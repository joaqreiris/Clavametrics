-- Migración 172: el club puede renunciar al veto por conflicto, caso por caso.
--
-- Cambio de criterio respecto de la 168. Antes la plataforma decidía por el club que no le
-- convenía recibir soporte de alguien en conflicto. La alternativa era prometer en el
-- contrato una persona no conflictuada que para Camboya hoy no existe: los dos únicos
-- administradores ejercen en esa liga. Prometer eso era prometer de más.
--
-- Ahora se le cuenta el conflicto y decide él. Cuatro condiciones para que esto no vacíe
-- la garantía, que es el riesgo evidente:
--   1. Es un acto DISTINTO de abrir la puerta. Un permiso normal NO levanta el veto; hay
--      que pedir la renuncia explícitamente. Si fueran lo mismo, la garantía se diluiría
--      sola en el uso diario.
--   2. Va pegada a ESE permiso y caduca con él. No es un ajuste permanente que se marca
--      una vez y se olvida.
--   3. Sólo nace del club (is_club_manager). El admin en conflicto no la puede pedir ni
--      crear: no hay ningún RPC que se lo permita.
--   4. Deja un evento propio, 'conflict_waived', en el registro inalterable, para que al
--      leer el historial se distinga de una autorización corriente.
--
-- El veto MANUAL (support_restrictions) sigue siendo absoluto y no admite renuncia por esta
-- vía: para eso el club ya tiene la de borrar esa fila, que sólo él puede hacer.

alter table public.support_grants
  add column if not exists conflict_waived boolean not null default false,
  add column if not exists waiver_reason text;

comment on column public.support_grants.conflict_waived is
  'El club renuncio expresamente al veto por conflicto de interes declarado, solo para este '
  'permiso y mientras dure. Nunca lo puede activar el propio admin en conflicto.';

alter table public.platform_access_log drop constraint if exists platform_access_log_event_check;
alter table public.platform_access_log add constraint platform_access_log_event_check
  check (event in ('grant_opened','grant_revoked','session_opened','session_closed',
                   'resource_viewed','conflict_waived'));

create or replace function public.support_club_id()
returns uuid
language sql stable security definer set search_path to 'public'
as $$
  select s.club_id
  from public.support_sessions s
  join public.support_grants  g on g.id = s.grant_id
  where s.admin_user_id = auth.uid()
    and s.expires_at > now()
    and g.expires_at > now()
    and g.revoked_at is null
    and g.club_id = s.club_id
    and exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid())
    -- el veto nominal del club es absoluto: no admite renuncia por esta vía
    and not exists (
      select 1 from public.support_restrictions r
      where r.club_id = s.club_id and r.admin_user_id = auth.uid()
    )
    -- el veto por conflicto declarado cae sólo si ESTE permiso lleva renuncia expresa
    and (g.conflict_waived or not public.support_conflict(auth.uid(), s.club_id))
  limit 1;
$$;

drop function if exists public.support_grant_open(uuid, integer, text);

create function public.support_grant_open(
  p_club_id uuid,
  p_hours integer default 24,
  p_reason text default null,
  p_waive_conflict boolean default false,
  p_waiver_reason text default null
) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid; v_hours integer; v_waive boolean; v_hay_conflicto boolean;
begin
  if not public.is_club_manager(p_club_id) then
    raise exception 'solo un admin u owner del club puede autorizar soporte';
  end if;
  v_hours := least(greatest(coalesce(p_hours, 24), 1), 168);
  v_waive := coalesce(p_waive_conflict, false);

  if v_waive then
    -- Renunciar a un veto que no existe deja ruido en el historial del club: se rechaza.
    select exists (
      select 1 from public.platform_admin_engagements e
      where public.support_conflict(e.admin_user_id, p_club_id)
    ) into v_hay_conflicto;
    if not coalesce(v_hay_conflicto, false) then
      raise exception 'no hay ningun conflicto declarado que afecte a este club';
    end if;
    -- Una renuncia sin motivo no sirve para nada seis meses despues.
    if coalesce(btrim(p_waiver_reason), '') = '' then
      raise exception 'para renunciar al veto hay que dejar constancia del motivo';
    end if;
  end if;

  insert into public.support_grants (club_id, granted_by, reason, expires_at,
                                     conflict_waived, waiver_reason)
  values (p_club_id, auth.uid(), p_reason, now() + make_interval(hours => v_hours),
          v_waive, case when v_waive then btrim(p_waiver_reason) end)
  returning id into v_id;

  perform public.support_log(p_club_id, 'grant_opened', null,
    jsonb_build_object('grant_id', v_id, 'hours', v_hours, 'reason', p_reason));

  if v_waive then
    perform public.support_log(p_club_id, 'conflict_waived', null,
      jsonb_build_object('grant_id', v_id, 'motivo', btrim(p_waiver_reason),
                         'hasta', now() + make_interval(hours => v_hours)));
  end if;
  return v_id;
