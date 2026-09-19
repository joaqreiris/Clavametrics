-- Respaldo COMPLETO de los layouts antes de convertir las cards clásicas en cards del builder.
-- La migración reescribe gps_dashboard_layouts de tres clubes: sin esta copia no hay vuelta atrás,
-- y son dashboards que la gente armó a mano.
create table if not exists gps_dashboard_layouts_respaldo_190 (
  respaldado_en timestamptz not null default now(),
  user_id uuid,
  club_id uuid,
  dashboard_id text,
  layout jsonb,
  updated_at timestamptz
);

insert into gps_dashboard_layouts_respaldo_190 (user_id, club_id, dashboard_id, layout, updated_at)
select user_id, club_id, dashboard_id, layout, updated_at from gps_dashboard_layouts;

-- Sólo el service role la toca: es una copia de seguridad, no un dato del producto.
alter table gps_dashboard_layouts_respaldo_190 enable row level security;

comment on table gps_dashboard_layouts_respaldo_190 is
  'Copia de gps_dashboard_layouts previa a la migración de cards clásicas → builder (sept 2026). Borrar cuando la migración lleve semanas estable.';
