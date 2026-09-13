/* ============================================================
   Club Overview — pestañas de DIRECCIÓN DEPORTIVA.

   La semana ya estaba resuelta, pero nadie gestiona un club por semanas: un
   director deportivo compara categorías y mira meses. Estas cuatro vistas son
   lo que faltaba para eso.

     Temporada → tendencia del club + tabla comparativa entre equipos
     Lesiones  → epidemiología real (incidencia, burden, mecanismo, re-lesión)
     Plantel   → edades, profundidad por puesto, minutos, vencimientos
     Staff     → adopción real del sistema + huecos de carga de datos

   Decisiones que conviene no deshacer:

   · Todo se calcula EN EL CLIENTE sobre selects filtrados por RLS. No hay RPC
     nueva ni SECURITY DEFINER que auditar — que es justo donde viven los bugs
     de permisos de esta app. El precio es traer filas: se acota por período y
     se piden sólo las columnas necesarias.
   · Cada pestaña carga la primera vez que se abre y cachea por
     (pestaña × período × equipo). Entrar a Club Overview sigue costando
     exactamente lo mismo que antes de esta pantalla.
   · Los gráficos son SVG y CSS a mano, sin Chart.js. cmCharts existe pero
     exige el bundle de un CDN y un fallback DOM por si no llega; para
     sparklines y barras horizontales eso es más frágil que dibujarlas.
   · Nada de esto escribe en la base. Es una pantalla de lectura.
   ============================================================ */