end;
$$;

grant execute on function public.support_grant_open(uuid, integer, text, boolean, text) to authenticated;

create or replace function public.support_session_open(p_club_id uuid, p_reason text)
returns timestamptz language plpgsql security definer set search_path to 'public' as $$
declare v_grant uuid; v_grant_exp timestamptz; v_exp timestamptz; v_waived boolean;
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'no sos admin de plataforma';
  end if;
  if coalesce(p_reason, '') = '' then
    raise exception 'hay que declarar un motivo para entrar a un club';
  end if;
  if exists (select 1 from public.support_restrictions
             where club_id = p_club_id and admin_user_id = auth.uid()) then
    raise exception 'tenes acceso vetado a este club por conflicto de interes';
  end if;

  -- si hay varias ventanas vivas, gana la que lleva renuncia
  select id, expires_at, conflict_waived into v_grant, v_grant_exp, v_waived
  from public.support_grants
  where club_id = p_club_id and revoked_at is null and expires_at > now()
  order by conflict_waived desc, expires_at desc limit 1;

  if v_grant is null then
    raise exception 'este club no tiene una ventana de soporte abierta';
  end if;

  if public.support_conflict(auth.uid(), p_club_id) and not coalesce(v_waived, false) then
    raise exception 'tenes acceso vetado a este club: declaraste que ejerces en su pais. El club puede autorizarlo expresamente desde su panel si lo considera';
  end if;

  v_exp := least(v_grant_exp, now() + interval '2 hours');
  insert into public.support_sessions (admin_user_id, club_id, grant_id, reason, opened_at, expires_at)
  values (auth.uid(), p_club_id, v_grant, p_reason, now(), v_exp)
  on conflict (admin_user_id) do update
    set club_id = excluded.club_id, grant_id = excluded.grant_id,
        reason = excluded.reason, opened_at = now(), expires_at = excluded.expires_at;
  perform public.support_log(p_club_id, 'session_opened', null,
    jsonb_build_object('reason', p_reason, 'expires_at', v_exp, 'con_renuncia', coalesce(v_waived,false)));
  return v_exp;
end;
$$;

drop function if exists public.support_conflict_notice(uuid);

create function public.support_conflict_notice(p_club_id uuid)
returns table (
  admin_email    text,
  country        text,
  started_on     date,
  ended_on       date,
  cooloff_months integer,
  blocked_until  date,
  note           text,
  waived_until   timestamptz,
  waiver_reason  text
)
language sql stable security definer set search_path to 'public'
as $$
  select p.email, e.country, e.started_on, e.ended_on, e.cooloff_months,
         case when e.ended_on is null then null
              else (e.ended_on + make_interval(months => e.cooloff_months))::date end,
         e.note,
         w.expires_at, w.waiver_reason
  from public.platform_admin_engagements e
  join public.profiles p on p.id = e.admin_user_id
  left join lateral (
    select g.expires_at, g.waiver_reason
    from public.support_grants g
    where g.club_id = p_club_id and g.conflict_waived
      and g.revoked_at is null and g.expires_at > now()
    order by g.expires_at desc limit 1
  ) w on true
  where public.support_conflict(e.admin_user_id, p_club_id)
  order by e.started_on desc;
$$;

grant execute on function public.support_conflict_notice(uuid) to authenticated;
