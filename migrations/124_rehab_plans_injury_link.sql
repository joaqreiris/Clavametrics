-- 124_rehab_plans_injury_link.sql
-- Link a rehab plan to the injury it rehabilitates (nullable: preventive plans have none).
--
-- NOTE: rehab_plans.injury_id and its FK already exist in the live schema, but the FK was
-- created WITHOUT ON DELETE SET NULL and there was no supporting index. This migration is
-- idempotent and brings both to the intended state:
--   * FK with ON DELETE SET NULL — deleting an injury unlinks its plan, never deletes it.
--   * an index on injury_id.
-- Existing rows are untouched (injury_id stays null for plans not linked to an injury).

-- 1) Column (no-op if it already exists)
alter table public.rehab_plans add column if not exists injury_id uuid;

-- 2) FK → injuries(id) with ON DELETE SET NULL (drop+recreate to fix the delete action idempotently)
alter table public.rehab_plans drop constraint if exists rehab_plans_injury_id_fkey;
alter table public.rehab_plans add constraint rehab_plans_injury_id_fkey
  foreign key (injury_id) references public.injuries(id) on delete set null;

-- 3) Index
create index if not exists rehab_plans_injury_id_idx on public.rehab_plans(injury_id);

comment on column public.rehab_plans.injury_id is
  'The injury this rehab plan rehabilitates (null for preventive plans). Phases are copied from injury_phases into programme_phases at plan creation as an editable base.';
