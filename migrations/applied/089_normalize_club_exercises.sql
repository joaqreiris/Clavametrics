-- ============================================================
-- MIGRATION 088: Normalize club-created exercises + alias table
-- Fills canonical tokens for CLUB rows (is_default = false) from their
-- existing free-text (equipment, muscle_group, category). Best-effort and
-- deterministic: what cannot be resolved is left NULL (= "needs tagging",
-- to be completed later by a coach or the AI import).
-- movement_patterns / contraction / speed / plane / myofascial have NO
-- source column, so they stay NULL for club rows by design.
--
-- The alias dictionary is GENERATED FROM lib/exercise-taxonomy.js — it is
-- not hand-maintained here. taxonomy_aliases also seeds the future
-- learned-alias loop (club-scoped rows get added there later).
-- Additive + idempotent. Run in Supabase SQL Editor AFTER 086 and 087.
-- ============================================================

-- ── 1. Normalizer — mirrors the lib's norm() (no extension needed) ──
CREATE OR REPLACE FUNCTION cm_norm(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        translate(lower(coalesce(t,'')),
          'áàäâãéèëêíìïîóòöôõúùüûñçº',
          'aaaaaeeeeiiiiooooouuuunco'),
        '[-_/]+', ' ', 'g'),
      '\s+', ' ', 'g')
  );
$$;

-- ── 2. Global alias dictionary (also the learned-alias seed) ─────────
CREATE TABLE IF NOT EXISTS taxonomy_aliases (
  dimension text NOT NULL,
  alias     text NOT NULL,   -- already normalized via cm_norm
  token     text NOT NULL,
  PRIMARY KEY (dimension, alias)
);
ALTER TABLE taxonomy_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone authenticated can read taxonomy_aliases" ON taxonomy_aliases;
CREATE POLICY "Anyone authenticated can read taxonomy_aliases"
  ON taxonomy_aliases FOR SELECT TO authenticated USING (true);

