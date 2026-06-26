-- 085_drill_previews_storage.sql
-- Private Storage bucket for drill diagram previews + club-scoped RLS + a path column on exercises.

-- 1) Private bucket (not public → served via signed URLs)
insert into storage.buckets (id, name, public)
values ('drill-previews', 'drill-previews', false)
on conflict (id) do nothing;

-- 2) Path column on exercises (storage object path: '<club_id>/<exercise_id>.png')
alter table public.exercises add column if not exists preview_path text;
comment on column public.exercises.preview_path is 'Storage path in drill-previews bucket (<club_id>/<exercise_id>.png) for the drill diagram PNG.';

-- 3) RLS on storage.objects for this bucket — club members (by the first path folder = their club_id) can read/write
--    (storage.foldername(name))[1] is the first path segment = club_id.
drop policy if exists "drill_previews_select" on storage.objects;
create policy "drill_previews_select" on storage.objects for select
  using (
    bucket_id = 'drill-previews'
    and (storage.foldername(name))[1] in (select club_id::text from public.profiles where id = auth.uid())
  );

drop policy if exists "drill_previews_insert" on storage.objects;
create policy "drill_previews_insert" on storage.objects for insert
  with check (
    bucket_id = 'drill-previews'
    and (storage.foldername(name))[1] in (select club_id::text from public.profiles where id = auth.uid())
  );

drop policy if exists "drill_previews_update" on storage.objects;
create policy "drill_previews_update" on storage.objects for update
  using (
    bucket_id = 'drill-previews'
    and (storage.foldername(name))[1] in (select club_id::text from public.profiles where id = auth.uid())
  );

drop policy if exists "drill_previews_delete" on storage.objects;
create policy "drill_previews_delete" on storage.objects for delete
  using (
    bucket_id = 'drill-previews'
    and (storage.foldername(name))[1] in (select club_id::text from public.profiles where id = auth.uid())
  );
