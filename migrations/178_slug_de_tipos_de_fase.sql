-- Migración 178: los tipos de fase de fábrica se pueden traducir.
--
-- `phase_types` trae cinco presets compartidos por todos los clubes (club_id null):
-- Preseason, In-season, Off-season, Break, FIFA break. El nombre está guardado en
-- inglés y el Planificador anual lo pintaba tal cual, así que un club que trabaja en
-- español creaba sus fases con nombres en inglés. Y no se puede traducir la fila: es
-- la MISMA para todos los clubes, cada uno en su idioma.
--
-- Se añade `slug`, que es lo estable, y la traducción vive en el front
-- (annual_planner.phase_<slug>). Los tipos que crea un club son suyos y se muestran
-- como los escribió: ahí no hay nada que traducir.

alter table public.phase_types add column if not exists slug text;

update public.phase_types set slug = case name
  when 'Preseason'  then 'preseason'
  when 'In-season'  then 'in_season'
  when 'Off-season' then 'off_season'
  when 'Break'      then 'break'
  when 'FIFA break' then 'fifa_break'
end
where is_preset = true and slug is null;

-- Único entre los presets: dos presets con el mismo slug se pisarían la traducción.
-- Los tipos propios de un club no llevan slug, así que quedan fuera del índice.
create unique index if not exists phase_types_preset_slug_idx
  on public.phase_types (slug) where is_preset = true and slug is not null;

comment on column public.phase_types.slug is
  'Clave estable de los presets, para traducirlos en el front (annual_planner.phase_<slug>). '
  'Null en los tipos creados por un club: esos se muestran con el nombre que les puso.';
