/* =============================================================
   wyscout-team-stats.js — el export "Team Stats" de Wyscout, leído.

   Wyscout da dos archivos por partido y son cosas distintas. El XML de eventos es una
   playlist de vídeo: sirve para el análisis en vídeo y para contar cuántas veces hizo
   cada cosa cada jugador, pero no tiene una sola coordenada. El Excel de Team Stats es
   el que trae la lectura del partido — posesión, xG, PPDA, pases progresivos, y las
   recuperaciones y pérdidas partidas por tercio del campo — y trae DOS filas, la nuestra
   y la del rival.

   La forma del archivo tiene una trampa: los encabezados agrupan varias columnas y no
   siempre en la misma proporción. "Recoveries / Low / Medium / High" son cuatro nombres
   sobre cuatro celdas, pero "Progressive passes / accurate" son dos nombres sobre TRES
   celdas — la tercera es el porcentaje y nadie la nombra. Leer el encabezado literal
   desalinea todo lo que viene después, así que acá se expande por catálogo.

   47 grupos → 103 métricas. Los nombres de columna vienen en inglés siempre, sea cual
   sea el idioma de la cuenta de Wyscout, así que el catálogo matchea en inglés y la
   traducción se hace al mostrar.
   ============================================================= */
(function () {
  'use strict';
  if (window.cmWyscoutTeamStats) return;   // idempotente

  function tt(key, fb, vars) {
    const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
    return (v && v !== key) ? v : (fb != null ? fb : key);
  }

  // ── El catálogo: encabezado exacto de Wyscout → las claves que ocupa ──────────
  // El orden importa: la posición dentro del array es el desplazamiento de columna
  // respecto del encabezado.
  const CATALOG = [
    ['Goals', ['goals']],
    ['xG', ['xg']],
    ['Shots / on target', ['shots', 'shots_on_target', 'shots_pct']],
    ['Passes / accurate', ['passes', 'passes_accurate', 'passes_pct']],
    ['Possession, %', ['possession_pct']],
    ['Losses / Low / Medium / High', ['losses', 'losses_low', 'losses_medium', 'losses_high']],
    ['Recoveries / Low / Medium / High', ['recoveries', 'recoveries_low', 'recoveries_medium', 'recoveries_high']],
    ['Duels / won', ['duels', 'duels_won', 'duels_pct']],
    ['Shots from outside penalty area / on target', ['shots_from_outside_penalty_area', 'shots_from_outside_penalty_area_on_target', 'shots_from_outside_penalty_area_pct']],
    ['Positional attacks / with shots', ['positional_attacks', 'positional_attacks_with_shots', 'positional_attacks_pct']],
    ['Counterattacks / with shots', ['counterattacks', 'counterattacks_with_shots', 'counterattacks_pct']],
    ['Set pieces / with shots', ['set_pieces', 'set_pieces_with_shots', 'set_pieces_pct']],
    ['Corners / with shots', ['corners', 'corners_with_shots', 'corners_pct']],
    ['Free kicks / with shots', ['free_kicks', 'free_kicks_with_shots', 'free_kicks_pct']],
    ['Penalties / converted', ['penalties', 'penalties_converted', 'penalties_pct']],
    ['Crosses / accurate', ['crosses', 'crosses_accurate', 'crosses_pct']],
    ['Deep completed crosses', ['deep_completed_crosses']],
    ['Deep completed passes', ['deep_completed_passes']],
    ['Penalty area entries (runs / crosses)', ['penalty_area_entries', 'penalty_area_entries_runs', 'penalty_area_entries_crosses']],
    ['Touches in penalty area', ['touches_in_penalty_area']],
    ['Offensive duels / won', ['offensive_duels', 'offensive_duels_won', 'offensive_duels_pct']],
    ['Offsides', ['offsides']],
    ['Conceded goals', ['conceded_goals']],
    ['Shots against / on target', ['shots_against', 'shots_against_on_target', 'shots_against_pct']],
    ['Defensive duels / won', ['defensive_duels', 'defensive_duels_won', 'defensive_duels_pct']],
    ['Aerial duels / won', ['aerial_duels', 'aerial_duels_won', 'aerial_duels_pct']],
    ['Sliding tackles / successful', ['sliding_tackles', 'sliding_tackles_successful', 'sliding_tackles_pct']],
    ['Interceptions', ['interceptions']],
    ['Clearances', ['clearances']],
    ['Fouls', ['fouls']],
    ['Yellow cards', ['yellow_cards']],
    ['Red cards', ['red_cards']],
    ['Forward passes / accurate', ['forward_passes', 'forward_passes_accurate', 'forward_passes_pct']],
    ['Back passes / accurate', ['back_passes', 'back_passes_accurate', 'back_passes_pct']],
    ['Lateral passes / accurate', ['lateral_passes', 'lateral_passes_accurate', 'lateral_passes_pct']],
    ['Long passes / accurate', ['long_passes', 'long_passes_accurate', 'long_passes_pct']],
    ['Passes to final third / accurate', ['passes_to_final_third', 'passes_to_final_third_accurate', 'passes_to_final_third_pct']],
    ['Progressive passes / accurate', ['progressive_passes', 'progressive_passes_accurate', 'progressive_passes_pct']],
    ['Smart passes / accurate', ['smart_passes', 'smart_passes_accurate', 'smart_passes_pct']],
    ['Throw ins / accurate', ['throw_ins', 'throw_ins_accurate', 'throw_ins_pct']],
    ['Goal kicks', ['goal_kicks']],
    ['Match tempo', ['match_tempo']],
    ['Average passes per possession', ['average_passes_per_possession']],
    ['Long pass %', ['long_pass_pct']],
    ['Average shot distance', ['average_shot_distance']],
    ['Average pass length', ['average_pass_length']],
    ['PPDA', ['ppda']],
  ];

  // Columnas que describen el partido, no lo que pasó dentro.
  const DESCRIPTIVE = ['Date', 'Match', 'Competition', 'Duration', 'Team', 'Scheme'];

  const norm = s => String(s == null ? '' : s)
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ').trim();

  const CAT_BY_HEADER = (function () {
    const m = {};
    CATALOG.forEach(([h, keys]) => { m[norm(h)] = keys; });
    return m;
  })();

  /** Un número, o null. Wyscout escribe "81.16", "0", a veces vacío. */
  function num(v) {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
  }

  // ── ¿Es este archivo un Team Stats de Wyscout? ───────────────────────────────
  /**
   * Reconoce la planilla por su encabezado, no por el nombre del archivo: el usuario
   * lo renombra y seguiría funcionando. Pide las tres columnas que ningún otro export
   * tiene juntas.
   * @param {string[]} headers fila de encabezados, tal cual viene
   */
  function looks(headers) {
    const set = new Set((headers || []).map(norm));
    const musts = ['team', 'possession %', 'recoveries low medium high'];
    return musts.every(m => set.has(m));
  }

  /**
   * Lee la planilla entera.
   * @param {Array[]} rows matriz cruda del sheet (fila 0 = encabezados)
   * @param {string}  opponentName nombre del rival según el partido ya cargado; se usa
   *                  para saber cuál de las dos filas somos nosotros. Opcional.
   * @returns {{sides: Array, matched: boolean}|null}
   */
  function parse(rows, opponentName) {
    if (!rows || !rows.length) return null;
    const headers = (rows[0] || []).map(h => String(h == null ? '' : h).trim());
    if (!looks(headers)) return null;

    // 1) Dónde empieza cada grupo, y qué clave le toca a cada columna.
    //    Un grupo ocupa desde su encabezado hasta el siguiente encabezado no vacío.
    const starts = [];
    headers.forEach((h, i) => { if (h !== '') starts.push(i); });

    const colKey = {};           // índice de columna -> clave de métrica
    const colDesc = {};          // índice de columna -> nombre descriptivo
    const unknown = [];          // encabezados que el catálogo no conoce
    starts.forEach((s, i) => {
      const h = headers[s];
      const width = (i + 1 < starts.length ? starts[i + 1] : headers.length) - s;
      if (DESCRIPTIVE.indexOf(h) !== -1) { colDesc[s] = h; return; }
      const keys = CAT_BY_HEADER[norm(h)];
      if (!keys) { unknown.push(h); return; }
      // El catálogo manda sobre el ancho real: si Wyscout suma una columna al grupo,
      // se ignora en vez de correr el resto de la fila.
      keys.forEach((k, off) => { if (off < width) colKey[s + off] = k; });
    });

    // 2) Las filas de datos son las que traen nombre de equipo. Las de arriba
    //    ("Kompong Dewa" / "Opponents") son rótulos del propio Excel, no datos.
    const teamCol = Object.keys(colDesc).find(c => colDesc[c] === 'Team');
    if (teamCol == null) return null;

    const sides = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const name = String(row[teamCol] == null ? '' : row[teamCol]).trim();
      if (!name) continue;

      const stats = {};
      Object.keys(colKey).forEach(c => {
        const n = num(row[c]);
        if (n != null) stats[colKey[c]] = n;
      });
      if (!Object.keys(stats).length) continue;

      const at = d => { const c = Object.keys(colDesc).find(k => colDesc[k] === d); return c == null ? null : row[c]; };
      sides.push({
        team_name: name,
        // "4-3-3 (100.0%)" → nos quedamos con el dibujo.
        formation: (String(at('Scheme') || '').match(/^[\d\-]+/) || [null])[0],
        match_date: at('Date') || null,
        competition: at('Competition') || null,
        match_label: at('Match') || null,
        stats: stats,
      });
    }
    if (sides.length < 1) return null;

    // 3) Cuál de los dos somos. El nombre del rival ya está en el partido cargado, así
    //    que se busca por ahí; si no matchea, queda el orden del archivo, que en los
    //    exports de Wyscout pone primero al equipo del que se pidió el reporte.
    let matched = false;
    if (opponentName && sides.length === 2) {
      const opp = norm(opponentName);
      const i = sides.findIndex(s => {
        const n = norm(s.team_name);
        return n === opp || n.indexOf(opp) !== -1 || opp.indexOf(n) !== -1;
      });
      if (i !== -1) {
        matched = true;
        sides[i].side = 'them';
        sides[1 - i].side = 'us';
      }
    }
    if (!matched) sides.forEach((s, i) => { s.side = i === 0 ? 'us' : 'them'; });

    return { sides: sides, matched: matched, unknown: unknown };
  }

  // ── Etiquetas ────────────────────────────────────────────────────────────────
  // Se traduce el grupo, no cada una de las 103 claves: "progressive_passes_accurate"
  // se arma con la etiqueta del grupo más el sufijo. Así el i18n son 47 nombres y un
  // puñado de sufijos, en vez de 103 cadenas casi iguales en tres idiomas.
  const SUFFIX = {
    accurate:    ['team_stat.sfx_accurate',   'accurate'],
    won:         ['team_stat.sfx_won',        'won'],
    successful:  ['team_stat.sfx_successful', 'successful'],
    converted:   ['team_stat.sfx_converted',  'converted'],
    on_target:   ['team_stat.sfx_on_target',  'on target'],
    with_shots:  ['team_stat.sfx_with_shots', 'with shots'],
    runs:        ['team_stat.sfx_runs',       'runs'],
    crosses:     ['team_stat.sfx_crosses',    'crosses'],
    low:         ['team_stat.sfx_low',        'own third'],
    medium:      ['team_stat.sfx_medium',     'middle third'],
    high:        ['team_stat.sfx_high',       'final third'],
    pct:         ['team_stat.sfx_pct',        '%'],
  };
  // Nombres base en inglés, tal como los escribe Wyscout. Es el texto que se ve si
  // falta la traducción, y el que se muestra como ayuda cuando se pide el original.
  const BASE_EN = (function () {
    const m = {};
    CATALOG.forEach(([h, keys]) => { m[keys[0]] = h.split('/')[0].replace(/\s*\(.*$/, '').replace(/,\s*%$/, '').trim(); });
    return m;
  })();

  /** Descompone una clave en grupo + sufijo, con el sufijo más largo que aplique. */
  function split(key) {
    if (BASE_EN[key]) return { base: key, sfx: null };
    const sfxs = Object.keys(SUFFIX).sort((a, b) => b.length - a.length);
    for (const s of sfxs) {
      if (key.endsWith('_' + s)) {
        const base = key.slice(0, -(s.length + 1));
        if (BASE_EN[base]) return { base: base, sfx: s };
      }
    }
    return { base: key, sfx: null };
  }

  /** Etiqueta traducida y completa: "Pases progresivos acertados". */
  function label(key) {
    const p = split(key);
    const base = tt('team_stat.' + p.base, BASE_EN[p.base] || p.base.replace(/_/g, ' '));
    if (!p.sfx) return base;
    if (p.sfx === 'pct') return base + ' %';
    return base + ' ' + tt(SUFFIX[p.sfx][0], SUFFIX[p.sfx][1]);
  }

  /** Sólo el grupo, sin sufijo — para agrupar en la tabla completa. */
  function groupLabel(key) {
    const p = split(key);
    return tt('team_stat.' + p.base, BASE_EN[p.base] || p.base.replace(/_/g, ' '));
  }

  /** El nombre original de Wyscout, para quien busca la métrica en la plataforma. */
  function originalLabel(key) {
    const p = split(key);
    const en = BASE_EN[p.base] || p.base.replace(/_/g, ' ');
    if (!p.sfx) return en;
    if (p.sfx === 'pct') return en + ' %';
    return en + ' ' + SUFFIX[p.sfx][1];
  }

  /** Cómo se escribe un valor: los porcentajes y promedios llevan decimal, el resto no. */
  function format(key, v) {
    if (v == null || v === '') return '—';
    const n = Number(v);
    if (!isFinite(n)) return String(v);
    const isPct = /_pct$/.test(key) || key === 'possession_pct' || key === 'long_pass_pct';
    if (isPct) return n.toFixed(1).replace('.', ',') + ' %';
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2).replace('.', ',');
  }

  /** Para estas métricas, más bajo es mejor. Importa al pintar una tendencia. */
  const LOWER_IS_BETTER = ['ppda', 'losses', 'losses_low', 'losses_medium', 'conceded_goals',
    'shots_against', 'shots_against_on_target', 'fouls', 'yellow_cards', 'red_cards',
    'offsides', 'average_shot_distance'];

  /** Las que se muestran enfrentadas contra el rival, en este orden. */
  const HIGHLIGHT = ['possession_pct', 'xg', 'shots', 'passes', 'progressive_passes',
    'passes_to_final_third', 'penalty_area_entries', 'recoveries', 'losses',
    'duels_pct', 'positional_attacks', 'ppda'];

  /** Las que ofrece la card de evolución. La primera es la que se abre por defecto. */
  const TREND = ['possession_pct', 'xg', 'ppda', 'progressive_passes_accurate',
    'recoveries_high', 'losses_low', 'passes_to_final_third_accurate',
    'penalty_area_entries', 'shots', 'shots_against', 'duels_pct', 'match_tempo'];

  /** Todas las claves conocidas, en el orden del catálogo. */
  function allKeys() {
    const out = [];
    CATALOG.forEach(([, keys]) => keys.forEach(k => out.push(k)));
    return out;
  }

  window.cmWyscoutTeamStats = {
    looks, parse, label, groupLabel, originalLabel, format, allKeys,
    split, CATALOG, HIGHLIGHT, TREND, LOWER_IS_BETTER,
    lowerIsBetter: k => LOWER_IS_BETTER.indexOf(k) !== -1,
  };
})();
