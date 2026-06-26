-- ============================================================
-- MIGRATION 044: Shared Exercise Library (extend gym_exercises)
-- Serves Gym · Individual · Rehab · Preventives. NOT pitch drills.
-- Pattern mirrors 035_gps_metric_definitions_seed.sql (per-club seed
-- + AFTER INSERT ON clubs trigger). DRY via a global template table.
-- Run in Supabase SQL Editor. Additive + idempotent.
-- ============================================================

-- ── 1. Extend gym_exercises (additive, no rename) ──────────────
-- NOTE: today `category` stores complexity (Low/Med/High). We repurpose
-- `category` to mean EXERCISE TYPE and move complexity to its own column.
ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS complexity   text CHECK (complexity IN ('Low','Medium','High')),
  ADD COLUMN IF NOT EXISTS equipment    text,
  ADD COLUMN IF NOT EXISTS usable_in    text[] NOT NULL DEFAULT ARRAY['gym']::text[],
  ADD COLUMN IF NOT EXISTS is_default   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_key  text;

-- Idempotency for default rows: one copy of each default per club.
CREATE UNIQUE INDEX IF NOT EXISTS gym_exercises_default_uq
  ON gym_exercises (club_id, default_key) WHERE default_key IS NOT NULL;

-- OPTIONAL one-time cleanup of EXISTING club rows (review before running):
-- moves the old complexity-in-category into the new column.
-- UPDATE gym_exercises SET complexity = category
--   WHERE complexity IS NULL AND category IN ('Low','Medium','High');
-- UPDATE gym_exercises SET category = NULL
--   WHERE category IN ('Low','Medium','High');

-- ── 2. Global template table (single source of truth, no club_id) ──
CREATE TABLE IF NOT EXISTS default_exercises (
  default_key  text PRIMARY KEY,
  name         text NOT NULL,
  category     text NOT NULL,            -- exercise TYPE
  muscle_group text,
  complexity   text CHECK (complexity IN ('Low','Medium','High')),
  equipment    text,
  usable_in    text[] NOT NULL,
  description  text                      -- objective / coaching cue
);
ALTER TABLE default_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone authenticated can read default_exercises" ON default_exercises;
CREATE POLICY "Anyone authenticated can read default_exercises"
  ON default_exercises FOR SELECT TO authenticated USING (true);

-- ── 3. Load the 120 canonical defaults (idempotent) ──────────────
INSERT INTO default_exercises
  (default_key, name, category, muscle_group, complexity, equipment, usable_in, description)
