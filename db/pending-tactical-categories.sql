-- Categorías tácticas renombrables y ampliables por equipo.
-- Aplicar en Supabase (SQL Editor). Es idempotente: se puede correr dos veces.

-- 1) La tabla. Sin filas para un equipo = usa las seis de fábrica (lib/tactical-cats.js).
create table if not exists public.tactical_categories (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  team_id uuid not null,
  key text not null,          -- 'offensive'… (fábrica) o 'c_<8hex>' (creada por el club)
  name text,                  -- NULL = nombre traducido de fábrica
  color text,                 -- tono de la paleta ('green','blue',…), no un hex
  position integer default 0 not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  constraint tactical_categories_pkey primary key (id),
  constraint tactical_categories_key_uq unique (club_id, team_id, key),
  constraint tactical_categories_key_check check (length(btrim(key)) > 0)
);
create index if not exists idx_tactical_categories_club_team
  on public.tactical_categories using btree (club_id, team_id);

alter table public.tactical_categories enable row level security;

drop policy if exists "tactical_categories_scoped" on public.tactical_categories;
create policy "tactical_categories_scoped" on public.tactical_categories as permissive for all to authenticated
  using ((club_id = get_user_club_id()) and (has_full_planning_access() or (team_id in (select my_team_ids()))))
  with check ((club_id = get_user_club_id()) and (has_full_planning_access() or (team_id in (select my_team_ids()))));

drop policy if exists "tactical_categories_super_all" on public.tactical_categories;
create policy "tactical_categories_super_all" on public.tactical_categories as permissive for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- 2) category deja de ser una lista cerrada de seis: ahora es la key de una categoría
--    del club. Sin FK porque las de fábrica no tienen fila propia.
alter table public.tactical_objectives drop constraint if exists tactical_objectives_category_check;
alter table public.tactical_objectives add constraint tactical_objectives_category_check
  check (length(btrim(category)) > 0);

alter table public.tactical_catalog drop constraint if exists tactical_catalog_category_check;
alter table public.tactical_catalog add constraint tactical_catalog_category_check
  check ((category is null) or (length(btrim(category)) > 0));

-- 3) Realtime: que un cambio de categoría llegue a los demás sin recargar.
alter table public.tactical_categories replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tactical_categories'
  ) then
    alter publication supabase_realtime add table public.tactical_categories;
  end if;
end $$;
