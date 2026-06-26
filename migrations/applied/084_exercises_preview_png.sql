-- 084_exercises_preview_png.sql
-- Rasterized PNG (data URL) of the drill diagram, used for crisp/fixed-aspect rendering in prints and cards.
alter table public.exercises add column if not exists preview_png text;
comment on column public.exercises.preview_png is 'PNG data URL of the drill diagram (html2canvas of #plField), for print/cards.';
-- inherits existing exercises RLS.
