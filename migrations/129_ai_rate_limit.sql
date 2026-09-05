-- Migration 129: rate limit por club para las Edge Functions que gastan cuota externa.
-- generate-gym-plan y tag-exercise pegan a la API de Anthropic, youtube-import a la cuota
-- de YouTube Data v3. Sin tope, un loop desde cualquier sesión válida agota la cuenta.
--
-- Principio de diseño: **el contador tiene que quedar fuera del alcance del cliente**. Un
-- contador que el propio usuario puede modificar no es un límite. De ahí las tres piezas:
--
--   * `ai_usage_events` tiene RLS habilitada y CERO policies → deny-all para anon y
--     authenticated (mismo patrón que `gps_integration_secrets`). Nadie la lee ni la
--     escribe con el JWT del usuario. NO agregarle policies.
--   * `ai_rate_limit_take()` es SECURITY DEFINER: cuenta e inserta en la misma
--     transacción, con un advisory lock por (club, fn) para que dos llamadas
--     simultáneas no lean el mismo contador y pasen las dos.
--   * Los límites viven acá, no en el parámetro que manda la Edge Function: se ajustan
--     con un CREATE OR REPLACE, sin redeploy de las funciones.
--
-- Las Edge Functions cortan fail-closed: si el chequeo no se puede hacer, no se gasta
-- cuota externa.
--
-- `ai_card_generations` queda solo como audit log (qué prompt produjo qué config);
-- generate-card pasa a contar por esta misma función.
--
-- Aditiva y reversible: drop de la tabla + la función deshace todo.

-- ── Contador ────────────────────────────────────────────────────────────────
create table if not exists public.ai_usage_events (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  fn         text not null,
  created_at timestamptz not null default now()
);

comment on table public.ai_usage_events is
  'Contador de llamadas a Edge Functions con cuota externa (Anthropic, YouTube). '
  'RLS sin policies a propósito: solo lo toca ai_rate_limit_take() (SECURITY DEFINER). '
  'No agregar policies: el contador tiene que quedar fuera del alcance del cliente.';

alter table public.ai_usage_events enable row level security;
-- Sin policies: deny-all para anon/authenticated. service_role y SECURITY DEFINER pasan.

-- La ventana es siempre "últimas 24 h" para un (club, fn) → índice que cubre el count.
create index if not exists idx_ai_usage_events_club_fn_time
  on public.ai_usage_events (club_id, fn, created_at desc);

-- ── Toma de cupo ────────────────────────────────────────────────────────────
create or replace function public.ai_rate_limit_take(p_fn text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  uuid;
  v_limit int;
  v_used  int;
begin
  -- Límites diarios por club. Ajustar acá (CREATE OR REPLACE), no en las funciones.
  v_limit := case p_fn
    when 'generate-card'     then 20   -- Sonnet, 1 card por llamada
    when 'generate-gym-plan' then 20   -- Sonnet, 1 sesión por llamada
    when 'tag-exercise'      then 60   -- Haiku, hasta 30 ejercicios por llamada (~1800/día)
    when 'youtube-import'    then 30   -- hasta 6 unidades de cuota YouTube por llamada
    else null
  end;

  if v_limit is null then
    raise exception 'ai_rate_limit_take: fn desconocida %', p_fn
      using errcode = 'invalid_parameter_value';
  end if;

  select club_id into v_club from public.profiles where id = auth.uid();
  if v_club is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_club', 'used', 0, 'limit', v_limit);
  end if;

  -- Serializa los concurrentes del mismo (club, fn): sin esto, N llamadas simultáneas
  -- leen el mismo count y pasan todas. Se libera al terminar la transacción.
  perform pg_advisory_xact_lock(hashtextextended(v_club::text || ':' || p_fn, 0));

  select count(*) into v_used
    from public.ai_usage_events
   where club_id = v_club
     and fn = p_fn
     and created_at >= now() - interval '24 hours';

  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'used', v_used, 'limit', v_limit);
  end if;

  insert into public.ai_usage_events (club_id, user_id, fn)
  values (v_club, auth.uid(), p_fn);

  return jsonb_build_object('allowed', true, 'used', v_used + 1, 'limit', v_limit);
end;
$$;

comment on function public.ai_rate_limit_take(text) is
  'Consume una unidad de cupo diario del club para la Edge Function p_fn. '
  'Devuelve {allowed, used, limit, reason?}. La llaman las Edge Functions con el JWT '
  'del usuario; si devuelve allowed=false hay que cortar antes de pegarle a la API externa.';

-- Solo usuarios logueados. anon no tiene nada que hacer acá (B1 del audit).
revoke all on function public.ai_rate_limit_take(text) from public;
revoke all on function public.ai_rate_limit_take(text) from anon;
grant execute on function public.ai_rate_limit_take(text) to authenticated;