INSERT INTO taxonomy_aliases (dimension, alias, token) VALUES
  ('purpose', 'rise temperature', 'rise_temperature'),
  ('purpose', 'warm up', 'rise_temperature'),
  ('purpose', 'warmup', 'rise_temperature'),
  ('purpose', 'raise', 'rise_temperature'),
  ('purpose', 'ramp', 'rise_temperature'),
  ('purpose', 'mobility', 'rise_temperature'),
  ('purpose', 'entrada en calor', 'rise_temperature'),
  ('purpose', 'calentamiento', 'rise_temperature'),
  ('purpose', 'movilidad', 'rise_temperature'),
  ('purpose', 'aquecimento', 'rise_temperature'),
  ('purpose', 'release', 'release'),
  ('purpose', 'liberacion', 'release'),
  ('purpose', 'soft tissue', 'release'),
  ('purpose', 'foam rolling', 'release'),
  ('purpose', 'smr', 'release'),
  ('purpose', 'elongacion', 'release'),
  ('purpose', 'soltura', 'release'),
  ('purpose', 'liberacao', 'release'),
  ('purpose', 'activation', 'activation'),
  ('purpose', 'activacion', 'activation'),
  ('purpose', 'primer', 'activation'),
  ('purpose', 'glute activation', 'activation'),
  ('purpose', 'ativacao', 'activation'),
  ('purpose', 'power', 'power'),
  ('purpose', 'potencia', 'power'),
  ('purpose', 'explosividad', 'power'),
  ('purpose', 'rfd', 'power'),
  ('purpose', 'strength', 'strength'),
  ('purpose', 'fuerza', 'strength'),
  ('purpose', 'forca', 'strength'),
  ('purpose', 'conditioning', 'conditioning'),
  ('purpose', 'acondicionamiento', 'conditioning'),
  ('purpose', 'metabolic', 'conditioning'),
  ('purpose', 'energy systems', 'conditioning'),
  ('purpose', 'cardio', 'conditioning'),
  ('purpose', 'condicionamento', 'conditioning'),
  ('purpose', 'prevention', 'prevention'),
  ('purpose', 'prevencion', 'prevention'),
  ('purpose', 'prehab', 'prevention'),
  ('purpose', 'preventive', 'prevention'),
  ('purpose', 'propiocepcion', 'prevention'),
  ('purpose', 'equilibrio', 'prevention'),
  ('purpose', 'balance', 'prevention'),
  ('purpose', 'prevencao', 'prevention'),
  ('purpose', 'cooldown', 'cooldown'),
  ('purpose', 'vuelta a la calma', 'cooldown'),
  ('purpose', 'cool down', 'cooldown'),
  ('purpose', 'recovery', 'cooldown'),
  ('purpose', 'recuperacion', 'cooldown'),
  ('purpose', 'volta a calma', 'cooldown'),
  ('equipment', 'bodyweight', 'bodyweight'),
  ('equipment', 'none', 'bodyweight'),
  ('equipment', 'no equipment', 'bodyweight'),
  ('equipment', 'peso corporal', 'bodyweight'),
  ('equipment', 'sin material', 'bodyweight'),
  ('equipment', 'barbell', 'barbell'),
  ('equipment', 'barra', 'barbell'),
  ('equipment', 'dumbbell', 'dumbbell'),
  ('equipment', 'dumbbells', 'dumbbell'),
  ('equipment', 'db', 'dumbbell'),
  ('equipment', 'mancuerna', 'dumbbell'),
  ('equipment', 'mancuernas', 'dumbbell'),
  ('equipment', 'kettlebell', 'kettlebell'),
  ('equipment', 'kb', 'kettlebell'),
  ('equipment', 'pesa rusa', 'kettlebell'),
  ('equipment', 'trap bar', 'trap_bar'),
  ('equipment', 'hex bar', 'trap_bar'),
  ('equipment', 'barra hexagonal', 'trap_bar'),
  ('equipment', 'band', 'band'),
  ('equipment', 'resistance band', 'band'),
  ('equipment', 'banda', 'band'),
  ('equipment', 'mini band', 'mini_band'),
  ('equipment', 'loop band', 'mini_band'),
  ('equipment', 'mini banda', 'mini_band'),
  ('equipment', 'banda circular', 'mini_band'),
  ('equipment', 'cable', 'cable'),
  ('equipment', 'polea', 'cable'),
  ('equipment', 'pulley', 'cable'),
  ('equipment', 'conical pulley', 'conical_pulley'),
  ('equipment', 'polea conica', 'conical_pulley'),
  ('equipment', 'versapulley', 'conical_pulley'),
  ('equipment', 'flywheel', 'flywheel'),
  ('equipment', 'inertial', 'flywheel'),
  ('equipment', 'yoyo', 'flywheel'),
  ('equipment', 'yo yo', 'flywheel'),
  ('equipment', 'yoyo squat', 'flywheel'),
  ('equipment', 'kbox', 'flywheel'),
  ('equipment', 'inercial', 'flywheel'),
  ('equipment', 'isoinercial', 'flywheel'),
  ('equipment', 'bench', 'bench'),
  ('equipment', 'banco', 'bench'),
  ('equipment', 'box', 'box'),
  ('equipment', 'cajon', 'box'),
  ('equipment', 'plyo box', 'plyo_box'),
  ('equipment', 'cajon pliometrico', 'plyo_box'),
  ('equipment', 'plyobox', 'plyo_box'),
  ('equipment', 'step', 'step'),
  ('equipment', 'escalon', 'step'),
  ('equipment', 'wall', 'wall'),
  ('equipment', 'pared', 'wall'),
  ('equipment', 'pull up bar', 'pull_up_bar'),
  ('equipment', 'barra de dominadas', 'pull_up_bar'),
  ('equipment', 'chin up bar', 'pull_up_bar'),
  ('equipment', 'sled', 'sled'),
  ('equipment', 'trineo', 'sled'),
  ('equipment', 'prowler', 'sled'),
  ('equipment', 'med ball', 'med_ball'),
  ('equipment', 'medicine ball', 'med_ball'),
  ('equipment', 'balon medicinal', 'med_ball'),
  ('equipment', 'foam roller', 'foam_roller'),
  ('equipment', 'rodillo', 'foam_roller'),
  ('equipment', 'foam', 'foam_roller'),
  ('equipment', 'swiss ball', 'swiss_ball'),
  ('equipment', 'fitball', 'swiss_ball'),
  ('equipment', 'stability ball', 'swiss_ball'),
  ('equipment', 'pelota suiza', 'swiss_ball'),
  ('equipment', 'bosu', 'bosu'),
  ('equipment', 'bosu ball', 'bosu'),
  ('equipment', 'wobble board', 'wobble_board'),
  ('equipment', 'balance board', 'wobble_board'),
  ('equipment', 'tabla de equilibrio', 'wobble_board'),
  ('equipment', 'ab wheel', 'ab_wheel'),
  ('equipment', 'rueda abdominal', 'ab_wheel'),
  ('equipment', 'sliders', 'sliders'),
  ('equipment', 'discos deslizantes', 'sliders'),
  ('equipment', 'valslides', 'sliders'),
  ('equipment', 'rower', 'rower'),
  ('equipment', 'remo', 'rower'),
  ('equipment', 'rowing erg', 'rower'),
  ('equipment', 'bike', 'bike'),
  ('equipment', 'assault bike', 'bike'),
  ('equipment', 'watt bike', 'bike'),
  ('equipment', 'bici', 'bike'),
  ('equipment', 'bicicleta', 'bike'),
  ('equipment', 'ski erg', 'ski_erg'),
  ('equipment', 'skierg', 'ski_erg'),
  ('equipment', 'ski', 'ski_erg'),
  ('equipment', 'treadmill', 'treadmill'),
  ('equipment', 'cinta', 'treadmill'),
  ('equipment', 'caminadora', 'treadmill'),
  ('equipment', 'battle ropes', 'battle_ropes'),
  ('equipment', 'ropes', 'battle_ropes'),
  ('equipment', 'sogas', 'battle_ropes'),
  ('equipment', 'cuerdas', 'battle_ropes'),
  ('equipment', 'cones', 'cones'),
  ('equipment', 'conos', 'cones'),
  ('equipment', 'hurdles', 'hurdles'),
  ('equipment', 'vallas', 'hurdles'),
  ('equipment', 'mini hurdles', 'mini_hurdles'),
  ('equipment', 'wickets', 'mini_hurdles'),
  ('equipment', 'mini vallas', 'mini_hurdles'),
  ('equipment', 'agility ladder', 'agility_ladder'),
  ('equipment', 'ladder', 'agility_ladder'),
  ('equipment', 'escalera de agilidad', 'agility_ladder'),
  ('equipment', 'escalera', 'agility_ladder'),
  ('equipment', 'pad', 'pad'),
  ('equipment', 'colchoneta', 'pad'),
  ('equipment', 'almohadilla', 'pad'),
  ('equipment', 'partner', 'partner'),
  ('equipment', 'companion', 'partner'),
  ('equipment', 'companero', 'partner'),
  ('equipment', 'companera', 'partner'),
  ('equipment', 'manual resistance', 'partner'),
  ('muscle_group', 'quadriceps', 'quadriceps'),
  ('muscle_group', 'quads', 'quadriceps'),
  ('muscle_group', 'cuadriceps', 'quadriceps'),
  ('muscle_group', 'hamstrings', 'hamstrings'),
  ('muscle_group', 'isquios', 'hamstrings'),
  ('muscle_group', 'isquiosurales', 'hamstrings'),
  ('muscle_group', 'isquiotibiales', 'hamstrings'),
  ('muscle_group', 'glutes', 'glutes'),
  ('muscle_group', 'glute max', 'glutes'),
  ('muscle_group', 'gluteo mayor', 'glutes'),
  ('muscle_group', 'gluteo', 'glutes'),
  ('muscle_group', 'glute med', 'glute_med'),
  ('muscle_group', 'gluteus medius', 'glute_med'),
  ('muscle_group', 'gluteo medio', 'glute_med'),
  ('muscle_group', 'adductors', 'adductors'),
  ('muscle_group', 'aductores', 'adductors'),
  ('muscle_group', 'groin', 'adductors'),
  ('muscle_group', 'ingle', 'adductors'),
  ('muscle_group', 'hip flexors', 'hip_flexors'),
  ('muscle_group', 'flexores de cadera', 'hip_flexors'),
  ('muscle_group', 'psoas', 'hip_flexors'),
  ('muscle_group', 'calves', 'calves'),
  ('muscle_group', 'gastrocnemius', 'calves'),
  ('muscle_group', 'gemelos', 'calves'),
  ('muscle_group', 'soleus', 'soleus'),
  ('muscle_group', 'soleo', 'soleus'),
  ('muscle_group', 'tibialis anterior', 'tibialis_anterior'),
  ('muscle_group', 'tibial', 'tibialis_anterior'),
  ('muscle_group', 'tibialis', 'tibialis_anterior'),
  ('muscle_group', 'tibial anterior', 'tibialis_anterior'),
  ('muscle_group', 'chest', 'chest'),
  ('muscle_group', 'pecs', 'chest'),
  ('muscle_group', 'pectoral', 'chest'),
  ('muscle_group', 'pectorales', 'chest'),
  ('muscle_group', 'shoulders', 'shoulders'),
  ('muscle_group', 'deltoids', 'shoulders'),
  ('muscle_group', 'deltoides', 'shoulders'),
  ('muscle_group', 'hombro', 'shoulders'),
  ('muscle_group', 'hombros', 'shoulders'),
  ('muscle_group', 'lats', 'lats'),
  ('muscle_group', 'latissimus', 'lats'),
  ('muscle_group', 'dorsal', 'lats'),
  ('muscle_group', 'dorsales', 'lats'),
  ('muscle_group', 'upper back', 'upper_back'),
  ('muscle_group', 'espalda alta', 'upper_back'),
  ('muscle_group', 'mid back', 'upper_back'),
  ('muscle_group', 'lower traps', 'lower_traps'),
  ('muscle_group', 'trapecio inferior', 'lower_traps'),
  ('muscle_group', 'rotator cuff', 'rotator_cuff'),
  ('muscle_group', 'cuff', 'rotator_cuff'),
  ('muscle_group', 'manguito rotador', 'rotator_cuff'),
  ('muscle_group', 'manguito', 'rotator_cuff'),
  ('muscle_group', 'serratus', 'serratus'),
  ('muscle_group', 'serrato', 'serratus'),
  ('muscle_group', 'biceps', 'biceps'),
  ('muscle_group', 'triceps', 'triceps'),
  ('muscle_group', 'forearm', 'forearm'),
  ('muscle_group', 'grip', 'forearm'),
  ('muscle_group', 'antebrazo', 'forearm'),
  ('muscle_group', 'agarre', 'forearm'),
  ('muscle_group', 'core', 'core'),
  ('muscle_group', 'abs', 'core'),
  ('muscle_group', 'abdominals', 'core'),
  ('muscle_group', 'abdominales', 'core'),
  ('muscle_group', 'obliques', 'obliques'),
  ('muscle_group', 'oblicuos', 'obliques'),
  ('muscle_group', 'ql', 'ql'),
  ('muscle_group', 'quadratus lumborum', 'ql'),
  ('muscle_group', 'cuadrado lumbar', 'ql'),
  ('muscle_group', 'erectors', 'erectors'),
  ('muscle_group', 'spinal erectors', 'erectors'),
  ('muscle_group', 'erector spinae', 'erectors'),
  ('muscle_group', 'erectores', 'erectors'),
  ('muscle_group', 'lumbares', 'erectors'),
  ('movement_pattern', 'horizontal push', 'horizontal_push'),
  ('movement_pattern', 'empuje horizontal', 'horizontal_push'),
  ('movement_pattern', 'press', 'horizontal_push'),
  ('movement_pattern', 'bench press', 'horizontal_push'),
  ('movement_pattern', 'vertical push', 'vertical_push'),
  ('movement_pattern', 'empuje vertical', 'vertical_push'),
  ('movement_pattern', 'overhead press', 'vertical_push'),
  ('movement_pattern', 'shoulder press', 'vertical_push'),
  ('movement_pattern', 'horizontal pull', 'horizontal_pull'),
  ('movement_pattern', 'traccion horizontal', 'horizontal_pull'),
  ('movement_pattern', 'row', 'horizontal_pull'),
  ('movement_pattern', 'remo', 'horizontal_pull'),
  ('movement_pattern', 'vertical pull', 'vertical_pull'),
  ('movement_pattern', 'traccion vertical', 'vertical_pull'),
  ('movement_pattern', 'pull up', 'vertical_pull'),
  ('movement_pattern', 'pulldown', 'vertical_pull'),
  ('movement_pattern', 'squat', 'squat'),
  ('movement_pattern', 'sentadilla', 'squat'),
  ('movement_pattern', 'hinge', 'hinge'),
  ('movement_pattern', 'bisagra', 'hinge'),
  ('movement_pattern', 'hip hinge', 'hinge'),
  ('movement_pattern', 'deadlift', 'hinge'),
  ('movement_pattern', 'peso muerto', 'hinge'),
  ('movement_pattern', 'lunge', 'lunge'),
  ('movement_pattern', 'zancada', 'lunge'),
  ('movement_pattern', 'split squat', 'lunge'),
  ('movement_pattern', 'estocada', 'lunge'),
  ('movement_pattern', 'single leg', 'single_leg'),
  ('movement_pattern', 'unilateral', 'single_leg'),
  ('movement_pattern', 'monopodal', 'single_leg'),
  ('movement_pattern', 'carry', 'carry'),
  ('movement_pattern', 'loaded carry', 'carry'),
  ('movement_pattern', 'transporte', 'carry'),
  ('movement_pattern', 'acarreo', 'carry'),
  ('movement_pattern', 'rotation', 'rotation'),
  ('movement_pattern', 'rotacion', 'rotation'),
  ('movement_pattern', 'rotacional', 'rotation'),
  ('movement_pattern', 'anti rotation', 'anti_rotation'),
  ('movement_pattern', 'anti rotacion', 'anti_rotation'),
  ('movement_pattern', 'pallof', 'anti_rotation'),
  ('movement_pattern', 'anti extension', 'anti_extension'),
  ('movement_pattern', 'plank', 'anti_extension'),
  ('movement_pattern', 'plancha', 'anti_extension'),
  ('movement_pattern', 'anti lateral flexion', 'anti_lateral_flexion'),
  ('movement_pattern', 'anti flexion lateral', 'anti_lateral_flexion'),
  ('movement_pattern', 'suitcase', 'anti_lateral_flexion'),
  ('movement_pattern', 'side plank', 'anti_lateral_flexion'),
  ('movement_pattern', 'jump', 'jump'),
  ('movement_pattern', 'salto', 'jump'),
  ('movement_pattern', 'jumping', 'jump'),
  ('movement_pattern', 'landing', 'landing'),
  ('movement_pattern', 'aterrizaje', 'landing'),
  ('movement_pattern', 'deceleration', 'landing'),
  ('movement_pattern', 'frenado', 'landing'),
  ('movement_pattern', 'locomotion', 'locomotion'),
  ('movement_pattern', 'sprint', 'locomotion'),
  ('movement_pattern', 'gait', 'locomotion'),
  ('movement_pattern', 'carrera', 'locomotion'),
  ('movement_pattern', 'run', 'locomotion'),
  ('movement_pattern', 'skip', 'locomotion'),
  ('movement_pattern', 'marcha', 'locomotion'),
  ('movement_pattern', 'isometric hold', 'isometric_hold'),
  ('movement_pattern', 'hold estatico', 'isometric_hold'),
  ('movement_pattern', 'wall sit', 'isometric_hold'),
  ('movement_pattern', 'sentadilla isometrica', 'isometric_hold'),
  ('myofascial_chain', 'superficial back line', 'superficial_back_line'),
  ('myofascial_chain', 'sbl', 'superficial_back_line'),
  ('myofascial_chain', 'cadena posterior', 'superficial_back_line'),
  ('myofascial_chain', 'linea posterior superficial', 'superficial_back_line'),
  ('myofascial_chain', 'linha posterior', 'superficial_back_line'),
  ('myofascial_chain', 'superficial front line', 'superficial_front_line'),
  ('myofascial_chain', 'sfl', 'superficial_front_line'),
  ('myofascial_chain', 'cadena anterior', 'superficial_front_line'),
  ('myofascial_chain', 'linea anterior superficial', 'superficial_front_line'),
  ('myofascial_chain', 'linha anterior', 'superficial_front_line'),
  ('myofascial_chain', 'lateral line', 'lateral_line'),
  ('myofascial_chain', 'll', 'lateral_line'),
  ('myofascial_chain', 'linea lateral', 'lateral_line'),
  ('myofascial_chain', 'cadena lateral', 'lateral_line'),
  ('myofascial_chain', 'spiral line', 'spiral_line'),
  ('myofascial_chain', 'spl', 'spiral_line'),
  ('myofascial_chain', 'linea espiral', 'spiral_line'),
  ('myofascial_chain', 'deep front line', 'deep_front_line'),
  ('myofascial_chain', 'dfl', 'deep_front_line'),
  ('myofascial_chain', 'linea profunda anterior', 'deep_front_line'),
  ('myofascial_chain', 'core line', 'deep_front_line'),
  ('myofascial_chain', 'nucleo', 'deep_front_line'),
  ('myofascial_chain', 'functional lines', 'functional_lines'),
  ('myofascial_chain', 'fl', 'functional_lines'),
  ('myofascial_chain', 'lineas funcionales', 'functional_lines'),
  ('myofascial_chain', 'front functional', 'functional_lines'),
  ('myofascial_chain', 'back functional', 'functional_lines'),
  ('myofascial_chain', 'arm lines', 'arm_lines'),
  ('myofascial_chain', 'al', 'arm_lines'),
  ('myofascial_chain', 'lineas del brazo', 'arm_lines'),
  ('contraction_type', 'concentric', 'concentric'),
  ('contraction_type', 'concentrica', 'concentric'),
  ('contraction_type', 'eccentric', 'eccentric'),
  ('contraction_type', 'excentrica', 'eccentric'),
  ('contraction_type', 'eccentrics', 'eccentric'),
  ('contraction_type', 'negatives', 'eccentric'),
  ('contraction_type', 'isometric', 'isometric'),
  ('contraction_type', 'isometrica', 'isometric'),
  ('contraction_type', 'iso hold', 'iso_hold'),
  ('contraction_type', 'hold', 'iso_hold'),
  ('contraction_type', 'sosten isometrico', 'iso_hold'),
  ('contraction_type', 'isometric hold', 'iso_hold'),
  ('contraction_type', 'natera', 'iso_hold'),
  ('contraction_type', 'iso push', 'iso_push'),
  ('contraction_type', 'overcoming', 'iso_push'),
  ('contraction_type', 'empuje isometrico', 'iso_push'),
  ('contraction_type', 'iso catch', 'iso_catch'),
  ('contraction_type', 'yielding', 'iso_catch'),
  ('contraction_type', 'catch', 'iso_catch'),
  ('contraction_type', 'frenado', 'iso_catch'),
  ('contraction_type', 'contencion', 'iso_catch'),
  ('contraction_type', 'isotonic', 'isotonic'),
  ('contraction_type', 'isotonica', 'isotonic'),
  ('contraction_type', 'dinamica completa', 'isotonic'),
  ('contraction_type', 'dynamic', 'isotonic'),
  ('contraction_type', 'plyometric', 'plyometric'),
  ('contraction_type', 'plyo', 'plyometric'),
  ('contraction_type', 'pliometrica', 'plyometric'),
  ('contraction_type', 'cea', 'plyometric'),
  ('contraction_type', 'ssc', 'plyometric'),
  ('contraction_type', 'reactive', 'plyometric'),
  ('movement_speed', 'max strength', 'max_strength'),
  ('movement_speed', 'fuerza maxima', 'max_strength'),
  ('movement_speed', 'maximal strength', 'max_strength'),
  ('movement_speed', 'grind', 'max_strength'),
  ('movement_speed', 'strength speed', 'strength_speed'),
  ('movement_speed', 'fuerza velocidad', 'strength_speed'),
  ('movement_speed', 'speed strength', 'speed_strength'),
  ('movement_speed', 'velocidad fuerza', 'speed_strength'),
  ('movement_speed', 'potencia', 'speed_strength'),
  ('movement_speed', 'power', 'speed_strength'),
  ('movement_speed', 'max velocity', 'max_velocity'),
  ('movement_speed', 'velocidad maxima', 'max_velocity'),
  ('movement_speed', 'ballistic', 'max_velocity'),
  ('movement_speed', 'supramaximal', 'supramaximal'),
  ('movement_speed', 'supramaxima', 'supramaximal'),
  ('movement_speed', 'overspeed', 'supramaximal'),
  ('movement_speed', 'assisted', 'supramaximal'),
  ('plane', 'sagittal', 'sagittal'),
  ('plane', 'sagital', 'sagittal'),
  ('plane', 'frontal', 'frontal'),
  ('plane', 'lateral plane', 'frontal'),
  ('plane', 'coronal', 'frontal'),
  ('plane', 'transverse', 'transverse'),
  ('plane', 'transversal', 'transverse'),
  ('plane', 'rotational', 'transverse'),
  ('plane', 'rotacional', 'transverse'),
  ('plane', 'multiplanar', 'multiplanar'),
  ('plane', '3d', 'multiplanar'),
  ('plane', 'combined', 'multiplanar'),
  ('purpose', 'olympic', 'power'),
  ('purpose', 'speed', 'power'),
  ('purpose', 'core', 'strength')
