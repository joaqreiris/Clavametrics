# ClavaMetrics — Exercise Taxonomy (review draft)

Canonical vocabulary for `gym_exercises`. **Review this, mark add/remove/rename, then we write `lib/exercise-taxonomy.js` + the additive migration.**

## Ground rules (how this is stored & shown)

- **Token** = canonical, English, `snake_case`, **immutable**. This is the *only* thing stored in the DB.
- **Label** = display text. English here; ES/PT come from `i18n.js` later. Changing a label never touches data.
- **Aliases** = free-text inputs that resolve to the token (the seed for the learned-alias resolver). They are how "empuje de cadera", "hip thrust", "hinge" all land on the right token, in any language.
- **Required** dimensions must be set on every exercise. **Optional** ones enrich search/AI but can be blank.
- **Multi** = array (`text[]`), an exercise can hold several. **Single** = one value.
- **Load (light/heavy) is NOT a tag here** — it lives in the plan. An exercise carries *all* its possible purposes; the session decides which one is used.

---

## 1. `purpose` — Finalidad
**Required (1 primary) · Multi (secondary optional)**

The role of the exercise in the session. The order below is a **suggested default only** — each coach reorders it as their own method (this lives as a *user preference*, not in the taxonomy).

| Token | Label | Description | Aliases |
|---|---|---|---|
| `rise_temperature` | Rise Temperature | Warm-up: raise core temperature and general readiness, including active mobility (RAMP-style). | warm up, warm-up, raise, RAMP, mobility, entrada en calor, calentamiento, movilidad, aquecimento |
| `release` | Release | Soft-tissue / myofascial release and elongation before work. | liberación, soft tissue, foam rolling, SMR, elongación, soltura, liberação |
| `activation` | Activation | Pre-activate the target musculature before loading. | activación, glute activation, primer, ativação |
| `power` | Power | High-velocity force expression. | potencia, explosividad, RFD, potência |
| `strength` | Strength | Maximal / submaximal force development. | fuerza, força |
| `conditioning` | Conditioning | Aerobic / anaerobic metabolic work. | acondicionamiento, metabolic, energy systems, cardio, condicionamento |
| `prevention` | Prevention | Injury prevention / prehab, incl. balance & proprioception. | prevención, prehab, preventive, propiocepción, equilibrio, balance, prevenção |
| `cooldown` | Cooldown | Down-regulation, static stretch, recovery. | vuelta a la calma, cool down, recovery, recuperación, volta à calma |

> Note: old `category` retires into this. `mobility` → absorbed by `rise_temperature`; `balance` → absorbed by `prevention` (your call, confirmed).

---

## 2. `equipment` — Material
**Required · Multi**

The implement(s) the exercise needs. `bodyweight` = no equipment.

| Token | Label | Aliases |
|---|---|---|
| `bodyweight` | Bodyweight | none, no equipment, peso corporal, sin material |
| `barbell` | Barbell | barra |
| `dumbbell` | Dumbbell | dumbbells, DB, mancuerna, mancuernas |
| `kettlebell` | Kettlebell | KB, pesa rusa |
| `trap_bar` | Trap Bar | hex bar, barra hexagonal |
| `band` | Band | resistance band, banda |
| `mini_band` | Mini-band | loop band, mini banda, banda circular |
| `cable` | Cable | polea, pulley |
| `conical_pulley` | Conical Pulley | polea cónica, versapulley |
| `flywheel` | Flywheel | inertial, yoyo, yo-yo squat, kbox, inercial, isoinercial |
| `bench` | Bench | banco |
| `box` | Box | cajón |
| `plyo_box` | Plyo Box | cajón pliométrico, plyobox |
| `step` | Step | escalón |
| `wall` | Wall | pared |
| `pull_up_bar` | Pull-up Bar | barra de dominadas |
| `sled` | Sled | trineo, prowler |
| `med_ball` | Medicine Ball | medicine ball, balón medicinal, balon medicinal |
| `foam_roller` | Foam Roller | rodillo, foam |
| `swiss_ball` | Swiss Ball | fitball, stability ball, pelota suiza |
| `bosu` | Bosu | bosu ball |
| `wobble_board` | Wobble Board | balance board, tabla de equilibrio |
| `ab_wheel` | Ab Wheel | rueda abdominal |
| `sliders` | Sliders | discos deslizantes, valslides |
| `rower` | Rower | remo, rowing erg |
| `bike` | Bike | assault bike, watt bike, bici, bicicleta |
| `ski_erg` | SkiErg | ski |
| `treadmill` | Treadmill | cinta, caminadora |
| `battle_ropes` | Battle Ropes | ropes, sogas, cuerdas |
| `cones` | Cones | conos |
| `hurdles` | Hurdles | vallas |
| `mini_hurdles` | Mini-hurdles | wickets, mini vallas |
| `agility_ladder` | Agility Ladder | ladder, escalera de agilidad |
| `pad` | Pad | colchoneta, almohadilla |
| `partner` | Partner | companion, compañero, manual resistance |

