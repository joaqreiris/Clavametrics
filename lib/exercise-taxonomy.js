// ClavaMetrics — canonical exercise taxonomy (vanilla, no deps, no build).
// --------------------------------------------------------------------------
// TOKENS are immutable and are the ONLY thing stored in the DB.
// LABELS are display-only (English here; wire to i18n.js for ES/PT later —
//   never store the label, only the token).
// ALIASES seed the resolver: any free-text input (EN/ES/PT) that maps to a
//   token. This is the static base for the future learned-alias loop.
// Exposes window.CMTaxonomy (browser) and module.exports (node/serverless).
(function () {
  'use strict';

  // ── Dimension metadata ────────────────────────────────────────────────
  // column        = gym_exercises array column it writes to
  // primaryColumn = scalar column for the primary value (purpose only)
  // required      = must be set on every exercise
  // multi         = stored as text[] (array); false = single value
  const DIMENSIONS = {
    purpose:          { column: 'purposes',          primaryColumn: 'primary_purpose', required: true,  multi: true  },
    equipment:        { column: 'equipment_tags',                                      required: true,  multi: true  },
    muscle_group:     { column: 'muscle_groups',                                       required: true,  multi: true  },
    movement_pattern: { column: 'movement_patterns',                                   required: true,  multi: true  },
    myofascial_chain: { column: 'myofascial_chains',                                   required: false, multi: true  },
    contraction_type: { column: 'contraction_types',                                   required: false, multi: true  },
    movement_speed:   { column: 'movement_speeds',                                     required: false, multi: true  },
    plane:            { column: 'planes',                                              required: false, multi: true  },
  };

  // ── 1. PURPOSE (Finalidad) · required(1 primary) · multi ──────────────
  // Order = SUGGESTED default only; each coach reorders it (user preference,
  // not stored here). Load (light/heavy) is NOT here — it lives in the plan.
  const PURPOSE = [
    { token: 'rise_temperature', label: 'Rise Temperature', desc: 'Warm-up: raise core temperature and readiness, incl. active mobility (RAMP).', aliases: ['warm up','warm-up','warmup','raise','ramp','mobility','entrada en calor','calentamiento','movilidad','aquecimento'] },
    { token: 'release',          label: 'Release',          desc: 'Soft-tissue / myofascial release and elongation before work.',                aliases: ['liberacion','liberación','soft tissue','foam rolling','smr','elongacion','elongación','soltura','liberação'] },
    { token: 'activation',       label: 'Activation',       desc: 'Pre-activate the target musculature before loading.',                        aliases: ['activacion','activación','primer','glute activation','ativação'] },
    { token: 'power',            label: 'Power',            desc: 'High-velocity force expression.',                                            aliases: ['potencia','explosividad','rfd','potência'] },
    { token: 'strength',         label: 'Strength',         desc: 'Maximal / submaximal force development.',                                    aliases: ['fuerza','força'] },
    { token: 'conditioning',     label: 'Conditioning',     desc: 'Aerobic / anaerobic metabolic work.',                                        aliases: ['acondicionamiento','metabolic','energy systems','cardio','condicionamento'] },
    { token: 'prevention',       label: 'Prevention',       desc: 'Injury prevention / prehab, incl. balance & proprioception.',                aliases: ['prevencion','prevención','prehab','preventive','propiocepcion','propiocepción','equilibrio','balance','prevenção'] },
    { token: 'cooldown',         label: 'Cooldown',         desc: 'Down-regulation, static stretch, recovery.',                                 aliases: ['vuelta a la calma','cool down','cooldown','recovery','recuperacion','recuperación','volta à calma'] },
  ];

  // ── 2. EQUIPMENT (Material) · required · multi ────────────────────────
  const EQUIPMENT = [
    { token: 'bodyweight',     label: 'Bodyweight',      aliases: ['none','no equipment','peso corporal','sin material'] },
    { token: 'barbell',        label: 'Barbell',         aliases: ['barra'] },
    { token: 'dumbbell',       label: 'Dumbbell',        aliases: ['dumbbells','db','mancuerna','mancuernas'] },
    { token: 'kettlebell',     label: 'Kettlebell',      aliases: ['kb','pesa rusa'] },
    { token: 'trap_bar',       label: 'Trap Bar',        aliases: ['hex bar','barra hexagonal'] },
    { token: 'band',           label: 'Band',            aliases: ['resistance band','banda'] },
    { token: 'mini_band',      label: 'Mini-band',       aliases: ['loop band','mini banda','banda circular'] },
    { token: 'cable',          label: 'Cable',           aliases: ['polea','pulley'] },
    { token: 'conical_pulley', label: 'Conical Pulley',  aliases: ['polea conica','polea cónica','versapulley'] },
    { token: 'flywheel',       label: 'Flywheel',        aliases: ['inertial','yoyo','yo-yo','yoyo squat','kbox','inercial','isoinercial'] },
    { token: 'bench',          label: 'Bench',           aliases: ['banco'] },
    { token: 'box',            label: 'Box',             aliases: ['cajon','cajón'] },
    { token: 'plyo_box',       label: 'Plyo Box',        aliases: ['cajon pliometrico','cajón pliométrico','plyobox'] },
    { token: 'step',           label: 'Step',            aliases: ['escalon','escalón'] },
    { token: 'wall',           label: 'Wall',            aliases: ['pared'] },
    { token: 'pull_up_bar',    label: 'Pull-up Bar',     aliases: ['barra de dominadas','chin-up bar'] },
    { token: 'sled',           label: 'Sled',            aliases: ['trineo','prowler'] },
    { token: 'med_ball',       label: 'Medicine Ball',   aliases: ['medicine ball','balon medicinal','balón medicinal'] },
    { token: 'foam_roller',    label: 'Foam Roller',     aliases: ['rodillo','foam'] },
    { token: 'swiss_ball',     label: 'Swiss Ball',      aliases: ['fitball','stability ball','pelota suiza'] },
    { token: 'bosu',           label: 'Bosu',            aliases: ['bosu ball'] },
    { token: 'wobble_board',   label: 'Wobble Board',    aliases: ['balance board','tabla de equilibrio'] },
    { token: 'ab_wheel',       label: 'Ab Wheel',        aliases: ['rueda abdominal'] },
    { token: 'sliders',        label: 'Sliders',         aliases: ['discos deslizantes','valslides'] },
    { token: 'rower',          label: 'Rower',           aliases: ['remo','rowing erg'] },
    { token: 'bike',           label: 'Bike',            aliases: ['assault bike','watt bike','bici','bicicleta'] },
    { token: 'ski_erg',        label: 'SkiErg',          aliases: ['ski'] },
    { token: 'treadmill',      label: 'Treadmill',       aliases: ['cinta','caminadora'] },
    { token: 'battle_ropes',   label: 'Battle Ropes',    aliases: ['ropes','sogas','cuerdas'] },
    { token: 'cones',          label: 'Cones',           aliases: ['conos'] },
    { token: 'hurdles',        label: 'Hurdles',         aliases: ['vallas'] },
    { token: 'mini_hurdles',   label: 'Mini-hurdles',    aliases: ['wickets','mini vallas'] },
    { token: 'agility_ladder', label: 'Agility Ladder',  aliases: ['ladder','escalera de agilidad','escalera'] },
    { token: 'pad',            label: 'Pad',             aliases: ['colchoneta','almohadilla'] },
    { token: 'partner',        label: 'Partner',         aliases: ['companion','compañero','compañera','manual resistance'] },
  ];

  // ── 3. MUSCLE_GROUP (Grupo muscular) · required · multi · atomic only ──
  const MUSCLE_GROUP = [
    { token: 'quadriceps',        label: 'Quadriceps',       aliases: ['quads','cuadriceps','cuádriceps'] },
    { token: 'hamstrings',        label: 'Hamstrings',       aliases: ['isquios','isquiosurales','isquiotibiales'] },
    { token: 'glutes',            label: 'Glutes',           aliases: ['glute max','gluteo mayor','glúteo mayor','gluteo'] },
    { token: 'glute_med',         label: 'Glute Med',        aliases: ['gluteus medius','gluteo medio','glúteo medio'] },
    { token: 'adductors',         label: 'Adductors',        aliases: ['aductores','groin','ingle'] },
    { token: 'hip_flexors',       label: 'Hip Flexors',      aliases: ['flexores de cadera','psoas'] },
    { token: 'calves',            label: 'Calves',           aliases: ['gastrocnemius','gemelos'] },
    { token: 'soleus',            label: 'Soleus',           aliases: ['soleo','sóleo'] },
    { token: 'tibialis_anterior', label: 'Tibialis Anterior',aliases: ['tibial','tibialis','tibial anterior'] },
    { token: 'chest',             label: 'Chest',            aliases: ['pecs','pectoral','pectorales'] },
    { token: 'shoulders',         label: 'Shoulders',        aliases: ['deltoids','deltoides','hombro','hombros'] },
    { token: 'lats',              label: 'Lats',             aliases: ['latissimus','dorsal','dorsales'] },
    { token: 'upper_back',        label: 'Upper Back',       aliases: ['espalda alta','mid back'] },
    { token: 'lower_traps',       label: 'Lower Traps',      aliases: ['trapecio inferior'] },
    { token: 'rotator_cuff',      label: 'Rotator Cuff',     aliases: ['cuff','manguito rotador','manguito'] },
    { token: 'serratus',          label: 'Serratus',         aliases: ['serrato'] },
    { token: 'biceps',            label: 'Biceps',           aliases: ['biceps','bíceps'] },
    { token: 'triceps',           label: 'Triceps',          aliases: ['triceps','tríceps'] },
    { token: 'forearm',           label: 'Forearm',          aliases: ['grip','antebrazo','agarre'] },
    { token: 'core',              label: 'Core',             aliases: ['abs','abdominals','abdominales'] },
    { token: 'obliques',          label: 'Obliques',         aliases: ['oblicuos'] },
    { token: 'ql',                label: 'QL',               aliases: ['quadratus lumborum','cuadrado lumbar'] },
    { token: 'erectors',          label: 'Spinal Erectors',  aliases: ['erector spinae','erectores','lumbares'] },
  ];

  // Region shortcuts — UI helpers. Expand to atomic tokens on select; the
  // region itself is NEVER stored. Use expandRegion(token).
  const MUSCLE_REGIONS = {
    lower_body:      ['quadriceps','hamstrings','glutes','glute_med','adductors','calves','soleus'],
    upper_body:      ['chest','shoulders','lats','upper_back','biceps','triceps','forearm'],
    full_body:       [], // intentionally empty: tag the actual atomic muscles
    posterior_chain: ['hamstrings','glutes','erectors'],
    anterior_chain:  ['quadriceps','hip_flexors','chest'],
  };

  // ── 4. MYOFASCIAL_CHAIN (Cadenas miofasciales) · optional · multi ─────
  // Anatomy Trains lines. "cadena posterior" in a RELEASE context lands here;
  // in a STRENGTH/HINGE context it is the muscular region shortcut (§3).
  const MYOFASCIAL_CHAIN = [
    { token: 'superficial_back_line',  label: 'Superficial Back Line',  aliases: ['sbl','cadena posterior','linea posterior superficial','línea posterior superficial','linha posterior'] },
    { token: 'superficial_front_line', label: 'Superficial Front Line', aliases: ['sfl','cadena anterior','linea anterior superficial','línea anterior superficial','linha anterior'] },
    { token: 'lateral_line',           label: 'Lateral Line',           aliases: ['ll','linea lateral','línea lateral','cadena lateral'] },
    { token: 'spiral_line',            label: 'Spiral Line',            aliases: ['spl','linea espiral','línea espiral'] },
    { token: 'deep_front_line',        label: 'Deep Front Line',        aliases: ['dfl','linea profunda anterior','línea profunda anterior','core line','nucleo','núcleo'] },
    { token: 'functional_lines',       label: 'Functional Lines',       aliases: ['fl','lineas funcionales','líneas funcionales','front functional','back functional'] },
    { token: 'arm_lines',              label: 'Arm Lines',              aliases: ['al','lineas del brazo','líneas del brazo'] },
  ];

  // ── 5. CONTRACTION_TYPE (Tipo de contracción) · optional · multi ──────
  // Multi handles your plyometric note: a depth jump = plyometric + eccentric.
  const CONTRACTION_TYPE = [
    { token: 'concentric', label: 'Concentric', desc: 'Muscle shortens under load.',                                       aliases: ['concentrica','concéntrica'] },
    { token: 'eccentric',  label: 'Eccentric',  desc: 'Muscle lengthens under load (incl. supramaximal eccentrics).',      aliases: ['excentrica','excéntrica','eccentrics','negatives'] },
    { token: 'isometric',  label: 'Isometric',  desc: 'Static, no length change (general).',                               aliases: ['isometrica','isométrica'] },
    { token: 'iso_hold',   label: 'Iso Hold',   desc: 'Sustained static hold of a load at a joint angle (e.g. lunge hold).',aliases: ['hold','sosten isometrico','sostén isométrico','isometric hold','natera'] },
    { token: 'iso_push',   label: 'Iso Push',   desc: 'Overcoming isometric — pushing against immovable resistance.',       aliases: ['overcoming','empuje isometrico','empuje isométrico'] },
    { token: 'iso_catch',  label: 'Iso Catch',  desc: 'Yielding isometric — decelerating / holding under load.',           aliases: ['yielding','catch','frenado','contencion','contención'] },
    { token: 'isotonic',   label: 'Isotonic',   desc: 'Full dynamic rep (concentric + eccentric); default for most lifts.', aliases: ['isotonica','isotónica','dinamica completa','dinámica completa','dynamic'] },
    { token: 'plyometric', label: 'Plyometric', desc: 'Stretch-shortening cycle, reactive.',                               aliases: ['plyo','pliometrica','pliométrica','cea','ssc','reactive'] },
  ];

  // ── 6. MOVEMENT_SPEED (Velocidad del movimiento) · optional · multi ───
  const MOVEMENT_SPEED = [
    { token: 'max_strength',   label: 'Max Strength',   desc: 'Heavy load, low velocity end.',                          aliases: ['fuerza maxima','fuerza máxima','maximal strength','grind'] },
    { token: 'strength_speed', label: 'Strength-Speed', desc: 'Accelerating heavy–moderate loads.',                     aliases: ['fuerza-velocidad','fuerza velocidad'] },
    { token: 'speed_strength', label: 'Speed-Strength', desc: 'Light–moderate loads, high velocity (power zone).',      aliases: ['velocidad-fuerza','velocidad fuerza','potencia','power'] },
    { token: 'max_velocity',   label: 'Max Velocity',   desc: 'Minimal load, peak velocity (sprint, ballistic).',       aliases: ['velocidad maxima','velocidad máxima','ballistic'] },
    { token: 'supramaximal',   label: 'Supramaximal',   desc: 'Beyond max: overspeed (assisted) or supramaximal eccentric.', aliases: ['supramaxima','supramáxima','overspeed','assisted'] },
  ];

  // ── 7. PLANE (Plano) · optional · multi ───────────────────────────────
  const PLANE = [
    { token: 'sagittal',    label: 'Sagittal',    desc: 'Forward/backward — flexion/extension.',     aliases: ['sagital'] },
    { token: 'frontal',     label: 'Frontal',     desc: 'Side-to-side — abduction/adduction.',       aliases: ['lateral plane','coronal'] },
    { token: 'transverse',  label: 'Transverse',  desc: 'Rotational / horizontal.',                  aliases: ['transversal','rotational','rotacional'] },
    { token: 'multiplanar', label: 'Multiplanar', desc: 'Combined / 3D.',                             aliases: ['3d','combined'] },
  ];

  // ── 8. MOVEMENT_PATTERN (Patrón de movimiento) · required · multi ─────
  const MOVEMENT_PATTERN = [
    { token: 'horizontal_push',      label: 'Horizontal Push',      aliases: ['empuje horizontal','press','bench press'] },
    { token: 'vertical_push',        label: 'Vertical Push',        aliases: ['empuje vertical','overhead press','shoulder press'] },
    { token: 'horizontal_pull',      label: 'Horizontal Pull',      aliases: ['traccion horizontal','tracción horizontal','row','remo'] },
    { token: 'vertical_pull',        label: 'Vertical Pull',        aliases: ['traccion vertical','tracción vertical','pull-up','pulldown'] },
    { token: 'squat',                label: 'Squat',                aliases: ['sentadilla'] },
    { token: 'hinge',                label: 'Hinge',                aliases: ['bisagra','hip hinge','deadlift','peso muerto'] },
    { token: 'lunge',                label: 'Lunge',                aliases: ['zancada','split squat','estocada'] },
    { token: 'single_leg',           label: 'Single-leg',           aliases: ['unilateral','monopodal'] },
    { token: 'carry',                label: 'Carry',                aliases: ['loaded carry','transporte','acarreo'] },
    { token: 'rotation',             label: 'Rotation',             aliases: ['rotacion','rotación','rotacional'] },
    { token: 'anti_rotation',        label: 'Anti-rotation',        aliases: ['anti-rotacion','anti-rotación','pallof'] },
    { token: 'anti_extension',       label: 'Anti-extension',       aliases: ['anti-extension','anti-extensión','plank','plancha'] },
    { token: 'anti_lateral_flexion', label: 'Anti-lateral-flexion', aliases: ['anti-flexion lateral','anti-flexión lateral','suitcase','side plank'] },
    { token: 'jump',                 label: 'Jump',                 aliases: ['salto','jumping'] },
    { token: 'landing',              label: 'Landing',              aliases: ['aterrizaje','deceleration','frenado'] },
    { token: 'locomotion',           label: 'Locomotion',          aliases: ['sprint','gait','carrera','run','skip','marcha'] },
    { token: 'isometric_hold',       label: 'Isometric Hold',       aliases: ['hold estatico','hold estático','wall sit','sentadilla isometrica'] },
  ];

  // ── Registry + helpers ────────────────────────────────────────────────
  const LISTS = {
    purpose: PURPOSE,
    equipment: EQUIPMENT,
    muscle_group: MUSCLE_GROUP,
    movement_pattern: MOVEMENT_PATTERN,
    myofascial_chain: MYOFASCIAL_CHAIN,
    contraction_type: CONTRACTION_TYPE,
    movement_speed: MOVEMENT_SPEED,
    plane: PLANE,
  };

  // normalize free-text for matching: lowercase, strip accents, collapse
  // whitespace and hyphens to single spaces.
  function norm(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Build per-dimension indexes once: token set, alias→token map, label map.
  const INDEX = {};
  for (const dim of Object.keys(LISTS)) {
    const tokenSet = new Set();
    const aliasMap = new Map();
    const labelMap = new Map();
    for (const item of LISTS[dim]) {
      tokenSet.add(item.token);
      labelMap.set(item.token, item.label);
      // the token itself and its normalized label resolve to the token
      aliasMap.set(norm(item.token), item.token);
      aliasMap.set(norm(item.token.replace(/_/g, ' ')), item.token);
      aliasMap.set(norm(item.label), item.token);
      for (const a of (item.aliases || [])) aliasMap.set(norm(a), item.token);
    }
    INDEX[dim] = { tokenSet, aliasMap, labelMap };
  }

  // resolve(dimension, input) → canonical token | null
  function resolve(dimension, input) {
    const idx = INDEX[dimension];
    if (!idx) return null;
    return idx.aliasMap.get(norm(input)) || null;
  }

  // expandRegion(token) → atomic muscle tokens (or [token] if not a region)
  function expandRegion(token) {
    return MUSCLE_REGIONS[token] ? MUSCLE_REGIONS[token].slice() : [token];
  }

  function isValid(dimension, token) {
    const idx = INDEX[dimension];
    return !!idx && idx.tokenSet.has(token);
  }

  function label(dimension, token) {
    const idx = INDEX[dimension];
    return (idx && idx.labelMap.get(token)) || token;
  }

  function tokens(dimension) {
    return (LISTS[dimension] || []).map(function (i) { return i.token; });
  }

  const TAXONOMY = {
    DIMENSIONS, MUSCLE_REGIONS,
    PURPOSE, EQUIPMENT, MUSCLE_GROUP, MOVEMENT_PATTERN,
    MYOFASCIAL_CHAIN, CONTRACTION_TYPE, MOVEMENT_SPEED, PLANE,
    LISTS,
    norm, resolve, expandRegion, isValid, label, tokens,
  };

  if (typeof window !== 'undefined') window.CMTaxonomy = TAXONOMY;
  if (typeof module !== 'undefined' && module.exports) module.exports = TAXONOMY;
})();