(function () {
  'use strict';
  const sb = () => window.sb;

  function tt(k, fb, vars) { const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(k, vars) : null; return (v && v !== k) ? v : (fb != null ? fb : k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function initials(n) { n = String(n || '').trim(); if (!n) return '•'; const p = n.split(/\s+/); return ((p[0][0] || '') + (p[1] ? p[1][0] : '')).toUpperCase(); }

  // ── fechas (locales, nunca UTC — igual que club-overview.js) ──
  function ymd(d) { return window.cmYMD ? window.cmYMD(d) : (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
  function parseYMD(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function todayY() { return window.cmToday ? window.cmToday() : ymd(new Date()); }
  function daysBetween(a, b) { return Math.round((parseYMD(b) - parseYMD(a)) / 86400000); }
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monLabel(m) { return tt('month_short.' + m, MON[m]); }
  function shortDate(y) { if (!y) return '—'; const d = parseYMD(y); return d.getDate() + ' ' + monLabel(d.getMonth()); }

  // ── números ──
  function nf(n, dec) {
    if (n == null || !isFinite(n)) return '—';
    const lang = (window.CM_I18N && CM_I18N.current) || 'en';
    try { return new Intl.NumberFormat(lang, { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(n); }
    catch (_) { return String(dec ? n.toFixed(dec) : Math.round(n)); }
  }
  function pct(num, den) { return (!den || den <= 0) ? null : (num / den * 100); }
  function fmtPct(v, dec) { return v == null ? '—' : nf(v, dec || 0) + '%'; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // "Cuántos años tiene hoy" — sin librerías de fechas y sin fallar por el 29 de febrero.
  function ageOf(dob) {
    if (!dob) return null;
    const b = parseYMD(dob), t = parseYMD(todayY());
    if (isNaN(b)) return null;
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return (a >= 0 && a < 120) ? a : null;
  }

  /* ── ZONA CORPORAL: normalización ─────────────────────────────────────────
     injuries.body_area es texto libre y en la base real conviven "Left
     Hamstring", "hamstring", "Isquiotibial", "Rodilla (LCM)", "LCA rodilla" y
     "Gemelo (sóleo)". Agrupar por el texto crudo da un gráfico con veinte
     barras de una unidad cada una, que no dice nada. Esto lo reduce a regiones
     comparables: saca el lado (es dato clínico, no epidemiológico) y mapea
     sinónimos en los tres idiomas de la app.

     El orden importa: lo específico va antes que lo genérico, porque gana la
     primera coincidencia. "Isquiotibial" tiene que caer en hamstring y no en
     muslo, y "tendón rotuliano" en rodilla y no en tendón.                  */
  const SIDE_RX = /\b(left|right|l|r|izq|izquierdo|izquierda|der|derecho|derecha|esquerdo|direito|bilateral|ambos)\b/gi;
  const AREA_GROUPS = [
    ['hamstring', ['hamstring', 'isquio', 'isquiotibial', 'biceps femoral', 'bicipital', 'femoral posterior', 'posterior de muslo']],
    /* `hip` va ANTES que `quad` por una sola palabra: en portugués la cadera es "quadril", y
       como gana la primera coincidencia por subcadena, con el orden al revés "Quadril" caía en
       cuádriceps. Al revés no pasa — "quadriceps" no contiene "quadril" (…dri-c vs …dri-l) —
       así que un "Quad" suelto en inglés sigue llegando bien a su grupo. */
    ['hip', ['hip', 'cadera', 'quadril', 'psoas', 'iliaco', 'iliopsoas', 'gluteo', 'glute', 'trocanter', 'piramidal']],
    ['quad', ['quadricep', 'quadriceps', 'cuadricep', 'cuadriceps', 'recto femoral', 'recto anterior', 'quad']],
    ['adductor', ['adductor', 'aductor', 'adutor', 'groin', 'ingle', 'pubis', 'pubalgia', 'pubiana', 'virilha']],
    ['calf', ['calf', 'gemelo', 'soleo', 'gastrocnemio', 'triceps sural', 'sural', 'panturrilha', 'gemelar']],
    ['knee', ['knee', 'rodilla', 'joelho', 'acl', 'lca', 'lcm', 'lcp', 'lla', 'lle interno', 'mcl', 'pcl', 'menisc', 'rotulian', 'patell', 'patelar', 'cruzado']],
    ['ankle', ['ankle', 'tobillo', 'tornozelo', 'peroneo astragalino', 'deltoideo ligament', 'sindesmosis', 'esguince de tobillo']],
    ['shin', ['shin', 'tibia', 'tibial', 'periostitis', 'espinilla', 'canilla', 'canela']],
    ['foot', ['foot', 'pie', 'metatars', 'plantar', 'fascia', 'talon', 'calcaneo', 'aquiles', 'achilles', 'toe', 'hallux', 'dedo del pie', 'empeine', 'escafoides']],
    ['thigh', ['thigh', 'muslo', 'coxa']],
    ['back', ['back', 'espalda', 'lumbar', 'lumbalgia', 'dorsal', 'columna', 'vertebr', 'costas', 'sacro', 'ciatic', 'hernia']],
    ['trunk', ['abdominal', 'abdomen', 'oblicuo', 'oblique', 'core', 'costilla', 'ribs', 'costela', 'tronco', 'intercostal', 'pared abdominal']],
    ['shoulder', ['shoulder', 'hombro', 'ombro', 'clavicula', 'deltoid', 'acromio', 'rotador', 'supraespinoso', 'escapula', 'luxacion de hombro']],
    ['arm', ['arm', 'brazo', 'braco', 'elbow', 'codo', 'cotovelo', 'wrist', 'muneca', 'pulso', 'hand', 'mano', 'finger', 'dedo', 'antebrazo', 'humero', 'radio', 'cubito', 'escafoide mano']],
    ['neck', ['neck', 'cuello', 'pescoco', 'cervical', 'trapecio']],
    ['head', ['head', 'cabeza', 'cabeca', 'craneo', 'concussion', 'conmocion', 'concussao', 'nariz', 'nose', 'face', 'cara', 'rostro', 'ojo', 'eye', 'mandibula', 'pomulo']]
  ];
  const AREA_FALLBACK = ['hamstring', 'quad', 'adductor', 'calf', 'knee', 'ankle', 'shin', 'foot', 'hip', 'thigh', 'back', 'trunk', 'shoulder', 'arm', 'neck', 'head'];
  // El null se normaliza ANTES de tocar nada: escrito con el ternario adentro, String(null)
  // devolvía la cadena "null" y una lesión sin zona cargada terminaba clasificada como "Otra"
  // en vez de "Sin registrar" — que son dos cosas distintas para quien lee el informe.
  // El rango de diacríticos va escapado (̀-ͯ) y no con los caracteres combinantes
  // literales, que son invisibles en el editor y cualquiera los borra sin darse cuenta.
  function deaccent(s) {
    const t = String(s == null ? '' : s);
    return t.normalize ? t.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : t;
  }
  function normArea(raw) {
    let s = deaccent(raw).toLowerCase().replace(SIDE_RX, ' ').replace(/[()\[\]/_,.;:-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return 'unknown';
    for (const [key, words] of AREA_GROUPS) for (const w of words) if (s.indexOf(w) !== -1) return key;
    return 'other';
  }
  function areaLabel(k) {
    const FB = {
      hamstring: 'Hamstring', quad: 'Quadriceps', adductor: 'Adductor / groin', calf: 'Calf', knee: 'Knee',
      ankle: 'Ankle', shin: 'Shin', foot: 'Foot', hip: 'Hip / glute', thigh: 'Thigh', back: 'Back / lumbar',
      trunk: 'Trunk', shoulder: 'Shoulder', arm: 'Arm / hand', neck: 'Neck', head: 'Head / face',
      other: 'Other', unknown: 'Not recorded'
    };
    return tt('co_dir.area_' + k, FB[k] || k);
  }
  function catLabel(k) {
    const FB = { muscular: 'Muscular', acl: 'ACL', ligament: 'Ligament', tendon: 'Tendon', bone: 'Bone', other: 'Other', unknown: 'Not recorded' };
    return tt('co_dir.cat_' + (k || 'unknown'), FB[k] || k);
  }
  function mechLabel(k) {
    const FB = { contact: 'Contact', non_contact: 'Non-contact', overuse: 'Overuse', unknown: 'Not recorded' };
    return tt('co_dir.mech_' + (k || 'unknown'), FB[k] || k);
  }
  function sevLabel(s) {
    s = (s || '').toLowerCase();
    return tt('club_overview.sev_' + s, s === 'minor' ? 'Minor' : s === 'moderate' ? 'Moderate' : s === 'severe' ? 'Severe' : (s || '—'));
  }

  /* ── POSICIONES: agrupación a 4 líneas ────────────────────────────────────
     assets/positions.js es la tabla canónica y hace el roll-up fino. Acá sólo
     hace falta la línea (arco / defensa / medio / ataque) para contar
     profundidad, así que se usa su roll-up si está cargado y si no se cae a un
     mapeo propio — Club Overview no carga positions.js hoy y no vale sumarle
     un script sólo para esto.                                               */
  const LINE_OF = {
    gk: 'gk', por: 'gk', arq: 'gk', goalkeeper: 'gk', portero: 'gk', arquero: 'gk', goleiro: 'gk',
    cb: 'def', lb: 'def', rb: 'def', lwb: 'def', rwb: 'def', sw: 'def', df: 'def', dc: 'def', li: 'def', ld: 'def',
    defender: 'def', defensa: 'def', zaguero: 'def', lateral: 'def', central: 'def', zagueiro: 'def', 'central defender': 'def',
    cdm: 'mid', cm: 'mid', cam: 'mid', dm: 'mid', am: 'mid', mc: 'mid', mcd: 'mid', mco: 'mid', mid: 'mid', mf: 'mid',
    midfielder: 'mid', medio: 'mid', mediocampista: 'mid', volante: 'mid', pivote: 'mid', interior: 'mid', meia: 'mid',
    lw: 'att', rw: 'att', st: 'att', cf: 'att', ss: 'att', fw: 'att', ei: 'att', ed: 'att', dl: 'att',
    forward: 'att', striker: 'att', delantero: 'att', extremo: 'att', atacante: 'att', ponta: 'att', 'centre forward': 'att'
  };
  function lineOf(pos) {
    const raw = deaccent(pos).toLowerCase().trim();
    if (!raw) return 'unk';
    if (window.cmPositionLine) { try { const l = window.cmPositionLine(pos); if (l) return l; } catch (_) {} }
    if (LINE_OF[raw]) return LINE_OF[raw];
    const first = raw.split(/[\s/,-]+/)[0];
    if (LINE_OF[first]) return LINE_OF[first];
    for (const k in LINE_OF) if (k.length > 3 && raw.indexOf(k) !== -1) return LINE_OF[k];
    return 'unk';
  }
  const LINES = ['gk', 'def', 'mid', 'att', 'unk'];
  function lineLabel(l) {
    const FB = { gk: 'Goalkeepers', def: 'Defenders', mid: 'Midfielders', att: 'Forwards', unk: 'No position' };
    return tt('co_dir.line_' + l, FB[l]);
  }

  /* ── DISPONIBILIDAD: qué cuenta como "fuera" ──────────────────────────────
     Mismo conjunto exacto que el KPI de la pestaña Semana
     (assets/club-overview.js → computeKpis). Es deliberado: dos números que el
     usuario espera que coincidan no pueden salir de dos definiciones. Los
     estados con limitación (partial/limited/rehab) se cuentan aparte, como
     "con limitaciones", en vez de moverlos a "fuera" y desalinear las cifras. */
  const OUT_ST = new Set(['injured', 'sick', 'unavailable', 'away']);
  const LIMITED_ST = new Set(['partial', 'limited', 'rehab']);

  // ── estado del módulo ──
  const S = {
    clubId: null, teams: [], scopeTeam: '', profile: null,
    period: '90d', seasonStart: null, seasonLabel: '',
    tab: null, cache: {}, sort: { cmp: { k: 'name', dir: 1 }, staff: { k: 'acts', dir: -1 }, inj: { k: 'days', dir: -1 } }
  };
  const PERIODS = [['30d', 'co_dir.p_30d', '30 d'], ['90d', 'co_dir.p_90d', '90 d'], ['season', 'co_dir.p_season', 'Season']];

  function scopeTeams() { return S.scopeTeam ? S.teams.filter(t => t.id === S.scopeTeam) : S.teams; }
  function scopeTeamIds() { return new Set(scopeTeams().map(t => t.id)); }
  function periodRange() {
    const to = todayY();
    if (S.period === 'season' && S.seasonStart) return { from: S.seasonStart, to };
    const days = S.period === '30d' ? 30 : 90;
    return { from: ymd(addDays(parseYMD(to), -(days - 1))), to };
  }
  function cacheKey(tab) { const r = periodRange(); return tab + '|' + r.from + '|' + r.to + '|' + (S.scopeTeam || 'all'); }

  /* ── SVG sparkline ────────────────────────────────────────────────────────
     viewBox fijo + width:100% para que escale sin desbordar nunca, y
     vector-effect="non-scaling-stroke" para que al estirarse en horizontal la
     línea no engorde. Los null cortan la línea en vez de dibujar un cero, que
     mentiría: "no hay dato" y "cero" no son lo mismo.                        */
  function sparkline(vals, opts) {
    opts = opts || {};
    const W = 100, H = opts.h || 28, pad = 2;
    const nums = vals.filter(v => v != null && isFinite(v));
    if (nums.length < 2) return '<div class="cod-spark-empty">' + esc(tt('co_dir.spark_thin', 'Not enough history')) + '</div>';
    let lo = Math.min.apply(null, nums), hi = Math.max.apply(null, nums);
    if (opts.zeroBase) lo = Math.min(0, lo);
    // Serie plana (p. ej. wellness clavado en 100%): si sólo se empuja el techo, la línea
    // queda dibujada contra el borde INFERIOR y se lee como un cero, que es lo contrario de
    // lo que pasó. Abriendo el rango a ambos lados queda centrada, que es lo que significa.
    if (hi === lo) { const pad2 = Math.abs(hi) > 1 ? Math.abs(hi) * 0.1 : 1; lo -= pad2; hi += pad2; }
    const x = i => pad + (i / Math.max(1, vals.length - 1)) * (W - pad * 2);
    const y = v => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
    const segs = []; let cur = [];
    vals.forEach((v, i) => {
      if (v == null || !isFinite(v)) { if (cur.length) segs.push(cur); cur = []; return; }
      cur.push(x(i).toFixed(1) + ',' + y(v).toFixed(1));
    });
    if (cur.length) segs.push(cur);
    const color = opts.color || 'var(--cm-accent)';
    const lines = segs.filter(s => s.length > 1).map(s => '<polyline points="' + s.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>').join('');
    const dots = segs.filter(s => s.length === 1).map(s => { const p = s[0].split(','); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.6" fill="' + color + '"/>'; }).join('');
    // Último punto marcado: es el valor que el usuario está leyendo arriba en grande.
    let last = '';
    for (let i = vals.length - 1; i >= 0; i--) { const v = vals[i]; if (v != null && isFinite(v)) { last = '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.4" fill="' + color + '" stroke="var(--cm-surface)" stroke-width="1.2"/>'; break; } }
    return '<svg class="cod-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' + lines + dots + last + '</svg>';
  }

  // Barras horizontales en CSS: una fila por categoría, ancho relativo al máximo.
  function hbars(rows, opts) {
    opts = opts || {};
    if (!rows.length) return emptyBlock(opts.empty || tt('co_dir.no_data', 'No data for this period.'));
    const max = rows.reduce((m, r) => Math.max(m, Number(r.value) || 0), 0) || 1;
    return '<div class="cod-bars">' + rows.map(r => {
      const w = clamp((Number(r.value) || 0) / max * 100, 0, 100);
      return '<div class="cod-bar"><div class="cod-bar-l" title="' + esc(r.label) + '">' + esc(r.label) + '</div>' +
        '<div class="cod-bar-t"><span style="width:' + w.toFixed(1) + '%;background:' + (r.color || 'var(--cm-accent)') + '"></span></div>' +
        '<div class="cod-bar-v">' + esc(r.display != null ? r.display : nf(r.value)) + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  // Barras verticales por bucket temporal (nuevas lesiones / días perdidos por mes).
  function vbars(buckets, opts) {
    opts = opts || {};
    const vals = buckets.map(b => Number(b.value) || 0);
    if (!buckets.length || !vals.some(v => v > 0)) return emptyBlock(opts.empty || tt('co_dir.no_data', 'No data for this period.'));
    const max = Math.max.apply(null, vals) || 1;
    return '<div class="cod-vwrap"><div class="cod-vbars">' + buckets.map(b => {
      const v = Number(b.value) || 0, h = clamp(v / max * 100, v > 0 ? 4 : 0, 100);
      return '<div class="cod-vcol" title="' + esc(b.label + ': ' + nf(v)) + '">' +
        '<div class="cod-vval">' + (v > 0 ? esc(nf(v)) : '') + '</div>' +
        '<div class="cod-vtrack"><span style="height:' + h.toFixed(1) + '%;background:' + (opts.color || 'var(--cm-accent)') + '"></span></div>' +
        '<div class="cod-vlbl">' + esc(b.short || b.label) + '</div></div>';
    }).join('') + '</div></div>';
  }

  function emptyBlock(msg, icon) {
    return '<div class="cod-empty"><i class="ti ' + (icon || 'ti-database-off') + '"></i><span>' + esc(msg) + '</span></div>';
  }
  function hint(txt) { return '<p class="cod-hint">' + esc(txt) + '</p>'; }
  // Nota metodológica: qué mide el número y de dónde sale. Va como <details> y no
  // como tooltip porque es texto de dos líneas y en tablet un title no se lee.
  function method(txt) {
    return '<details class="cod-method"><summary>' + esc(tt('co_dir.how', 'How this is calculated')) + '</summary><div>' + esc(txt) + '</div></details>';
  }
  function kpiCard(c) {
    return '<div class="cod-kpi"><div class="cod-kt"><div class="cod-ki" style="background:' + (c.bg || 'var(--cm-accent-soft)') + ';color:' + (c.col || 'var(--cm-accent)') + '"><i class="ti ' + c.ic + '"></i></div>' +
      '<div class="cod-kl">' + esc(c.lbl) + '</div></div>' +
      '<div class="cod-kv">' + c.val + (c.unit ? '<small>' + esc(c.unit) + '</small>' : '') + '</div>' +
      (c.sub ? '<div class="cod-ks">' + c.sub + '</div>' : '') +
      (c.spark || '') + '</div>';
  }
  function deltaChip(cur, prev, opts) {
    opts = opts || {};
    if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev)) return '<span class="co-chip neutral">' + esc(tt('co_dir.no_prev', 'No prior period')) + '</span>';
    const d = cur - prev;
    if (Math.abs(d) < (opts.eps != null ? opts.eps : 0.5)) return '<span class="co-chip neutral"><i class="ti ti-equal"></i>' + esc(tt('co_dir.flat', 'Stable')) + '</span>';
    const up = d > 0, goodUp = !opts.lowerIsBetter;
    const good = up === goodUp;
    return '<span class="co-chip ' + (good ? 'good' : 'bad') + '"><i class="ti ti-arrow-' + (up ? 'up' : 'down') + '-right"></i>' +
      esc((up ? '+' : '') + nf(d, opts.dec || 0) + (opts.unit || '')) + '</span>';
  }

  /* ── BUCKETS temporales ───────────────────────────────────────────────────
     Semanales si el período es corto, mensuales si es largo. Con 30 días,
     agrupar por mes da uno o dos puntos y la tendencia no existe; con una
     temporada entera, agrupar por semana da cuarenta columnas ilegibles en
     tablet.                                                                 */
  function buildBuckets(from, to) {
    const span = daysBetween(from, to) + 1;
    const out = [];
    if (span <= 120) {
      // Semanas de lunes a domingo, recortadas al período.
      let cur = parseYMD(from);
      cur = addDays(cur, -((cur.getDay() + 6) % 7));
      const end = parseYMD(to);
      while (cur <= end) {
        const s = ymd(cur), e = ymd(addDays(cur, 6));
        out.push({ from: s < from ? from : s, to: e > to ? to : e, label: shortDate(s), short: String(parseYMD(s).getDate()) });
        cur = addDays(cur, 7);
      }
    } else {
      let cur = new Date(parseYMD(from).getFullYear(), parseYMD(from).getMonth(), 1);
      const end = parseYMD(to);
      while (cur <= end) {
        const s = ymd(cur), lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0), e = ymd(lastDay);
        out.push({ from: s < from ? from : s, to: e > to ? to : e, label: monLabel(cur.getMonth()) + ' ' + String(cur.getFullYear()).slice(2), short: monLabel(cur.getMonth()) });
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
    }
    return out;
  }

  /* ── FETCH ────────────────────────────────────────────────────────────────
     Un bloque "core" que comparten Temporada y Lesiones, y dos bloques extra
     para Plantel y Staff. run() se come el error a propósito: una tabla que
     falla (columna nueva, permiso) deja su sección vacía con su cartel, no
     tumba la pestaña entera.                                                 */
  const run = p => p.then(r => (r && r.data) ? r.data : []).catch(() => []);

  async function loadSeasonStart() {
    if (S.seasonStart !== null) return;
    S.seasonStart = ''; S.seasonLabel = '';
    const rows = await run(sb().from('seasons').select('name,start_date,end_date,team_id').eq('club_id', S.clubId).order('start_date', { ascending: false }));
    const t = todayY();
    const ids = scopeTeamIds();
    const relevant = rows.filter(r => !r.team_id || !ids.size || ids.has(r.team_id));
    const live = relevant.filter(r => r.start_date && (!r.end_date || r.end_date >= t) && r.start_date <= t);
    const pick = live.length ? live : relevant;
    if (pick.length) {
      // La más temprana entre las vigentes: con varias categorías, la temporada del club
      // empieza cuando arrancó la primera.
      const start = pick.reduce((m, r) => (r.start_date && (!m || r.start_date < m) ? r.start_date : m), null);
      S.seasonStart = start || '';
      S.seasonLabel = (pick.find(r => r.name) || {}).name || '';
    }
    if (!S.seasonStart) S.seasonStart = ymd(addDays(parseYMD(t), -364));
  }

  async function loadCore() {
    const key = cacheKey('core'); if (S.cache[key]) return S.cache[key];
    const { from, to } = periodRange(), cid = S.clubId;
    let sessQ = sb().from('training_sessions').select('id,team_id,session_type,session_date,duration,estimated_rpe').eq('club_id', cid).eq('is_historical', false).gte('session_date', from).lte('session_date', to);
    let avQ = sb().from('availability').select('player_id,team_id,status,date').eq('club_id', cid).gte('date', from).lte('date', to);
    let rpeQ = sb().from('rpe').select('session_id,player_id,session_date,load').eq('club_id', cid).gte('session_date', from).lte('session_date', to);
    let wellQ = sb().from('wellness').select('player_id,readiness,submitted_at').eq('club_id', cid).gte('submitted_at', from).lte('submitted_at', to + 'T23:59:59');
    if (S.scopeTeam) { sessQ = sessQ.eq('team_id', S.scopeTeam); avQ = avQ.eq('team_id', S.scopeTeam); }
    // Lesiones: todas las que SOLAPAN el período (abiertas, o cerradas después de `from`),
    // no sólo las que empiezan dentro. El burden de un período incluye los días que aporta
    // una lesión vieja que sigue abierta.
    const injQ = sb().from('injuries').select('id,player_id,body_area,severity,status,start_date,expected_return,returned_date,injury_category,injury_mechanism,mechanism,injury_type')
      .eq('club_id', cid).or('returned_date.is.null,returned_date.gte.' + from);
    const plQ = sb().from('players').select('id,first_name,last_name,position,positions,team_id,date_of_birth').eq('club_id', cid).is('archived_at', null);
    const ptQ = sb().from('player_teams').select('player_id,team_id').eq('club_id', cid);
    const [sessions, avail, rpe, wellness, injuries, players, pteams] =
      await Promise.all([run(sessQ), run(avQ), run(rpeQ), run(wellQ), run(injQ), run(plQ), run(ptQ)]);
    const pmap = {}; (players || []).forEach(p => { pmap[String(p.id)] = p; });
    // Un jugador puede estar en varios equipos (player_teams) y además tener players.team_id.
    // Para atribuir una lesión o una edad a UN equipo hace falta un dueño único: gana
    // players.team_id, y si está vacío el primer player_teams que aparezca.
    const teamOf = {};
    (pteams || []).forEach(r => { const k = String(r.player_id); if (!teamOf[k]) teamOf[k] = r.team_id; });
    (players || []).forEach(p => { if (p.team_id) teamOf[String(p.id)] = p.team_id; });
    const rosterOf = {};
    (pteams || []).forEach(r => { (rosterOf[r.team_id] = rosterOf[r.team_id] || new Set()).add(String(r.player_id)); });
    (players || []).forEach(p => { if (p.team_id) (rosterOf[p.team_id] = rosterOf[p.team_id] || new Set()).add(String(p.id)); });
    const out = { from, to, sessions, avail, rpe, wellness, injuries, players, pteams, pmap, teamOf, rosterOf };
    S.cache[key] = out; return out;
  }

  async function loadStaff() {
    const key = cacheKey('staffdata'); if (S.cache[key]) return S.cache[key];
    const { from, to } = periodRange(), cid = S.clubId;
    // 5000 filas es techo de seguridad, no de negocio: activity_log mezcla acciones de staff
    // con eventos de jugadores (rpe/wellness/gps, que vienen sin actor_id) y en un club activo
    // esos son la mayoría. El corte por fecha ya acota; esto evita el caso patológico.
    const actQ = sb().from('activity_log').select('actor_id,actor_label,action,entity_table,team_id,created_at')
      .eq('club_id', cid).gte('created_at', from).lte('created_at', to + 'T23:59:59')
      .order('created_at', { ascending: false }).limit(5000);
    const profQ = sb().from('profiles').select('id,full_name,first_name,last_name,role,club_role,job_title').eq('club_id', cid);
    const [acts, profiles] = await Promise.all([run(actQ), run(profQ)]);
    const out = { from, to, acts, profiles };
    S.cache[key] = out; return out;
  }

  async function loadSquad() {
    const key = cacheKey('squaddata'); if (S.cache[key]) return S.cache[key];
    const cid = S.clubId, { from, to } = periodRange();
    // contract_until es columna nueva (migración 147). Si la base del entorno todavía no la
    // tiene, el select entero falla y la pestaña queda vacía — así que se reintenta sin ella.
    const COLS = 'id,first_name,last_name,position,positions,team_id,date_of_birth,joined_date,number,status';
    let players = null;
    try {
      const r = await sb().from('players').select(COLS + ',contract_until').eq('club_id', cid).is('archived_at', null);
      if (r && !r.error) players = r.data || [];
    } catch (_) {}
    if (players == null) players = await run(sb().from('players').select(COLS).eq('club_id', cid).is('archived_at', null));
    const ptQ = sb().from('player_teams').select('player_id,team_id').eq('club_id', cid);
    const mrQ = sb().from('match_results').select('id,team_id,match_date').eq('club_id', cid).gte('match_date', from).lte('match_date', to);
    const pmsQ = sb().from('player_match_stats').select('player_id,match_id,minutes').eq('club_id', cid);
    const [pteams, matches, pms] = await Promise.all([run(ptQ), run(mrQ), run(pmsQ)]);
    const out = { players, pteams, matches, pms, from, to };
    S.cache[key] = out; return out;
  }

  /* ── CÓMPUTO: métricas por equipo y por período ───────────────────────────
     Una sola pasada que sirve a la tendencia del club, a la tabla comparativa
     y a las columnas de la pestaña Lesiones.                                */
  function rosterFor(core, teamId) { return core.rosterOf[teamId] || new Set(); }

  // Disponibilidad sobre los días QUE TIENEN REGISTRO. Dividir por días de calendario
  // castigaría al club que no carga disponibilidad los domingos y daría 60% donde el dato
  // real es 95%. A cambio se expone la cobertura, para que el número se pueda juzgar.
  function availStats(core, teamIds, from, to) {
    const inScope = new Set();
    teamIds.forEach(id => rosterFor(core, id).forEach(p => inScope.add(p)));
    const byDay = {};
    (core.avail || []).forEach(a => {
      if (a.date < from || a.date > to) return;
      const pid = String(a.player_id);
      if (inScope.size && !inScope.has(pid)) return;
      if (a.team_id && teamIds.size && !teamIds.has(a.team_id) && !inScope.has(pid)) return;
      const d = (byDay[a.date] = byDay[a.date] || { n: 0, out: 0, lim: 0, seen: new Set() });
      if (d.seen.has(pid)) return; d.seen.add(pid);
      d.n++;
      const st = (a.status || '').toLowerCase();
      if (OUT_ST.has(st)) d.out++;
      else if (LIMITED_ST.has(st)) d.lim++;
    });
    let n = 0, out = 0, lim = 0, days = 0;
    Object.keys(byDay).forEach(k => { const d = byDay[k]; n += d.n; out += d.out; lim += d.lim; days++; });
    return { pct: pct(n - out, n), limPct: pct(lim, n), records: n, days: days };
  }

  // Cumplimiento de RPE: misma lógica que la pestaña Semana — se esperan tantas respuestas
  // como jugadores en el plantel del equipo de la sesión, y los partidos no cuentan.
  function rpeStats(core, teamIds, from, to) {
    const bySession = {};
    (core.rpe || []).forEach(r => { if (!r.session_id) return; (bySession[r.session_id] = bySession[r.session_id] || new Set()).add(String(r.player_id)); });
    let exp = 0, got = 0;
    (core.sessions || []).forEach(s => {
      if (!teamIds.has(s.team_id)) return;
      if ((s.session_type || '').toLowerCase() === 'match') return;
      if (s.session_date < from || s.session_date > to) return;
      const n = rosterFor(core, s.team_id).size; if (!n) return;
      exp += n; got += Math.min(n, bySession[s.id] ? bySession[s.id].size : 0);
    });
    return { pct: pct(got, exp), expected: exp, got: got };
  }

  // Respuesta de wellness: partes cargados ÷ (jugadores × días con al menos un parte).
  // Los días sin ningún parte no se cuentan: casi siempre son días libres, y meterlos
  // hundiría el porcentaje por una razón que no es incumplimiento.
  function wellStats(core, teamIds, from, to) {
    const inScope = new Set();
    teamIds.forEach(id => rosterFor(core, id).forEach(p => inScope.add(p)));
    const days = {}; let rows = 0; const rd = [];
    (core.wellness || []).forEach(w => {
      const day = String(w.submitted_at || '').slice(0, 10);
      if (!day || day < from || day > to) return;
      const pid = String(w.player_id);
      if (inScope.size && !inScope.has(pid)) return;
      (days[day] = days[day] || new Set()).add(pid);
      rows++;
      const r = Number(w.readiness); if (!isNaN(r)) rd.push(r);
    });
    const nDays = Object.keys(days).length;
    const expected = nDays * (inScope.size || 0);
    let submitted = 0; Object.keys(days).forEach(d => { submitted += days[d].size; });
    return { pct: pct(submitted, expected), days: nDays, rows: rows, avg: rd.length ? rd.reduce((a, b) => a + b, 0) / rd.length : null };
  }

  function sessionStats(core, teamIds, from, to) {
    let n = 0, auSum = 0, auN = 0, minutes = 0;
    (core.sessions || []).forEach(s => {
      if (!teamIds.has(s.team_id) || s.session_date < from || s.session_date > to) return;
      n++;
      if (s.duration) minutes += Number(s.duration) || 0;
      const au = (s.duration && s.estimated_rpe) ? Number(s.duration) * Number(s.estimated_rpe) : 0;
      if (au) { auSum += au; auN++; }
    });
    return { count: n, avgLoad: auN ? Math.round(auSum / auN) : null, minutes: minutes };
  }

  // Días perdidos DENTRO del período: solapamiento de [start, returned||hoy] con [from, to].
  // start_date puede ser futura (se carga una lesión con fecha de mañana) y returned_date
  // puede ser anterior a start si alguien se equivocó al tipear: por eso el clamp a 0.
  function daysLostIn(inj, from, to) {
    if (!inj.start_date) return 0;
    const t = todayY();
    const s = inj.start_date, e = inj.returned_date || t;
    const a = s > from ? s : from, b = e < to ? e : to;
    if (a > b) return 0;
    return Math.max(0, daysBetween(a, b) + 1);
  }
  function injuriesOfTeams(core, teamIds) {
    return (core.injuries || []).filter(i => {
      const owner = core.teamOf[String(i.player_id)];
      if (!teamIds.size) return true;
      if (owner && teamIds.has(owner)) return true;
      // Sin dueño resuelto: entra sólo si no hay filtro de equipo, para no inflar una categoría.
      return !S.scopeTeam && !owner;
    });
  }
  function injStats(core, teamIds, from, to) {
    const list = injuriesOfTeams(core, teamIds);
    let days = 0, newN = 0, active = 0;
    list.forEach(i => {
      days += daysLostIn(i, from, to);
      if (i.start_date >= from && i.start_date <= to) newN++;
      if (i.status === 'active' || i.status === 'returning') active++;
    });
    return { list, daysLost: days, newCount: newN, active: active };
  }

  /* Exposición estimada en horas-jugador, para la incidencia por 1000 h.
     Por cada sesión: duración × nº de expuestos. El nº sale, en orden de
     preferencia, de la disponibilidad de ese día (quien no estaba fuera) y si
     no hay registro, del plantel. Rehab queda fuera: no es exposición de
     equipo, es tratamiento, y contarla bajaría la incidencia por una razón
     falsa. Es una ESTIMACIÓN y la pantalla lo dice.                          */
  function exposureHours(core, teamIds, from, to) {
    const availByDay = {};
    (core.avail || []).forEach(a => {
      if (a.date < from || a.date > to) return;
      const d = (availByDay[a.date] = availByDay[a.date] || {});
      const owner = a.team_id || core.teamOf[String(a.player_id)] || '_';
      const b = (d[owner] = d[owner] || { ok: 0, seen: new Set() });
      const pid = String(a.player_id); if (b.seen.has(pid)) return; b.seen.add(pid);
      if (!OUT_ST.has((a.status || '').toLowerCase())) b.ok++;
    });
    let hours = 0, sessions = 0;
    (core.sessions || []).forEach(s => {
      if (!teamIds.has(s.team_id) || s.session_date < from || s.session_date > to) return;
      const type = (s.session_type || '').toLowerCase();
      if (type === 'rehab') return;
      const dur = Number(s.duration); if (!dur || dur <= 0) return;
      const day = availByDay[s.session_date] || {};
      let n = day[s.team_id] ? day[s.team_id].ok : null;
      if (n == null || n === 0) n = rosterFor(core, s.team_id).size;
      if (!n) return;
      hours += (dur / 60) * n; sessions++;
    });
    return { hours: hours, sessions: sessions };
  }

  /* Re-lesión: una lesión cuenta como recaída si el MISMO jugador ya tuvo otra
     en la MISMA región normalizada y esa anterior había empezado antes. No es
     la definición de consenso (que exige la misma estructura y una ventana de
     dos meses desde el alta), y la pantalla lo aclara: con body_area en texto
     libre, la región es lo más fino que se puede afirmar sin inventar.        */
  function reinjuryCount(list) {
    const seen = {}, sorted = list.slice().sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    let re = 0;
    sorted.forEach(i => {
      const k = String(i.player_id) + '|' + normArea(i.body_area);
      if (seen[k]) re++; else seen[k] = 1;
    });
    return re;
  }

  function groupCount(list, keyFn, from, to) {
    const m = {};
    list.forEach(i => {
      const k = keyFn(i); if (k == null) return;
      const g = (m[k] = m[k] || { key: k, count: 0, days: 0 });
      g.count++; g.days += daysLostIn(i, from, to);
    });
    return Object.keys(m).map(k => m[k]);
  }

  /* ══════════════════════════════════════════════════════════════════════
     PESTAÑA 1 · TEMPORADA — tendencia del club + comparativa entre equipos
     ══════════════════════════════════════════════════════════════════════ */
  async function renderSeason(root) {
    root.innerHTML = loadingBlock();
    const core = await loadCore();
    const { from, to } = core, ids = scopeTeamIds();
    if (!S.teams.length) { root.innerHTML = panel(tt('co_dir.cmp_title', 'Team by team'), emptyBlock(tt('club_overview.no_teams', 'No teams found for this club.'), 'ti-users-group')); return; }

    const buckets = buildBuckets(from, to);
    // Serie por bucket para las cuatro sparklines.
    const series = buckets.map(b => ({
      label: b.label, short: b.short,
      avail: availStats(core, ids, b.from, b.to).pct,
      days: injStats(core, ids, b.from, b.to).daysLost,
      rpe: rpeStats(core, ids, b.from, b.to).pct,
      well: wellStats(core, ids, b.from, b.to).pct
    }));
    const A = availStats(core, ids, from, to), R = rpeStats(core, ids, from, to), W = wellStats(core, ids, from, to), I = injStats(core, ids, from, to), SS = sessionStats(core, ids, from, to);
    // Mitad anterior del período como comparación: con un solo período no hay contra qué medir.
    const half = Math.floor((daysBetween(from, to) + 1) / 2);
    const midA = ymd(addDays(parseYMD(from), half)), prevTo = ymd(addDays(parseYMD(midA), -1));
    const pA = availStats(core, ids, from, prevTo), pR = rpeStats(core, ids, from, prevTo), pW = wellStats(core, ids, from, prevTo), pI = injStats(core, ids, from, prevTo);
    const cA = availStats(core, ids, midA, to), cR = rpeStats(core, ids, midA, to), cW = wellStats(core, ids, midA, to), cI = injStats(core, ids, midA, to);

    const cards = [
      kpiCard({
        ic: 'ti-user-check', col: 'var(--cm-success)', bg: 'var(--cm-success-bg)', lbl: tt('co_dir.k_avail', 'Squad availability'),
        val: A.pct == null ? '—' : nf(A.pct, 0), unit: A.pct == null ? '' : '%',
        sub: deltaChip(cA.pct, pA.pct, { unit: '%' }) + '<span class="co-chip neutral">' + esc(nf(A.days) + ' ' + tt('co_dir.days_logged', 'days logged')) + '</span>',
        spark: sparkline(series.map(s => s.avail), { color: 'var(--cm-success)' })
      }),
      kpiCard({
        ic: 'ti-bandage', col: 'var(--cm-danger)', bg: 'var(--cm-danger-bg)', lbl: tt('co_dir.k_days_lost', 'Days lost to injury'),
        val: nf(I.daysLost),
        sub: deltaChip(cI.daysLost, pI.daysLost, { lowerIsBetter: true, eps: 1 }) + '<span class="co-chip neutral">' + esc(nf(I.newCount) + ' ' + tt('co_dir.new_inj', 'new')) + '</span>',
        spark: sparkline(series.map(s => s.days), { color: 'var(--cm-danger)', zeroBase: true })
      }),
      kpiCard({
        ic: 'ti-activity', col: 'var(--cm-violet)', bg: 'var(--cm-violet-bg)', lbl: tt('club_overview.k_rpe', 'RPE compliance'),
        val: R.pct == null ? '—' : nf(R.pct, 0), unit: R.pct == null ? '' : '%',
        sub: deltaChip(cR.pct, pR.pct, { unit: '%' }) + '<span class="co-chip neutral">' + esc(nf(R.got) + '/' + nf(R.expected)) + '</span>',
        spark: sparkline(series.map(s => s.rpe), { color: 'var(--cm-violet)' })
      }),
      kpiCard({
        ic: 'ti-battery-charging', col: 'var(--cm-info)', bg: 'var(--cm-info-bg)', lbl: tt('co_dir.k_well_resp', 'Wellness response'),
        val: W.pct == null ? '—' : nf(W.pct, 0), unit: W.pct == null ? '' : '%',
        sub: deltaChip(cW.pct, pW.pct, { unit: '%' }) + (W.avg == null ? '' : '<span class="co-chip neutral">' + esc(tt('co_dir.readiness', 'readiness') + ' ' + nf(W.avg, 1)) + '</span>'),
        spark: sparkline(series.map(s => s.well), { color: 'var(--cm-info)' })
      })
    ].join('');

    // ── comparativa entre equipos ──
    const rows = S.teams.filter(t => !S.scopeTeam || t.id === S.scopeTeam).map(t => {
      const one = new Set([t.id]);
      const a = availStats(core, one, from, to), r = rpeStats(core, one, from, to), w = wellStats(core, one, from, to), i = injStats(core, one, from, to), s = sessionStats(core, one, from, to);
      return {
        id: t.id, name: t.name || '—', category: t.category || '',
        squad: rosterFor(core, t.id).size,
        avail: a.pct, active: i.active, days: i.daysLost,
        rpe: r.pct, well: w.pct, sessions: s.count, load: s.avgLoad
      };
    });
    const sort = S.sort.cmp;
    rows.sort((x, y) => {
      const a = x[sort.k], b = y[sort.k];
      if (typeof a === 'string' || typeof b === 'string') return String(a || '').localeCompare(String(b || '')) * sort.dir;
      const av = a == null ? -Infinity : a, bv = b == null ? -Infinity : b;
      return (av - bv) * sort.dir;
    });
    const COLS = [
      ['name', tt('co_dir.c_team', 'Team'), 'l'],
      ['squad', tt('co_dir.c_squad', 'Squad'), 'n'],
      ['avail', tt('co_dir.c_avail', 'Availability'), 'n'],
      ['active', tt('co_dir.c_active', 'Out now'), 'n'],
      ['days', tt('co_dir.c_days', 'Days lost'), 'n'],
      ['rpe', tt('co_dir.c_rpe', 'RPE'), 'n'],
      ['well', tt('co_dir.c_well', 'Wellness'), 'n'],
      ['sessions', tt('co_dir.c_sessions', 'Sessions'), 'n'],
      ['load', tt('co_dir.c_load', 'Avg load'), 'n']
    ];
    const thead = COLS.map(c => '<th class="' + (c[2] === 'n' ? 'num' : '') + ' cod-sortable" data-cmp="' + c[0] + '" aria-sort="' + (sort.k === c[0] ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' +
      '<button type="button">' + esc(c[1]) + '<i class="ti ' + (sort.k === c[0] ? (sort.dir > 0 ? 'ti-caret-up-filled' : 'ti-caret-down-filled') : 'ti-minus-vertical') + '"></i></button></th>').join('');
    const tbody = rows.length ? rows.map(r => {
      const availCls = r.avail == null ? 'neutral' : r.avail >= 90 ? 'good' : r.avail >= 80 ? 'warn' : 'bad';
      const rpeCls = r.rpe == null ? 'neutral' : r.rpe >= 85 ? 'good' : r.rpe >= 60 ? 'warn' : 'bad';
      const wellCls = r.well == null ? 'neutral' : r.well >= 80 ? 'good' : r.well >= 50 ? 'warn' : 'bad';
      return '<tr><th scope="row"><div class="cod-tname"><span class="cod-tn">' + esc(r.name) + '</span>' + (r.category ? '<span class="cod-tc">' + esc(r.category) + '</span>' : '') + '</div></th>' +
        '<td class="num">' + esc(nf(r.squad)) + '</td>' +
        '<td class="num"><span class="co-chip ' + availCls + '">' + esc(fmtPct(r.avail)) + '</span></td>' +
        '<td class="num">' + (r.active ? '<span class="co-chip bad">' + esc(nf(r.active)) + '</span>' : '<span class="cod-zero">0</span>') + '</td>' +
        '<td class="num">' + esc(nf(r.days)) + '</td>' +
        '<td class="num"><span class="co-chip ' + rpeCls + '">' + esc(fmtPct(r.rpe)) + '</span></td>' +
        '<td class="num"><span class="co-chip ' + wellCls + '">' + esc(fmtPct(r.well)) + '</span></td>' +
        '<td class="num">' + esc(nf(r.sessions)) + '</td>' +
        '<td class="num">' + (r.load == null ? '—' : esc(nf(r.load)) + '<small> AU</small>') + '</td></tr>';
    }).join('') : '';

    root.innerHTML =
      '<div class="cod-kpis">' + cards + '</div>' +
      '<div class="co-panel cod-panel"><div class="co-phead"><h2>' + esc(tt('co_dir.cmp_title', 'Team by team')) + '</h2><div class="co-grow"></div>' +
        '<span class="cod-meta">' + esc(shortDate(from) + ' – ' + shortDate(to)) + '</span></div>' +
        (tbody
          ? '<div class="cod-tablewrap"><table class="cod-table" id="coCmpTable"><thead><tr>' + thead + '</tr></thead><tbody>' + tbody + '</tbody></table></div>'
          : emptyBlock(tt('co_dir.no_teams_data', 'No data for the teams in this period.'), 'ti-table-off')) +
        '<div class="cod-foot">' + method(tt('co_dir.m_cmp', 'Availability is the share of recorded player-days where the player was not injured, sick, unavailable or away. Days lost counts every day an injury overlaps this period. RPE and Wellness are submissions received over submissions expected from each team\'s roster.')) + '</div>' +
      '</div>' +
      (SS.count ? '' : hint(tt('co_dir.no_sessions_hint', 'No sessions in this period — load, RPE and wellness columns will stay empty until the week is planned.')));

    const tbl = document.getElementById('coCmpTable');
    if (tbl) tbl.addEventListener('click', e => {
      const th = e.target.closest('th[data-cmp]'); if (!th) return;
      const k = th.dataset.cmp;
      S.sort.cmp = { k: k, dir: S.sort.cmp.k === k ? -S.sort.cmp.dir : (k === 'name' ? 1 : -1) };
      renderSeason(root);
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     PESTAÑA 2 · LESIONES — epidemiología del club
     ══════════════════════════════════════════════════════════════════════ */
  async function renderInjuries(root) {
    root.innerHTML = loadingBlock();
    const core = await loadCore();
    const { from, to } = core, ids = scopeTeamIds();
    const I = injStats(core, ids, from, to);
    const list = I.list;
    const inPeriod = list.filter(i => i.start_date >= from && i.start_date <= to);
    const EX = exposureHours(core, ids, from, to);
    const inc = EX.hours > 0 ? (inPeriod.length / EX.hours * 1000) : null;
    const re = reinjuryCount(list);
    const closed = list.filter(i => i.returned_date);
    const avgOut = closed.length ? closed.reduce((a, i) => a + Math.max(0, daysBetween(i.start_date, i.returned_date) + 1), 0) / closed.length : null;

    if (!list.length) {
      root.innerHTML = '<div class="co-panel cod-panel"><div class="co-phead"><h2>' + esc(tt('co_dir.inj_title', 'Injury profile')) + '</h2></div>' +
        emptyBlock(tt('co_dir.inj_none', 'No injuries recorded in this period. Nothing to report — which is the best possible report.'), 'ti-mood-check') + '</div>';
      return;
    }

    const kpis = [
      kpiCard({ ic: 'ti-clipboard-plus', col: 'var(--cm-danger)', bg: 'var(--cm-danger-bg)', lbl: tt('co_dir.k_new', 'New injuries'), val: nf(inPeriod.length), sub: '<span class="co-chip neutral">' + esc(nf(I.active) + ' ' + tt('co_dir.open_now', 'still open')) + '</span>' }),
      kpiCard({ ic: 'ti-calendar-x', col: 'var(--cm-warning)', bg: 'var(--cm-warning-bg)', lbl: tt('co_dir.k_days_lost', 'Days lost to injury'), val: nf(I.daysLost), sub: avgOut == null ? '' : '<span class="co-chip neutral">' + esc(nf(avgOut, 0) + ' ' + tt('co_dir.avg_per_case', 'avg per closed case')) + '</span>' }),
      kpiCard({ ic: 'ti-chart-dots', col: 'var(--cm-violet)', bg: 'var(--cm-violet-bg)', lbl: tt('co_dir.k_incidence', 'Incidence / 1000 h'), val: inc == null ? '—' : nf(inc, 1), sub: '<span class="co-chip neutral">' + esc(nf(EX.hours, 0) + ' ' + tt('co_dir.exp_hours', 'exposure h')) + '</span>' }),
      kpiCard({ ic: 'ti-rotate-2', col: 'var(--cm-info)', bg: 'var(--cm-info-bg)', lbl: tt('co_dir.k_reinjury', 'Recurrences'), val: nf(re), sub: '<span class="co-chip ' + (re ? 'warn' : 'good') + '">' + esc(fmtPct(pct(re, list.length))) + ' ' + esc(tt('co_dir.of_cases', 'of cases')) + '</span>' })
    ].join('');

    const areaRows = groupCount(list, i => normArea(i.body_area), from, to)
      .sort((a, b) => b.days - a.days).slice(0, 10)
      .map(g => ({ label: areaLabel(g.key), value: g.days, display: nf(g.days), sub: ' · ' + nf(g.count) + (g.count === 1 ? ' ' + tt('co_dir.case', 'case') : ' ' + tt('co_dir.cases', 'cases')), color: 'var(--cm-danger)' }));
    const catRows = groupCount(list, i => i.injury_category || 'unknown', from, to)
      .sort((a, b) => b.count - a.count)
      .map(g => ({ label: catLabel(g.key), value: g.count, display: nf(g.count), sub: ' · ' + nf(g.days) + ' d', color: 'var(--cm-violet)' }));
    const mechRows = groupCount(list, i => i.injury_mechanism || 'unknown', from, to)
      .sort((a, b) => b.count - a.count)
      .map(g => ({ label: mechLabel(g.key), value: g.count, display: nf(g.count), sub: ' · ' + nf(g.days) + ' d', color: 'var(--cm-info)' }));
    const sevRows = ['severe', 'moderate', 'minor'].map(s => {
      const g = list.filter(i => (i.severity || '').toLowerCase() === s);
      return { label: sevLabel(s), value: g.length, display: nf(g.length), sub: ' · ' + nf(g.reduce((a, i) => a + daysLostIn(i, from, to), 0)) + ' d', color: s === 'severe' ? 'var(--cm-danger)' : s === 'moderate' ? 'var(--cm-warning)' : 'var(--cm-neutral)' };
    }).filter(r => r.value > 0);

    const buckets = buildBuckets(from, to);
    const timeline = buckets.map(b => ({ label: b.label, short: b.short, value: list.filter(i => i.start_date >= b.from && i.start_date <= b.to).length }));
    const burdenLine = buckets.map(b => injStats(core, ids, b.from, b.to).daysLost);

    // Tabla de casos, ordenable.
    const cases = list.map(i => {
      const p = core.pmap[String(i.player_id)];
      return {
        player: p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : tt('club_overview.a_player', 'Player'),
        team: (S.teams.find(t => t.id === core.teamOf[String(i.player_id)]) || {}).name || '',
        area: areaLabel(normArea(i.body_area)), raw: i.body_area || '',
        cat: catLabel(i.injury_category || 'unknown'), sev: i.severity || '', sevL: sevLabel(i.severity),
        start: i.start_date, days: daysLostIn(i, from, to), status: i.status,
        eta: i.returned_date || i.expected_return || null, returned: !!i.returned_date
      };
    });
    const isort = S.sort.inj;
    cases.sort((a, b) => {
      const x = a[isort.k], y = b[isort.k];
      if (typeof x === 'string' || typeof y === 'string') return String(x || '').localeCompare(String(y || '')) * isort.dir;
      return ((x == null ? -Infinity : x) - (y == null ? -Infinity : y)) * isort.dir;
    });
    const ICOLS = [['player', tt('co_dir.c_player', 'Player'), 'l'], ['team', tt('co_dir.c_team', 'Team'), 'l'], ['area', tt('co_dir.c_area', 'Area'), 'l'],
      ['cat', tt('co_dir.c_cat', 'Type'), 'l'], ['sev', tt('co_dir.c_sev', 'Severity'), 'l'], ['start', tt('co_dir.c_start', 'Onset'), 'l'], ['days', tt('co_dir.c_days', 'Days lost'), 'n'], ['status', tt('co_dir.c_status', 'Status'), 'l']];
    const ithead = ICOLS.map(c => '<th class="' + (c[2] === 'n' ? 'num' : '') + ' cod-sortable" data-inj="' + c[0] + '" aria-sort="' + (isort.k === c[0] ? (isort.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' +
      '<button type="button">' + esc(c[1]) + '<i class="ti ' + (isort.k === c[0] ? (isort.dir > 0 ? 'ti-caret-up-filled' : 'ti-caret-down-filled') : 'ti-minus-vertical') + '"></i></button></th>').join('');
    const itbody = cases.map(c => {
      const stCls = c.status === 'cleared' ? 'good' : c.status === 'returning' ? 'info' : 'bad';
      const stLbl = c.status === 'cleared' ? tt('co_dir.st_cleared', 'Cleared') : c.status === 'returning' ? tt('club_overview.rtp_returning', 'Returning') : tt('co_dir.st_active', 'Out');
      return '<tr><th scope="row"><div class="cod-pname"><span class="cod-av">' + esc(initials(c.player)) + '</span><span class="cod-pn">' + esc(c.player) + '</span></div></th>' +
        '<td class="cod-dim">' + esc(c.team || '—') + '</td>' +
        '<td><span class="cod-area" title="' + esc(c.raw) + '">' + esc(c.area) + '</span></td>' +
        '<td class="cod-dim">' + esc(c.cat) + '</td>' +
        '<td><span class="co-chip ' + (c.sev === 'severe' ? 'bad' : c.sev === 'moderate' ? 'warn' : 'neutral') + '">' + esc(c.sevL) + '</span></td>' +
        '<td class="cod-mono">' + esc(shortDate(c.start)) + '</td>' +
        '<td class="num cod-mono">' + esc(nf(c.days)) + '</td>' +
        '<td><span class="co-chip ' + stCls + '">' + esc(stLbl) + '</span></td></tr>';
    }).join('');

    root.innerHTML =
      '<div class="cod-kpis">' + kpis + '</div>' +
      '<div class="cod-grid2">' +
        panel(tt('co_dir.by_area', 'Burden by body area'), hbars(areaRows), tt('co_dir.by_area_sub', 'days lost'), method(tt('co_dir.m_area', 'body_area is free text, so entries like "Left Hamstring", "hamstring" and "Isquiotibial" are grouped into one region and the side is dropped. Hover a row to see what was originally typed.'))) +
        panel(tt('co_dir.by_cat', 'By injury type'), hbars(catRows), tt('co_dir.by_cat_sub', 'cases')) +
      '</div>' +
      '<div class="cod-grid2">' +
        panel(tt('co_dir.by_mech', 'By mechanism'), hbars(mechRows), tt('co_dir.by_mech_sub', 'cases'), mechRows.some(r => r.label === mechLabel('unknown')) ? hint(tt('co_dir.mech_hint', 'Cases without a mechanism recorded show as "Not recorded" — it is a field in the injury form.')) : '') +
        panel(tt('co_dir.by_sev', 'By severity'), hbars(sevRows), tt('co_dir.by_sev_sub', 'cases')) +
      '</div>' +
      '<div class="cod-grid2">' +
        panel(tt('co_dir.tl_new', 'New injuries over time'), vbars(timeline, { color: 'var(--cm-danger)' })) +
        panel(tt('co_dir.tl_burden', 'Days lost over time'), '<div class="cod-sparkbig">' + sparkline(burdenLine, { color: 'var(--cm-warning)', h: 56, zeroBase: true }) + '<div class="cod-sparkx"><span>' + esc(buckets.length ? buckets[0].label : '') + '</span><span>' + esc(buckets.length ? buckets[buckets.length - 1].label : '') + '</span></div></div>') +
      '</div>' +
      '<div class="co-panel cod-panel"><div class="co-phead"><h2>' + esc(tt('co_dir.cases_title', 'Cases')) + '</h2><div class="co-grow"></div><span class="cod-meta">' + esc(nf(list.length) + ' ' + tt('co_dir.cases', 'cases')) + '</span></div>' +
        '<div class="cod-tablewrap"><table class="cod-table" id="coInjTable"><thead><tr>' + ithead + '</tr></thead><tbody>' + itbody + '</tbody></table></div>' +
        '<div class="cod-foot">' + method(tt('co_dir.m_inc', 'Incidence is new injuries per 1000 hours of estimated exposure. Exposure multiplies each session\'s duration by the players not marked out that day (rehab sessions excluded), so it is an estimate, not a measured figure. A recurrence is a second injury for the same player in the same region — with free-text body areas, the region is as precise as this can honestly get.')) + '</div>' +
      '</div>';

    const itbl = document.getElementById('coInjTable');
    if (itbl) itbl.addEventListener('click', e => {
      const th = e.target.closest('th[data-inj]'); if (!th) return;
      const k = th.dataset.inj;
      S.sort.inj = { k: k, dir: S.sort.inj.k === k ? -S.sort.inj.dir : (k === 'days' ? -1 : 1) };
      renderInjuries(root);
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     PESTAÑA 3 · PLANTEL — edades, profundidad, minutos, vencimientos
     ══════════════════════════════════════════════════════════════════════ */
  async function renderSquad(root) {
    root.innerHTML = loadingBlock();
    const d = await loadSquad();
    const ids = scopeTeamIds();
    const teamOf = {};
    (d.pteams || []).forEach(r => { const k = String(r.player_id); if (!teamOf[k]) teamOf[k] = r.team_id; });
    (d.players || []).forEach(p => { if (p.team_id) teamOf[String(p.id)] = p.team_id; });
    const players = (d.players || []).filter(p => !S.scopeTeam || teamOf[String(p.id)] === S.scopeTeam ||
      (d.pteams || []).some(r => String(r.player_id) === String(p.id) && r.team_id === S.scopeTeam));

    if (!players.length) { root.innerHTML = panel(tt('co_dir.t_squad', 'Squad'), emptyBlock(tt('co_dir.sq_none', 'No players in this scope.'), 'ti-users-group')); return; }

    const ages = players.map(p => ageOf(p.date_of_birth)).filter(a => a != null);
    const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
    const noDob = players.length - ages.length;

    // Profundidad por línea: menos de dos por línea es un riesgo que el director tiene que ver.
    const byLine = {}; LINES.forEach(l => { byLine[l] = []; });
    players.forEach(p => { const l = lineOf(p.position || (p.positions && p.positions[0])); (byLine[l] = byLine[l] || []).push(p); });
    const thin = LINES.filter(l => l !== 'unk' && byLine[l].length > 0 && byLine[l].length < 2);

    // Pirámide de edades por tramos.
    const BANDS = [[0, 17, 'U18'], [18, 20, '18–20'], [21, 23, '21–23'], [24, 27, '24–27'], [28, 31, '28–31'], [32, 99, '32+']];
    const ageRows = BANDS.map(b => {
      const n = ages.filter(a => a >= b[0] && a <= b[1]).length;
      return { label: b[2], value: n, display: nf(n), color: 'var(--cm-info)' };
    }).filter(r => r.value > 0);

    const lineRows = LINES.filter(l => byLine[l].length).map(l => ({
      label: lineLabel(l), value: byLine[l].length, display: nf(byLine[l].length),
      color: byLine[l].length < 2 && l !== 'unk' ? 'var(--cm-danger)' : 'var(--cm-accent)'
    }));

    // ── minutos ──
    // player_match_stats es la fuente. En la mayoría de los clubes está vacía (se llena desde
    // Match Reports), así que el cartel vacío tiene que decir DÓNDE se cargan, no sólo que no hay.
    const matchIds = new Set((d.matches || []).map(m => String(m.id)));
    const minBy = {};
    (d.pms || []).forEach(r => {
      if (matchIds.size && !matchIds.has(String(r.match_id))) return;
      const k = String(r.player_id); minBy[k] = (minBy[k] || 0) + (Number(r.minutes) || 0);
    });
    const minRows = players.map(p => ({ p: p, min: minBy[String(p.id)] || 0 })).filter(r => r.min > 0).sort((a, b) => b.min - a.min);
    const totalMin = minRows.reduce((a, r) => a + r.min, 0);
    const minBars = minRows.slice(0, 12).map(r => ({
      label: [r.p.first_name, r.p.last_name].filter(Boolean).join(' '),
      value: r.min, display: nf(r.min), sub: totalMin ? ' · ' + nf(pct(r.min, totalMin), 0) + '%' : '', color: 'var(--cm-accent)'
    }));

    // ── vencimientos de contrato ──
    const hasContractCol = (d.players || []).some(p => 'contract_until' in p);
    const t = todayY(), in180 = ymd(addDays(parseYMD(t), 180));
    const expiring = players.filter(p => p.contract_until).map(p => ({
      p: p, until: p.contract_until, days: daysBetween(t, p.contract_until)
    })).sort((a, b) => String(a.until).localeCompare(String(b.until)));
    const soon = expiring.filter(e => e.until <= in180);
    const withContract = expiring.length;

    const kpis = [
      kpiCard({ ic: 'ti-users-group', col: 'var(--cm-accent)', bg: 'var(--cm-accent-soft)', lbl: tt('co_dir.k_squad', 'Squad size'), val: nf(players.length), sub: '<span class="co-chip neutral">' + esc(nf(lineRows.length) + ' ' + tt('co_dir.lines', 'lines covered')) + '</span>' }),
      kpiCard({ ic: 'ti-cake', col: 'var(--cm-info)', bg: 'var(--cm-info-bg)', lbl: tt('co_dir.k_age', 'Average age'), val: avgAge == null ? '—' : nf(avgAge, 1), sub: noDob ? '<span class="co-chip warn">' + esc(nf(noDob) + ' ' + tt('co_dir.no_dob', 'without birth date')) + '</span>' : '<span class="co-chip good"><i class="ti ti-check"></i>' + esc(tt('co_dir.all_dob', 'all recorded')) + '</span>' }),
      kpiCard({ ic: 'ti-stack-2', col: thin.length ? 'var(--cm-danger)' : 'var(--cm-success)', bg: thin.length ? 'var(--cm-danger-bg)' : 'var(--cm-success-bg)', lbl: tt('co_dir.k_depth', 'Thin positions'), val: nf(thin.length), sub: thin.length ? '<span class="co-chip bad">' + esc(thin.map(lineLabel).join(', ')) + '</span>' : '<span class="co-chip good"><i class="ti ti-check"></i>' + esc(tt('co_dir.depth_ok', 'Two or more everywhere')) + '</span>' }),
      kpiCard({ ic: 'ti-file-text', col: 'var(--cm-warning)', bg: 'var(--cm-warning-bg)', lbl: tt('co_dir.k_expiring', 'Expiring ≤ 6 months'), val: nf(soon.length), sub: '<span class="co-chip neutral">' + esc(nf(withContract) + '/' + nf(players.length) + ' ' + tt('co_dir.with_date', 'with a date')) + '</span>' })
    ].join('');

    const expBody = soon.length ? '<div class="cod-list">' + soon.slice(0, 12).map(e => {
      const nm = [e.p.first_name, e.p.last_name].filter(Boolean).join(' ');
      const cls = e.days < 0 ? 'bad' : e.days <= 60 ? 'bad' : e.days <= 120 ? 'warn' : 'info';
      const lbl = e.days < 0 ? tt('co_dir.expired', 'Expired') : e.days === 0 ? tt('common.today', 'Today') : nf(e.days) + ' ' + tt('co_dir.days_short', 'd');
      return '<div class="cod-li"><span class="cod-av">' + esc(initials(nm)) + '</span><div class="cod-lib"><div class="cod-lt">' + esc(nm) + '</div>' +
        '<div class="cod-ld">' + esc([e.p.position || '', (S.teams.find(x => x.id === teamOf[String(e.p.id)]) || {}).name || ''].filter(Boolean).join(' · ')) + '</div></div>' +
        '<span class="cod-mono cod-dim">' + esc(shortDate(e.until)) + '</span><span class="co-chip ' + cls + '">' + esc(lbl) + '</span></div>';
    }).join('') + '</div>'
      : emptyBlock(hasContractCol
        ? (withContract ? tt('co_dir.exp_none', 'No contracts expiring in the next 6 months.') : tt('co_dir.exp_empty', 'No contract end dates recorded yet. Add them in Squad → player → Contract until, and this panel fills itself.'))
        : tt('co_dir.exp_nocol', 'Contract dates are not available in this database yet.'), withContract ? 'ti-mood-check' : 'ti-calendar-plus');

    root.innerHTML =
      '<div class="cod-kpis">' + kpis + '</div>' +
      '<div class="cod-grid2">' +
        panel(tt('co_dir.age_profile', 'Age profile'), hbars(ageRows), tt('co_dir.players', 'players')) +
        panel(tt('co_dir.depth', 'Depth by line'), hbars(lineRows), tt('co_dir.players', 'players'),
          thin.length ? hint(tt('co_dir.thin_hint', 'A line with a single player has no cover for an injury or a suspension.')) : '') +
      '</div>' +
      '<div class="cod-grid2">' +
        panel(tt('co_dir.minutes', 'Minutes played'), minBars.length
          ? hbars(minBars)
          : emptyBlock(tt('co_dir.min_empty', 'No match minutes in this period. Minutes come from Match Reports — record a line-up and the distribution appears here.'), 'ti-clock-off'),
          minBars.length ? tt('co_dir.min_sub', 'minutes · share of total') : '',
          minBars.length ? method(tt('co_dir.m_min', 'Minutes are summed from player match stats for matches inside the selected period. Only players with at least one minute are listed, top 12 first.')) : '') +
        panel(tt('co_dir.contracts', 'Contracts expiring'), expBody, '') +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════════════════
     PESTAÑA 4 · STAFF — adopción real y huecos de carga
     ══════════════════════════════════════════════════════════════════════ */
  // Acciones sin actor_id son de jugadores (rpe/wellness/gps se registran sin usuario de staff):
  // mezclarlas haría que el club pareciera activísimo aunque el cuerpo técnico no entre nunca.
  function isStaffAction(a) { return !!a.actor_id; }
  function actionLabel(a) {
    const FB = {
      'session.published': 'published a session', 'session.modified': 'edited a session', 'session.created': 'created a session',
      'microcycle.published': 'published a microcycle', 'availability.changed': 'updated availability',
      'injury.logged': 'logged an injury', 'injury.cleared': 'cleared an injury', 'treatment.adaptation': 'adapted a treatment',
      'evaluation.recorded': 'recorded an evaluation', 'player.added': 'added a player', 'player.archived': 'archived a player',
      'task.created': 'created a task', 'task.completed': 'completed a task', 'member.joined': 'joined the club',
      'gym.updated': 'updated a gym session'
    };
    return tt('co_dir.act_' + String(a).replace(/\./g, '_'), FB[a] || String(a).replace(/[._]/g, ' '));
  }
  function roleLabel(r) {
    if (!r) return '';
    return tt('admin.role_' + String(r).toLowerCase(), String(r).replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()));
  }
  function relAge(ts) {
    if (!ts) return { txt: tt('co_dir.never', 'Never'), cls: 'bad', days: Infinity };
    const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
    if (isNaN(days)) return { txt: '—', cls: 'neutral', days: Infinity };
    const txt = days <= 0 ? tt('common.today', 'Today') : days === 1 ? tt('co_dir.yesterday', 'Yesterday') : nf(days) + ' ' + tt('co_dir.days_ago', 'd ago');
    return { txt: txt, cls: days <= 3 ? 'good' : days <= 14 ? 'warn' : 'bad', days: days };
  }

  async function renderStaff(root) {
    root.innerHTML = loadingBlock();
    const [d, core] = await Promise.all([loadStaff(), loadCore()]);
    const { from, to } = d;
    const acts = (d.acts || []).filter(isStaffAction).filter(a => !S.scopeTeam || !a.team_id || a.team_id === S.scopeTeam);
    const profiles = d.profiles || [];

    const byActor = {};
    acts.forEach(a => {
      const k = String(a.actor_id);
      const g = (byActor[k] = byActor[k] || { n: 0, last: null, kinds: {}, label: a.actor_label || '' });
      g.n++;
      if (!g.last || a.created_at > g.last) g.last = a.created_at;
      g.kinds[a.action] = (g.kinds[a.action] || 0) + 1;
      if (!g.label && a.actor_label) g.label = a.actor_label;
    });
    const buckets = buildBuckets(from, to);
    const rows = profiles.map(p => {
      const g = byActor[String(p.id)] || { n: 0, last: null, kinds: {} };
      const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || g.label || '—';
      const top = Object.keys(g.kinds).sort((a, b) => g.kinds[b] - g.kinds[a])[0] || '';
      const series = buckets.map(b => acts.filter(a => String(a.actor_id) === String(p.id) && a.created_at >= b.from && a.created_at <= b.to + 'T23:59:59').length);
      return { id: p.id, name: name, role: [p.role, p.club_role].filter(Boolean).map(roleLabel).join(' · ') || roleLabel('staff'), job: p.job_title || '', acts: g.n, last: g.last, top: top, series: series };
    });
    // Miembros con actividad que no están en profiles del club (ya salieron): no se pierden.
    Object.keys(byActor).forEach(k => {
      if (profiles.some(p => String(p.id) === k)) return;
      const g = byActor[k];
      rows.push({ id: k, name: g.label || tt('co_dir.former', 'Former member'), role: tt('co_dir.not_in_club', 'No longer in the club'), job: '', acts: g.n, last: g.last, top: Object.keys(g.kinds)[0] || '', series: buckets.map(() => 0) });
    });

    const ssort = S.sort.staff;
    rows.sort((a, b) => {
      const x = a[ssort.k], y = b[ssort.k];
      if (ssort.k === 'last') return (String(y || '').localeCompare(String(x || ''))) * (ssort.dir > 0 ? -1 : 1);
      if (typeof x === 'string' || typeof y === 'string') return String(x || '').localeCompare(String(y || '')) * ssort.dir;
      return ((x || 0) - (y || 0)) * ssort.dir;
    });

    const active = rows.filter(r => r.acts > 0).length;
    const silent = rows.filter(r => r.acts === 0);
    const spanDays = daysBetween(from, to) + 1;

    /* ── huecos de carga de datos ──
       El otro lado de la adopción: no "quién entró" sino "qué falta". Todo esto sale de
       datos que ya están cargados en core, y es lo que un director puede pedir que se
       corrija mañana. */
    const gaps = [];
    const tIds = scopeTeamIds();
    scopeTeams().forEach(t => {
      const one = new Set([t.id]);
      const av = (core.avail || []).filter(a => a.team_id === t.id || core.teamOf[String(a.player_id)] === t.id);
      const lastAv = av.reduce((m, a) => (a.date > m ? a.date : m), '');
      const lag = lastAv ? daysBetween(lastAv, todayY()) : null;
      if (!lastAv) gaps.push({ k: 'bad', i: 'ti-user-off', t: t.name, d: tt('co_dir.gap_noavail', 'No availability recorded in this period.') });
      else if (lag > 7) gaps.push({ k: 'warn', i: 'ti-user-off', t: t.name, d: tt('co_dir.gap_avail_lag', 'Availability last updated {n} days ago.', { n: nf(lag) }).replace('{n}', nf(lag)) });
      const ss = sessionStats(core, one, from, to);
      if (!ss.count) gaps.push({ k: 'warn', i: 'ti-calendar-off', t: t.name, d: tt('co_dir.gap_nosess', 'No sessions planned in this period.') });
      const rr = rpeStats(core, one, from, to);
      if (rr.expected > 0 && rr.pct != null && rr.pct < 50) gaps.push({ k: 'warn', i: 'ti-activity', t: t.name, d: tt('co_dir.gap_rpe', 'RPE compliance below 50%.') });
    });
    const noEta = (core.injuries || []).filter(i => (i.status === 'active') && !i.expected_return && (!tIds.size || tIds.has(core.teamOf[String(i.player_id)])));
    if (noEta.length) gaps.push({ k: 'warn', i: 'ti-bandage', t: tt('co_dir.gap_eta_t', 'Injuries without an expected return'), d: tt('co_dir.gap_eta', '{n} open cases have no ETA — Return to play cannot rank them.').replace('{n}', nf(noEta.length)) });
    const noPos = (core.players || []).filter(p => !p.position && (!p.positions || !p.positions.length) && (!tIds.size || tIds.has(core.teamOf[String(p.id)])));
    if (noPos.length) gaps.push({ k: 'info', i: 'ti-user-question', t: tt('co_dir.gap_pos_t', 'Players without a position'), d: tt('co_dir.gap_pos', '{n} players are missing a position, so depth by line is incomplete.').replace('{n}', nf(noPos.length)) });

    const kpis = [
      kpiCard({ ic: 'ti-users', col: 'var(--cm-accent)', bg: 'var(--cm-accent-soft)', lbl: tt('co_dir.k_active_staff', 'Active staff'), val: nf(active) + '<small>/' + nf(rows.length) + '</small>', sub: silent.length ? '<span class="co-chip warn">' + esc(nf(silent.length) + ' ' + tt('co_dir.silent', 'with no activity')) + '</span>' : '<span class="co-chip good"><i class="ti ti-check"></i>' + esc(tt('co_dir.all_active', 'Everyone active')) + '</span>' }),
      kpiCard({ ic: 'ti-bolt', col: 'var(--cm-violet)', bg: 'var(--cm-violet-bg)', lbl: tt('co_dir.k_actions', 'Staff actions'), val: nf(acts.length), sub: '<span class="co-chip neutral">' + esc(nf(acts.length / Math.max(1, spanDays), 1) + ' ' + tt('co_dir.per_day', 'per day')) + '</span>' }),
      kpiCard({ ic: 'ti-alert-triangle', col: gaps.length ? 'var(--cm-warning)' : 'var(--cm-success)', bg: gaps.length ? 'var(--cm-warning-bg)' : 'var(--cm-success-bg)', lbl: tt('co_dir.k_gaps', 'Data gaps'), val: nf(gaps.length), sub: gaps.length ? '<span class="co-chip warn">' + esc(tt('co_dir.gaps_sub', 'worth a message to the staff')) + '</span>' : '<span class="co-chip good"><i class="ti ti-check"></i>' + esc(tt('co_dir.gaps_none', 'Nothing missing')) + '</span>' })
    ].join('');

    const SCOLS = [['name', tt('co_dir.c_member', 'Member'), 'l'], ['role', tt('co_dir.c_role', 'Role'), 'l'], ['acts', tt('co_dir.c_actions', 'Actions'), 'n'], ['last', tt('co_dir.c_last', 'Last seen'), 'l']];
    const sthead = SCOLS.map(c => '<th class="' + (c[2] === 'n' ? 'num' : '') + ' cod-sortable" data-staff="' + c[0] + '" aria-sort="' + (ssort.k === c[0] ? (ssort.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' +
      '<button type="button">' + esc(c[1]) + '<i class="ti ' + (ssort.k === c[0] ? (ssort.dir > 0 ? 'ti-caret-up-filled' : 'ti-caret-down-filled') : 'ti-minus-vertical') + '"></i></button></th>').join('') +
      '<th class="cod-trendh">' + esc(tt('co_dir.c_trend', 'Trend')) + '</th>';
    const stbody = rows.length ? rows.map(r => {
      const rel = relAge(r.last);
      return '<tr><th scope="row"><div class="cod-pname"><span class="cod-av">' + esc(initials(r.name)) + '</span>' +
        '<div class="cod-pnb"><span class="cod-pn">' + esc(r.name) + '</span>' + (r.top ? '<span class="cod-psub">' + esc(tt('co_dir.mostly', 'mostly') + ' ' + actionLabel(r.top)) + '</span>' : '') + '</div></div></th>' +
        '<td class="cod-dim">' + esc(r.role || '—') + (r.job ? '<small class="cod-job">' + esc(r.job) + '</small>' : '') + '</td>' +
        '<td class="num cod-mono">' + (r.acts ? esc(nf(r.acts)) : '<span class="cod-zero">0</span>') + '</td>' +
        '<td><span class="co-chip ' + rel.cls + '">' + esc(rel.txt) + '</span></td>' +
        '<td class="cod-trend">' + (r.acts ? sparkline(r.series, { color: 'var(--cm-accent)', h: 22, zeroBase: true }) : '<span class="cod-dim">—</span>') + '</td></tr>';
    }).join('') : '';

    root.innerHTML =
      '<div class="cod-kpis cod-kpis-3">' + kpis + '</div>' +
      '<div class="co-panel cod-panel"><div class="co-phead"><h2>' + esc(tt('co_dir.gaps_title', 'What is missing')) + '</h2><div class="co-grow"></div><span class="cod-meta">' + esc(shortDate(from) + ' – ' + shortDate(to)) + '</span></div>' +
        (gaps.length
          ? '<div class="co-alist">' + gaps.slice(0, 12).map(g => '<div class="co-alert ' + g.k + '"><div class="ai"><i class="ti ' + g.i + '"></i></div><div class="ab"><div class="at">' + esc(g.t) + '</div><div class="ad">' + esc(g.d) + '</div></div></div>').join('') + '</div>'
          : emptyBlock(tt('co_dir.gaps_none_long', 'Every team has availability, sessions and RPE up to date for this period.'), 'ti-mood-check')) +
      '</div>' +
      '<div class="co-panel cod-panel"><div class="co-phead"><h2>' + esc(tt('co_dir.staff_title', 'Who is using the system')) + '</h2><div class="co-grow"></div><span class="cod-meta">' + esc(nf(acts.length) + ' ' + tt('co_dir.actions_low', 'actions')) + '</span></div>' +
        (stbody
          ? '<div class="cod-tablewrap"><table class="cod-table" id="coStaffTable"><thead><tr>' + sthead + '</tr></thead><tbody>' + stbody + '</tbody></table></div>'
          : emptyBlock(tt('co_dir.staff_empty', 'No staff members found for this club.'), 'ti-users-off')) +
        '<div class="cod-foot">' + method(tt('co_dir.m_staff', 'Counted from the activity log, keeping only actions with a signed-in author. Player submissions (RPE, wellness, GPS imports) are recorded without one and are deliberately left out, so this reflects staff work and not squad traffic.')) + '</div>' +
      '</div>';

    const stbl = document.getElementById('coStaffTable');
    if (stbl) stbl.addEventListener('click', e => {
      const th = e.target.closest('th[data-staff]'); if (!th) return;
      const k = th.dataset.staff;
      S.sort.staff = { k: k, dir: S.sort.staff.k === k ? -S.sort.staff.dir : (k === 'name' ? 1 : -1) };
      renderStaff(root);
    });
  }

  // ── piezas compartidas de layout ──
  function panel(title, body, sub, extra) {
    return '<div class="co-panel cod-panel"><div class="co-phead"><h2>' + esc(title) + '</h2>' +
      (sub ? '<div class="co-grow"></div><span class="cod-meta">' + esc(sub) + '</span>' : '') + '</div>' +
      '<div class="cod-pbody">' + body + (extra || '') + '</div></div>';
  }
  function loadingBlock() {
    return '<div class="cod-loading" role="status" aria-live="polite"><i class="ti ti-loader-2"></i><span>' + esc(tt('common.loading', 'Loading…')) + '</span></div>';
  }

  // ── router de pestañas ──
  const TABS = {
    season: { root: 'coTabSeason', render: renderSeason },
    injuries: { root: 'coTabInjuries', render: renderInjuries },
    squad: { root: 'coTabSquad', render: renderSquad },
    staff: { root: 'coTabStaff', render: renderStaff }
  };

  async function show(tab) {
    S.tab = tab;
    const def = TABS[tab]; if (!def) return;
    const root = document.getElementById(def.root); if (!root) return;
    await loadSeasonStart();
    renderPeriodBar();
    try { await def.render(root); }
    catch (err) {
      // Un error de cómputo no puede dejar la pestaña en "Cargando…" para siempre.
      try { console.error('[club-overview-director]', tab, err); } catch (_) {}
      root.innerHTML = panel(tt('co_dir.views', 'Views'), emptyBlock(tt('co_dir.render_error', 'This view could not be built. Reload the page and, if it persists, tell support which tab failed.'), 'ti-alert-triangle'));
    }
  }

  function renderPeriodBar() {
    const bar = document.getElementById('coPeriodBar'); if (!bar) return;
    bar.innerHTML = PERIODS.map(p => {
      const lbl = p[0] === 'season' && S.seasonLabel ? S.seasonLabel : tt(p[1], p[2]);
      return '<button type="button" data-period="' + p[0] + '" class="' + (S.period === p[0] ? 'on' : '') + '" aria-pressed="' + (S.period === p[0] ? 'true' : 'false') + '">' + esc(lbl) + '</button>';
    }).join('');
  }

  function setPeriod(p) {
    if (S.period === p) return;
    S.period = p;
    try { localStorage.setItem('co_dir_period', p); } catch (_) {}
    renderPeriodBar();
    if (S.tab) show(S.tab);
  }

  // ── API que consume club-overview.js ──
  window.cmCoDirector = {
    init(ctx) {
      S.clubId = ctx.clubId; S.teams = ctx.teams || []; S.scopeTeam = ctx.scopeTeam || ''; S.profile = ctx.profile || null;
      try { const p = localStorage.getItem('co_dir_period'); if (p && PERIODS.some(x => x[0] === p)) S.period = p; } catch (_) {}
      const bar = document.getElementById('coPeriodBar');
      if (bar && !bar.__wired) {
        bar.__wired = true;
        bar.addEventListener('click', e => { const b = e.target.closest('button[data-period]'); if (b) setPeriod(b.dataset.period); });
      }
    },
    show,
    // El selector de equipo del topbar es compartido con la pestaña Semana: cambiar de
    // equipo invalida el caché (la clave lo incluye) y repinta lo que esté abierto.
    setScope(teamId) {
      if (S.scopeTeam === (teamId || '')) return;
      S.scopeTeam = teamId || '';
      S.seasonStart = null;   // la temporada vigente depende de los equipos del scope
      if (S.tab) show(S.tab);
    },
    setTeams(teams) { S.teams = teams || []; },
    relang() { renderPeriodBar(); if (S.tab) show(S.tab); },
    // Sólo para tests: deja inspeccionar la normalización sin abrir la página.
    _normArea: normArea, _lineOf: lineOf
  };
})();