---

## 3. `muscle_group` — Grupo muscular
**Required · Multi · atomic muscles only**

What the exercise loads. Atomic only — region shortcuts (below) expand on select but are **not stored**.

| Token | Label | Aliases |
|---|---|---|
| `quadriceps` | Quadriceps | quads, cuádriceps |
| `hamstrings` | Hamstrings | isquios, isquiosurales, isquiotibiales |
| `glutes` | Glutes | glute max, glúteo mayor, gluteo |
| `glute_med` | Glute Med | gluteus medius, glúteo medio |
| `adductors` | Adductors | aductores, groin, ingle |
| `hip_flexors` | Hip Flexors | flexores de cadera, psoas |
| `calves` | Calves | gastrocnemius, gemelos |
| `soleus` | Soleus | sóleo |
| `tibialis_anterior` | Tibialis Anterior | tibial, tibialis, tibial anterior |
| `chest` | Chest | pecs, pectoral, pectorales |
| `shoulders` | Shoulders | deltoids, deltoides, hombro |
| `lats` | Lats | latissimus, dorsal, dorsales |
| `upper_back` | Upper Back | espalda alta, mid back |
| `lower_traps` | Lower Traps | trapecio inferior |
| `rotator_cuff` | Rotator Cuff | cuff, manguito rotador |
| `serratus` | Serratus | serrato |
| `biceps` | Biceps | bíceps |
| `triceps` | Triceps | tríceps |
| `forearm` | Forearm | grip, antebrazo, agarre |
| `core` | Core | abs, abdominals, abdominales |
| `obliques` | Obliques | oblicuos |
| `ql` | QL | quadratus lumborum, cuadrado lumbar |
| `erectors` | Spinal Erectors | erector spinae, erectores, lumbares |

**Region shortcuts** (UI helpers — expand to atomic tokens on select, not stored):
`lower_body`, `upper_body`, `full_body`, `posterior_chain` (→ hamstrings + glutes + erectors), `anterior_chain` (→ quadriceps + hip_flexors + chest).

> Disambiguation: "cadena posterior" used in a **strength/hinge** context = this region shortcut (muscular). Used in a **release** context = the fascial line in §4. The AI resolves it by the exercise's `purpose`.

---

## 4. `myofascial_chains` — Cadenas miofasciales
**Optional · Multi**

The fascial line being released / elongated (Anatomy Trains). Aliases carry the common ES/PT names.

| Token | Label | Aliases |
|---|---|---|
| `superficial_back_line` | Superficial Back Line | SBL, cadena posterior, línea posterior superficial, linha posterior |
| `superficial_front_line` | Superficial Front Line | SFL, cadena anterior, línea anterior superficial, linha anterior |
| `lateral_line` | Lateral Line | LL, línea lateral, cadena lateral |
| `spiral_line` | Spiral Line | SPL, línea espiral |
| `deep_front_line` | Deep Front Line | DFL, línea profunda anterior, core line, núcleo |
| `functional_lines` | Functional Lines | FL, líneas funcionales, front functional, back functional |
| `arm_lines` | Arm Lines | AL, líneas del brazo |

---

## 5. `contraction_type` — Tipo de contracción
**Optional · Multi**

The muscle action emphasized. Multi resolves your plyometric note — a depth jump is `plyometric` **+** `eccentric` at once.