VALUES
  ('back_squat', 'Back Squat', 'strength', 'Quads / Glutes', 'High', 'Barbell', ARRAY['gym','individual']::text[], 'Bilateral lower-body strength; brace, knees track toes'),
  ('front_squat', 'Front Squat', 'strength', 'Quads', 'High', 'Barbell', ARRAY['gym','individual']::text[], 'Quad-dominant squat; tall torso, elbows high'),
  ('romanian_deadlift', 'Romanian Deadlift', 'strength', 'Hamstrings / Glutes', 'Medium', 'Barbell', ARRAY['gym','individual','rehab','preventive']::text[], 'Posterior-chain hinge; flat back, hips back'),
  ('conventional_deadlift', 'Conventional Deadlift', 'strength', 'Posterior chain', 'High', 'Barbell', ARRAY['gym','individual']::text[], 'Full posterior-chain strength from floor'),
  ('trap_bar_deadlift', 'Trap-Bar Deadlift', 'strength', 'Posterior chain / Quads', 'Medium', 'Trap bar', ARRAY['gym','individual','rehab']::text[], 'Lower-back-friendly deadlift variation'),
  ('bulgarian_split_squat', 'Bulgarian Split Squat', 'strength', 'Quads / Glutes', 'Medium', 'Dumbbells', ARRAY['gym','individual','rehab','preventive']::text[], 'Unilateral strength & knee stability'),
  ('walking_lunge', 'Walking Lunge', 'strength', 'Quads / Glutes', 'Low', 'Dumbbells', ARRAY['gym','individual']::text[], 'Unilateral, gait-specific loading'),
  ('step_up', 'Step-up', 'strength', 'Quads / Glutes', 'Low', 'Dumbbells / Box', ARRAY['gym','individual','rehab','preventive']::text[], 'Single-leg drive, scalable height'),
  ('hip_thrust', 'Hip Thrust', 'strength', 'Glutes', 'Low', 'Barbell', ARRAY['gym','individual','rehab','preventive']::text[], 'Glute strength with low spinal load'),
  ('goblet_squat', 'Goblet Squat', 'strength', 'Quads / Glutes', 'Low', 'KB / Dumbbell', ARRAY['gym','individual','rehab','preventive']::text[], 'Beginner-friendly squat pattern'),
  ('bench_press', 'Bench Press', 'strength', 'Chest / Triceps', 'Medium', 'Barbell', ARRAY['gym','individual']::text[], 'Upper-body horizontal push'),
  ('incline_dumbbell_press', 'Incline Dumbbell Press', 'strength', 'Chest / Shoulders', 'Medium', 'Dumbbells', ARRAY['gym','individual']::text[], 'Upper-chest & shoulder push'),
  ('overhead_press', 'Overhead Press', 'strength', 'Shoulders', 'Medium', 'Barbell', ARRAY['gym','individual']::text[], 'Vertical push, overhead strength'),
  ('pull_up', 'Pull-up', 'strength', 'Lats / Upper back', 'High', 'Pull-up bar', ARRAY['gym','individual']::text[], 'Vertical pull, scapular control'),
  ('barbell_row', 'Barbell Row', 'strength', 'Upper back / Lats', 'Medium', 'Barbell', ARRAY['gym','individual']::text[], 'Horizontal pull, posture support'),
  ('single_arm_dumbbell_row', 'Single-Arm Dumbbell Row', 'strength', 'Lats / Upper back', 'Low', 'Dumbbell', ARRAY['gym','individual','rehab']::text[], 'Unilateral pull, scalable'),
  ('squat_jump', 'Squat Jump', 'power', 'Lower body', 'Low', NULL, ARRAY['gym','individual']::text[], 'Concentric power, vertical'),
  ('countermovement_jump', 'Countermovement Jump', 'power', 'Lower body', 'Low', NULL, ARRAY['gym','individual']::text[], 'Stretch-shortening cycle, monitor RSI'),
  ('box_jump', 'Box Jump', 'power', 'Lower body', 'Medium', 'Plyo box', ARRAY['gym','individual']::text[], 'Concentric power; step down, soft landing'),
  ('depth_jump', 'Depth Jump', 'power', 'Lower body', 'High', 'Plyo box', ARRAY['individual']::text[], 'Reactive strength — screen athlete first'),
  ('drop_stick_landing', 'Drop & Stick Landing', 'power', 'Lower body', 'Low', 'Box', ARRAY['rehab','preventive']::text[], 'Landing mechanics, deceleration base'),
  ('broad_jump', 'Broad Jump', 'power', 'Lower body', 'Medium', NULL, ARRAY['gym','individual']::text[], 'Horizontal power output'),
  ('lateral_bound', 'Lateral Bound', 'power', 'Lower body', 'Medium', NULL, ARRAY['gym','individual','preventive']::text[], 'Frontal-plane power & landing control'),
  ('single_leg_hop_stick', 'Single-Leg Hop & Stick', 'power', 'Lower body', 'Medium', NULL, ARRAY['individual','rehab','preventive']::text[], 'Unilateral control & confidence'),
  ('hurdle_hops', 'Hurdle Hops', 'power', 'Lower body', 'Medium', 'Hurdles', ARRAY['individual']::text[], 'Repeated reactive jumps'),
  ('pogo_hops', 'Pogo Hops', 'power', 'Calves / Ankle', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Ankle stiffness & reactive strength'),
  ('medicine_ball_slam', 'Medicine Ball Slam', 'power', 'Core / Full body', 'Low', 'Med ball', ARRAY['gym','individual']::text[], 'Triple-extension power'),
  ('medicine_ball_rotational_throw', 'Medicine Ball Rotational Throw', 'power', 'Core', 'Low', 'Med ball', ARRAY['gym','individual','preventive']::text[], 'Rotational power, hip-to-shoulder'),
  ('hang_power_clean', 'Hang Power Clean', 'olympic', 'Full body', 'High', 'Barbell', ARRAY['gym','individual']::text[], 'Triple extension, rate of force development'),
  ('power_clean', 'Power Clean', 'olympic', 'Full body', 'High', 'Barbell', ARRAY['individual']::text[], 'Full-extension power from floor'),
  ('clean_pull', 'Clean Pull', 'olympic', 'Posterior chain', 'Medium', 'Barbell', ARRAY['gym','individual']::text[], 'Extension power, no catch'),
  ('hang_power_snatch', 'Hang Power Snatch', 'olympic', 'Full body', 'High', 'Barbell', ARRAY['individual']::text[], 'Wide-grip explosive triple extension'),
  ('push_press', 'Push Press', 'olympic', 'Shoulders / Legs', 'Medium', 'Barbell', ARRAY['gym','individual']::text[], 'Overhead power, leg drive'),
  ('push_jerk', 'Push Jerk', 'olympic', 'Shoulders / Legs', 'High', 'Barbell', ARRAY['individual']::text[], 'Overhead power with re-dip'),
  ('kettlebell_swing', 'Kettlebell Swing', 'olympic', 'Glutes / Hamstrings', 'Low', 'Kettlebell', ARRAY['gym','individual','rehab','preventive']::text[], 'Ballistic hip hinge'),
  ('kettlebell_clean', 'Kettlebell Clean', 'olympic', 'Full body', 'Medium', 'Kettlebell', ARRAY['gym','individual']::text[], 'Explosive rack delivery'),
  ('world_s_greatest_stretch', 'World''s Greatest Stretch', 'mobility', 'Full body', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Multi-joint dynamic warm-up flow'),
  ('90_90_hip_switch', '90/90 Hip Switch', 'mobility', 'Hips', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Hip internal/external rotation'),
  ('spiderman_lunge', 'Spiderman Lunge', 'mobility', 'Hips / Groin', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Hip opener, dynamic'),
  ('hip_flexor_rock_back', 'Hip Flexor Rock-back', 'mobility', 'Hips', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Hip extension prep'),
  ('deep_squat_hold_prying', 'Deep Squat Hold (prying)', 'mobility', 'Hips / Ankles', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Bottom-position mobility'),
  ('thoracic_spine_rotation', 'Thoracic Spine Rotation', 'mobility', 'T-spine', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Restore upper-back rotation'),
  ('open_book', 'Open Book', 'mobility', 'T-spine', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Side-lying rotation'),
  ('quadruped_t_spine_reach', 'Quadruped T-spine Reach', 'mobility', 'T-spine', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Segmental rotation control'),
  ('cat_camel', 'Cat-Camel', 'mobility', 'Spine', 'Low', NULL, ARRAY['rehab','preventive']::text[], 'Segmental spine mobility'),
  ('wall_slides_shoulder', 'Wall Slides (shoulder)', 'mobility', 'Shoulders', 'Low', 'Wall', ARRAY['gym','individual','rehab','preventive']::text[], 'Overhead shoulder ROM'),
  ('ankle_dorsiflexion_rock', 'Ankle Dorsiflexion Rock', 'mobility', 'Ankle', 'Low', NULL, ARRAY['individual','rehab','preventive']::text[], 'Restore dorsiflexion ROM'),
  ('banded_ankle_mobilization', 'Banded Ankle Mobilization', 'mobility', 'Ankle', 'Low', 'Band', ARRAY['individual','rehab','preventive']::text[], 'Joint-glide dorsiflexion'),
  ('glute_bridge', 'Glute Bridge', 'activation', 'Glutes', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Glute activation pre-session'),
  ('single_leg_glute_bridge', 'Single-Leg Glute Bridge', 'activation', 'Glutes', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Unilateral glute activation'),
  ('banded_lateral_walk', 'Banded Lateral Walk', 'activation', 'Glute med', 'Low', 'Mini-band', ARRAY['gym','individual','rehab','preventive']::text[], 'Hip abductor activation'),
  ('monster_walk', 'Monster Walk', 'activation', 'Glutes', 'Low', 'Mini-band', ARRAY['gym','individual','preventive']::text[], 'Multi-direction hip activation'),
  ('clamshell', 'Clamshell', 'activation', 'Glute med', 'Low', 'Mini-band', ARRAY['rehab','preventive']::text[], 'Hip stabilizer activation'),
  ('dead_bug', 'Dead Bug', 'activation', 'Core', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Anti-extension trunk activation'),
  ('bird_dog', 'Bird Dog', 'activation', 'Core / Glutes', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Trunk stability, contralateral'),
  ('scapular_wall_slide', 'Scapular Wall Slide', 'activation', 'Shoulders', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Scapular upward rotation control'),
  ('banded_pull_apart', 'Banded Pull-apart', 'activation', 'Upper back', 'Low', 'Band', ARRAY['gym','individual','rehab','preventive']::text[], 'Scapular retractor activation'),
  ('prone_y_t_w', 'Prone Y-T-W', 'activation', 'Lower traps / Cuff', 'Low', NULL, ARRAY['rehab','preventive']::text[], 'Shoulder-girdle activation'),
  ('front_plank', 'Front Plank', 'core', 'Core', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Anti-extension isometric'),
  ('side_plank', 'Side Plank', 'core', 'Lateral core / QL', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Anti-lateral-flexion'),
  ('pallof_press', 'Pallof Press', 'core', 'Core', 'Low', 'Cable / Band', ARRAY['gym','individual','rehab','preventive']::text[], 'Anti-rotation control'),
  ('hollow_hold', 'Hollow Hold', 'core', 'Core', 'Low', NULL, ARRAY['gym','individual']::text[], 'Full anterior-chain tension'),
  ('hanging_leg_raise', 'Hanging Leg Raise', 'core', 'Hip flexors / Core', 'Medium', 'Pull-up bar', ARRAY['gym','individual']::text[], 'Controlled trunk flexion'),
  ('reverse_crunch', 'Reverse Crunch', 'core', 'Lower abs', 'Low', NULL, ARRAY['gym','individual']::text[], 'Posterior pelvic-tilt control'),
  ('ab_wheel_rollout', 'Ab Wheel Rollout', 'core', 'Core', 'High', 'Ab wheel', ARRAY['gym','individual']::text[], 'Anti-extension under load'),
  ('russian_twist', 'Russian Twist', 'core', 'Obliques', 'Low', 'Med ball', ARRAY['gym','individual']::text[], 'Rotational endurance'),
  ('cable_woodchop', 'Cable Woodchop', 'core', 'Obliques', 'Low', 'Cable', ARRAY['gym','individual','preventive']::text[], 'Rotational strength, hip-driven'),
  ('stir_the_pot', 'Stir the Pot', 'core', 'Core', 'Medium', 'Swiss ball', ARRAY['gym','individual']::text[], 'Dynamic anti-extension'),
  ('suitcase_carry', 'Suitcase Carry', 'core', 'Core / Grip', 'Low', 'DB / KB', ARRAY['gym','individual','rehab','preventive']::text[], 'Anti-lateral-flexion loaded carry'),
  ('bear_crawl', 'Bear Crawl', 'core', 'Core / Shoulders', 'Low', NULL, ARRAY['gym','individual','rehab']::text[], 'Trunk stability in motion'),
  ('single_leg_balance', 'Single-Leg Balance', 'balance', 'Ankle / Hip', 'Low', NULL, ARRAY['rehab','preventive']::text[], 'Static proprioception base'),
  ('tandem_stance_hold', 'Tandem Stance Hold', 'balance', 'Ankle / Hip', 'Low', NULL, ARRAY['rehab','preventive']::text[], 'Narrow-base balance'),
  ('single_leg_rdl', 'Single-Leg RDL', 'balance', 'Hamstrings / Glutes', 'Medium', 'Dumbbell', ARRAY['gym','individual','rehab','preventive']::text[], 'Dynamic balance + hinge'),
  ('airplane_single_leg', 'Airplane (single-leg)', 'balance', 'Glutes / Post. chain', 'Medium', NULL, ARRAY['rehab','preventive']::text[], 'Hip control through rotation'),
  ('bosu_squat', 'Bosu Squat', 'balance', 'Lower body', 'Medium', 'Bosu', ARRAY['rehab','preventive']::text[], 'Unstable-surface control'),
  ('wobble_board_hold', 'Wobble Board Hold', 'balance', 'Ankle', 'Low', 'Wobble board', ARRAY['rehab','preventive']::text[], 'Ankle proprioception'),
  ('y_balance_reach', 'Y-Balance Reach', 'balance', 'Lower body', 'Low', NULL, ARRAY['rehab','preventive']::text[], 'Dynamic balance drill / screen'),
  ('single_leg_balance_perturbation', 'Single-Leg Balance + Perturbation', 'balance', 'Ankle / Hip', 'Medium', 'Band / partner', ARRAY['rehab','preventive']::text[], 'Reactive stability'),
  ('bike_intervals', 'Bike Intervals', 'conditioning', 'Full body', 'Medium', 'Assault / Watt bike', ARRAY['gym','individual','rehab']::text[], 'Low-impact aerobic/anaerobic intervals'),
  ('bike_steady_state', 'Bike Steady-State', 'conditioning', 'Full body', 'Low', 'Bike', ARRAY['gym','individual','rehab']::text[], 'Aerobic base, low impact'),
  ('rowing_intervals', 'Rowing Intervals', 'conditioning', 'Full body', 'Medium', 'Rower', ARRAY['gym','individual','rehab']::text[], 'Low-impact full-body conditioning'),
  ('skierg_intervals', 'SkiErg Intervals', 'conditioning', 'Full body', 'Medium', 'SkiErg', ARRAY['gym','individual','rehab']::text[], 'Upper-biased conditioning'),
  ('tempo_run', 'Tempo Run', 'conditioning', 'Full body', 'Low', NULL, ARRAY['individual']::text[], 'Aerobic capacity, low impact'),
  ('shuttle_runs', 'Shuttle Runs', 'conditioning', 'Full body', 'Medium', 'Cones', ARRAY['individual']::text[], 'Repeated efforts with COD'),
  ('sled_push', 'Sled Push', 'conditioning', 'Full body', 'Medium', 'Sled', ARRAY['gym','individual','rehab','preventive']::text[], 'Concentric-only conditioning & strength'),
  ('sled_drag_backward', 'Sled Drag (backward)', 'conditioning', 'Quads / Knee', 'Low', 'Sled', ARRAY['rehab','preventive']::text[], 'Knee-friendly quad loading'),
  ('battle_ropes', 'Battle Ropes', 'conditioning', 'Upper body / Core', 'Low', 'Ropes', ARRAY['gym','individual']::text[], 'Upper-body metabolic work'),
  ('incline_treadmill_walk', 'Incline Treadmill Walk', 'conditioning', 'Lower body', 'Low', 'Treadmill', ARRAY['rehab']::text[], 'Early-stage return-to-run aerobic'),
  ('nordic_hamstring_curl', 'Nordic Hamstring Curl', 'prehab', 'Hamstrings', 'High', 'Pad / partner', ARRAY['gym','rehab','preventive']::text[], 'Eccentric hamstring — injury prevention'),
  ('hamstring_slider_curl', 'Hamstring Slider Curl', 'prehab', 'Hamstrings', 'Medium', 'Sliders', ARRAY['rehab','preventive']::text[], 'Eccentric/concentric hamstring control'),
  ('copenhagen_plank', 'Copenhagen Plank', 'prehab', 'Adductors', 'Medium', 'Bench', ARRAY['rehab','preventive']::text[], 'Adductor strength — groin prevention'),
  ('calf_raise_straight_knee', 'Calf Raise (straight knee)', 'prehab', 'Calves', 'Low', 'Step', ARRAY['rehab','preventive']::text[], 'Gastrocnemius resilience'),
  ('calf_raise_bent_knee_soleus', 'Calf Raise (bent knee / soleus)', 'prehab', 'Soleus', 'Low', 'Step', ARRAY['rehab','preventive']::text[], 'Soleus resilience'),
  ('eccentric_heel_drop', 'Eccentric Heel Drop', 'prehab', 'Achilles / Calf', 'Low', 'Step', ARRAY['rehab','preventive']::text[], 'Achilles tendon loading'),
  ('tibialis_raise', 'Tibialis Raise', 'prehab', 'Tibialis', 'Low', 'Wall', ARRAY['individual','rehab','preventive']::text[], 'Shin-splint prevention'),
  ('atg_split_squat', 'ATG Split Squat', 'prehab', 'Quads / Knee', 'Medium', NULL, ARRAY['rehab','preventive']::text[], 'Knee resilience through full ROM'),
  ('reverse_nordic', 'Reverse Nordic', 'prehab', 'Quads', 'Medium', 'Pad', ARRAY['rehab','preventive']::text[], 'Eccentric quad / knee health'),
  ('banded_external_rotation', 'Banded External Rotation', 'prehab', 'Rotator cuff', 'Low', 'Band', ARRAY['rehab','preventive']::text[], 'Posterior cuff strength'),
  ('scapular_push_up', 'Scapular Push-up', 'prehab', 'Serratus', 'Low', NULL, ARRAY['gym','rehab','preventive']::text[], 'Scapular protraction control'),
  ('wrist_flexor_extensor_eccentrics', 'Wrist Flexor/Extensor Eccentrics', 'prehab', 'Forearm', 'Low', 'Dumbbell', ARRAY['rehab','preventive']::text[], 'Tendon loading, racket/contact sports'),
  ('a_skip', 'A-Skip', 'speed', 'Lower body', 'Low', NULL, ARRAY['gym','individual']::text[], 'Sprint mechanics, front-side action'),
  ('b_skip', 'B-Skip', 'speed', 'Lower body', 'Medium', NULL, ARRAY['individual']::text[], 'Leg extension & recovery mechanics'),
  ('ladder_quick_feet', 'Ladder Quick Feet', 'speed', 'Lower body', 'Low', 'Agility ladder', ARRAY['gym','individual','preventive']::text[], 'Foot speed & coordination'),
  ('acceleration_sprint_10_20_m', 'Acceleration Sprint (10–20 m)', 'speed', 'Lower body', 'Medium', NULL, ARRAY['individual']::text[], 'Acceleration quality, low volume'),
  ('resisted_sprint_band_sled', 'Resisted Sprint (band / sled)', 'speed', 'Lower body', 'Medium', 'Band / Sled', ARRAY['individual']::text[], 'Acceleration force application'),
  ('flying_sprint_max_velocity', 'Flying Sprint (max velocity)', 'speed', 'Lower body', 'High', NULL, ARRAY['individual']::text[], 'Top-speed mechanics'),
  ('wicket_runs', 'Wicket Runs', 'speed', 'Lower body', 'Medium', 'Mini-hurdles', ARRAY['individual']::text[], 'Max-velocity rhythm'),
  ('5_10_5_pro_agility', '5-10-5 Pro Agility', 'speed', 'Lower body', 'Medium', 'Cones', ARRAY['individual','preventive']::text[], 'Change-of-direction mechanics'),
  ('t_drill', 'T-Drill', 'speed', 'Lower body', 'Medium', 'Cones', ARRAY['individual','preventive']::text[], 'Multi-direction agility'),
  ('deceleration_drill', 'Deceleration Drill', 'speed', 'Lower body', 'Medium', 'Cones', ARRAY['individual','rehab','preventive']::text[], 'Braking mechanics, injury prevention'),
  ('standing_hamstring_stretch', 'Standing Hamstring Stretch', 'cooldown', 'Hamstrings', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Static cooldown'),
  ('hip_flexor_stretch', 'Hip Flexor Stretch', 'cooldown', 'Hip flexors', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Static cooldown'),
  ('couch_stretch', 'Couch Stretch', 'cooldown', 'Hip flexors / Quads', 'Low', 'Wall', ARRAY['gym','individual','rehab','preventive']::text[], 'Deep hip-flexor / quad stretch'),
  ('pigeon_stretch', 'Pigeon Stretch', 'cooldown', 'Glutes / Hips', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Glute / external-rotator stretch'),
  ('calf_stretch_wall', 'Calf Stretch (wall)', 'cooldown', 'Calves', 'Low', 'Wall', ARRAY['gym','individual','rehab','preventive']::text[], 'Gastrocnemius / soleus stretch'),
  ('child_s_pose', 'Child''s Pose', 'cooldown', 'Spine / Lats', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Spine decompression, calming'),
  ('foam_roll_quads', 'Foam Roll Quads', 'cooldown', 'Quads', 'Low', 'Foam roller', ARRAY['gym','individual','rehab','preventive']::text[], 'Myofascial release'),
  ('foam_roll_it_band_glutes', 'Foam Roll IT Band / Glutes', 'cooldown', 'Glutes / Lateral thigh', 'Low', 'Foam roller', ARRAY['gym','individual','rehab','preventive']::text[], 'Lateral-chain release'),
  ('thoracic_foam_roll', 'Thoracic Foam Roll', 'cooldown', 'T-spine', 'Low', 'Foam roller', ARRAY['gym','individual','rehab','preventive']::text[], 'Upper-back extension / release'),
  ('diaphragmatic_breathing', 'Diaphragmatic Breathing', 'cooldown', 'Recovery', 'Low', NULL, ARRAY['gym','individual','rehab','preventive']::text[], 'Parasympathetic down-regulation')
ON CONFLICT (default_key) DO NOTHING;

-- ── 4. Backfill: seed defaults into every EXISTING club ──────────
INSERT INTO gym_exercises
  (club_id, name, category, muscle_group, complexity, equipment, usable_in, description, is_default, default_key)
SELECT c.id, d.name, d.category, d.muscle_group, d.complexity, d.equipment, d.usable_in, d.description, true, d.default_key
FROM clubs c CROSS JOIN default_exercises d
ON CONFLICT (club_id, default_key) WHERE default_key IS NOT NULL DO NOTHING;

-- ── 5. Trigger: seed defaults automatically for NEW clubs ────────
CREATE OR REPLACE FUNCTION seed_default_exercises_for_club()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO gym_exercises
    (club_id, name, category, muscle_group, complexity, equipment, usable_in, description, is_default, default_key)
  SELECT NEW.id, d.name, d.category, d.muscle_group, d.complexity, d.equipment, d.usable_in, d.description, true, d.default_key
  FROM default_exercises d
  ON CONFLICT (club_id, default_key) WHERE default_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_exercises ON clubs;
CREATE TRIGGER trg_seed_default_exercises
  AFTER INSERT ON clubs
  FOR EACH ROW EXECUTE FUNCTION seed_default_exercises_for_club();
