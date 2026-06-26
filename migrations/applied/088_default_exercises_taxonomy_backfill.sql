-- ============================================================
-- MIGRATION 087: Canonical backfill of the 120 default exercises
-- Deterministic mapping (curated, validated against lib/exercise-taxonomy.js).
-- 1) extends default_exercises with the canonical columns
-- 2) sets canonical tokens on all 120 defaults
-- 3) propagates to every club's default rows (only where still untagged)
-- 4) updates the new-club seed trigger to carry the canonical columns
-- Additive + idempotent. Run in Supabase SQL Editor AFTER migration 086.
-- ============================================================

-- ── 1. Canonical columns on the global template ──────────────
ALTER TABLE default_exercises
  ADD COLUMN IF NOT EXISTS primary_purpose    text,
  ADD COLUMN IF NOT EXISTS purposes           text[],
  ADD COLUMN IF NOT EXISTS equipment_tags     text[],
  ADD COLUMN IF NOT EXISTS muscle_groups      text[],
  ADD COLUMN IF NOT EXISTS movement_patterns  text[],
  ADD COLUMN IF NOT EXISTS myofascial_chains  text[],
  ADD COLUMN IF NOT EXISTS contraction_types  text[],
  ADD COLUMN IF NOT EXISTS movement_speeds    text[],
  ADD COLUMN IF NOT EXISTS planes             text[];

-- ── 2. Canonical values for the 120 defaults ─────────────────
UPDATE default_exercises AS d SET
  primary_purpose   = v.primary_purpose,
  purposes          = v.purposes,
  equipment_tags    = v.equipment_tags,
  muscle_groups     = v.muscle_groups,
  movement_patterns = v.movement_patterns,
  myofascial_chains = v.myofascial_chains,
  contraction_types = v.contraction_types,
  movement_speeds   = v.movement_speeds,
  planes            = v.planes
