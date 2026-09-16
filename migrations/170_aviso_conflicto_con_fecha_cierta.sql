-- Migración 170: el aviso de conflicto necesita fecha cierta, no "un período".
--
-- El texto que ve el club tiene efectos jurídicos: es una manifestación del declarante en
-- la que el club se apoya para contratar. "Durante un período de carencia" no es oponible;
-- "hasta el 30 de junio de 2027" sí. Se añaden el plazo y la fecha calculada de fin de la
-- inhabilitación para que la pantalla pueda decirla.
--
-- Hay que DROP: cambiar las columnas de salida no se puede con CREATE OR REPLACE.

drop function if exists public.support_conflict_notice(uuid);

create function public.support_conflict_notice(p_club_id uuid)
returns table (
  admin_email    text,
  country        text,
  started_on     date,
  ended_on       date,
  cooloff_months integer,
  blocked_until  date,
  note           text
)
language sql stable security definer set search_path to 'public'
as $$
  select p.email, e.country, e.started_on, e.ended_on, e.cooloff_months,
         case when e.ended_on is null then null
              else (e.ended_on + make_interval(months => e.cooloff_months))::date end,
         e.note
  from public.platform_admin_engagements e
  join public.profiles p on p.id = e.admin_user_id
  where public.support_conflict(e.admin_user_id, p_club_id)
  order by e.started_on desc;
$$;

grant execute on function public.support_conflict_notice(uuid) to authenticated;
