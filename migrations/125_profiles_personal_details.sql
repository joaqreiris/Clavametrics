-- 125_profiles_personal_details.sql
-- Personal profile fields for staff/users + onboarding flag. full_name stays as the display name
-- (kept in sync from first+last); avatar_url already exists (reused for the profile photo).
--
-- Idempotent. Does NOT drop/rename existing columns (full_name, avatar_url, role, club_role,
-- settings, notification_settings stay). Team assignment (member_teams) is NOT touched here.

-- 1) Personal columns (no-op if they already exist)
alter table public.profiles add column if not exists first_name     text;
alter table public.profiles add column if not exists last_name      text;
alter table public.profiles add column if not exists phone          text;
alter table public.profiles add column if not exists birth_date     date;
alter table public.profiles add column if not exists job_title      text;    -- visible role/title (free text, distinct from the app 'role')
alter table public.profiles add column if not exists preferred_lang text;    -- 'en' | 'es' | 'pt' — ties into the i18n cm_lang system
alter table public.profiles add column if not exists onboarded      boolean not null default false;

-- 2) preferred_lang constrained to the three supported locales (nullable = "not chosen yet")
alter table public.profiles drop constraint if exists profiles_preferred_lang_check;
alter table public.profiles add constraint profiles_preferred_lang_check
  check (preferred_lang is null or preferred_lang in ('en','es','pt'));

-- 3) Backfill onboarded=true for users who ALREADY have a real name, so existing users
--    aren't forced through onboarding.
update public.profiles set onboarded = true
  where onboarded = false and coalesce(nullif(trim(full_name),''), null) is not null;

comment on column public.profiles.onboarded is
  'False until the user completes first-login onboarding (name required). Gates access to the app.';

-- 4) Private Storage bucket for profile photos + RLS.
--    Users manage their OWN avatar (folder named after their auth uid); reads are open at the
--    storage layer and gated further at the app level (kept simple + club-safe).
insert into storage.buckets (id, name, public) values ('profile-avatars','profile-avatars', false)
  on conflict (id) do nothing;

-- owner can write/update/delete under a folder named after their auth uid; anyone can read.
drop policy if exists profile_avatars_read on storage.objects;
create policy profile_avatars_read on storage.objects for select
  using ( bucket_id = 'profile-avatars' );   -- (read gated further at app level; keep simple + club-safe)

drop policy if exists profile_avatars_write on storage.objects;
create policy profile_avatars_write on storage.objects for insert
  with check ( bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists profile_avatars_update on storage.objects;
create policy profile_avatars_update on storage.objects for update
  using ( bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists profile_avatars_delete on storage.objects;
create policy profile_avatars_delete on storage.objects for delete
  using ( bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text );
