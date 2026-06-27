-- Migration 104: distinguish exercises drawn on the canvas from exercises whose
-- preview is an uploaded image ("From image" in the Drill Designer). Image drills
-- keep objects_json null and rely on preview_path only; everything else (dimensions,
-- series/work/rest, GPS mapping, Daily Planning projection) is identical. Idempotent.

alter table public.exercises
  add column if not exists source_type text not null default 'canvas';

alter table public.exercises
  drop constraint if exists exercises_source_type_check;

alter table public.exercises
  add constraint exercises_source_type_check
  check (source_type = any (array['canvas'::text, 'image'::text]));