FROM (VALUES
  ('back_squat', 'strength', ARRAY['strength']::text[], ARRAY['barbell']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['squat']::text[], NULL::text[], ARRAY['isotonic']::text[], ARRAY['max_strength']::text[], ARRAY['sagittal']::text[]),
  ('front_squat', 'strength', ARRAY['strength']::text[], ARRAY['barbell']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['squat']::text[], NULL::text[], ARRAY['isotonic']::text[], ARRAY['max_strength']::text[], ARRAY['sagittal']::text[]),
  ('romanian_deadlift', 'strength', ARRAY['strength']::text[], ARRAY['barbell']::text[], ARRAY['hamstrings','glutes']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['eccentric','isotonic']::text[], ARRAY['max_strength']::text[], ARRAY['sagittal']::text[]),
  ('conventional_deadlift', 'strength', ARRAY['strength']::text[], ARRAY['barbell']::text[], ARRAY['hamstrings','glutes','erectors']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['isotonic']::text[], ARRAY['max_strength']::text[], ARRAY['sagittal']::text[]),
  ('trap_bar_deadlift', 'strength', ARRAY['strength']::text[], ARRAY['trap_bar']::text[], ARRAY['hamstrings','glutes','erectors','quadriceps']::text[], ARRAY['hinge','squat']::text[], NULL::text[], ARRAY['isotonic']::text[], ARRAY['max_strength']::text[], ARRAY['sagittal']::text[]),
  ('bulgarian_split_squat', 'strength', ARRAY['strength']::text[], ARRAY['dumbbell']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['lunge','single_leg']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('walking_lunge', 'strength', ARRAY['strength']::text[], ARRAY['dumbbell']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['lunge']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('step_up', 'strength', ARRAY['strength']::text[], ARRAY['dumbbell','box']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['single_leg']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('hip_thrust', 'strength', ARRAY['strength']::text[], ARRAY['barbell']::text[], ARRAY['glutes']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('goblet_squat', 'strength', ARRAY['strength']::text[], ARRAY['kettlebell','dumbbell']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['squat']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('bench_press', 'strength', ARRAY['strength']::text[], ARRAY['barbell']::text[], ARRAY['chest','triceps']::text[], ARRAY['horizontal_push']::text[], NULL::text[], ARRAY['isotonic']::text[], ARRAY['max_strength']::text[], ARRAY['sagittal']::text[]),
  ('incline_dumbbell_press', 'strength', ARRAY['strength']::text[], ARRAY['dumbbell']::text[], ARRAY['chest','shoulders']::text[], ARRAY['horizontal_push']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('overhead_press', 'strength', ARRAY['strength']::text[], ARRAY['barbell']::text[], ARRAY['shoulders','triceps']::text[], ARRAY['vertical_push']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('pull_up', 'strength', ARRAY['strength']::text[], ARRAY['pull_up_bar']::text[], ARRAY['lats','upper_back','biceps']::text[], ARRAY['vertical_pull']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('barbell_row', 'strength', ARRAY['strength']::text[], ARRAY['barbell']::text[], ARRAY['upper_back','lats']::text[], ARRAY['horizontal_pull']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('single_arm_dumbbell_row', 'strength', ARRAY['strength']::text[], ARRAY['dumbbell']::text[], ARRAY['lats','upper_back']::text[], ARRAY['horizontal_pull']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('squat_jump', 'power', ARRAY['power']::text[], ARRAY['bodyweight']::text[], ARRAY['quadriceps','glutes','calves']::text[], ARRAY['jump']::text[], NULL::text[], ARRAY['plyometric','concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('countermovement_jump', 'power', ARRAY['power']::text[], ARRAY['bodyweight']::text[], ARRAY['quadriceps','glutes','calves']::text[], ARRAY['jump']::text[], NULL::text[], ARRAY['plyometric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('box_jump', 'power', ARRAY['power']::text[], ARRAY['plyo_box']::text[], ARRAY['quadriceps','glutes','calves']::text[], ARRAY['jump','landing']::text[], NULL::text[], ARRAY['plyometric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('depth_jump', 'power', ARRAY['power']::text[], ARRAY['plyo_box']::text[], ARRAY['quadriceps','glutes','calves']::text[], ARRAY['jump','landing']::text[], NULL::text[], ARRAY['plyometric','eccentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('drop_stick_landing', 'prevention', ARRAY['prevention','power']::text[], ARRAY['box']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['landing']::text[], NULL::text[], ARRAY['eccentric','iso_catch']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('broad_jump', 'power', ARRAY['power']::text[], ARRAY['bodyweight']::text[], ARRAY['quadriceps','glutes','calves']::text[], ARRAY['jump']::text[], NULL::text[], ARRAY['plyometric','concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('lateral_bound', 'power', ARRAY['power']::text[], ARRAY['bodyweight']::text[], ARRAY['glutes','glute_med','quadriceps']::text[], ARRAY['jump','landing']::text[], NULL::text[], ARRAY['plyometric']::text[], ARRAY['speed_strength']::text[], ARRAY['frontal']::text[]),
  ('single_leg_hop_stick', 'power', ARRAY['power','prevention']::text[], ARRAY['bodyweight']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['jump','landing','single_leg']::text[], NULL::text[], ARRAY['plyometric','iso_catch']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('hurdle_hops', 'power', ARRAY['power']::text[], ARRAY['hurdles']::text[], ARRAY['calves','quadriceps','glutes']::text[], ARRAY['jump','landing']::text[], NULL::text[], ARRAY['plyometric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('pogo_hops', 'power', ARRAY['power']::text[], ARRAY['bodyweight']::text[], ARRAY['calves','soleus']::text[], ARRAY['jump']::text[], NULL::text[], ARRAY['plyometric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('medicine_ball_slam', 'power', ARRAY['power']::text[], ARRAY['med_ball']::text[], ARRAY['core','lats']::text[], ARRAY['vertical_pull']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('medicine_ball_rotational_throw', 'power', ARRAY['power']::text[], ARRAY['med_ball']::text[], ARRAY['core','obliques']::text[], ARRAY['rotation']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['transverse']::text[]),
  ('hang_power_clean', 'power', ARRAY['power']::text[], ARRAY['barbell']::text[], ARRAY['hamstrings','glutes','erectors','shoulders','quadriceps']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('power_clean', 'power', ARRAY['power']::text[], ARRAY['barbell']::text[], ARRAY['hamstrings','glutes','erectors','shoulders','quadriceps']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('clean_pull', 'power', ARRAY['power']::text[], ARRAY['barbell']::text[], ARRAY['hamstrings','glutes','erectors']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['strength_speed']::text[], ARRAY['sagittal']::text[]),
  ('hang_power_snatch', 'power', ARRAY['power']::text[], ARRAY['barbell']::text[], ARRAY['hamstrings','glutes','shoulders','quadriceps']::text[], ARRAY['hinge','vertical_push']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('push_press', 'power', ARRAY['power']::text[], ARRAY['barbell']::text[], ARRAY['shoulders','quadriceps','triceps']::text[], ARRAY['vertical_push']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('push_jerk', 'power', ARRAY['power']::text[], ARRAY['barbell']::text[], ARRAY['shoulders','quadriceps','triceps']::text[], ARRAY['vertical_push']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('kettlebell_swing', 'power', ARRAY['power']::text[], ARRAY['kettlebell']::text[], ARRAY['glutes','hamstrings']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('kettlebell_clean', 'power', ARRAY['power']::text[], ARRAY['kettlebell']::text[], ARRAY['glutes','hamstrings','shoulders']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['concentric']::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('world_s_greatest_stretch', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['hip_flexors','hamstrings','adductors']::text[], ARRAY['lunge','rotation']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('90_90_hip_switch', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['glutes','hip_flexors']::text[], ARRAY['rotation']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('spiderman_lunge', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['hip_flexors','adductors']::text[], ARRAY['lunge']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('hip_flexor_rock_back', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['hip_flexors']::text[], ARRAY['hinge']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('deep_squat_hold_prying', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['adductors','glutes']::text[], ARRAY['squat','isometric_hold']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('thoracic_spine_rotation', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['upper_back']::text[], ARRAY['rotation']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('open_book', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['upper_back']::text[], ARRAY['rotation']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('quadruped_t_spine_reach', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['upper_back']::text[], ARRAY['rotation']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('cat_camel', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['erectors','core']::text[], ARRAY[]::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('wall_slides_shoulder', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['wall']::text[], ARRAY['shoulders','lower_traps']::text[], ARRAY['vertical_push']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['frontal']::text[]),
  ('ankle_dorsiflexion_rock', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['soleus','calves']::text[], ARRAY['lunge']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('banded_ankle_mobilization', 'rise_temperature', ARRAY['rise_temperature']::text[], ARRAY['band']::text[], ARRAY['soleus','calves']::text[], ARRAY['lunge']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('glute_bridge', 'activation', ARRAY['activation']::text[], ARRAY['bodyweight']::text[], ARRAY['glutes']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['concentric']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('single_leg_glute_bridge', 'activation', ARRAY['activation']::text[], ARRAY['bodyweight']::text[], ARRAY['glutes']::text[], ARRAY['hinge','single_leg']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('banded_lateral_walk', 'activation', ARRAY['activation']::text[], ARRAY['mini_band']::text[], ARRAY['glute_med']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['frontal']::text[]),
  ('monster_walk', 'activation', ARRAY['activation']::text[], ARRAY['mini_band']::text[], ARRAY['glutes','glute_med']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('clamshell', 'activation', ARRAY['activation','prevention']::text[], ARRAY['mini_band']::text[], ARRAY['glute_med']::text[], ARRAY['rotation']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('dead_bug', 'activation', ARRAY['activation','prevention']::text[], ARRAY['bodyweight']::text[], ARRAY['core']::text[], ARRAY['anti_extension']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('bird_dog', 'activation', ARRAY['activation','prevention']::text[], ARRAY['bodyweight']::text[], ARRAY['core','glutes','erectors']::text[], ARRAY['anti_extension']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('scapular_wall_slide', 'activation', ARRAY['activation']::text[], ARRAY['bodyweight']::text[], ARRAY['lower_traps','serratus']::text[], ARRAY['vertical_push']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['frontal']::text[]),
  ('banded_pull_apart', 'activation', ARRAY['activation']::text[], ARRAY['band']::text[], ARRAY['upper_back','lower_traps']::text[], ARRAY['horizontal_pull']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('prone_y_t_w', 'activation', ARRAY['activation','prevention']::text[], ARRAY['bodyweight']::text[], ARRAY['lower_traps','rotator_cuff']::text[], ARRAY['horizontal_pull']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('front_plank', 'strength', ARRAY['strength']::text[], ARRAY['bodyweight']::text[], ARRAY['core']::text[], ARRAY['anti_extension']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('side_plank', 'strength', ARRAY['strength']::text[], ARRAY['bodyweight']::text[], ARRAY['obliques','ql']::text[], ARRAY['anti_lateral_flexion']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['frontal']::text[]),
  ('pallof_press', 'strength', ARRAY['strength']::text[], ARRAY['cable','band']::text[], ARRAY['core','obliques']::text[], ARRAY['anti_rotation']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('hollow_hold', 'strength', ARRAY['strength']::text[], ARRAY['bodyweight']::text[], ARRAY['core']::text[], ARRAY['anti_extension']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('hanging_leg_raise', 'strength', ARRAY['strength']::text[], ARRAY['pull_up_bar']::text[], ARRAY['core','hip_flexors']::text[], ARRAY['anti_extension']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('reverse_crunch', 'strength', ARRAY['strength']::text[], ARRAY['bodyweight']::text[], ARRAY['core']::text[], ARRAY['anti_extension']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('ab_wheel_rollout', 'strength', ARRAY['strength']::text[], ARRAY['ab_wheel']::text[], ARRAY['core']::text[], ARRAY['anti_extension']::text[], NULL::text[], ARRAY['eccentric']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('russian_twist', 'strength', ARRAY['strength']::text[], ARRAY['med_ball']::text[], ARRAY['obliques']::text[], ARRAY['rotation']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('cable_woodchop', 'strength', ARRAY['strength']::text[], ARRAY['cable']::text[], ARRAY['obliques','core']::text[], ARRAY['rotation']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('stir_the_pot', 'strength', ARRAY['strength']::text[], ARRAY['swiss_ball']::text[], ARRAY['core']::text[], ARRAY['anti_extension']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('suitcase_carry', 'strength', ARRAY['strength']::text[], ARRAY['dumbbell','kettlebell']::text[], ARRAY['obliques','ql','forearm']::text[], ARRAY['carry','anti_lateral_flexion']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['frontal']::text[]),
  ('bear_crawl', 'strength', ARRAY['strength']::text[], ARRAY['bodyweight']::text[], ARRAY['core','shoulders']::text[], ARRAY['locomotion','anti_rotation']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('single_leg_balance', 'prevention', ARRAY['prevention']::text[], ARRAY['bodyweight']::text[], ARRAY['glute_med','soleus']::text[], ARRAY['single_leg','isometric_hold']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('tandem_stance_hold', 'prevention', ARRAY['prevention']::text[], ARRAY['bodyweight']::text[], ARRAY['soleus','glute_med']::text[], ARRAY['isometric_hold']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('single_leg_rdl', 'prevention', ARRAY['prevention','strength']::text[], ARRAY['dumbbell']::text[], ARRAY['hamstrings','glutes']::text[], ARRAY['hinge','single_leg']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('airplane_single_leg', 'prevention', ARRAY['prevention']::text[], ARRAY['bodyweight']::text[], ARRAY['glutes','hamstrings']::text[], ARRAY['hinge','single_leg','rotation']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('bosu_squat', 'prevention', ARRAY['prevention']::text[], ARRAY['bosu']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['squat']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('wobble_board_hold', 'prevention', ARRAY['prevention']::text[], ARRAY['wobble_board']::text[], ARRAY['soleus','calves']::text[], ARRAY['isometric_hold']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('y_balance_reach', 'prevention', ARRAY['prevention']::text[], ARRAY['bodyweight']::text[], ARRAY['glute_med','quadriceps']::text[], ARRAY['single_leg']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('single_leg_balance_perturbation', 'prevention', ARRAY['prevention']::text[], ARRAY['band','partner']::text[], ARRAY['glute_med','soleus']::text[], ARRAY['single_leg','isometric_hold']::text[], NULL::text[], ARRAY['iso_catch']::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('bike_intervals', 'conditioning', ARRAY['conditioning']::text[], ARRAY['bike']::text[], ARRAY['quadriceps','hamstrings','glutes']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('bike_steady_state', 'conditioning', ARRAY['conditioning']::text[], ARRAY['bike']::text[], ARRAY['quadriceps','hamstrings','glutes']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('rowing_intervals', 'conditioning', ARRAY['conditioning']::text[], ARRAY['rower']::text[], ARRAY['lats','quadriceps','core']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('skierg_intervals', 'conditioning', ARRAY['conditioning']::text[], ARRAY['ski_erg']::text[], ARRAY['lats','core','triceps']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('tempo_run', 'conditioning', ARRAY['conditioning']::text[], ARRAY['bodyweight']::text[], ARRAY['quadriceps','hamstrings','calves']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('shuttle_runs', 'conditioning', ARRAY['conditioning','power']::text[], ARRAY['cones']::text[], ARRAY['quadriceps','hamstrings','glutes']::text[], ARRAY['locomotion','landing']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('sled_push', 'conditioning', ARRAY['conditioning','strength']::text[], ARRAY['sled']::text[], ARRAY['quadriceps','glutes','calves']::text[], ARRAY['locomotion']::text[], NULL::text[], ARRAY['concentric']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('sled_drag_backward', 'prevention', ARRAY['prevention','conditioning']::text[], ARRAY['sled']::text[], ARRAY['quadriceps']::text[], ARRAY['locomotion']::text[], NULL::text[], ARRAY['concentric']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('battle_ropes', 'conditioning', ARRAY['conditioning']::text[], ARRAY['battle_ropes']::text[], ARRAY['shoulders','forearm','core']::text[], ARRAY['anti_extension']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('incline_treadmill_walk', 'conditioning', ARRAY['conditioning','prevention']::text[], ARRAY['treadmill']::text[], ARRAY['quadriceps','glutes','calves']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('nordic_hamstring_curl', 'prevention', ARRAY['prevention','strength']::text[], ARRAY['pad','partner']::text[], ARRAY['hamstrings']::text[], ARRAY['single_leg']::text[], NULL::text[], ARRAY['eccentric']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('hamstring_slider_curl', 'prevention', ARRAY['prevention']::text[], ARRAY['sliders']::text[], ARRAY['hamstrings']::text[], ARRAY['hinge']::text[], NULL::text[], ARRAY['eccentric','concentric']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('copenhagen_plank', 'prevention', ARRAY['prevention']::text[], ARRAY['bench']::text[], ARRAY['adductors']::text[], ARRAY['anti_lateral_flexion']::text[], NULL::text[], ARRAY['iso_hold']::text[], NULL::text[], ARRAY['frontal']::text[]),
  ('calf_raise_straight_knee', 'prevention', ARRAY['prevention','strength']::text[], ARRAY['step']::text[], ARRAY['calves']::text[], ARRAY['single_leg']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('calf_raise_bent_knee_soleus', 'prevention', ARRAY['prevention']::text[], ARRAY['step']::text[], ARRAY['soleus']::text[], ARRAY['single_leg']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('eccentric_heel_drop', 'prevention', ARRAY['prevention']::text[], ARRAY['step']::text[], ARRAY['calves','soleus']::text[], ARRAY['single_leg']::text[], NULL::text[], ARRAY['eccentric']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('tibialis_raise', 'prevention', ARRAY['prevention']::text[], ARRAY['wall']::text[], ARRAY['tibialis_anterior']::text[], ARRAY['isometric_hold']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('atg_split_squat', 'prevention', ARRAY['prevention','strength']::text[], ARRAY['bodyweight']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['lunge','single_leg']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('reverse_nordic', 'prevention', ARRAY['prevention']::text[], ARRAY['pad']::text[], ARRAY['quadriceps','hip_flexors']::text[], ARRAY['anti_extension']::text[], NULL::text[], ARRAY['eccentric']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('banded_external_rotation', 'prevention', ARRAY['prevention']::text[], ARRAY['band']::text[], ARRAY['rotator_cuff']::text[], ARRAY['rotation']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('scapular_push_up', 'prevention', ARRAY['prevention']::text[], ARRAY['bodyweight']::text[], ARRAY['serratus']::text[], ARRAY['horizontal_push']::text[], NULL::text[], ARRAY['isotonic']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('wrist_flexor_extensor_eccentrics', 'prevention', ARRAY['prevention']::text[], ARRAY['dumbbell']::text[], ARRAY['forearm']::text[], ARRAY['isometric_hold']::text[], NULL::text[], ARRAY['eccentric']::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('a_skip', 'power', ARRAY['power','rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['hip_flexors','calves']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], ARRAY['max_velocity']::text[], ARRAY['sagittal']::text[]),
  ('b_skip', 'power', ARRAY['power','rise_temperature']::text[], ARRAY['bodyweight']::text[], ARRAY['hamstrings','hip_flexors']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], ARRAY['max_velocity']::text[], ARRAY['sagittal']::text[]),
  ('ladder_quick_feet', 'power', ARRAY['power','rise_temperature']::text[], ARRAY['agility_ladder']::text[], ARRAY['calves','hip_flexors']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], ARRAY['max_velocity']::text[], ARRAY['multiplanar']::text[]),
  ('acceleration_sprint_10_20_m', 'power', ARRAY['power']::text[], ARRAY['bodyweight']::text[], ARRAY['quadriceps','glutes','hamstrings']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], ARRAY['speed_strength']::text[], ARRAY['sagittal']::text[]),
  ('resisted_sprint_band_sled', 'power', ARRAY['power']::text[], ARRAY['band','sled']::text[], ARRAY['quadriceps','glutes','hamstrings']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], ARRAY['strength_speed']::text[], ARRAY['sagittal']::text[]),
  ('flying_sprint_max_velocity', 'power', ARRAY['power']::text[], ARRAY['bodyweight']::text[], ARRAY['hamstrings','glutes','calves']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], ARRAY['max_velocity']::text[], ARRAY['sagittal']::text[]),
  ('wicket_runs', 'power', ARRAY['power']::text[], ARRAY['mini_hurdles']::text[], ARRAY['hamstrings','hip_flexors','calves']::text[], ARRAY['locomotion']::text[], NULL::text[], NULL::text[], ARRAY['max_velocity']::text[], ARRAY['sagittal']::text[]),
  ('5_10_5_pro_agility', 'power', ARRAY['power','prevention']::text[], ARRAY['cones']::text[], ARRAY['quadriceps','glutes','adductors']::text[], ARRAY['locomotion','landing']::text[], NULL::text[], NULL::text[], ARRAY['speed_strength']::text[], ARRAY['multiplanar']::text[]),
  ('t_drill', 'power', ARRAY['power','prevention']::text[], ARRAY['cones']::text[], ARRAY['quadriceps','glutes','adductors']::text[], ARRAY['locomotion','landing']::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('deceleration_drill', 'prevention', ARRAY['prevention','power']::text[], ARRAY['cones']::text[], ARRAY['quadriceps','glutes']::text[], ARRAY['locomotion','landing']::text[], NULL::text[], ARRAY['eccentric','iso_catch']::text[], NULL::text[], ARRAY['multiplanar']::text[]),
  ('standing_hamstring_stretch', 'cooldown', ARRAY['cooldown']::text[], ARRAY['bodyweight']::text[], ARRAY['hamstrings']::text[], ARRAY[]::text[], ARRAY['superficial_back_line']::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('hip_flexor_stretch', 'cooldown', ARRAY['cooldown']::text[], ARRAY['bodyweight']::text[], ARRAY['hip_flexors']::text[], ARRAY[]::text[], ARRAY['superficial_front_line']::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('couch_stretch', 'cooldown', ARRAY['cooldown']::text[], ARRAY['wall']::text[], ARRAY['hip_flexors','quadriceps']::text[], ARRAY[]::text[], ARRAY['superficial_front_line']::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('pigeon_stretch', 'cooldown', ARRAY['cooldown']::text[], ARRAY['bodyweight']::text[], ARRAY['glutes']::text[], ARRAY[]::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['transverse']::text[]),
  ('calf_stretch_wall', 'cooldown', ARRAY['cooldown']::text[], ARRAY['wall']::text[], ARRAY['calves','soleus']::text[], ARRAY[]::text[], ARRAY['superficial_back_line']::text[], NULL::text[], NULL::text[], ARRAY['sagittal']::text[]),
  ('child_s_pose', 'cooldown', ARRAY['cooldown']::text[], ARRAY['bodyweight']::text[], ARRAY['lats','erectors']::text[], ARRAY[]::text[], ARRAY['superficial_back_line']::text[], NULL::text[], NULL::text[], NULL::text[]),
  ('foam_roll_quads', 'release', ARRAY['release']::text[], ARRAY['foam_roller']::text[], ARRAY['quadriceps']::text[], ARRAY[]::text[], ARRAY['superficial_front_line']::text[], NULL::text[], NULL::text[], NULL::text[]),
  ('foam_roll_it_band_glutes', 'release', ARRAY['release']::text[], ARRAY['foam_roller']::text[], ARRAY['glutes','glute_med']::text[], ARRAY[]::text[], ARRAY['lateral_line']::text[], NULL::text[], NULL::text[], NULL::text[]),
  ('thoracic_foam_roll', 'release', ARRAY['release']::text[], ARRAY['foam_roller']::text[], ARRAY['upper_back','erectors']::text[], ARRAY[]::text[], ARRAY['superficial_back_line']::text[], NULL::text[], NULL::text[], NULL::text[]),
  ('diaphragmatic_breathing', 'cooldown', ARRAY['cooldown']::text[], ARRAY['bodyweight']::text[], ARRAY['core']::text[], ARRAY[]::text[], NULL::text[], NULL::text[], NULL::text[], NULL::text[])
) AS v(default_key, primary_purpose, purposes, equipment_tags, muscle_groups,
       movement_patterns, myofascial_chains, contraction_types, movement_speeds, planes)
WHERE d.default_key = v.default_key;

-- ── 3. Propagate to every club's seeded default rows ─────────
-- Guard: only fill rows still untagged, so re-runs never clobber coach edits.
UPDATE gym_exercises AS g SET
  primary_purpose   = d.primary_purpose,
  purposes          = d.purposes,
  equipment_tags    = d.equipment_tags,
  muscle_groups     = d.muscle_groups,
  movement_patterns = d.movement_patterns,
  myofascial_chains = d.myofascial_chains,
  contraction_types = d.contraction_types,
  movement_speeds   = d.movement_speeds,
  planes            = d.planes
FROM default_exercises d
WHERE g.default_key = d.default_key
  AND g.is_default
  AND g.muscle_groups IS NULL;

-- ── 4. New clubs: seed trigger now carries the canonical columns ──
CREATE OR REPLACE FUNCTION seed_default_exercises_for_club()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO gym_exercises
    (club_id, name, category, muscle_group, complexity, equipment, usable_in, description,
     is_default, default_key,
     primary_purpose, purposes, equipment_tags, muscle_groups, movement_patterns,
     myofascial_chains, contraction_types, movement_speeds, planes)
  SELECT NEW.id, d.name, d.category, d.muscle_group, d.complexity, d.equipment, d.usable_in, d.description,
         true, d.default_key,
         d.primary_purpose, d.purposes, d.equipment_tags, d.muscle_groups, d.movement_patterns,
         d.myofascial_chains, d.contraction_types, d.movement_speeds, d.planes
  FROM default_exercises d
  ON CONFLICT (club_id, default_key) WHERE default_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;
