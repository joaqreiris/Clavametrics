-- Migración 168: el conflicto de interés se DECLARA, no se lista a mano.
--
-- La 163 dejó support_restrictions: un veto club por club. Sirve, pero se pudre. Se carga
-- hoy con los clubes de la liga donde trabaja el fundador y en marzo se da de alta el
-- noveno: nadie se acuerda, ese club queda expuesto, y el día que se descubre no importa
-- que haya sido un olvido — parece deliberado.
--
-- Aquí se invierte: el admin declara DÓNDE TRABAJA (país, que clubs ya guarda) y de eso se
-- deduce el veto. Un club nuevo de ese país nace vetado, sin que nadie haga nada.
--
-- Tres reglas que hacen que la declaración valga algo:
--   1. Es pública: cualquier usuario autenticado la puede leer. Ese es el punto — una
--      declaración secreta no tranquiliza a nadie.
--   2. No se puede borrar ni ablandar. Se puede cerrar (ended_on) pero no borrar, no
--      acortar hacia atrás, no reabrir, y no bajar el enfriamiento. Un trigger lo impide.
--   3. Irse de la liga no abre la puerta el mismo día: quedan `cooloff_months` (12 por
--      defecto) de enfriamiento. Lo que te llevaste sigue sirviendo un tiempo.
--
-- El club empleador queda EXCEPTUADO: es donde trabajás, tenés que poder entrar. Esa
-- excepción se declara explícitamente y se registra en el log del club afectado, para que
-- no sea una puerta trasera silenciosa.

-- ------------------------------------------------------------------ 1. tablas

create table if not exists public.platform_admin_engagements (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid not null references public.profiles(id) on delete cascade,
  country        text not null,                    -- se compara contra clubs.country
  note           text,
  started_on     date not null default current_date,
  ended_on       date,                             -- null = sigue trabajando ahí
  cooloff_months integer not null default 12,
  created_at     timestamptz not null default now(),
  constraint engagements_cooloff_check check (cooloff_months between 0 and 120),
  constraint engagements_dates_check   check (ended_on is null or ended_on >= started_on)
);
create index if not exists engagements_admin_idx
  on public.platform_admin_engagements (admin_user_id, country);

comment on table public.platform_admin_engagements is
  'Dónde ejerce cada admin de plataforma. De aquí se DEDUCE el veto: todo club de ese país '
  'queda fuera de su alcance, salvo su empleador declarado. Pública a propósito.';

-- El club (o clubes) donde trabaja, que son la excepción al veto de su propio país.
create table if not exists public.platform_admin_employers (
  engagement_id uuid not null references public.platform_admin_engagements(id) on delete cascade,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (engagement_id, club_id)
);

-- --------------------------------------------- 2. no se puede ablandar ni borrar

create or replace function public.engagements_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'una declaracion de conflicto no se borra: se cierra con ended_on';
  end if;
  if new.admin_user_id is distinct from old.admin_user_id
     or new.country    is distinct from old.country
     or new.started_on is distinct from old.started_on then
    raise exception 'no se puede reescribir a quien, donde ni desde cuando';
  end if;
  if old.ended_on is not null and new.ended_on is null then
    raise exception 'una declaracion cerrada no se reabre';
  end if;
  if old.ended_on is not null and new.ended_on < old.ended_on then
    raise exception 'no se puede adelantar la fecha de salida ya declarada';
  end if;
  if new.cooloff_months < old.cooloff_months then
    raise exception 'no se puede acortar el periodo de enfriamiento';
  end if;
  return new;
end;
$$;

drop trigger if exists engagements_no_softening on public.platform_admin_engagements;
create trigger engagements_no_softening
  before update or delete on public.platform_admin_engagements
  for each row execute function public.engagements_immutable();

-- Declararse empleado de un club es la única forma de exceptuarse del veto, así que no
-- puede ser silenciosa: queda en el registro que ESE club lee.
create or replace function public.employers_log()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare v_admin uuid; v_pais text;
begin
  select e.admin_user_id, e.country into v_admin, v_pais
  from public.platform_admin_engagements e where e.id = new.engagement_id;
  insert into public.platform_access_log (club_id, actor_id, actor_email, event, resource, detail)
  values (new.club_id, v_admin,
          (select email from public.profiles where id = v_admin),
          'session_opened', 'conflicto:empleador_declarado',
          jsonb_build_object('pais', v_pais, 'nota',
            'este admin declaro que trabaja en este club, por eso queda exceptuado del veto del pais'));
  return new;
end;
$$;

