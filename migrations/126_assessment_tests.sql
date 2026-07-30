-- 126_assessment_tests.sql
-- Catálogo de tests de assessment (fuerza isométrica + movilidad) como DATO, no código,
-- + memoria de mapeo de columnas CSV para el importador de screening (formato ancho).
-- Los RESULTADOS siguen viviendo en force_tests + force_test_metrics (no hay tabla de resultados nueva).
-- Patrón RLS calcado de force_metric_definitions / force_column_mappings.

-- ── catálogo de tests (semillas globales club_id null + custom por club) ───────────────
create table if not exists public.assessment_test_defs (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid references public.clubs(id) on delete cascade,   -- null = semilla global
  family           text not null check (family in ('isometric','mobility')),
  key              text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  test_type        text not null,                        -- lo que se guarda en force_tests.test_type
  label            text not null,                        -- fallback en inglés
  i18n_key         text,
  metric_key       text not null default 'peak_force',   -- peak_force | rom | score
  unit             text not null default 'N',            -- N | ° | cm | score | +/-
  value_type       text not null default 'numeric' check (value_type in ('numeric','binary','score')),
  bilateral        boolean not null default true,
  higher_is_better boolean not null default true,
  min_value        numeric,
  max_value        numeric,
  thresholds       jsonb   not null default '{}'::jsonb,  -- {alert_below,watch_below} | {alert_above,watch_above} | {lsi_alert_below}
  asym_watch_pct   numeric,
  asym_alert_pct   numeric,
  reference        text,
  reference_url    text,
  evidence_level   text check (evidence_level in ('strong','moderate','practice')),
  aliases          text[] not null default '{}',         -- headers CSV: {'POST CH','POSTERIOR CHAIN','IPC'}
  sort_order       int  not null default 100,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists assessment_test_defs_global_key_uidx
  on public.assessment_test_defs (key) where club_id is null;
create unique index if not exists assessment_test_defs_club_key_uidx
  on public.assessment_test_defs (club_id, key) where club_id is not null;
create index if not exists assessment_test_defs_family_idx
  on public.assessment_test_defs (family, sort_order);

-- ── memoria de mapeo de columnas CSV → (test, lado) ────────────────────────────────────
create table if not exists public.assessment_column_maps (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  source_label       text not null default 'screening',
  source_column_name text not null,
  test_key           text not null,
  side               text check (side in ('L','R')),
  updated_at         timestamptz not null default now(),
  unique (club_id, source_label, source_column_name)
);
create index if not exists idx_assessment_col_map_club
  on public.assessment_column_maps using btree (club_id);

-- ── RLS: assessment_test_defs (calca force_metric_definitions) ─────────────────────────
alter table public.assessment_test_defs enable row level security;
create policy "assessment_test_defs select" on public.assessment_test_defs as permissive for select to public
  using (((club_id is null) or (club_id in ( select profiles.club_id
     from profiles
    where (profiles.id = auth.uid())))));
create policy "assessment_test_defs write club" on public.assessment_test_defs as permissive for all to public
  using ((club_id in ( select profiles.club_id
     from profiles
    where (profiles.id = auth.uid()))))
  with check ((club_id in ( select profiles.club_id
     from profiles
    where (profiles.id = auth.uid()))));
create policy "assessment_test_defs super admin" on public.assessment_test_defs as permissive for all to public
  using (is_super_admin())
  with check (is_super_admin());

-- ── RLS: assessment_column_maps (calca force_column_mappings) ──────────────────────────
alter table public.assessment_column_maps enable row level security;
create policy "assessment_col_map club" on public.assessment_column_maps as permissive for all to public
  using ((club_id in ( select profiles.club_id
     from profiles
    where (profiles.id = auth.uid()))))
  with check ((club_id in ( select profiles.club_id
     from profiles
    where (profiles.id = auth.uid()))));
create policy "assessment_col_map super admin" on public.assessment_column_maps as permissive for all to public
  using (is_super_admin())
  with check (is_super_admin());

-- ── Semillas globales (club_id null). ON CONFLICT sobre el índice único parcial ─────────
-- Familia isometric: galga/dinamómetro, peak_force en N, bilateral, mayor es mejor, asim 10/15.
insert into public.assessment_test_defs
  (club_id, family, key, test_type, label, i18n_key, metric_key, unit, value_type,
   bilateral, higher_is_better, thresholds, asym_watch_pct, asym_alert_pct,
   reference, evidence_level, aliases, sort_order)
values
  (null,'isometric','iso_post_chain_30','ISO · Posterior chain 30°','ISO · Posterior chain 30°',
   'evaluations.test_iso_post_chain_30','peak_force','N','numeric',true,true,
   '{}'::jsonb,10,15,
   'Asimetría >10-15% como bandera; sin corte absoluto validado para IPC 30°. Leer junto a delta vs baseline propio.',
   'practice','{POST CH,POSTERIOR CHAIN,IPC,PC}',10),

  (null,'isometric','iso_knee_ext_90','ISO · Knee extension 90°','ISO · Knee extension 90°',
   'evaluations.test_iso_knee_ext_90','peak_force','N','numeric',true,true,
   '{"lsi_alert_below":90}'::jsonb,10,15,
   'Grindem et al. BJSM 2016; Kyritsis et al. BJSM 2016 — LSI <90% en criterios de RTS.',
   'strong','{QUAD,QUADS,KNEE EXT}',20),

  (null,'isometric','iso_hip_add_0','ISO · Hip adduction 0°','ISO · Hip adduction 0°',
   'evaluations.test_iso_hip_add_0','peak_force','N','numeric',true,true,
   '{}'::jsonb,10,15,
   'Thorborg et al. AJSM 2010 — ratio add:abd ipsilateral >0,90 como referencia de recuperación; grupo con dolor inguinal 0,80 ± 0,14.',
   'strong','{ADD,ADDUCTION,SQUEEZE}',30),

  (null,'isometric','iso_hip_abd_0','ISO · Hip abduction 0°','ISO · Hip abduction 0°',
   'evaluations.test_iso_hip_abd_0','peak_force','N','numeric',true,true,
   '{}'::jsonb,10,15,
   'Thorborg et al. AJSM 2010 — ratio add:abd ipsilateral >0,90 como referencia de recuperación; grupo con dolor inguinal 0,80 ± 0,14.',
   'strong','{ABD,ABDUCTION}',40),

  (null,'isometric','iso_shoulder_er','ISO · Shoulder ER','ISO · Shoulder ER',
   'evaluations.test_iso_shoulder_er','peak_force','N','numeric',true,true,
   '{}'::jsonb,10,15,
   'Ellenbecker & Davies, J Athl Train 2000 — ratio ER:IR 0,66-0,75.',
   'moderate','{SH EXT,SHOULDER ER,ER}',50),

  (null,'isometric','iso_shoulder_ir','ISO · Shoulder IR','ISO · Shoulder IR',
   'evaluations.test_iso_shoulder_ir','peak_force','N','numeric',true,true,
   '{}'::jsonb,10,15,
   'Ellenbecker & Davies, J Athl Train 2000 — ratio ER:IR 0,66-0,75.',
   'moderate','{SH INT,SHOULDER IR,IR}',60)
on conflict (key) where club_id is null do nothing;

-- Familia mobility.
insert into public.assessment_test_defs
  (club_id, family, key, test_type, label, i18n_key, metric_key, unit, value_type,
   bilateral, higher_is_better, min_value, max_value, thresholds, asym_watch_pct, asym_alert_pct,
   reference, evidence_level, aliases, sort_order)
values
  (null,'mobility','mob_ankle_df','MOB · Ankle dorsiflexion','MOB · Ankle dorsiflexion',
   'evaluations.test_mob_ankle_df','rom','°','numeric',true,true,null,null,
   '{"alert_below":34,"watch_below":38}'::jsonb,10,15,
   'Hoch & McKeon 2011 (asimetría normal 0,1 ± 1,5 cm); ~34° asociado a mayor riesgo de lesión. Si el club mide en cm: alert <10 cm, watch <11 cm.',
   'moderate','{ANKLE,ANKLE DF,WBLT,LUNGE}',10),

  (null,'mobility','mob_hip_ir','MOB · Hip internal rotation','MOB · Hip internal rotation',
   'evaluations.test_mob_hip_ir','rom','°','numeric',true,true,null,null,
   '{}'::jsonb,null,null,
   'Regla combinada IR+ER <80° total → revisar movilidad de cadera.',
   'practice','{INT ROT,HIP IR,IR CADERA}',20),

  (null,'mobility','mob_hip_er','MOB · Hip external rotation','MOB · Hip external rotation',
   'evaluations.test_mob_hip_er','rom','°','numeric',true,true,null,null,
   '{}'::jsonb,null,null,
   'Regla combinada IR+ER <80° total → revisar movilidad de cadera.',
   'practice','{EXT ROT,HIP ER}',30),

  (null,'mobility','mob_aslr','MOB · ASLR','MOB · ASLR',
   'evaluations.test_mob_aslr','rom','°','numeric',true,true,null,null,
   '{"alert_below":70,"watch_below":80}'::jsonb,null,null,
   'Basado en práctica clínica; sin corte prospectivo fuerte en fútbol.',
   'practice','{ASLR,SLR,LEG RAISE}',40),

  (null,'mobility','mob_thomas','MOB · Thomas test','MOB · Thomas test',
   'evaluations.test_mob_thomas','score','+/-','binary',true,false,null,null,
   '{}'::jsonb,null,null,
   'Thomas test — positivo = restricción de flexores de cadera.',
   'practice','{THOMAS,THPOMAS}',50),

  (null,'mobility','mob_hypermobility','MOB · Beighton','MOB · Beighton',
   'evaluations.test_mob_hypermobility','score','score','score',true,false,0,9,
   '{"watch_above":4}'::jsonb,null,null,
   'Beighton et al. 1973; criterios Malfait et al. 2017 — ≥5/9 = hiperlaxitud generalizada.',
   'strong','{HYPERLAX,BEIGHTON,GJH}',60)
on conflict (key) where club_id is null do nothing;

-- ── Verificación ───────────────────────────────────────────────────────────────────────
-- select family, count(*) from public.assessment_test_defs where club_id is null group by family;
--   -> isometric 6, mobility 6
-- select key, test_type, unit, aliases from public.assessment_test_defs where club_id is null order by family, sort_order;
-- select tablename, policyname from pg_policies where tablename in ('assessment_test_defs','assessment_column_maps');
