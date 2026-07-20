// ClavaMetrics — Shared position vocabulary (single source of truth)
// Include before page logic:  <script src="assets/positions.js"></script>
//
// MODEL: one canonical DETAILED code is what gets STORED in players.position; the coarser
// levels are DERIVED, never stored — so analysis can roll up without ever losing detail:
//
//   detailed (LB, CDM, LW…)  →  basic 6 (GK CB FB MF WG ST)  →  group (Goalkeepers, …)
//
// Why derive instead of letting the user pick one vocabulary: a 25-man squad spread over
// ~20 detailed positions leaves ~1 player per position, which makes the "vs Position"
// baseline compare a player against himself. Rolling up to the basic 6 gives a real
// reference set — while the detailed code stays available for squad/lineup views.
//
// NOTE: these tables mirror Squad.html's POS_CFG/_POS_ALIASES. Squad still owns its own
// copy for now (left untouched deliberately); converge it here when convenient.

(function () {
  if (window.CM_POSITIONS) return;   // idempotent

  // code → { group, basic (the 6-code roll-up), order }
  var CFG = {
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
  };

  // Free text (any provider / language) → canonical code.
  var ALIASES = {
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
  };

  // Ordered list for <select>s (detailed first within each line of the pitch, generic last).
  var SELECTABLE = [
    'GK',
    'CB', 'LB', 'RB', 'WB', 'LWB', 'RWB', 'FB',
    'CDM', 'CM', 'CAM', 'LM', 'RM', 'MF',
    'LW', 'RW', 'WG',
    'ST', 'CF', 'SS',
  ];

  var BASIC  = ['GK', 'CB', 'FB', 'MF', 'WG', 'ST'];
  var GROUPS = ['Goalkeepers', 'Defenders', 'Midfielders', 'Wingers', 'Forwards', 'Other'];

  /** Free text → canonical detailed code, or null when unknown/empty.
   *  Returns null (never a guess) so callers don't invent a position. */
  function normalize(raw) {
    try {
      if (raw == null) return null;
      var k = String(raw).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().toUpperCase().replace(/\s+/g, ' ');
      if (!k) return null;
      // ALIASES first: the full names (GOALKEEPER, DEFENDER, …) exist in BOTH tables, and we
      // want them collapsed to the short code (GK, CB, …) rather than stored verbatim —
      // otherwise "GK" and "GOALKEEPER" become two separate values all over again.
      // No bare short code is an alias key, so valid codes still fall through to CFG.
      if (ALIASES[k]) return ALIASES[k];
      if (CFG[k]) return k;
      return null;
    } catch (_e) { return null; }
  }

  /** Detailed code (or free text) → one of the basic 6, or null. */
  function basic(code) {
    var c = normalize(code);
    return (c && CFG[c] && CFG[c].basic) || null;
  }

  /** Detailed code (or free text) → broad group label, 'Other' when unknown. */
  function group(code) {
    var c = normalize(code);
    return (c && CFG[c] && CFG[c].group) || 'Other';
  }

  window.CM_POSITIONS = { CFG: CFG, ALIASES: ALIASES, SELECTABLE: SELECTABLE, BASIC: BASIC, GROUPS: GROUPS };
  window.cmNormalizePosition = normalize;
  window.cmPositionBasic     = basic;
  window.cmPositionGroup     = group;
})();