drop trigger if exists employers_log_trg on public.platform_admin_employers;
create trigger employers_log_trg
  after insert on public.platform_admin_employers
  for each row execute function public.employers_log();

-- ------------------------------------------------------------- 3. el veto derivado

-- ¿Este admin tiene conflicto declarado con este club?
-- Nunca devuelve NULL: si algo no se sabe, el guard tiene que cortar, no dudar.
create or replace function public.support_conflict(p_admin uuid, p_club_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(exists (
    select 1
    from public.platform_admin_engagements e
    join public.clubs c on c.id = p_club_id
    where e.admin_user_id = p_admin
      and c.country is not null
      and lower(btrim(c.country)) = lower(btrim(e.country))
      -- vigente, o todavía dentro del enfriamiento posterior a la salida
      and (e.ended_on is null
           or (e.ended_on + make_interval(months => e.cooloff_months)) > current_date)
      -- salvo que ese club sea su empleador declarado
      and not exists (
        select 1 from public.platform_admin_employers em
        where em.engagement_id = e.id and em.club_id = p_club_id
      )
  ), false);
$$;

comment on function public.support_conflict(uuid, uuid) is
  'Veto DEDUCIDO de la declaracion de donde trabaja el admin. Un club nuevo del mismo pais '
  'nace vetado sin que nadie lo agregue a ninguna lista.';

-- Se enchufa en el guard central: a partir de aquí, conflicto declarado == puerta cerrada,
-- aunque el club haya abierto la ventana y no exista ninguna fila en support_restrictions.
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
    and not exists (
      select 1 from public.support_restrictions r
      where r.club_id = s.club_id and r.admin_user_id = auth.uid()
    )
    and not public.support_conflict(auth.uid(), s.club_id)
  limit 1;
$$;

-- Y en la puerta de entrada, para que el error diga la verdad en vez de "no hay ventana".
create or replace function public.support_session_open(p_club_id uuid, p_reason text)
returns timestamptz language plpgsql security definer set search_path to 'public' as $$
declare v_grant uuid; v_grant_exp timestamptz; v_exp timestamptz;
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
  if public.support_conflict(auth.uid(), p_club_id) then
    raise exception 'tenes acceso vetado a este club: declaraste que ejerces en su pais';
  end if;
  select id, expires_at into v_grant, v_grant_exp
  from public.support_grants
  where club_id = p_club_id and revoked_at is null and expires_at > now()
  order by expires_at desc limit 1;
  if v_grant is null then
    raise exception 'este club no tiene una ventana de soporte abierta';
  end if;
  v_exp := least(v_grant_exp, now() + interval '2 hours');
  insert into public.support_sessions (admin_user_id, club_id, grant_id, reason, opened_at, expires_at)
  values (auth.uid(), p_club_id, v_grant, p_reason, now(), v_exp)
  on conflict (admin_user_id) do update
    set club_id = excluded.club_id, grant_id = excluded.grant_id,
        reason = excluded.reason, opened_at = now(), expires_at = excluded.expires_at;
  perform public.support_log(p_club_id, 'session_opened', null,
    jsonb_build_object('reason', p_reason, 'expires_at', v_exp));
  return v_exp;
end;
$$;

-- Lo que el club ve en su panel: "declaró que ejerce en tu país, así que no puede entrar".
create or replace function public.support_conflict_notice(p_club_id uuid)
returns table (admin_email text, country text, started_on date, ended_on date, note text)
language sql stable security definer set search_path to 'public'
as $$
  select p.email, e.country, e.started_on, e.ended_on, e.note
  from public.platform_admin_engagements e
  join public.profiles p on p.id = e.admin_user_id
  where public.support_conflict(e.admin_user_id, p_club_id)
  order by e.started_on desc;
$$;

-- ------------------------------------------------------------------- 4. RLS

alter table public.platform_admin_engagements enable row level security;
alter table public.platform_admin_employers   enable row level security;

-- Públicas a propósito: una declaración de conflicto que nadie puede leer no sirve de nada.
drop policy if exists engagements_read on public.platform_admin_engagements;
create policy engagements_read on public.platform_admin_engagements
  for select to authenticated using (true);

drop policy if exists employers_read on public.platform_admin_employers;
create policy employers_read on public.platform_admin_employers
  for select to authenticated using (true);

revoke all on public.platform_admin_engagements, public.platform_admin_employers
  from anon, authenticated;
grant select on public.platform_admin_engagements, public.platform_admin_employers to authenticated;

grant execute on function public.support_conflict(uuid, uuid)     to authenticated;
grant execute on function public.support_conflict_notice(uuid)    to authenticated;
