-- =========================================================
-- 046 — Nutrition Module · sexo en nutrition_targets
-- Las fórmulas RMR (Ten-Haaf, Harris-Benedict, Mifflin) requieren sexo,
-- que no existe en `players`. Se guarda acá para poder recalcular fiel.
-- =========================================================

alter table public.nutrition_targets
  add column if not exists sex text
    check (sex in ('male','female'));
