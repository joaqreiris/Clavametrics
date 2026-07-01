-- Migration 112: Clinical Record schema (historia clínica del jugador).
-- ─────────────────────────────────────────────────────────────────────────────
-- Capa CLÍNICA sensible del jugador, separada de lo operativo. NO duplica nada:
-- el Clinical Record LEE lesiones de `injuries`/`injury_phases` y sesiones de
-- `treatments`; acá vive solo lo que hoy no existe en ningún lado:
--   1. player_medical_profile  → base médica 1:1 (sangre, alergias, crónicas, revisión)
--   2. player_medications       → medicación / suplementos vigentes (+ flag TUE)
--   3. medical_screenings       → PCMA / cardíaco (ECG, eco, esfuerzo, visión, dental)
--   4. medical_episodes         → enfermedad no traumática + conmoción (SCAT/GRTP en jsonb)
--   5. surgeries                → antecedentes quirúrgicos
--   6. medical_studies          → imágenes y estudios (RMN, eco, RX, lab)
--   7. medical_documents        → informes, consentimientos, certificados de aptitud
--
-- Todo es club-scoped y queda gated por ROL MÉDICO vía has_medical_access()
-- (= physio / admin / owner / super-admin). Coach/S&C NO leen estas tablas: su
-- vista reducida (estado, disponibilidad, RTP) sale de injuries/availability, que
-- tienen su propia RLS más amplia. SELECT y escritura comparten el mismo gate por
-- tratarse de dato clínico sensible.
--
-- Idempotente: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Helper: acceso a datos clínicos ───────────────────────────────────────
-- Mismo molde que has_full_planning_access(), sumando 'physio' (= medical role).
create or replace function public.has_medical_access()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
      or exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('admin','owner','physio'));
$$;

comment on function public.has_medical_access() is
  'TRUE si el usuario puede ver/editar la historia clínica: super-admin o role in (admin,owner,physio).';


-- ── helper local: aplica la pareja de policies estándar a una tabla clínica ───
-- (no es una función SQL; el patrón se repite tabla por tabla más abajo para
--  mantener cada migración explícita y auditable, igual que el resto del repo).


-- ── 1. player_medical_profile (1:1 con players) ──────────────────────────────
create table if not exists public.player_medical_profile (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references public.clubs(id)   on delete cascade,
  player_id           uuid not null references public.players(id) on delete cascade,
  blood_type          text,                 -- 'O+', 'A-', …
  blood_phenotype     text,                 -- fenotipo extendido, p.ej. 'CcEe'
  allergies           jsonb not null default '[]'::jsonb,  -- [{substance,reaction,severity}]
  chronic_conditions  jsonb not null default '[]'::jsonb,  -- [{name,notes}]
  family_history      text,
  emergency_contact   jsonb,                -- {name,relation,phone}
  treating_physician  text,
  insurance           text,                 -- aseguradora / clínica de referencia
  last_review_date    date,
  next_review_date    date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by         uuid,
  unique (player_id)
);
create index if not exists idx_pmp_club   on public.player_medical_profile (club_id);
create index if not exists idx_pmp_player on public.player_medical_profile (player_id);

alter table public.player_medical_profile enable row level security;

drop policy if exists pmp_select on public.player_medical_profile;
create policy pmp_select on public.player_medical_profile
  for select to authenticated
  using (club_id = public.get_user_club_id() and public.has_medical_access());

drop policy if exists pmp_write on public.player_medical_profile;
create policy pmp_write on public.player_medical_profile
  for all to authenticated
  using      (club_id = public.get_user_club_id() and public.has_medical_access())
  with check (club_id = public.get_user_club_id() and public.has_medical_access());


-- ── 2. player_medications ────────────────────────────────────────────────────
create table if not exists public.player_medications (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id)   on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  name          text not null,
  dose          text,
  frequency     text,                       -- 'PRN', 'daily', 'BID', …
  reason        text,
  is_supplement boolean not null default false,
  tue           boolean not null default false,  -- exención terapéutica (antidoping)
  start_date    date,
  end_date      date,
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by         uuid
);
create index if not exists idx_pmed_club   on public.player_medications (club_id);
create index if not exists idx_pmed_player on public.player_medications (player_id, active);

