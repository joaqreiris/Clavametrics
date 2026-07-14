-- 122_body_composition_anthropometry.sql
-- body_composition becomes the single source of truth for anthropometry:
-- raw skinfolds + girths + derived values (Siri %BF, somatotype, BMI/RFM).

-- Raw skinfolds (mm)
alter table public.body_composition add column if not exists sf_triceps      numeric;
alter table public.body_composition add column if not exists sf_subscapular  numeric;
alter table public.body_composition add column if not exists sf_biceps       numeric;
alter table public.body_composition add column if not exists sf_iliac_crest  numeric;
alter table public.body_composition add column if not exists sf_supraspinal  numeric;
alter table public.body_composition add column if not exists sf_abdominal    numeric;
alter table public.body_composition add column if not exists sf_thigh        numeric;
alter table public.body_composition add column if not exists sf_calf         numeric;
alter table public.body_composition add column if not exists sf_chest        numeric;
alter table public.body_composition add column if not exists sf_midaxillary  numeric;

-- Girths / breadths needed for Heath-Carter (cm)
alter table public.body_composition add column if not exists girth_arm_flexed numeric;
alter table public.body_composition add column if not exists girth_calf       numeric;
alter table public.body_composition add column if not exists breadth_humerus  numeric;
alter table public.body_composition add column if not exists breadth_femur    numeric;
alter table public.body_composition add column if not exists waist_cm         numeric;
alter table public.body_composition add column if not exists height_cm        numeric;

-- Context needed by the equations
alter table public.body_composition add column if not exists age_years  numeric;
alter table public.body_composition add column if not exists sex        text;
alter table public.body_composition drop constraint if exists body_composition_sex_check;
alter table public.body_composition add constraint body_composition_sex_check
  check (sex is null or sex in ('male','female'));

-- Derived values (computed by the app; stored so both pages read the same numbers)
alter table public.body_composition add column if not exists sf_formula   text;   -- 'JP3' | 'JP7' | 'DW4' | …
alter table public.body_composition add column if not exists sum_skinfolds numeric;
alter table public.body_composition add column if not exists bmi          numeric;
alter table public.body_composition add column if not exists rfm          numeric;
alter table public.body_composition add column if not exists soma_endo    numeric;
alter table public.body_composition add column if not exists soma_meso    numeric;
alter table public.body_composition add column if not exists soma_ecto    numeric;

comment on table public.body_composition is
  'Single source of truth for anthropometry: weigh-ins, skinfolds, girths and derived values (Siri %BF, BMI/RFM, Heath-Carter somatotype). Read by Nutrition and Evaluations.';
