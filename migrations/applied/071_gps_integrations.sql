-- =============================================================
-- Migration 071: Capa de conexión GPS (API-ready, provider-agnostic)
-- Deja ClavaMetrics listo para ingestar datos de Catapult/StatSports cuando
-- el club autorice. NO hace llamadas a APIs todavía: solo schema de conexión
-- + almacenamiento seguro de credenciales. El mapeo de atletas REUSA
-- players.external_gps_id (ya existe, mig 028). La ingesta llena gps_reports
-- (ya existe), igual que el CSV.
-- Depends on: clubs, players (028), get_user_club_id + set_updated_at (billing)
-- =============================================================

-- ── 1. Conexiones (metadata NO secreta, visible para el club) ──
create table if not exists public.gps_integrations (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references public.clubs(id) on delete cascade,
  provider            text not null check (provider in ('catapult','statsports')),
  status              text not null default 'pending'
                        check (status in ('pending','connected','error','disabled')),
  external_account_id text,                                 -- StatSports Team Id / OpenField org
  config              jsonb not null default '{}'::jsonb,   -- scopes, endpoints, team map, etc.
  connected_at        timestamptz,
  last_sync_at        timestamptz,
  last_error          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (club_id, provider)
);

create index if not exists idx_gps_integrations_club on public.gps_integrations(club_id);

alter table public.gps_integrations enable row level security;

drop policy if exists gps_int_club_all on public.gps_integrations;
create policy gps_int_club_all on public.gps_integrations
  for all to authenticated
  using (club_id = public.get_user_club_id())
  with check (club_id = public.get_user_club_id());

drop trigger if exists trg_gps_int_updated on public.gps_integrations;
create trigger trg_gps_int_updated before update on public.gps_integrations
  for each row execute function public.set_updated_at();

-- ── 2. Credenciales AISLADAS (service-role only) ──────────────
-- Tabla separada a propósito: el token = contraseña. Sin policies para
-- authenticated → nadie del cliente la lee. Solo backend/edge function
-- (service-role) y la función SECURITY DEFINER de abajo.
create table if not exists public.gps_integration_secrets (
  integration_id uuid primary key
                   references public.gps_integrations(id) on delete cascade,
  credential     text not null,
  set_at         timestamptz default now()
);

alter table public.gps_integration_secrets enable row level security;

-- ── 3. Setear / limpiar credencial sin exponerla ──────────────
create or replace function public.set_gps_credential(p_integration_id uuid, p_credential text)
returns void language plpgsql security definer set search_path = public as $$
declare v_club uuid;
begin
  select club_id into v_club from public.gps_integrations where id = p_integration_id;
  if v_club is null then raise exception 'integration not found'; end if;
  if v_club <> public.get_user_club_id() then raise exception 'not authorized'; end if;

  insert into public.gps_integration_secrets (integration_id, credential, set_at)
       values (p_integration_id, p_credential, now())
  on conflict (integration_id) do update set credential = excluded.credential, set_at = now();

  update public.gps_integrations
     set status = 'connected', connected_at = coalesce(connected_at, now()), updated_at = now()
   where id = p_integration_id;
end; $$;

create or replace function public.clear_gps_credential(p_integration_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_club uuid;
begin
  select club_id into v_club from public.gps_integrations where id = p_integration_id;
  if v_club is null then raise exception 'integration not found'; end if;
  if v_club <> public.get_user_club_id() then raise exception 'not authorized'; end if;

  delete from public.gps_integration_secrets where integration_id = p_integration_id;
  update public.gps_integrations
     set status = 'disabled', updated_at = now()
   where id = p_integration_id;
end; $$;

revoke all on function public.set_gps_credential(uuid, text) from public;
revoke all on function public.clear_gps_credential(uuid)     from public;
grant execute on function public.set_gps_credential(uuid, text) to authenticated;
grant execute on function public.clear_gps_credential(uuid)     to authenticated;