alter table public.player_medications enable row level security;

drop policy if exists pmed_select on public.player_medications;
create policy pmed_select on public.player_medications
  for select to authenticated
  using (club_id = public.get_user_club_id() and public.has_medical_access());

drop policy if exists pmed_write on public.player_medications;
create policy pmed_write on public.player_medications
  for all to authenticated
  using      (club_id = public.get_user_club_id() and public.has_medical_access())
  with check (club_id = public.get_user_club_id() and public.has_medical_access());


-- ── 3. medical_screenings (PCMA / cardíaco / visión / dental) ─────────────────
create table if not exists public.medical_screenings (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id)   on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  type          text not null,              -- ecg | echo | stress_test | vision | dental | other
  performed_on  date,
  result        text,                       -- texto libre: 'Normal sinus rhythm', '20/20', …
  status        text not null default 'ok', -- semáforo
  next_due      date,
  doc_url       text,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by         uuid,
  constraint medical_screenings_type_check
    check (type   = any (array['ecg','echo','stress_test','vision','dental','other'])),
  constraint medical_screenings_status_check
    check (status = any (array['ok','warning','abnormal']))
);
create index if not exists idx_mscr_club   on public.medical_screenings (club_id);
create index if not exists idx_mscr_player on public.medical_screenings (player_id, type);

alter table public.medical_screenings enable row level security;

drop policy if exists mscr_select on public.medical_screenings;
create policy mscr_select on public.medical_screenings
  for select to authenticated
  using (club_id = public.get_user_club_id() and public.has_medical_access());

drop policy if exists mscr_write on public.medical_screenings;
create policy mscr_write on public.medical_screenings
  for all to authenticated
  using      (club_id = public.get_user_club_id() and public.has_medical_access())
  with check (club_id = public.get_user_club_id() and public.has_medical_access());


-- ── 4. medical_episodes (enfermedad no traumática + conmoción) ────────────────
-- Conmoción: baseline + retorno gradual (GRTP) van en `detail` jsonb, p.ej.
--   {"scat": {...}, "grtp": [{"step":1,"label":"Symptom-limited activity","done":true,"date":"…"}]}
create table if not exists public.medical_episodes (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id)   on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  category      text not null default 'illness',  -- illness | concussion | other
  system        text,                       -- respiratory | gi | dermatological | …
  diagnosis     text not null,
  start_date    date not null,
  end_date      date,
  days_lost     integer,
  status        text not null default 'active',   -- active | monitoring | resolved
  detail        jsonb,                      -- SCAT / GRTP / extras
  notes         text,
  created_at    timestamptz not null default now(),
  created_by         uuid,
  constraint medical_episodes_category_check
    check (category = any (array['illness','concussion','other'])),
  constraint medical_episodes_status_check
    check (status   = any (array['active','monitoring','resolved']))
);
create index if not exists idx_mepi_club   on public.medical_episodes (club_id);
create index if not exists idx_mepi_player on public.medical_episodes (player_id, start_date desc);

alter table public.medical_episodes enable row level security;

drop policy if exists mepi_select on public.medical_episodes;
create policy mepi_select on public.medical_episodes
  for select to authenticated
  using (club_id = public.get_user_club_id() and public.has_medical_access());

drop policy if exists mepi_write on public.medical_episodes;
create policy mepi_write on public.medical_episodes
  for all to authenticated
  using      (club_id = public.get_user_club_id() and public.has_medical_access())
  with check (club_id = public.get_user_club_id() and public.has_medical_access());


-- ── 5. surgeries (antecedentes quirúrgicos) ──────────────────────────────────
create table if not exists public.surgeries (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id)     on delete cascade,
  player_id          uuid not null references public.players(id)   on delete cascade,
  procedure          text not null,
  surgery_date       date,
  laterality         text default 'na',     -- left | right | bilateral | na
  surgeon            text,
  clinic             text,
  implants           text,
  outcome            text,
  related_injury_id  uuid references public.injuries(id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  constraint surgeries_laterality_check
    check (laterality = any (array['left','right','bilateral','na']))
);
create index if not exists idx_surg_club   on public.surgeries (club_id);
create index if not exists idx_surg_player on public.surgeries (player_id, surgery_date desc);