| Token | Label | Description | Aliases |
|---|---|---|---|
| `concentric` | Concentric | Muscle shortens under load. | concéntrica, concentrica |
| `eccentric` | Eccentric | Muscle lengthens under load (incl. supramaximal eccentrics). | excéntrica, eccentrics, negatives |
| `isometric` | Isometric | Static, no length change (general). | isométrica, isometrica |
| `iso_hold` | Iso Hold | Sustained static hold at a joint angle. | hold, sostén isométrico, isometric hold |
| `iso_push` | Iso Push | Overcoming isometric — pushing against immovable resistance. | overcoming, empuje isométrico |
| `iso_catch` | Iso Catch | Yielding isometric — decelerating / holding under load. | yielding, catch, frenado, contención |
| `isotonic` | Isotonic | Full dynamic rep (concentric + eccentric); the default for most lifts. | isotónica, dinámica completa, dynamic |
| `plyometric` | Plyometric | Stretch-shortening cycle, reactive. | plyo, pliométrica, CEA, SSC, reactive |

---

## 6. `movement_speed` — Velocidad del movimiento
**Optional · Multi**

Where it sits on the force–velocity continuum.

| Token | Label | Description | Aliases |
|---|---|---|---|
| `max_strength` | Max Strength | Heavy load, low velocity end. | fuerza máxima, maximal strength, grind |
| `strength_speed` | Strength-Speed | Accelerating heavy–moderate loads. | fuerza-velocidad |
| `speed_strength` | Speed-Strength | Light–moderate loads, high velocity (power zone). | velocidad-fuerza, potencia, power |
| `max_velocity` | Max Velocity | Minimal load, peak velocity (sprint, ballistic). | velocidad máxima, ballistic |
| `supramaximal` | Supramaximal | Beyond max: overspeed (assisted) or supramaximal eccentric. | supramáxima, overspeed, assisted |

> Supramaximal eccentrics = `supramaximal` (speed) + `eccentric` (contraction). Overspeed sprint = `supramaximal` + `max_velocity`.

---

## 7. `plane` — Plano
**Optional · Multi**

Anatomical plane of the movement.

| Token | Label | Description | Aliases |
|---|---|---|---|
| `sagittal` | Sagittal | Forward/backward — flexion/extension. | sagital |
| `frontal` | Frontal | Side-to-side — abduction/adduction, lateral. | frontal, lateral plane, coronal |
| `transverse` | Transverse | Rotational / horizontal. | transversal, rotational, rotacional |
| `multiplanar` | Multiplanar | Combined / 3D. | multiplanar, 3d, combined |

---

## 8. `movement_pattern` — Patrón de movimiento
**Required · Multi**

The fundamental gesture.

| Token | Label | Aliases |
|---|---|---|
| `squat` | Squat | sentadilla |
| `hinge` | Hinge | bisagra, hip hinge, deadlift, peso muerto |
| `lunge` | Lunge | zancada, split squat |
| `single_leg` | Single-leg | unilateral, monopodal |
| `horizontal_push` | Horizontal Push | empuje horizontal, press, bench |
| `vertical_push` | Vertical Push | empuje vertical, overhead press |
| `horizontal_pull` | Horizontal Pull | tracción horizontal, row, remo |
| `vertical_pull` | Vertical Pull | tracción vertical, pull-up, pulldown |
| `carry` | Carry | loaded carry, transporte, acarreo |
| `rotation` | Rotation | rotación, rotacional |
| `anti_rotation` | Anti-rotation | anti-rotación, pallof |
| `anti_extension` | Anti-extension | anti-extensión, plank |
| `anti_lateral_flexion` | Anti-lateral-flexion | anti-flexión lateral, suitcase |
| `jump` | Jump | salto, jumping |
| `landing` | Landing | aterrizaje, deceleration |
| `locomotion` | Locomotion | sprint, gait, carrera, run, skip |
| `isometric_hold` | Isometric Hold | hold estático, wall sit |

---

## Open items for your last pass
1. Anything to **add / remove / rename** in any of the eight lists?
2. `equipment`: ok to merge `dumbbell(s)`, `KB/DB`, `assault/watt bike → bike`, `wobble/balance board`? Did I miss any implement you use?
3. `muscle_group`: ok keeping it atomic with the 5 region shortcuts, or do you want more regions?
4. `movement_pattern`: `isometric_hold` overlaps a bit with `anti_extension`/`anti_lateral_flexion` (planks). Keep it for pure holds (wall sit), or drop it?
