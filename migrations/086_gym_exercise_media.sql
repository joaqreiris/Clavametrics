-- 086_gym_exercise_media.sql
-- Optional per-exercise media for gym exercises: uploaded image/GIF (private Storage) or a YouTube video. Fallback = initials.

-- 1) Columns on gym_exercises
alter table public.gym_exercises add column if not exists media_type text;   -- 'image' (Storage file png/gif) | 'youtube' | null
alter table public.gym_exercises add column if not exists media_ref  text;   -- image: storage path '<club>/<id>.<ext>' · youtube: video id or url
alter table public.gym_exercises drop constraint if exists gym_exercises_media_type_check;
alter table public.gym_exercises add constraint gym_exercises_media_type_check
  check (media_type is null or media_type in ('image','youtube'));
comment on column public.gym_exercises.media_type is 'image (Storage png/gif) | youtube | null (initials fallback).';
comment on column public.gym_exercises.media_ref  is 'image: storage path in gym-exercise-media bucket; youtube: video id/url.';

-- 2) Private bucket for uploaded gym media
insert into storage.buckets (id, name, public) values ('gym-exercise-media','gym-exercise-media', false)
on conflict (id) do nothing;

-- 3) Club-scoped RLS on storage.objects for the bucket (first path folder = club_id)
drop policy if exists "gym_media_select" on storage.objects;
create policy "gym_media_select" on storage.objects for select using (
  bucket_id = 'gym-exercise-media'
  and (storage.foldername(name))[1] in (select club_id::text from public.profiles where id = auth.uid()));
drop policy if exists "gym_media_insert" on storage.objects;
create policy "gym_media_insert" on storage.objects for insert with check (
  bucket_id = 'gym-exercise-media'
  and (storage.foldername(name))[1] in (select club_id::text from public.profiles where id = auth.uid()));
drop policy if exists "gym_media_update" on storage.objects;
create policy "gym_media_update" on storage.objects for update using (
  bucket_id = 'gym-exercise-media'
  and (storage.foldername(name))[1] in (select club_id::text from public.profiles where id = auth.uid()));
drop policy if exists "gym_media_delete" on storage.objects;
create policy "gym_media_delete" on storage.objects for delete using (
  bucket_id = 'gym-exercise-media'
  and (storage.foldername(name))[1] in (select club_id::text from public.profiles where id = auth.uid()));
