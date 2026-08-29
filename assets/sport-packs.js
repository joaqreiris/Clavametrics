// ClavaMetrics — Sport packs (declarative, single source of truth per sport)
// Include before positions.js / sport.js:  <script src="assets/sport-packs.js"></script>
//
// WHY THIS FILE EXISTS
// The app was written in football. Positions, lineups, match stats, load metrics and the
// weekly MD-x model all assume eleven players, one goalkeeper and one match per week. To
// serve basketball, futsal, rugby or hockey we do NOT branch on the sport in 60 files:
// every sport-specific fact lives HERE, as data, and the pages read it through CMSport.
//
// A pack is pure data — no DOM, no network, no Supabase. Adding a sport = adding an entry.
//
// SCOPE NOTE (phase 0): only `positions` and `field` are consumed today. The rest of each
// pack (match, load, tests, micro, tactics, drills, anthro, vocab) is declared now so the
// later phases have somewhere to read from, and so adding a sport stays a one-file change.
// Volleyball and handball are deliberately absent from v1 but the shape supports them:
// `load.tracking = 'imu'` and jump-count metrics are part of the model from day one.

(function () {
  if (window.CM_SPORT_PACKS) return;   // idempotent

  /* ============================================================
     POSITION MODEL (mirrors the football one in positions.js)

       cfg        code → { group, basic, order }
                  `basic` is the ROLL-UP used for "vs position" baselines: a 25-man squad
                  spread over 20 detailed codes leaves ~1 player each, which would compare
                  a player against himself. Rolling up gives a real reference set.
       groups     display buckets, in order. `icon` + `i18n` feed Squad's grouped list.
                  i18n keys are namespaced per sport so "Forwards" (football attackers) and
                  "Forwards" (rugby pack) never collide in the locale files.
       cssByBasic maps a basic code onto one of the SIX existing colour classes in Squad
                  (gk / cb / fb / mf / wg / st) — reusing the palette means no new CSS.
       aliases    free text (any provider, any language) → canonical code.
       selectable ordered list for <select>s.
     ============================================================ */

  /* ---- FOOTBALL — extracted verbatim from positions.js / Squad.html --------- */
  const FOOTBALL_POSITIONS = {
    groups: [
      { key: 'Goalkeepers', i18n: 'squad.group_goalkeepers', icon: 'ti-shield' },
      { key: 'Defenders',   i18n: 'squad.group_defenders',   icon: 'ti-wall' },
      { key: 'Midfielders', i18n: 'squad.group_midfielders', icon: 'ti-circles-relation' },
      { key: 'Wingers',     i18n: 'squad.group_wingers',     icon: 'ti-flame' },
      { key: 'Forwards',    i18n: 'squad.group_forwards',    icon: 'ti-target-arrow' },
    ],
    basics: ['GK', 'CB', 'FB', 'MF', 'WG', 'ST'],
    cssByBasic: { GK: 'gk', CB: 'cb', FB: 'fb', MF: 'mf', WG: 'wg', ST: 'st' },
    cfg: {
      GK:  { group: 'Goalkeepers', basic: 'GK', order: 0 },

      CB:  { group: 'Defenders',   basic: 'CB', order: 1 },
      LB:  { group: 'Defenders',   basic: 'FB', order: 1 },
      RB:  { group: 'Defenders',   basic: 'FB', order: 1 },
      FB:  { group: 'Defenders',   basic: 'FB', order: 1 },
      WB:  { group: 'Defenders',   basic: 'FB', order: 1 },
      LWB: { group: 'Defenders',   basic: 'FB', order: 1 },
      RWB: { group: 'Defenders',   basic: 'FB', order: 1 },

      DM:  { group: 'Midfielders', basic: 'MF', order: 2 },
      CDM: { group: 'Midfielders', basic: 'MF', order: 2 },
      CM:  { group: 'Midfielders', basic: 'MF', order: 2 },
      MF:  { group: 'Midfielders', basic: 'MF', order: 2 },
      CAM: { group: 'Midfielders', basic: 'MF', order: 2 },
      AM:  { group: 'Midfielders', basic: 'MF', order: 2 },

      LM:  { group: 'Wingers',     basic: 'WG', order: 3 },
      RM:  { group: 'Wingers',     basic: 'WG', order: 3 },
      WG:  { group: 'Wingers',     basic: 'WG', order: 3 },
      LW:  { group: 'Wingers',     basic: 'WG', order: 3 },
      RW:  { group: 'Wingers',     basic: 'WG', order: 3 },

      ST:  { group: 'Forwards',    basic: 'ST', order: 4 },
      CF:  { group: 'Forwards',    basic: 'ST', order: 4 },
      SS:  { group: 'Forwards',    basic: 'ST', order: 4 },
      '9': { group: 'Forwards',    basic: 'ST', order: 4 },

      // Full names occasionally stored by older imports
      GOALKEEPER: { group: 'Goalkeepers', basic: 'GK', order: 0 },
      DEFENDER:   { group: 'Defenders',   basic: 'CB', order: 1 },
      MIDFIELDER: { group: 'Midfielders', basic: 'MF', order: 2 },
      WINGER:     { group: 'Wingers',     basic: 'WG', order: 3 },
      FORWARD:    { group: 'Forwards',    basic: 'ST', order: 4 },
    },
    aliases: {
      GOALKEEPER:'GK', PORTERO:'GK', ARQUERO:'GK', GUARDAMETA:'GK', GOLERO:'GK', POR:'GK', GUARDAVALLAS:'GK', PORTEIRO:'GK', GOLEIRO:'GK', KEEPER:'GK', 'GOAL KEEPER':'GK',
      DEFENDER:'CB', DEF:'CB', DF:'CB', DEFENSA:'CB', DEFENSOR:'CB', ZAGA:'CB', 'CENTRE BACK':'CB', 'CENTER BACK':'CB', 'CENTRE-BACK':'CB', 'CENTER-BACK':'CB', CENTRAL:'CB', 'DEFENSA CENTRAL':'CB', DC:'CB', ZAGUERO:'CB', ZAGUEIRO:'CB',
      'LEFT BACK':'LB', 'LEFT-BACK':'LB', 'LATERAL IZQUIERDO':'LB', 'LATERAL IZQ':'LB', LI:'LB',
      'RIGHT BACK':'RB', 'RIGHT-BACK':'RB', 'LATERAL DERECHO':'RB', 'LATERAL DER':'RB', LD:'RB',
      FULLBACK:'FB', 'FULL BACK':'FB', 'FULL-BACK':'FB', BACK:'FB', LATERAL:'FB', LATERAIS:'FB',
      'WING BACK':'WB', WINGBACK:'WB', CARRILERO:'WB',
      'LEFT WING BACK':'LWB', 'RIGHT WING BACK':'RWB',
      'DEFENSIVE MIDFIELDER':'CDM', 'DEFENSIVE MID':'CDM', MCD:'CDM', PIVOTE:'CDM', PIVOT:'CDM', 'MEDIOCENTRO DEFENSIVO':'CDM', 'VOLANTE DEFENSIVO':'CDM',
      'CENTRAL MIDFIELDER':'CM', 'CENTRAL MID':'CM', MEDIOCENTRO:'CM', MC:'CM', VOLANTE:'CM', MEIA:'CM',
      'ATTACKING MIDFIELDER':'CAM', 'ATTACKING MID':'CAM', MCO:'CAM', MEDIAPUNTA:'CAM', ENGANCHE:'CAM',
      MIDFIELDER:'CM', MID:'CM', MEDIO:'CM', MEDIOCAMPO:'CM', MEDIOCAMPISTA:'CM', MEIOCAMPISTA:'CM',
      'LEFT MIDFIELDER':'LM', 'LEFT MID':'LM', 'RIGHT MIDFIELDER':'RM', 'RIGHT MID':'RM',
      WINGER:'WG', WING:'WG', EXTREMO:'WG', PONTA:'WG',
      'LEFT WINGER':'LW', 'LEFT WING':'LW', 'EXTREMO IZQUIERDO':'LW', 'EXTREMO IZQ':'LW', EI:'LW',
      'RIGHT WINGER':'RW', 'RIGHT WING':'RW', 'EXTREMO DERECHO':'RW', 'EXTREMO DER':'RW', ED:'RW',
      STRIKER:'ST', DELANTERO:'ST', ATACANTE:'ST', DEL:'ST', DELANTEROS:'ST', ATACANTES:'ST',
      'CENTRE FORWARD':'CF', 'CENTER FORWARD':'CF', 'DELANTERO CENTRO':'CF',
      'SECOND STRIKER':'SS', 'SEGUNDA PUNTA':'SS', 'SEGUNDO DELANTERO':'SS',
      FORWARD:'ST', FW:'ST',
    },
    selectable: [
      'GK',
      'CB', 'LB', 'RB', 'WB', 'LWB', 'RWB', 'FB',
      'CDM', 'CM', 'CAM', 'LM', 'RM', 'MF',
      'LW', 'RW', 'WG',
      'ST', 'CF', 'SS',
    ],
    // Long names for the pickers. Football reuses the keys already translated in
    // locales/*.json; the other sports get their own `squad.pos_<sport>_<code>` keys.
    labels: {
      GK:  { i18n: 'squad.pos_gk',  en: 'GK — Goalkeeper' },
      CB:  { i18n: 'squad.pos_cb',  en: 'CB — Centre back' },
      LB:  { i18n: 'squad.pos_lb',  en: 'LB — Left back' },
      RB:  { i18n: 'squad.pos_rb',  en: 'RB — Right back' },
      WB:  { i18n: 'squad.pos_wb',  en: 'WB — Wing back' },
      LWB: { i18n: 'squad.pos_lwb', en: 'LWB — Left wing back' },
      RWB: { i18n: 'squad.pos_rwb', en: 'RWB — Right wing back' },
      FB:  { i18n: 'squad.pos_fb',  en: 'FB — Full back' },
      CDM: { i18n: 'squad.pos_cdm', en: 'CDM — Defensive mid' },
      CM:  { i18n: 'squad.pos_cm',  en: 'CM — Central mid' },
      CAM: { i18n: 'squad.pos_cam', en: 'CAM — Attacking mid' },
      LM:  { i18n: 'squad.pos_lm',  en: 'LM — Left mid' },
      RM:  { i18n: 'squad.pos_rm',  en: 'RM — Right mid' },
      MF:  { i18n: 'squad.pos_mf',  en: 'MF — Midfielder' },
      LW:  { i18n: 'squad.pos_lw',  en: 'LW — Left winger' },
      RW:  { i18n: 'squad.pos_rw',  en: 'RW — Right winger' },
      WG:  { i18n: 'squad.pos_wg',  en: 'WG — Winger' },
      ST:  { i18n: 'squad.pos_st',  en: 'ST — Striker' },
      CF:  { i18n: 'squad.pos_cf',  en: 'CF — Centre forward' },
      SS:  { i18n: 'squad.pos_ss',  en: 'SS — Second striker' },
    },
  };

  /* ---- FUTSAL — goalkeeper + fixo / ala / pivô ------------------------------ */
  const FUTSAL_POSITIONS = {
    groups: [
      { key: 'Goalkeepers', i18n: 'squad.group_goalkeepers',  icon: 'ti-shield' },
      { key: 'Defenders',   i18n: 'squad.group_fs_defenders', icon: 'ti-wall' },
      { key: 'Wingers',     i18n: 'squad.group_fs_wings',     icon: 'ti-flame' },
      { key: 'Forwards',    i18n: 'squad.group_fs_pivots',    icon: 'ti-target-arrow' },
    ],
    basics: ['GK', 'FX', 'AL', 'PV'],
    cssByBasic: { GK: 'gk', FX: 'cb', AL: 'wg', PV: 'st' },
    cfg: {
      GK:  { group: 'Goalkeepers', basic: 'GK', order: 0 },
      FX:  { group: 'Defenders',   basic: 'FX', order: 1 },   // fixo / cierre
      AL:  { group: 'Wingers',     basic: 'AL', order: 2 },   // ala
      ALD: { group: 'Wingers',     basic: 'AL', order: 2 },   // ala derecha
      ALI: { group: 'Wingers',     basic: 'AL', order: 2 },   // ala izquierda
      PV:  { group: 'Forwards',    basic: 'PV', order: 3 },   // pivô
      UNI: { group: 'Wingers',     basic: 'AL', order: 2 },   // universal (juega todo el frente)
    },
    aliases: {
      GOALKEEPER:'GK', PORTERO:'GK', ARQUERO:'GK', GOLEIRO:'GK', PORTEIRO:'GK', GOLERO:'GK', POR:'GK', KEEPER:'GK',
      FIXO:'FX', CIERRE:'FX', DEFENSA:'FX', DEFENDER:'FX', DEFENSOR:'FX', 'LAST MAN':'FX',
      ALA:'AL', WING:'AL', WINGER:'AL', ALAS:'AL', 'ALA DERECHA':'ALD', 'ALA DERECHO':'ALD', 'RIGHT WING':'ALD',
      'ALA IZQUIERDA':'ALI', 'ALA IZQUIERDO':'ALI', 'LEFT WING':'ALI',
      PIVO:'PV', 'PIVÔ':'PV', PIVOT:'PV', PIVOTE:'PV', 'TARGET MAN':'PV', DELANTERO:'PV', ATACANTE:'PV', FORWARD:'PV',
      UNIVERSAL:'UNI',
    },
    selectable: ['GK', 'FX', 'AL', 'ALD', 'ALI', 'PV', 'UNI'],
    labels: {
      GK:  { i18n: 'squad.pos_futsal_gk',  en: 'GK — Goalkeeper' },
      FX:  { i18n: 'squad.pos_futsal_fx',  en: 'FX — Fixo / last man' },
      AL:  { i18n: 'squad.pos_futsal_al',  en: 'AL — Winger' },
      ALD: { i18n: 'squad.pos_futsal_ald', en: 'ALD — Right winger' },
      ALI: { i18n: 'squad.pos_futsal_ali', en: 'ALI — Left winger' },
      PV:  { i18n: 'squad.pos_futsal_pv',  en: 'PV — Pivot / target man' },
      UNI: { i18n: 'squad.pos_futsal_uni', en: 'UNI — Universal' },
    },
  };

  /* ---- BASKETBALL — 1..5, rolled up to guards / wings / bigs ---------------- */
  const BASKETBALL_POSITIONS = {
    groups: [
      { key: 'Guards', i18n: 'squad.group_bb_guards', icon: 'ti-circles-relation' },
      { key: 'Wings',  i18n: 'squad.group_bb_wings',  icon: 'ti-flame' },
      { key: 'Bigs',   i18n: 'squad.group_bb_bigs',   icon: 'ti-target-arrow' },
    ],
    basics: ['G', 'W', 'B'],
    cssByBasic: { G: 'mf', W: 'wg', B: 'st' },
    cfg: {
      PG:  { group: 'Guards', basic: 'G', order: 0 },   // 1 — base / armador
      SG:  { group: 'Guards', basic: 'G', order: 1 },   // 2 — escolta
      SF:  { group: 'Wings',  basic: 'W', order: 2 },   // 3 — alero
      PF:  { group: 'Bigs',   basic: 'B', order: 3 },   // 4 — ala-pívot
      C:   { group: 'Bigs',   basic: 'B', order: 4 },   // 5 — pívot
      // Hybrids clubs actually write down
      CG:  { group: 'Guards', basic: 'G', order: 1 },   // combo guard
      GF:  { group: 'Wings',  basic: 'W', order: 2 },   // guard-forward
      FC:  { group: 'Bigs',   basic: 'B', order: 3 },   // forward-center
    },
    aliases: {
      '1':'PG', 'POINT GUARD':'PG', BASE:'PG', ARMADOR:'PG', 'ARMADOR BASE':'PG', PLAYMAKER:'PG', 'ARMADOR DE JUEGO':'PG', 'BASE ARMADOR':'PG',
      '2':'SG', 'SHOOTING GUARD':'SG', ESCOLTA:'SG', 'ALA ARMADOR':'SG', 'ARMADOR ESCOLTA':'SG',
      '3':'SF', 'SMALL FORWARD':'SF', ALERO:'SF', 'ALA PEQUENO':'SF', 'ALA-PEQUENO':'SF',
      '4':'PF', 'POWER FORWARD':'PF', 'ALA PIVOT':'PF', 'ALA-PIVOT':'PF', 'ALA PIVO':'PF', 'ALA-PIVO':'PF', 'ALA FORTE':'PF',
      '5':'C', CENTER:'C', CENTRE:'C', CENTRO:'C', PIVOT:'C', PIVOTE:'C', PIVO:'C', 'PIVÔ':'C',
      'COMBO GUARD':'CG', 'GUARD FORWARD':'GF', 'GUARD-FORWARD':'GF', 'FORWARD CENTER':'FC', 'FORWARD-CENTER':'FC',
      GUARD:'SG', FORWARD:'SF', ALA:'SF',
    },
    selectable: ['PG', 'SG', 'SF', 'PF', 'C', 'CG', 'GF', 'FC'],
    labels: {
      PG: { i18n: 'squad.pos_bb_pg', en: 'PG — Point guard' },
      SG: { i18n: 'squad.pos_bb_sg', en: 'SG — Shooting guard' },
      SF: { i18n: 'squad.pos_bb_sf', en: 'SF — Small forward' },
      PF: { i18n: 'squad.pos_bb_pf', en: 'PF — Power forward' },
      C:  { i18n: 'squad.pos_bb_c',  en: 'C — Center' },
      CG: { i18n: 'squad.pos_bb_cg', en: 'CG — Combo guard' },
      GF: { i18n: 'squad.pos_bb_gf', en: 'GF — Guard-forward' },
      FC: { i18n: 'squad.pos_bb_fc', en: 'FC — Forward-center' },
    },
  };

  /* ---- RUGBY UNION — 1..15, rolled up the way the literature splits them -----
     Forwards vs backs is THE partition for load analysis: forwards accumulate the
     collisions, backs the high-speed running. Averaging both together is meaningless,
     so `group` carries that split and `basic` gives the finer unit (front row, back
     three…) that still leaves a usable reference set in a 30-man squad. */
  const RUGBY_POSITIONS = {
    groups: [
      { key: 'Pack',  i18n: 'squad.group_rg_forwards', icon: 'ti-wall' },
      { key: 'Backs', i18n: 'squad.group_rg_backs',    icon: 'ti-flame' },
    ],
    basics: ['FR', 'SR', 'BR', 'HB', 'CTR', 'B3'],
    cssByBasic: { FR: 'cb', SR: 'fb', BR: 'gk', HB: 'mf', CTR: 'wg', B3: 'st' },
    cfg: {
      PR:  { group: 'Pack',  basic: 'FR',  order: 0 },   // 1 & 3 — pilar / prop
      HK:  { group: 'Pack',  basic: 'FR',  order: 0 },   // 2 — hooker
      LK:  { group: 'Pack',  basic: 'SR',  order: 1 },   // 4 & 5 — segunda línea / lock
      FL:  { group: 'Pack',  basic: 'BR',  order: 2 },   // 6 & 7 — ala / flanker
      N8:  { group: 'Pack',  basic: 'BR',  order: 2 },   // 8 — octavo / number eight
      SH:  { group: 'Backs', basic: 'HB',  order: 3 },   // 9 — medio scrum
      FH:  { group: 'Backs', basic: 'HB',  order: 3 },   // 10 — apertura
      IC:  { group: 'Backs', basic: 'CTR', order: 4 },   // 12 — primer centro
      OC:  { group: 'Backs', basic: 'CTR', order: 4 },   // 13 — segundo centro
      WG:  { group: 'Backs', basic: 'B3',  order: 5 },   // 11 & 14 — wing
      FB:  { group: 'Backs', basic: 'B3',  order: 5 },   // 15 — fullback / zaguero
    },
    aliases: {
      '1':'PR', '3':'PR', PROP:'PR', PILAR:'PR', 'LOOSE HEAD':'PR', 'LOOSEHEAD':'PR', 'TIGHT HEAD':'PR', 'TIGHTHEAD':'PR', 'PILAR IZQUIERDO':'PR', 'PILAR DERECHO':'PR',
      '2':'HK', HOOKER:'HK', TALONADOR:'HK',
      '4':'LK', '5':'LK', LOCK:'LK', 'SECOND ROW':'LK', 'SEGUNDA LINEA':'LK', 'SEGUNDA LÍNEA':'LK', SALTADOR:'LK',
      '6':'FL', '7':'FL', FLANKER:'FL', ALA:'FL', 'FLANKER ABIERTO':'FL', 'FLANKER CERRADO':'FL', 'OPENSIDE':'FL', 'BLINDSIDE':'FL',
      '8':'N8', 'NUMBER 8':'N8', 'NUMBER EIGHT':'N8', OCTAVO:'N8', 'No 8':'N8', 'N 8':'N8',
      '9':'SH', 'SCRUM HALF':'SH', 'SCRUM-HALF':'SH', SCRUMHALF:'SH', 'MEDIO SCRUM':'SH', 'MEDIO MELE':'SH', 'MEDIO MELÉ':'SH',
      '10':'FH', 'FLY HALF':'FH', 'FLY-HALF':'FH', FLYHALF:'FH', APERTURA:'FH', 'STAND OFF':'FH', 'OUTSIDE HALF':'FH',
      '12':'IC', 'INSIDE CENTRE':'IC', 'INSIDE CENTER':'IC', 'PRIMER CENTRO':'IC', 'PRIMEIRO CENTRO':'IC',
      '13':'OC', 'OUTSIDE CENTRE':'OC', 'OUTSIDE CENTER':'OC', 'SEGUNDO CENTRO':'OC', CENTRE:'IC', CENTER:'IC', CENTRO:'IC',
      '11':'WG', '14':'WG', WING:'WG', WINGER:'WG', WINGS:'WG', 'ALA WING':'WG', PONTA:'WG', 'WING IZQUIERDO':'WG', 'WING DERECHO':'WG',
      '15':'FB', FULLBACK:'FB', 'FULL BACK':'FB', 'FULL-BACK':'FB', ZAGUERO:'FB', ZAGUEIRO:'FB',
      FORWARD:'FL', FORWARDS:'FL', BACK:'IC', BACKS:'IC', DELANTERO:'FL', 'TRES CUARTOS':'IC',
    },
    selectable: ['PR', 'HK', 'LK', 'FL', 'N8', 'SH', 'FH', 'IC', 'OC', 'WG', 'FB'],
    labels: {
      PR: { i18n: 'squad.pos_rg_pr', en: 'PR — Prop (1, 3)' },
      HK: { i18n: 'squad.pos_rg_hk', en: 'HK — Hooker (2)' },
      LK: { i18n: 'squad.pos_rg_lk', en: 'LK — Lock (4, 5)' },
      FL: { i18n: 'squad.pos_rg_fl', en: 'FL — Flanker (6, 7)' },
      N8: { i18n: 'squad.pos_rg_n8', en: 'N8 — Number eight (8)' },
      SH: { i18n: 'squad.pos_rg_sh', en: 'SH — Scrum-half (9)' },
      FH: { i18n: 'squad.pos_rg_fh', en: 'FH — Fly-half (10)' },
      IC: { i18n: 'squad.pos_rg_ic', en: 'IC — Inside centre (12)' },
      OC: { i18n: 'squad.pos_rg_oc', en: 'OC — Outside centre (13)' },
      WG: { i18n: 'squad.pos_rg_wg', en: 'WG — Wing (11, 14)' },
      FB: { i18n: 'squad.pos_rg_fb', en: 'FB — Fullback (15)' },
    },
  };

  /* ---- FIELD HOCKEY — goalkeeper / backs / midfield / forwards -------------- */
  const HOCKEY_POSITIONS = {
    groups: [
      { key: 'Goalkeepers', i18n: 'squad.group_goalkeepers',  icon: 'ti-shield' },
      { key: 'Defenders',   i18n: 'squad.group_hk_defenders', icon: 'ti-wall' },
      { key: 'Midfielders', i18n: 'squad.group_hk_midfield',  icon: 'ti-circles-relation' },
      { key: 'Forwards',    i18n: 'squad.group_hk_forwards',  icon: 'ti-target-arrow' },
    ],
    basics: ['GK', 'DEF', 'MID', 'FWD'],
    cssByBasic: { GK: 'gk', DEF: 'cb', MID: 'mf', FWD: 'st' },
    cfg: {
      GK: { group: 'Goalkeepers', basic: 'GK',  order: 0 },
      SW: { group: 'Defenders',   basic: 'DEF', order: 1 },   // sweeper / líbero
      CB: { group: 'Defenders',   basic: 'DEF', order: 1 },
      LB: { group: 'Defenders',   basic: 'DEF', order: 1 },
      RB: { group: 'Defenders',   basic: 'DEF', order: 1 },
      DM: { group: 'Midfielders', basic: 'MID', order: 2 },
      CM: { group: 'Midfielders', basic: 'MID', order: 2 },
      AM: { group: 'Midfielders', basic: 'MID', order: 2 },
      LM: { group: 'Midfielders', basic: 'MID', order: 2 },
      RM: { group: 'Midfielders', basic: 'MID', order: 2 },
      LW: { group: 'Forwards',    basic: 'FWD', order: 3 },
      RW: { group: 'Forwards',    basic: 'FWD', order: 3 },
      CF: { group: 'Forwards',    basic: 'FWD', order: 3 },
    },
    aliases: {
      GOALKEEPER:'GK', PORTERO:'GK', ARQUERO:'GK', GOLERO:'GK', GOLEIRO:'GK', KEEPER:'GK', POR:'GK',
      SWEEPER:'SW', LIBERO:'SW', 'LÍBERO':'SW',
      DEFENDER:'CB', DEFENSA:'CB', DEFENSOR:'CB', BACK:'CB', FULLBACK:'CB', 'FULL BACK':'CB', ZAGUERO:'CB', DEF:'CB', CENTRAL:'CB',
      'LEFT BACK':'LB', 'LATERAL IZQUIERDO':'LB', 'RIGHT BACK':'RB', 'LATERAL DERECHO':'RB',
      HALFBACK:'CM', 'HALF BACK':'CM', MIDFIELDER:'CM', MEDIOCAMPISTA:'CM', VOLANTE:'CM', MEDIO:'CM', MID:'CM',
      'DEFENSIVE MIDFIELDER':'DM', 'ATTACKING MIDFIELDER':'AM',
      'LEFT MIDFIELDER':'LM', 'RIGHT MIDFIELDER':'RM',
      FORWARD:'CF', STRIKER:'CF', DELANTERO:'CF', ATACANTE:'CF', 'CENTRE FORWARD':'CF', 'CENTER FORWARD':'CF',
      'LEFT WING':'LW', 'LEFT WINGER':'LW', 'EXTREMO IZQUIERDO':'LW',
      'RIGHT WING':'RW', 'RIGHT WINGER':'RW', 'EXTREMO DERECHO':'RW', WINGER:'LW', EXTREMO:'LW',
    },
    selectable: ['GK', 'SW', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'CF', 'RW'],
    labels: {
      GK: { i18n: 'squad.pos_hk_gk', en: 'GK — Goalkeeper' },
      SW: { i18n: 'squad.pos_hk_sw', en: 'SW — Sweeper' },
      CB: { i18n: 'squad.pos_hk_cb', en: 'CB — Centre back' },
      LB: { i18n: 'squad.pos_hk_lb', en: 'LB — Left back' },
      RB: { i18n: 'squad.pos_hk_rb', en: 'RB — Right back' },
      DM: { i18n: 'squad.pos_hk_dm', en: 'DM — Defensive midfielder' },
      CM: { i18n: 'squad.pos_hk_cm', en: 'CM — Centre midfielder' },
      AM: { i18n: 'squad.pos_hk_am', en: 'AM — Attacking midfielder' },
      LM: { i18n: 'squad.pos_hk_lm', en: 'LM — Left midfielder' },
      RM: { i18n: 'squad.pos_hk_rm', en: 'RM — Right midfielder' },
      LW: { i18n: 'squad.pos_hk_lw', en: 'LW — Left wing' },
      CF: { i18n: 'squad.pos_hk_cf', en: 'CF — Centre forward' },
      RW: { i18n: 'squad.pos_hk_rw', en: 'RW — Right wing' },
    },
  };

  /* ============================================================
     THE PACKS

     field.surface — what the ground is MADE of, which is not the same question as
     which lines to draw. Football and rugby are played on grass (mown stripes);
     basketball and futsal on a wooden floor (parquet boards). The drill board reads
     it to paint the right background instead of showing a basketball club a lawn.
     ============================================================ */
  const PACKS = {

    football: {
      key: 'football',
      i18n: 'sport.football',
      label: 'Football',
      // Categorías sugeridas en el onboarding. Antes la lista era fija (y de fútbol) para
      // todos los deportes: un club de básquet elegía "Reservas / Sub-19" con un ícono de
      // pelota de fútbol. Cada entrada es { id, i18n, hint, icon }; `primary: true` marca
      // la que se crea como teams.is_primary. Son sugerencias: el usuario puede agregar
      // categorías con nombre libre y renombrarlas después.
      squads: [
        { id: 'first',    i18n: 'onboarding.sq_first',    hint: 'onboarding.sq_h_senior',    icon: 'ti-trophy', primary: true },
        { id: 'reserves', i18n: 'onboarding.sq_reserves', hint: 'onboarding.sq_h_senior_b',  icon: 'ti-users' },
        { id: 'u19',      i18n: 'onboarding.sq_u19',      hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-football' },
        { id: 'u17',      i18n: 'onboarding.sq_u17',      hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-football' },
        { id: 'u15',      i18n: 'onboarding.sq_u15',      hint: 'onboarding.sq_h_youth_dev',  icon: 'ti-school' },
        { id: 'u13',      i18n: 'onboarding.sq_u13',      hint: 'onboarding.sq_h_youth_dev',  icon: 'ti-school' },
        { id: 'academy',  i18n: 'onboarding.sq_academy',  hint: 'onboarding.sq_h_academy',    icon: 'ti-baby-carriage' },
        { id: 'women',    i18n: 'onboarding.sq_women',    hint: 'onboarding.sq_h_women',      icon: 'ti-gender-female' },
      ],
      field:     { type: 'football', variant: 'full', orient: 'h', surface: 'grass' },
      positions: FOOTBALL_POSITIONS,
      roster:    { onField: 11, benchMax: 12, unlimitedSubs: false, hasGoalkeeper: true },
      lineup:    { enabled: true, hasFormation: true, slots: 11,
                   countLabel: 'XI',
                   staffRoles: ['head', 'assistant', 'gk_coach', 'fitness', 'physio', 'analyst', 'other'] },
      match:     { periods: { count: 2, minutes: 45 }, periodLabel: 'half',
                   scoring: 'goals', sanctions: 'cards',
                   competitions: ['league', 'cup', 'international', 'friendly'] },
      load:      { tracking: 'gps', speedBands: true, topUpEnabled: true,
                   coreMetrics: ['total_distance', 'high_speed_distance', 'sprint_distance',
                                 'accelerations', 'decelerations', 'max_speed', 'player_load'] },
      tests:     ['cmj', 'sj', 'slcmj', 'sprint', 'cod505', 'illinois', 'rsa', 'yoyo1', 'yoyo2', 'nordic'],
      micro:     { anchor: 'MD', multiGamePerWeek: false,
                   dayCodes: ['MD-6','MD-5','MD-4','MD-3','MD-2','MD-1','MD','MD+1','MD+2','MD+3'] },
      tactics:   { categories: ['offensive', 'defensive', 'transition_off', 'transition_def', 'set_pieces', 'other'] },
      drills:    { gameTypes: ['SSG', 'MSG', 'LSG'],
                   objects: ['ball', 'cone', 'pole', 'goal', 'goalpost', 'mannequin', 'zone', 'label'] },
      anthro:    { dominantSide: 'foot', extra: [] },
      // Sidebar: nothing hidden, nothing renamed — football is the vocabulary the app
      // was written in. Other packs diff against this.
      nav:       { hidden: [], icons: {} },
      i18n:      {},
      icons:     { ball: 'ti-ball-football', field: 'ti-soccer-field' },
      vocab:     { match: 'match', surface: 'pitch', score: 'goal' },
    },

    futsal: {
      key: 'futsal',
      i18n: 'sport.futsal',
      label: 'Futsal',
      squads: [
        { id: 'first',    i18n: 'onboarding.sq_first',    hint: 'onboarding.sq_h_senior',     icon: 'ti-trophy', primary: true },
        { id: 'reserves', i18n: 'onboarding.sq_reserves', hint: 'onboarding.sq_h_senior_b',   icon: 'ti-users' },
        { id: 'u20',      i18n: 'onboarding.sq_u20',      hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-football' },
        { id: 'u17',      i18n: 'onboarding.sq_u17',      hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-football' },
        { id: 'u15',      i18n: 'onboarding.sq_u15',      hint: 'onboarding.sq_h_youth_dev',  icon: 'ti-school' },
        { id: 'academy',  i18n: 'onboarding.sq_academy',  hint: 'onboarding.sq_h_academy',    icon: 'ti-baby-carriage' },
        { id: 'women',    i18n: 'onboarding.sq_women',    hint: 'onboarding.sq_h_women',      icon: 'ti-gender-female' },
      ],
      field:     { type: 'futsal', variant: 'full', orient: 'h', surface: 'wood' },
      positions: FUTSAL_POSITIONS,
      roster:    { onField: 5, benchMax: 9, unlimitedSubs: true, hasGoalkeeper: true },
      lineup:    { enabled: true, hasFormation: true, slots: 5,
                   countLabel: 'V',
                   staffRoles: ['head', 'assistant', 'gk_coach', 'fitness', 'physio', 'analyst', 'other'] },
      // Futsal runs stopped-clock halves and ACCUMULATED fouls (6th = double penalty),
      // which is a different sanction model from football's cards.
      match:     { periods: { count: 2, minutes: 20 }, periodLabel: 'half',
                   scoring: 'goals', sanctions: 'accumulated_fouls',
                   competitions: ['league', 'cup', 'international', 'friendly'] },
      load:      { tracking: 'imu', speedBands: false, topUpEnabled: false,
                   coreMetrics: ['player_load', 'accelerations', 'decelerations', 'total_distance', 'minutes'] },
      tests:     ['cmj', 'sj', 'sprint', 'cod505', 'illinois', 'rsa', 'yoyo1'],
      micro:     { anchor: 'MD', multiGamePerWeek: true,
                   dayCodes: ['MD-4','MD-3','MD-2','MD-1','MD','MD+1','MD+2'] },
      tactics:   { categories: ['offensive', 'defensive', 'transition_off', 'transition_def', 'set_pieces', 'other'] },
      drills:    { gameTypes: ['2v2', '3v3', '4v4', '5v5'],
                   objects: ['ball', 'cone', 'pole', 'goal', 'goalpost', 'mannequin', 'zone', 'label'] },
      anthro:    { dominantSide: 'foot', extra: [] },
      // Indoor: the Top-Up calculator works off % of Vmax with 19.8/25.2 km/h fallbacks,
      // which nobody reaches on a 40 m court.
      nav:       { hidden: ['top-up'], icons: { 'daily-planning': 'ti-ball-football' } },
      i18n:      {},
      icons:     { ball: 'ti-ball-football', field: 'ti-ball-football' },
      vocab:     { match: 'match', surface: 'court', score: 'goal' },
    },

    basketball: {
      key: 'basketball',
      i18n: 'sport.basketball',
      label: 'Basketball',
      squads: [
        { id: 'first',    i18n: 'onboarding.sq_first',   hint: 'onboarding.sq_h_senior',     icon: 'ti-trophy', primary: true },
        { id: 'u19',      i18n: 'onboarding.sq_u19',     hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-basketball' },
        { id: 'u17',      i18n: 'onboarding.sq_u17',     hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-basketball' },
        { id: 'u15',      i18n: 'onboarding.sq_u15',     hint: 'onboarding.sq_h_youth_dev',  icon: 'ti-school' },
        { id: 'u13',      i18n: 'onboarding.sq_u13',     hint: 'onboarding.sq_h_youth_dev',  icon: 'ti-school' },
        { id: 'mini',     i18n: 'onboarding.sq_mini',    hint: 'onboarding.sq_h_mini',       icon: 'ti-baby-carriage' },
        { id: 'women',    i18n: 'onboarding.sq_women',   hint: 'onboarding.sq_h_women',      icon: 'ti-gender-female' },
      ],
      field:     { type: 'basketball', variant: 'full', orient: 'h', surface: 'wood' },
      positions: BASKETBALL_POSITIONS,
      roster:    { onField: 5, benchMax: 10, unlimitedSubs: true, hasGoalkeeper: false },
      // No formation: a basketball starting five is a set of players, not a shape.
      lineup:    { enabled: true, hasFormation: false, slots: 5,
                   countLabel: 'V',
                   staffRoles: ['head', 'assistant', 'fitness', 'physio', 'analyst', 'other'] },
      match:     { periods: { count: 4, minutes: 10 }, periodLabel: 'quarter',
                   scoring: 'points', sanctions: 'fouls',
                   competitions: ['league', 'cup', 'international', 'friendly'] },
      // Indoor: no GPS. IMU/LPS gives PlayerLoad, IMA accel/decel/CoD and jump counts;
      // minutes played is the primary internal-load unit. Speed bands and the Top-Up
      // deficit model are meaningless on a 28 m court.
      load:      { tracking: 'imu', speedBands: false, topUpEnabled: false,
                   coreMetrics: ['player_load', 'accelerations', 'decelerations',
                                 'change_of_direction', 'jump_count', 'minutes'] },
      tests:     ['cmj', 'sj', 'slcmj', 'sprint', 'cod505', 'lane_agility', 'standing_reach', 'yoyo1'],
      // Two or three games a week is the norm, so the day code anchors on the NEAREST
      // game, not on "the match of the week".
      micro:     { anchor: 'GD', multiGamePerWeek: true,
                   dayCodes: ['GD-3','GD-2','GD-1','GD','GD+1','GD+2'] },
      tactics:   { categories: ['offensive', 'defensive', 'transition_off', 'transition_def', 'set_pieces', 'other'] },
      drills:    { gameTypes: ['1v1', '2v2', '3v3', '4v4', '5v5'],
                   objects: ['ball', 'cone', 'hoop', 'chair', 'ladder', 'zone', 'label'] },
      anthro:    { dominantSide: 'hand', extra: ['wingspan', 'standing_reach'] },
      nav:       { hidden: ['top-up'], icons: { 'daily-planning': 'ti-ball-basketball' } },
      // Wording that differs from football, as i18n key → i18n key. Applied to any
      // [data-i18n] node by CMSport.applyI18nOverrides, so a screen opts in simply by
      // having the key; nothing else changes.
      i18n:      { 'shell.nav.match-reports':          'shell.nav.game_reports',
                   'match_reports.match_reports':      'match_reports.game_reports',
                   'match_reports.match_report':       'match_reports.game_report',
                   'match_reports.search_match':       'match_reports.search_game' },
      icons:     { ball: 'ti-ball-basketball', field: 'ti-ball-basketball' },
      vocab:     { match: 'game', surface: 'court', score: 'point' },
    },

    rugby: {
      key: 'rugby',
      i18n: 'sport.rugby',
      label: 'Rugby',
      squads: [
        { id: 'first_xv',  i18n: 'onboarding.sq_first_xv',  hint: 'onboarding.sq_h_senior',     icon: 'ti-trophy', primary: true },
        { id: 'second_xv', i18n: 'onboarding.sq_second_xv', hint: 'onboarding.sq_h_senior_b',   icon: 'ti-users' },
        { id: 'u19',       i18n: 'onboarding.sq_u19',       hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-american-football' },
        { id: 'u17',       i18n: 'onboarding.sq_u17',       hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-american-football' },
        { id: 'u15',       i18n: 'onboarding.sq_u15',       hint: 'onboarding.sq_h_youth_dev',  icon: 'ti-school' },
        { id: 'academy',   i18n: 'onboarding.sq_academy',   hint: 'onboarding.sq_h_academy',    icon: 'ti-baby-carriage' },
        { id: 'women',     i18n: 'onboarding.sq_women',     hint: 'onboarding.sq_h_women',      icon: 'ti-gender-female' },
      ],
      field:     { type: 'rugby', variant: 'full', orient: 'h', surface: 'grass' },
      positions: RUGBY_POSITIONS,
      roster:    { onField: 15, benchMax: 8, unlimitedSubs: false, hasGoalkeeper: false },
      lineup:    { enabled: true, hasFormation: false, slots: 15,
                   countLabel: 'XV',
                   staffRoles: ['head', 'assistant', 'fitness', 'physio', 'analyst', 'other'] },
      match:     { periods: { count: 2, minutes: 40 }, periodLabel: 'half',
                   scoring: 'points', sanctions: 'cards',
                   competitions: ['league', 'cup', 'international', 'friendly'] },
      // GPS outdoors like football, but collisions are the distinguishing load: forwards
      // take the contacts, backs the high-speed running.
      load:      { tracking: 'gps', speedBands: true, topUpEnabled: true,
                   coreMetrics: ['total_distance', 'high_speed_distance', 'sprint_distance',
                                 'accelerations', 'decelerations', 'max_speed',
                                 'player_load', 'collisions', 'impacts'] },
      tests:     ['cmj', 'sj', 'sprint', 'cod505', 'bronco', 'yoyo1', 'nordic'],
      micro:     { anchor: 'MD', multiGamePerWeek: false,
                   dayCodes: ['MD-6','MD-5','MD-4','MD-3','MD-2','MD-1','MD','MD+1','MD+2','MD+3'] },
      tactics:   { categories: ['offensive', 'defensive', 'transition_off', 'transition_def', 'set_pieces', 'other'] },
      drills:    { gameTypes: ['SSG', 'MSG', 'LSG'],
                   objects: ['ball', 'cone', 'pole', 'goal', 'tackle_bag', 'ruck_pad', 'ladder', 'zone', 'label'] },
      anthro:    { dominantSide: 'foot', extra: [] },
      nav:       { hidden: [], icons: { 'daily-planning': 'ti-ball-american-football' } },
      i18n:      {},
      icons:     { ball: 'ti-ball-american-football', field: 'ti-ball-american-football' },
      vocab:     { match: 'match', surface: 'pitch', score: 'point' },
    },

    hockey: {
      key: 'hockey',
      i18n: 'sport.hockey',
      label: 'Field hockey',
      squads: [
        { id: 'first',    i18n: 'onboarding.sq_first',    hint: 'onboarding.sq_h_senior',     icon: 'ti-trophy', primary: true },
        { id: 'reserves', i18n: 'onboarding.sq_reserves', hint: 'onboarding.sq_h_senior_b',   icon: 'ti-users' },
        { id: 'u19',      i18n: 'onboarding.sq_u19',      hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-tennis' },
        { id: 'u16',      i18n: 'onboarding.sq_u16',      hint: 'onboarding.sq_h_youth_comp', icon: 'ti-ball-tennis' },
        { id: 'u14',      i18n: 'onboarding.sq_u14',      hint: 'onboarding.sq_h_youth_dev',  icon: 'ti-school' },
        { id: 'academy',  i18n: 'onboarding.sq_academy',  hint: 'onboarding.sq_h_academy',    icon: 'ti-baby-carriage' },
        { id: 'men',      i18n: 'onboarding.sq_men',      hint: 'onboarding.sq_h_men',        icon: 'ti-gender-male' },
      ],
      field:     { type: 'hockey', variant: 'full', orient: 'h', surface: 'grass' },
      positions: HOCKEY_POSITIONS,
      roster:    { onField: 11, benchMax: 7, unlimitedSubs: true, hasGoalkeeper: true },
      lineup:    { enabled: true, hasFormation: true, slots: 11,
                   countLabel: 'XI',
                   staffRoles: ['head', 'assistant', 'gk_coach', 'fitness', 'physio', 'analyst', 'other'] },
      match:     { periods: { count: 4, minutes: 15 }, periodLabel: 'quarter',
                   scoring: 'goals', sanctions: 'cards',
                   competitions: ['league', 'cup', 'international', 'friendly'] },
      load:      { tracking: 'gps', speedBands: true, topUpEnabled: true,
                   coreMetrics: ['total_distance', 'high_speed_distance', 'sprint_distance',
                                 'accelerations', 'decelerations', 'max_speed', 'player_load'] },
      tests:     ['cmj', 'sj', 'sprint', 'cod505', 'yoyo1', 'nordic'],
      micro:     { anchor: 'MD', multiGamePerWeek: true,
                   dayCodes: ['MD-5','MD-4','MD-3','MD-2','MD-1','MD','MD+1','MD+2'] },
      tactics:   { categories: ['offensive', 'defensive', 'transition_off', 'transition_def', 'set_pieces', 'other'] },
      drills:    { gameTypes: ['SSG', 'MSG', 'LSG'],
                   objects: ['ball', 'cone', 'pole', 'goal', 'mannequin', 'zone', 'label'] },
      anthro:    { dominantSide: 'hand', extra: [] },
      nav:       { hidden: [], icons: {} },
      i18n:      {},
      icons:     { ball: 'ti-ball-tennis', field: 'ti-soccer-field' },
      vocab:     { match: 'match', surface: 'pitch', score: 'goal' },
    },

    // Escape hatch: a club whose sport we don't model yet still gets the whole app —
    // blank surface, free-text positions, no lineup, no match module.
    other: {
      key: 'other',
      i18n: 'sport.other',
      label: 'Other sport',
      field:     { type: 'blank', variant: 'blank', orient: 'h', surface: 'neutral' },
      squads: [
        { id: 'first',    i18n: 'onboarding.sq_first',    hint: 'onboarding.sq_h_senior',    icon: 'ti-trophy', primary: true },
        { id: 'reserves', i18n: 'onboarding.sq_reserves', hint: 'onboarding.sq_h_senior_b',  icon: 'ti-users' },
        { id: 'youth',    i18n: 'onboarding.sq_youth',    hint: 'onboarding.sq_h_youth_dev', icon: 'ti-school' },
        { id: 'academy',  i18n: 'onboarding.sq_academy',  hint: 'onboarding.sq_h_academy',   icon: 'ti-baby-carriage' },
        { id: 'women',    i18n: 'onboarding.sq_women',    hint: 'onboarding.sq_h_women',     icon: 'ti-gender-female' },
      ],
      positions: null,                 // free text — never normalised, never rolled up
      roster:    { onField: null, benchMax: null, unlimitedSubs: true, hasGoalkeeper: false },
      lineup:    { enabled: false, hasFormation: false, slots: null, countLabel: '',
                   staffRoles: ['head', 'assistant', 'fitness', 'physio', 'analyst', 'other'] },
      match:     { periods: { count: 2, minutes: 45 }, periodLabel: 'half',
                   scoring: 'points', sanctions: null,
                   competitions: ['league', 'cup', 'international', 'friendly'] },
      load:      { tracking: 'none', speedBands: false, topUpEnabled: false, coreMetrics: ['minutes'] },
      tests:     ['cmj', 'sprint'],
      micro:     { anchor: 'MD', multiGamePerWeek: true,
                   dayCodes: ['MD-3','MD-2','MD-1','MD','MD+1','MD+2'] },
      tactics:   { categories: ['offensive', 'defensive', 'other'] },
      drills:    { gameTypes: [], objects: ['ball', 'cone', 'pole', 'zone', 'label'] },
      anthro:    { dominantSide: 'hand', extra: [] },
      // No lineup, no match module: we do not know this sport's shape, so we do not
      // pretend to. Everything transversal (gym, wellness, medical, load) stays.
      nav:       { hidden: ['lineup', 'match-reports', 'top-up'], icons: { 'daily-planning': 'ti-layout-grid' } },
      i18n:      {},
      icons:     { ball: 'ti-ball-football', field: 'ti-layout-grid' },
      vocab:     { match: 'match', surface: 'pitch', score: 'point' },
    },
  };

  // The sport a club can actually be created with today. `other` is reachable but is a
  // fallback, not a product: it exposes no lineup and no sport-specific analysis.
  const SUPPORTED = ['football', 'futsal', 'basketball', 'rugby', 'hockey'];

  window.CM_SPORT_PACKS = PACKS;
  window.CM_SPORT_SUPPORTED = SUPPORTED;
  window.CM_SPORT_DEFAULT = 'football';
})();
