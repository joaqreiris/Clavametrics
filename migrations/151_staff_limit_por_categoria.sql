-- ============================================================================
-- 151 — Las plazas de staff se suman por categoría de pago, no se toma el máximo
-- ============================================================================
--
-- Cómo estaba: club_staff_limit() hacía max(pl.max_staff) sobre las categorías
-- del club. Es decir, el tope de staff era el del mejor plan contratado y NO
-- crecía al contratar más categorías.
--
-- El problema: el precio es por categoría. Un club con cinco categorías en
-- Basic pagaba cinco veces 60 USD y seguía teniendo cuatro plazas de staff
-- para todo el club — y cinco categorías suelen significar cinco cuerpos
-- técnicos. El cliente que más pagaba era el primero en quedarse sin sitio.
--
-- Cómo queda: se suman las plazas de las categorías DE PAGO. Dos Basic pasan a
-- ser 8 plazas en vez de 4; Basic + Professional, 10 en vez de 6.
--
-- Las categorías gratuitas no suman, y esto es deliberado: team_plan_slug()
-- devuelve 'initiation' para toda categoría sin suscripción, así que sumarlas
-- convertía "crear categorías vacías" en una forma de regalarse plazas de
-- staff. El club conserva como suelo las plazas del tier gratuito.
--
-- Una sola categoría en Full (max_staff null) sigue dejando el club entero sin
-- tope, igual que antes.
--
-- Nadie pierde plazas: sum(pagadas) >= max(pagadas) siempre, y el suelo del
-- tier gratuito cubre el caso de un club sin nada contratado.
-- ============================================================================

create or replace function public.club_staff_limit(p_club_id uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare n integer;
begin
  perform public.assert_my_club(p_club_id);
  select case
    -- Una categoría ilimitada abre el club entero.
    when bool_or(pl.max_staff is null) then null
    else greatest(
      -- Suelo: lo que da el tier gratuito, aunque no haya nada contratado.
      coalesce((select max_staff from public.plans where slug = 'initiation'), 2),
      -- Las de pago suman. Las gratuitas no, o crear categorías vacías sería
      -- una forma de conseguir plazas sin pagarlas.
      coalesce(sum(pl.max_staff) filter (where pl.slug <> 'initiation'), 0)
    )
  end into n
  from public.teams t
  join public.plans pl on pl.slug = public.team_plan_slug(t.id)
  where t.club_id = p_club_id;

  -- OJO: aquí no va un coalesce. n = null significa "ilimitado" (hay una
  -- categoría en Full), y taparlo con un valor por defecto le pondría tope a
  -- quien pagó por no tenerlo. El club sin categorías ya está cubierto: la
  -- agregación siempre devuelve una fila, bool_or da null, el CASE cae al
  -- ELSE y greatest() deja el suelo del tier gratuito.
  return n;
end;
$$;

revoke execute on function public.club_staff_limit(uuid) from public, anon;
grant  execute on function public.club_staff_limit(uuid) to authenticated, service_role;
