-- 054_gym_session_templates.sql
-- Plantillas reutilizables de sesión de gym (para el botón "Load template" del Gym Planner).
-- content (JSONB) guarda la misma forma que gym_content pero solo el entrenamiento
-- ({ warmup, plyo, main }) — sin adaptaciones (son por jugador) ni metadata del día.
-- Scoped por club. Idempotente. Reutiliza helpers get_user_club_id() / set_updated_at().

create table if not exists public.gym_session_templates (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  content     jsonb,                 -- { warmup:{min,rows}, plyo:{...}, main:{...} }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_gym_templates_club on public.gym_session_templates(club_id);

drop trigger if exists trg_gym_templates_updated_at on public.gym_session_templates;
create trigger trg_gym_templates_updated_at
  before update on public.gym_session_templates
  for each row execute function public.set_updated_at();

alter table public.gym_session_templates enable row level security;

drop policy if exists gym_session_templates_rw on public.gym_session_templates;
create policy gym_session_templates_rw on public.gym_session_templates
  for all to authenticated
  using      (club_id = public.get_user_club_id())
  with check (club_id = public.get_user_club_id());
