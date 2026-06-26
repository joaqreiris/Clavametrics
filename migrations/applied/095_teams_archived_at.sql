-- Migration 095: soft-delete for teams. archived_at IS NULL = active; non-null = archived
-- (hidden from UI team lists, data fully preserved & reversible). Deleting a team hard was
-- blocked by FKs (seasons_team_id_fkey etc.) and would be destructive across ~15 tables,
-- so the workspace editor archives instead. No RLS / my_team_ids changes — archived teams
-- stay visible to admins for restore. Idempotent: safe to re-run.

alter table public.teams
  add column if not exists archived_at timestamptz;