ON CONFLICT (dimension, alias) DO NOTHING;

-- ── 3. Normalize CLUB rows (is_default = false), idempotent per dim ──

-- 3a. equipment_tags from free-text equipment (split on '/')
UPDATE gym_exercises g SET equipment_tags = sub.tokens
FROM (
  SELECT g2.id, array_agg(DISTINCT a.token) AS tokens
  FROM gym_exercises g2
  CROSS JOIN LATERAL regexp_split_to_table(g2.equipment, '/') AS part
  JOIN taxonomy_aliases a ON a.dimension = 'equipment' AND a.alias = cm_norm(part)
  WHERE g2.is_default = false
    AND g2.equipment_tags IS NULL
    AND coalesce(g2.equipment, '') <> ''
  GROUP BY g2.id
) sub
WHERE g.id = sub.id;

-- 3b. empty equipment → bodyweight
UPDATE gym_exercises
SET equipment_tags = ARRAY['bodyweight']::text[]
WHERE is_default = false
  AND equipment_tags IS NULL
  AND coalesce(equipment, '') = '';

-- 3c. muscle_groups from free-text muscle_group (split on '/')
UPDATE gym_exercises g SET muscle_groups = sub.tokens
FROM (
  SELECT g2.id, array_agg(DISTINCT a.token) AS tokens
  FROM gym_exercises g2
  CROSS JOIN LATERAL regexp_split_to_table(g2.muscle_group, '/') AS part
  JOIN taxonomy_aliases a ON a.dimension = 'muscle_group' AND a.alias = cm_norm(part)
  WHERE g2.is_default = false
    AND g2.muscle_groups IS NULL
    AND coalesce(g2.muscle_group, '') <> ''
  GROUP BY g2.id
) sub
WHERE g.id = sub.id;