alter table public.surgeries enable row level security;

drop policy if exists surg_select on public.surgeries;
create policy surg_select on public.surgeries
  for select to authenticated
  using (club_id = public.get_user_club_id() and public.has_medical_access());

drop policy if exists surg_write on public.surgeries;
create policy surg_write on public.surgeries
  for all to authenticated
  using      (club_id = public.get_user_club_id() and public.has_medical_access())
  with check (club_id = public.get_user_club_id() and public.has_medical_access());


-- ── 6. medical_studies (imágenes y estudios) ─────────────────────────────────
create table if not exists public.medical_studies (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id)     on delete cascade,
  player_id          uuid not null references public.players(id)   on delete cascade,
  modality           text not null,         -- mri | ultrasound | xray | ct | lab | other
  study_date         date,
  body_area          text,
  finding            text,
  file_url           text,
  related_injury_id  uuid references public.injuries(id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  constraint medical_studies_modality_check
    check (modality = any (array['mri','ultrasound','xray','ct','lab','other']))
);
create index if not exists idx_mstu_club   on public.medical_studies (club_id);
create index if not exists idx_mstu_player on public.medical_studies (player_id, study_date desc);

alter table public.medical_studies enable row level security;

drop policy if exists mstu_select on public.medical_studies;
create policy mstu_select on public.medical_studies
  for select to authenticated
  using (club_id = public.get_user_club_id() and public.has_medical_access());

drop policy if exists mstu_write on public.medical_studies;
create policy mstu_write on public.medical_studies
  for all to authenticated
  using      (club_id = public.get_user_club_id() and public.has_medical_access())
  with check (club_id = public.get_user_club_id() and public.has_medical_access());


-- ── 7. medical_documents (informes / consentimientos / certificados) ─────────
create table if not exists public.medical_documents (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id)     on delete cascade,
  player_id     uuid not null references public.players(id)   on delete cascade,
  type          text not null default 'report',  -- report | consent | certificate | insurance | other
  title         text not null,
  file_path     text,                       -- path en bucket 'medical-documents' (<club_id>/<player_id>/<file>)
  doc_date      date,
  uploaded_by   uuid,
  notes         text,
  created_at    timestamptz not null default now(),
  constraint medical_documents_type_check
    check (type = any (array['report','consent','certificate','insurance','other']))
);
create index if not exists idx_mdoc_club   on public.medical_documents (club_id);
create index if not exists idx_mdoc_player on public.medical_documents (player_id, doc_date desc);

alter table public.medical_documents enable row level security;

drop policy if exists mdoc_select on public.medical_documents;
create policy mdoc_select on public.medical_documents
  for select to authenticated
  using (club_id = public.get_user_club_id() and public.has_medical_access());

drop policy if exists mdoc_write on public.medical_documents;
create policy mdoc_write on public.medical_documents
  for all to authenticated
  using      (club_id = public.get_user_club_id() and public.has_medical_access())
  with check (club_id = public.get_user_club_id() and public.has_medical_access());


-- ── 8. Storage bucket privado para documentos / estudios médicos ─────────────
-- Path: '<club_id>/<player_id>/<filename>'. (storage.foldername(name))[1] = club_id.
-- Doble gate: pertenencia al club (folder) Y rol médico.
insert into storage.buckets (id, name, public)
values ('medical-documents', 'medical-documents', false)
on conflict (id) do nothing;

drop policy if exists medical_docs_select on storage.objects;
create policy medical_docs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = public.get_user_club_id()::text
    and public.has_medical_access()
  );

drop policy if exists medical_docs_write on storage.objects;
create policy medical_docs_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = public.get_user_club_id()::text
    and public.has_medical_access()
  )
  with check (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = public.get_user_club_id()::text
    and public.has_medical_access()
  );

-- ── fin migración 112 ────────────────────────────────────────────────────────