-- 3d. primary_purpose + purposes from free-text category (exercise type)
UPDATE gym_exercises g SET
  primary_purpose = a.token,
  purposes        = ARRAY[a.token]::text[]
FROM taxonomy_aliases a
WHERE a.dimension = 'purpose'
  AND a.alias = cm_norm(g.category)
  AND g.is_default = false
  AND g.primary_purpose IS NULL
  AND coalesce(g.category, '') <> '';

-- ── 4. Diagnostic (optional to run): unresolved free-text terms ──────
-- Lists club-row muscle/equipment terms that did NOT map to any token —
-- candidates to add as aliases or new canonical tokens.
-- SELECT 'equipment' AS dimension, cm_norm(part) AS term, count(*)
-- FROM gym_exercises g
-- CROSS JOIN LATERAL regexp_split_to_table(coalesce(g.equipment,''), '/') part
-- WHERE g.is_default = false AND coalesce(trim(part),'') <> ''
--   AND NOT EXISTS (SELECT 1 FROM taxonomy_aliases a
--                   WHERE a.dimension='equipment' AND a.alias = cm_norm(part))
-- GROUP BY cm_norm(part)
-- UNION ALL
-- SELECT 'muscle_group', cm_norm(part), count(*)
-- FROM gym_exercises g
-- CROSS JOIN LATERAL regexp_split_to_table(coalesce(g.muscle_group,''), '/') part
-- WHERE g.is_default = false AND coalesce(trim(part),'') <> ''
--   AND NOT EXISTS (SELECT 1 FROM taxonomy_aliases a
--                   WHERE a.dimension='muscle_group' AND a.alias = cm_norm(part))
-- GROUP BY cm_norm(part)
-- ORDER BY 3 DESC;
