// ══════════════════════════════════════════════════════════════
// GPS Import Pipeline — extraído de GPS Analysis.html (sin cambios de comportamiento).
// Se carga como <script src> PLANO en la misma posición del documento → mismo timing
// de ejecución que cuando era inline. IIFE autocontenido: no expone nada en window;
// consume globals (tt/showToast/sb/CMGpsMatch/gpParseDuration…) en runtime (event-driven).
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// GPS Import Pipeline — Bloques 1–4
// Upload CSV/XLSX → column mapping → player matching → INSERT
// SheetJS loaded lazily when drawer opens
// ══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // i18n con fallback: usa el tt() global (mismo que el resto de la app) si está; si no, el texto EN.
  const _wt = (k, f) => { try { return (typeof tt === 'function') ? tt(k, f) : (window.tt ? window.tt(k, f) : f); } catch (e) { return f; } };

  // ── Constants — built from gps-aliases.js ──────────────────
  const _aliasDb = window.GPS_BUILTIN_ALIASES || [];
  const TARGET_METRICS = _aliasDb.map(e => e.metric_key);
  // metric_key → array of aliases (for legacy callers)
  const METRIC_ALIASES = Object.fromEntries(_aliasDb.map(e => [e.metric_key, e.aliases]));
  // Human-readable labels for the dropdown
  const METRIC_LABEL = {
    player_name: 'Player name', player_first_name: 'First name',
    player_last_name: 'Last name', jersey_number: 'Jersey #',
    position: 'Position', player_external_gps_id: 'External GPS ID',
    session_date: 'Session date', session_type: 'Session type',
    total_distance: 'Total distance', high_speed_distance: 'HSR distance',
    very_high_speed_distance: 'VHSR distance', sprint_distance: 'Sprint distance',
    hmld: 'HMLD', distance_per_minute: 'Distance / min',
    max_speed: 'Max speed', avg_speed: 'Avg speed',
    accelerations: 'Accelerations', decelerations: 'Decelerations',
    sprint_count: 'Sprint count', player_load: 'Player load',
    time_played: 'Time played',
  };

  // Unit auto-detection for distance metrics — if header contains 'km', conversion = 1000
  const DISTANCE_METRICS = new Set([
    'total_distance','high_speed_distance','very_high_speed_distance',
    'sprint_distance','hmld',
  ]);

  // ── State ──────────────────────────────────────────────────
  let _wizState = {};

  // ── Load SheetJS lazily ────────────────────────────────────
  let _xlsxLoading = false;
  let _xlsxReady   = false;

  function loadXLSX() {
    return new Promise((res, rej) => {
      if (_xlsxReady) { res(); return; }
      if (_xlsxLoading) { const t = setInterval(() => { if (_xlsxReady) { clearInterval(t); res(); } }, 50); return; }
      _xlsxLoading = true;
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = () => { _xlsxReady = true; res(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // ── Fuzzy string similarity (normalised Levenshtein) ───────
  // String helpers delegate to the shared matcher core (assets/gps-matcher.js)
  // so CSV and Catapult mapping score names identically. Behavior unchanged.
  function _norm(s)    { return window.CMGpsMatch.normName(s); }
  function _sim(a, b)  { return window.CMGpsMatch.sim(a, b); }

  // ── Category hint — infer expected category from column name ─
  function _categoryHint(nc) {
    if (/\b(duration|time|minutes?|mins?)\b/.test(nc))           return 'time';
    if (/\b(distance|dist)\b|\(m\)|\(km\)/.test(nc))            return 'distance';
    if (/\b(speed|velocity|vel|km\/h)\b/.test(nc))              return 'speed';
    if (/\b(acc?el|decel)\b/.test(nc))                          return ['acceleration', 'count'];
    if (/\b(count|efforts?|n sprints?|num )\b/.test(nc))        return 'count';
    if (/\bload\b/.test(nc))                                    return 'load';
    if (/\b(position|jersey|shirt|dorsal|pos\b)\b/.test(nc) ||
        /\b(player|athlete|nombre|jugador|first name|last name|surname)\b/.test(nc))
      return 'player_field';
    return null; // no hint → allow all
  }

  function _catOk(hint, cat) {
    if (!hint) return true;
    return Array.isArray(hint) ? hint.includes(cat) : hint === cat;
  }

  // ── Column auto-match ──────────────────────────────────────
  // Order: 1. saved mapping  2. catalog label  3. built-in aliases
  function autoMatchColumn(colName, existingMappings) {
    const nc = _norm(colName);
    // 1. Saved mapping (memory of prior imports for this provider)
    const saved = existingMappings.find(m => _norm(m.source_column_name) === nc);
    if (saved) {
      if (saved.target_metric && saved.target_metric.startsWith('__attr__')) {
        return { metric: null, attribute: saved.target_metric.slice(8), confidence: 'saved', score: 1, conversion: saved.unit_conversion || 1 };
      }
      return { metric: saved.target_metric, confidence: 'saved', score: 1, conversion: saved.unit_conversion || 1 };
    }

    const normFn  = window.normalizeAlias || _norm;
    const catHint = _categoryHint(nc);
    const THRESHOLD = catHint ? 0.75 : 0.85;

    // 2. Catalog label matching (catches custom metrics and renamed core labels)
    const catalog = _wizState.metricCatalog || [];
    for (const def of catalog) {
      if (_norm(def.label) === nc) {
        return { metric: def.key, confidence: 'high', score: 1, conversion: detectConversion(colName, def.key) };
      }
    }

    // 3. Built-in alias exact match (player fields first via array order)
    for (const entry of _aliasDb) {
      if (!_catOk(catHint, entry.category)) continue;
      for (const alias of entry.aliases) {
        if (normFn(alias) === nc) {
          return { metric: entry.metric_key, confidence: 'high', score: 1, conversion: detectConversion(colName, entry.metric_key) };
        }
      }
    }

    // 4. Fuzzy — pick best between catalog labels and built-in aliases
    let bestCatalogKey = null, bestCatalogScore = 0;
    for (const def of catalog) {
      const s = _sim(nc, _norm(def.label));
      if (s > bestCatalogScore) { bestCatalogScore = s; bestCatalogKey = def.key; }
    }
    let bestAliasKey = null, bestAliasScore = 0;
    for (const entry of _aliasDb) {
      if (!_catOk(catHint, entry.category)) continue;
      for (const alias of entry.aliases) {
        const s = _sim(nc, normFn(alias));
        if (s > bestAliasScore) { bestAliasScore = s; bestAliasKey = entry.metric_key; }
      }
    }
    if (bestCatalogScore >= THRESHOLD && bestCatalogScore >= bestAliasScore) {
      return { metric: bestCatalogKey, confidence: 'medium', score: bestCatalogScore, conversion: detectConversion(colName, bestCatalogKey) };
    }
    if (bestAliasScore >= THRESHOLD) {
      return { metric: bestAliasKey, confidence: 'medium', score: bestAliasScore, conversion: detectConversion(colName, bestAliasKey) };
    }
    return { metric: null, confidence: 'none', score: Math.max(bestCatalogScore, bestAliasScore), conversion: 1 };
  }

  function detectConversion(colName, metric) {
    // Fixed per metric, NOT guessed from the header: the source CSV has
    // total_distance in km, every other distance in meters. The DB stores all in
    // meters → total_distance × 1000, the rest × 1.
    if (metric === 'total_distance') return 1000;
    return 1;
  }

  // ── Parse file with SheetJS ────────────────────────────────
  async function parseFile(file) {
    await loadXLSX();
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const wb   = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          res(rows);
        } catch (e) { rej(e); }
      };
      reader.onerror = rej;
      reader.readAsArrayBuffer(file);
    });
  }

  // ── Auto-detect session type from filename ─────────────────
  function detectSessionType(filename) {
    const n = filename.toLowerCase();
    if (/match|partido|game|vs|md\d/i.test(n)) return 'match';
    if (/train|entreno|entren|session/i.test(n)) return 'training';
    return 'auto';
  }

  // ── Open import wizard ─────────────────────────────────────
  async function openImportWizard(file) {
    showToast('Parsing file…');
    let rows;
    try { rows = await parseFile(file); }
    catch (e) { showToast('Error parsing file: ' + e.message); return; }

    if (!rows || rows.length < 2) { showToast('File is empty or has no data rows'); return; }

    const sessionTypeGuess = detectSessionType(file.name);
    const clubId = window._gpClubId || (await window.getClubId());

    // Load existing mappings from DB
    let existingMappings = [];
    if (clubId) {
      const { data } = await window.sb.from('gps_column_mappings')
        .select('source_column_name,target_metric,unit_conversion,source_label,parse_format,column_type,excluded')
        .eq('club_id', clubId);
      existingMappings = data || [];
    }

    // Load metric catalog (core + custom definitions for this club)
    let metricCatalog = [];
    if (clubId) {
      const { data } = await window.sb.from('gps_metric_definitions')
        .select('key,label,unit,category,decimals,is_core,display_order')
        .eq('club_id', clubId)
        .order('display_order', { ascending: true });
      metricCatalog = data || [];
    }

    _wizState = {
      file, rows, clubId, existingMappings, metricCatalog,
      headerRow: 0,          // 0-based index
      sessionType: sessionTypeGuess,
      matchDate: '',
      sourceLabel: guessSourceLabel(file.name),
      columnMap: {},          // colIndex → { metric, conversion, parseFormat }
      playerMap: {},          // rawName → player_id
      squadPlayers: [],
      colTypes: [],           // colIndex → { type, format, invalidCount, … } from gps-parsers
      colTypesHeader: -1,     // headerRow value when colTypes was last computed
    };

    // Load squad
    if (clubId) {
      const { data } = await window.sb.from('players')
        .select('id,first_name,last_name,number,position,external_gps_id')
        .eq('club_id', clubId).neq('status', 'inactive').is('archived_at', null);
      _wizState.squadPlayers = data || [];
    }

    buildWizard();
  }

  function guessSourceLabel(filename) {
    const n = filename.toLowerCase();
    if (/statsports|sonra/i.test(n))  return 'StatSports';
    if (/catapult|openfield/i.test(n)) return 'Catapult Vector';
    if (/polar/i.test(n))              return 'Polar Team Pro';
    if (/wimu/i.test(n))               return 'WIMU PRO';
    return 'Custom export';
  }

  // ── Build wizard modal ─────────────────────────────────────
  function buildWizard() {
    document.getElementById('gpImportModal')?.remove();

    const ov = document.createElement('div');
    ov.className = 'gp-modal-overlay';
    ov.id = 'gpImportModal';

    const modal = document.createElement('div');
    modal.className = 'gp-modal wide';
    modal.style.maxHeight = '85vh';

    modal.innerHTML = `
      <div class="gp-modal-h">
        <h3>Import GPS data</h3>
        <button class="gp-modal-x" id="wizClose"><i class="ti ti-x"></i></button>
      </div>
      <div class="gp-wiz-steps">
        <div class="gp-wiz-step is-on" data-step="1">1 · Preview</div>
        <div class="gp-wiz-step" data-step="2">2 · Map columns</div>
        <div class="gp-wiz-step" data-step="3">3 · Match players</div>
        <div class="gp-wiz-step" data-step="4">4 · Session</div>
        <div class="gp-wiz-step" data-step="5">5 · Import</div>
      </div>
      <div class="gp-modal-body" id="wizBody" style="overflow-y:auto;max-height:calc(85vh - 160px)"></div>
      <div class="gp-wiz-footer" id="wizFooter"></div>`;

    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    modal.querySelector('#wizClose').addEventListener('click', () => ov.remove());

    ov.appendChild(modal);
    document.body.appendChild(ov);
    renderWizStep(1);
  }

  function setWizStep(n) {
    document.querySelectorAll('.gp-wiz-step').forEach(el => {
      const s = +el.dataset.step;
      el.classList.toggle('is-on', s === n);
      el.classList.toggle('is-done', s < n);
    });
    renderWizStep(n);
  }

  // ── Step 1 — Preview ───────────────────────────────────────
  function renderWizStep(n) {
    const body   = document.getElementById('wizBody');
    const footer = document.getElementById('wizFooter');
    if (!body || !footer) return;

    if (n === 1) renderStep1(body, footer);
    else if (n === 2) renderStep2(body, footer);
    else if (n === 3) renderStep3(body, footer);
    else if (n === 4) renderStep4Session(body, footer);
    else if (n === 5) renderStep5Import(body);
  }

  function renderStep1(body, footer) {
    const { file, rows, headerRow, sessionType, sourceLabel } = _wizState;
    const hRow  = rows[headerRow] || [];
    const nCols = hRow.length;
    const nRows = rows.length - headerRow - 1;

    body.innerHTML = `
      <div class="gp-imp-info">
        <div class="gp-imp-info-cell"><div class="l">File</div><div class="v" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${file.name}">${file.name}</div></div>
        <div class="gp-imp-info-cell"><div class="l">Size</div><div class="v">${(file.size/1024).toFixed(0)} KB</div></div>
        <div class="gp-imp-info-cell"><div class="l">Rows</div><div class="v" id="nRows">${nRows}</div></div>
        <div class="gp-imp-info-cell"><div class="l">Columns</div><div class="v">${nCols}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <label style="font:600 11px/1 var(--cm-font-sans);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);display:block;margin-bottom:5px">Header row</label>
          <input type="number" id="wizHeaderRow" min="1" max="${rows.length}" value="${headerRow+1}"
            style="width:100%;padding:6px 10px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1 var(--cm-font-sans)">
        </div>
        <div>
          <label style="font:600 11px/1 var(--cm-font-sans);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);display:block;margin-bottom:5px">Session type</label>
          <select id="wizSessionType" style="width:100%;padding:6px 10px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1 var(--cm-font-sans)">
            <option value="auto" ${sessionType==='auto'?'selected':''}>Auto-detect from filename</option>
            <option value="match" ${sessionType==='match'?'selected':''}>Match (official)</option>
            <option value="training" ${(sessionType==='training'||sessionType==='conditioning')?'selected':''}>Training session</option>
          </select>
        </div>
      </div>
      <div id="wizMatchDateRow" style="display:${sessionType==='match'?'block':'none'};margin-bottom:14px">
        <label style="font:600 11px/1 var(--cm-font-sans);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);display:block;margin-bottom:5px">Match date (YYYY-MM-DD)</label>
        <input type="date" id="wizMatchDate" value="${_wizState.matchDate}"
          style="padding:6px 10px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1 var(--cm-font-sans)">
      </div>
      <div style="margin-bottom:14px">
        <label style="font:600 11px/1 var(--cm-font-sans);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);display:block;margin-bottom:5px">Provider / source label</label>
        <input type="text" id="wizSourceLabel" value="${sourceLabel}"
          placeholder="e.g. Catapult Vector, StatSports CSV…"
          style="width:100%;padding:6px 10px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1 var(--cm-font-sans);box-sizing:border-box">
      </div>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button id="wizExclAll" class="cm-btn is-outline is-sm" style="font:500 10.5px/1.4 var(--cm-font-sans)">Exclude all</button>
        <button id="wizInclAll" class="cm-btn is-outline is-sm" style="font:500 10.5px/1.4 var(--cm-font-sans)">Include all</button>
      </div>
      <div class="gp-imp-preview" id="wizPreviewTable"></div>`;

    renderPreviewTable(rows, headerRow);

    body.querySelector('#wizHeaderRow').addEventListener('input', e => {
      const v = Math.max(1, Math.min(+e.target.value, rows.length));
      _wizState.headerRow = v - 1;
      document.getElementById('nRows').textContent = rows.length - v;
      renderPreviewTable(rows, _wizState.headerRow);
    });
    body.querySelector('#wizSessionType').addEventListener('change', e => {
      _wizState.sessionType = e.target.value;
      document.getElementById('wizMatchDateRow').style.display =
        e.target.value === 'match' ? 'block' : 'none';
    });
    body.querySelector('#wizMatchDate')?.addEventListener('change', e => { _wizState.matchDate = e.target.value; });
    body.querySelector('#wizSourceLabel').addEventListener('input', e => { _wizState.sourceLabel = e.target.value; });
    body.querySelector('#wizExclAll').addEventListener('click', () => {
      const hdr = _wizState.rows[_wizState.headerRow] || [];
      (_wizState.colTypes || []).forEach((ct, i) => { if (ct && hdr[i]) ct.excluded = true; });
      renderPreviewTable(_wizState.rows, _wizState.headerRow);
    });
    body.querySelector('#wizInclAll').addEventListener('click', () => {
      (_wizState.colTypes || []).forEach(ct => { if (ct) ct.excluded = false; });
      renderPreviewTable(_wizState.rows, _wizState.headerRow);
    });

    footer.innerHTML = `
      <span style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">Step 1 of 5 &middot; <span id="wizColCounter"></span></span>
      <div class="right">
        <button class="cm-btn is-outline is-sm" onclick="document.getElementById('gpImportModal')?.remove()">Cancel</button>
        <button class="cm-btn is-primary is-sm" id="wizNext1">Next: Map columns</button>
      </div>`;
    footer.querySelector('#wizNext1').addEventListener('click', () => {
      _wizState.sessionType  = body.querySelector('#wizSessionType').value;
      _wizState.matchDate    = body.querySelector('#wizMatchDate')?.value || '';
      _wizState.sourceLabel  = body.querySelector('#wizSourceLabel').value.trim() || 'Custom export';
      buildColumnMap();
      setWizStep(2);
    });
  }

  function renderPreviewTable(rows, headerRow) {
    const wrap = document.getElementById('wizPreviewTable');
    if (!wrap) return;

    const hdr  = rows[headerRow] || [];
    const data = rows.slice(headerRow + 1, headerRow + 11);

    // Re-analyze only when header row changes; preserve user-set format overrides
    if (typeof gpAnalyzeCols === 'function' && _wizState.colTypesHeader !== headerRow) {
      _wizState.colTypes      = gpAnalyzeCols(rows, headerRow);
      _wizState.colTypesHeader = headerRow;
      // Record auto-detected type so "Auto" option can show it in the label
      _wizState.colTypes.forEach(ct => { if (ct) ct.autoType = ct.type; });

      // Apply saved parse_format / column_type from previous imports for this provider
      const labelMappings = (_wizState.existingMappings || [])
        .filter(m => m.source_label === _wizState.sourceLabel);
      hdr.forEach((col, i) => {
        if (!col || !_wizState.colTypes[i]) return;
        const saved = labelMappings.find(m => _norm(m.source_column_name) === _norm(col));
        if (saved?.parse_format)  _wizState.colTypes[i].format     = saved.parse_format;
        if (saved?.column_type) {
          _wizState.colTypes[i].manualType = saved.column_type;
          _wizState.colTypes[i].type       = saved.column_type;
        }
        if (saved?.excluded) _wizState.colTypes[i].excluded = true;
      });
    }

    const DATE_FMTS = window.GPS_PARSE_DATE_FORMATS     || {};
    const DUR_FMTS  = window.GPS_PARSE_DURATION_FORMATS  || {};

    const DATE_OPTIONS = [
      { v: DATE_FMTS.AUTO,         l: 'Auto-detect'  },
      { v: DATE_FMTS.DMY,          l: 'DD/MM/YYYY'   },
      { v: DATE_FMTS.MDY,          l: 'MM/DD/YYYY'   },
      { v: DATE_FMTS.YMD,          l: 'YYYY-MM-DD'   },
      { v: DATE_FMTS.EXCEL_SERIAL, l: 'Excel serial' },
    ];
    const DUR_OPTIONS = [
      { v: DUR_FMTS.AUTO,       l: 'Auto-detect'        },
      { v: DUR_FMTS.HHMMSS,     l: 'HH:MM:SS'           },
      { v: DUR_FMTS.HHMM,       l: 'HH:MM'              },
      { v: DUR_FMTS.MMSS,       l: 'MM:SS'              },
      { v: DUR_FMTS.MINUTES,    l: 'Minutes'            },
      { v: DUR_FMTS.EXCEL_TIME, l: 'Excel time'         },
    ];

    const SEL_STYLE = 'margin-top:3px;width:100%;padding:2px 5px;border:1px solid var(--cm-border-soft);border-radius:3px;background:var(--cm-bg-soft);color:var(--cm-fg);font:500 9.5px/1.4 var(--cm-font-mono)';

    function makeHeaderCell(ci, label) {
      const ct         = (_wizState.colTypes || [])[ci] || { type: 'text', format: null };
      const excluded   = ct.excluded || false;
      const type       = ct.type;
      const fmt        = ct.format;
      const invalid    = ct.invalidCount || 0;
      const manualType = ct.manualType || '';
      const autoLabel  = ct.autoType ? `Auto · ${ct.autoType}` : 'Auto';

      const EXCL_BTN = `<button class="gp-col-excl" data-ci="${ci}"
        title="${excluded ? 'Click to include' : 'Exclude column'}"
        style="flex-shrink:0;display:inline-flex;align-items:center;background:none;border:none;padding:1px 3px;cursor:pointer;font-size:13px;line-height:1;border-radius:3px;color:${excluded ? 'var(--cm-fg-muted)' : 'var(--cm-fg-faint)'}">
        <i class="ti ${excluded ? 'ti-eye' : 'ti-eye-off'}"></i>
      </button>`;

      const labelRow = `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:4px">
        <div style="font:600 11.5px/1.2 var(--cm-font-sans);color:${excluded ? 'var(--cm-fg-muted)' : 'var(--cm-fg-strong)'}">${label}</div>
        ${EXCL_BTN}
      </div>`;

      if (excluded) {
        return `<th style="min-width:100px;max-width:180px;vertical-align:top;padding:6px 8px;font-weight:normal;opacity:0.45;background:var(--cm-bg-soft)">
          ${labelRow}
          <span style="display:inline-block;margin-top:3px;padding:1px 5px;background:var(--cm-bg-soft);border:1px solid var(--cm-border);border-radius:3px;font:600 9.5px/1.4 var(--cm-font-mono);color:var(--cm-fg-muted)">excluded</span>
        </th>`;
      }

      const TYPE_OPTIONS = [
        { v: '',         l: autoLabel   },
        { v: 'date',     l: 'Date'      },
        { v: 'duration', l: 'Duration'  },
        { v: 'number',   l: 'Number'    },
        { v: 'text',     l: 'Text'      },
        { v: 'ignore',   l: 'Ignore'    },
      ];
      const typeOpts = TYPE_OPTIONS.map(o =>
        `<option value="${o.v}"${o.v === manualType ? ' selected' : ''}>${o.l}</option>`).join('');
      const typeSel = `<select class="gp-col-type-sel" data-ci="${ci}" style="${SEL_STYLE}">${typeOpts}</select>`;

      let badge = '', hint = '', dropdown = '', ambigNote = '';

      if (type === 'date') {
        hint = `<div style="font:600 9px/1 var(--cm-font-mono);color:var(--cm-accent);text-transform:uppercase;letter-spacing:.04em;margin-top:3px">date</div>`;
        const opts = DATE_OPTIONS.map(o =>
          `<option value="${o.v}"${o.v === fmt ? ' selected' : ''}>${o.l}</option>`).join('');
        dropdown = `<select class="gp-col-fmt-sel" data-ci="${ci}" style="${SEL_STYLE}">${opts}</select>`;
        if (ct.ambiguousDateFormat) {
          ambigNote = `<div style="font:500 9px/1.3 var(--cm-font-mono);color:var(--cm-warning);margin-top:2px">ambiguous · using DD/MM</div>`;
        }
      } else if (type === 'duration') {
        hint = `<div style="font:600 9px/1 var(--cm-font-mono);color:var(--cm-success);text-transform:uppercase;letter-spacing:.04em;margin-top:3px">duration</div>`;
        const opts = DUR_OPTIONS.map(o =>
          `<option value="${o.v}"${o.v === fmt ? ' selected' : ''}>${o.l}</option>`).join('');
        dropdown = `<select class="gp-col-fmt-sel" data-ci="${ci}" style="${SEL_STYLE}">${opts}</select>`;
      }

      if (invalid > 0) {
        badge = `<span class="gp-col-inv" data-ci="${ci}"
          style="display:inline-block;margin-top:3px;padding:1px 5px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:3px;font:600 9.5px/1.4 var(--cm-font-mono);color:var(--cm-danger);cursor:pointer;white-space:nowrap"
          title="Click to view unparseable values">${invalid} invalid</span>`;
      }

      return `<th style="min-width:100px;max-width:180px;vertical-align:top;padding:6px 8px;font-weight:normal">
        ${labelRow}
        ${typeSel}
        ${hint}${ambigNote}${dropdown}${badge}
      </th>`;
    }

    function renderCell(ci, value) {
      const ct = (_wizState.colTypes || [])[ci] || { type: 'text', format: null };
      if (ct.excluded) {
        return `<td style="opacity:0.45;background:var(--cm-bg-soft);color:var(--cm-fg-muted)">${String(value ?? '')}</td>`;
      }
      const disp = (typeof gpFmtDisplay === 'function')
        ? gpFmtDisplay(ct.type, value, ct.format)
        : String(value ?? '');
      let invalid = false;
      if (value !== '' && value != null) {
        if (ct.type === 'date')     invalid = window.gpParseDate?.(value, ct.format)?.invalid ?? false;
        if (ct.type === 'duration') invalid = window.gpParseDuration?.(value, ct.format)?.invalid ?? false;
      }
      return `<td${invalid ? ' style="color:var(--cm-danger)"' : ''}>${disp}</td>`;
    }

    wrap.innerHTML = `<table>
      <thead><tr>${hdr.map((h, i) => makeHeaderCell(i, h)).join('')}</tr></thead>
      <tbody>${data.map(r => `<tr>${hdr.map((_, i) => renderCell(i, r[i] ?? '')).join('')}</tr>`).join('')}</tbody>
    </table>`;

    // Format dropdown: update colType.format and re-render (preserving other overrides)
    wrap.querySelectorAll('.gp-col-fmt-sel').forEach(sel => {
      sel.addEventListener('change', e => {
        const ci = +e.target.dataset.ci;
        if (!_wizState.colTypes[ci]) return;
        _wizState.colTypes[ci].format = e.target.value;

        // Recount invalids across preview rows with the new format
        const ct      = _wizState.colTypes[ci];
        const samples = rows.slice(headerRow + 1, headerRow + 21)
          .map(r => r[ci]).filter(v => v !== null && v !== undefined && v !== '');
        let inv = 0;
        for (const v of samples) {
          if (ct.type === 'date'     && window.gpParseDate?.(v, ct.format)?.invalid)     inv++;
          if (ct.type === 'duration' && window.gpParseDuration?.(v, ct.format)?.invalid) inv++;
        }
        ct.invalidCount = inv;
        // Keep colTypesHeader so analyzeColumns is NOT re-run on re-render
        renderPreviewTable(rows, headerRow);
      });
    });

    // Type override selector: change detected type per column
    wrap.querySelectorAll('.gp-col-type-sel').forEach(sel => {
      sel.addEventListener('change', e => {
        const ci     = +e.target.dataset.ci;
        const chosen = e.target.value;
        if (!_wizState.colTypes[ci]) _wizState.colTypes[ci] = { type: 'text', autoType: 'text', format: null };
        const ct        = _wizState.colTypes[ci];
        ct.manualType   = chosen || null;
        ct.type         = chosen || ct.autoType || 'text';
        ct.format       = null; // reset format when type changes
        const samples   = rows.slice(headerRow + 1, headerRow + 21)
          .map(r => r[ci]).filter(v => v !== null && v !== undefined && v !== '');
        let inv = 0;
        for (const v of samples) {
          if (ct.type === 'date'     && window.gpParseDate?.(v, null)?.invalid)     inv++;
          if (ct.type === 'duration' && window.gpParseDuration?.(v, null)?.invalid) inv++;
        }
        ct.invalidCount = inv;
        renderPreviewTable(rows, headerRow);
      });
    });

    // Exclude toggle button
    wrap.querySelectorAll('.gp-col-excl').forEach(btn => {
      btn.addEventListener('click', () => {
        const ci = +btn.dataset.ci;
        if (!_wizState.colTypes[ci]) _wizState.colTypes[ci] = { type: 'text', format: null };
        _wizState.colTypes[ci].excluded = !_wizState.colTypes[ci].excluded;
        renderPreviewTable(rows, headerRow);
      });
    });

    // Update column counter in step-1 footer
    const _totalCols = hdr.filter(h => h).length;
    const _exclCols  = (_wizState.colTypes || []).reduce((n, ct, i) => n + ((ct?.excluded && hdr[i]) ? 1 : 0), 0);
    const _counter   = document.getElementById('wizColCounter');
    if (_counter) _counter.textContent = `${_totalCols - _exclCols} of ${_totalCols} columns`;

    // Invalid badge: show modal listing unparseable rows
    wrap.querySelectorAll('.gp-col-inv').forEach(badge => {
      badge.addEventListener('click', () => {
        const ci       = +badge.dataset.ci;
        const ct       = (_wizState.colTypes || [])[ci] || { type: 'text', format: null };
        const allData  = rows.slice(headerRow + 1).filter(r => r.some(c => c !== ''));
        const badRows  = [];
        allData.forEach((row, ri) => {
          const v = row[ci];
          if (v === '' || v == null) return;
          const bad = ct.type === 'date'     ? window.gpParseDate?.(v, ct.format)?.invalid
                    : ct.type === 'duration' ? window.gpParseDuration?.(v, ct.format)?.invalid
                    : false;
          if (bad) badRows.push({ row: ri + 1, value: String(v) });
        });
        const listHtml = badRows.slice(0, 20).map(b =>
          `<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--cm-border-soft)">
            <span style="font:500 10.5px/1.3 var(--cm-font-mono);color:var(--cm-fg-muted);min-width:44px;flex-shrink:0">Row ${b.row}</span>
            <span style="font:400 10.5px/1.3 var(--cm-font-mono);color:var(--cm-danger);word-break:break-all">${b.value}</span>
          </div>`
        ).join('') + (badRows.length > 20 ? `<div style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-faint);margin-top:6px">+${badRows.length - 20} more rows</div>` : '');
        makeModal(
          `${hdr[ci] || `Column ${ci}`} — ${badRows.length} unparseable value${badRows.length !== 1 ? 's' : ''}`,
          `<div style="font:400 12px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:10px">
            These values could not be parsed as <strong>${ct.type}</strong>. They will be skipped during import.
            Change the format dropdown above to fix parsing.
          </div>
          <div style="overflow-y:auto;max-height:260px">${listHtml}</div>`
        );
      });
    });
  }

  // ── Step 2 — Column mapping ────────────────────────────────
  function buildColumnMap() {
    const { rows, headerRow, existingMappings, sourceLabel, colTypes } = _wizState;
    const hdr = rows[headerRow] || [];
    const labelMappings = existingMappings.filter(m => m.source_label === sourceLabel);
    _wizState.columnMap = {};
    hdr.forEach((col, i) => {
      if (!col) return;
      const saved       = labelMappings.find(m => _norm(m.source_column_name) === _norm(col));
      const colType     = colTypes?.[i]?.manualType || null;
      const isExcluded  = !!(colTypes?.[i]?.excluded);
      // parse_format: prefer DB-saved value, then user override from preview, then auto
      const parseFormat = saved?.parse_format || colTypes?.[i]?.format || null;
      // Excluded or manually-ignored columns bypass auto-matching
      if (isExcluded || colType === 'ignore') {
        _wizState.columnMap[i] = {
          sourceCol: col, metric: null, confidence: 'manual', conversion: 1,
          parseFormat: null, colType, excluded: isExcluded,
        };
        return;
      }
      const match = autoMatchColumn(col, labelMappings);
      let conversion = match.conversion;
      // Auto-detect the SOURCE unit from the sample (suggestion only — the user
      // confirms via the unit selector). Never override a SAVED mapping. The km
      // heuristic only applies to total_distance (a session is thousands of m);
      // other distances (HSR/sprint…) are naturally small in metres, so default m.
      const _kind = window.GpsUnits && match.confidence !== 'saved' ? window.GpsUnits.kindOf(match.metric) : null;
      // El guard de 'saved' va TAMBIÉN acá: sin él este if pisaba la conversión que el
      // usuario ya había confirmado en un import anterior (es un if, corre siempre), y
      // total_distance quedaba como la única columna que el wizard re-adivinaba sola.
      if (match.confidence !== 'saved' && match.metric === 'total_distance') {
        conversion = window.GpsUnits.factorFor('distance', window.GpsUnits.suggestDistanceUnit(_wizColStat(i, 'median')));
      } else if (_kind === 'speed') {
        conversion = window.GpsUnits.factorFor('speed', window.GpsUnits.suggestSpeedUnit(_wizColStat(i, 'max')));
      } else if (_kind === 'distance') {
        conversion = 1;   // other distances → metres by default (selector can change)
      }
      _wizState.columnMap[i] = {
        sourceCol: col, metric: match.metric,
        attribute: match.attribute || null,
        confidence: match.confidence, score: match.score || 0,
        conversion,
        parseFormat, colType, excluded: false,
      };
    });
  }

  // Sample stat of a source column (parsed numbers): 'median' or 'max'. Used to
  // auto-suggest the source unit (km vs m, m/s vs km/h) in the mapping step.
  function _wizColStat(colIdx, kind) {
    const { rows, headerRow, decimalSep } = _wizState;
    const vals = [];
    for (const r of rows.slice(headerRow + 1)) {
      const raw = r[colIdx];
      if (raw === '' || raw == null) continue;
      const np = window.gpParseNumber
        ? window.gpParseNumber(raw, { decimal: decimalSep || 'dot' })
        : { value: +raw, invalid: !isFinite(+raw) };
      if (np && !np.invalid && np.value != null && isFinite(np.value)) vals.push(np.value);
      if (vals.length >= 300) break;
    }
    if (!vals.length) return null;
    if (kind === 'max') return Math.max(...vals);
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)];
  }

  // Conversion cell for the mapping table. Distance/speed columns get a friendly
  // SOURCE-unit selector (m/km/yd, km/h / m/s) that sets the conversion factor;
  // everything else keeps the raw advanced factor input.
  function _wizConvCell(i, c) {
    const U = window.GpsUnits;
    const kind = U ? U.kindOf(c.metric) : null;
    const css = 'padding:4px 6px;border:1px solid var(--cm-border);border-radius:5px;background:var(--cm-bg-soft);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-mono)';
    if (U && (kind === 'distance' || kind === 'speed')) {
      const units  = kind === 'distance' ? U.DISTANCE_UNITS : U.SPEED_UNITS;
      const labels = kind === 'distance' ? U.DISTANCE_UNIT_LABELS : U.SPEED_UNIT_LABELS;
      const canon  = kind === 'distance' ? 'meters' : 'kmh';
      const cur    = U.unitForFactor(kind, c.conversion);
      const opts   = Object.keys(units).map(u => `<option value="${u}"${u === cur ? ' selected' : ''}>${labels[u]}</option>`).join('');
      const hint   = cur !== canon
        ? `<div class="gp-unit-hint" style="font:500 10px/1.3 var(--cm-font-sans);color:var(--cm-warning);margin-top:3px">↳ looks like ${labels[cur]} — converting to ${kind === 'distance' ? 'metres' : 'km/h'}</div>`
        : '';
      return `<select class="gp-unit-sel" data-ci="${i}" data-kind="${kind}" title="Unit in the file → converted to canonical ${kind === 'distance' ? 'metres' : 'km/h'}" style="${css}">${opts}</select>${hint}`;
    }
    return `<input type="number" class="gp-conv-inp" data-ci="${i}" value="${c.conversion}" step="0.001" min="0.001" style="width:80px;${css}">`;
  }

  // slug helper for "Create new metric" key auto-generation
  function _toSlug(s) {
    const slug = (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/, '');
    return /^[a-z]/.test(slug) ? slug : ('m_' + slug) || 'metric';
  }

  // slug helper for session attribute keys — lowercase, accents removed, only [a-z0-9_]
  function _toAttrSlug(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/, '');
  }

  function _buildSelOptions(selectedVal) {
    const pfKeys      = window.GPS_PLAYER_FIELD_KEYS || new Set();
    const pfEntries   = _aliasDb.filter(e => pfKeys.has(e.metric_key));
    const specEntries = _aliasDb.filter(e => e.category === 'date');
    const catalog     = _wizState.metricCatalog || [];
    const coreMetrics = catalog.filter(d => d.is_core);
    const custMetrics = catalog.filter(d => !d.is_core);

    const opt = (key, label) =>
      `<option value="${key}"${key === selectedVal ? ' selected' : ''}>${label}</option>`;

    // Fallback to _aliasDb core entries when catalog hasn't been seeded yet
    const coreHtml = coreMetrics.length
      ? coreMetrics.map(d => opt(d.key, d.label + (d.unit ? ` (${d.unit})` : ''))).join('')
      : _aliasDb.filter(e => !pfKeys.has(e.metric_key) && e.category !== 'date')
          .map(e => opt(e.metric_key, METRIC_LABEL[e.metric_key] || e.metric_key)).join('');

    let attrHtml;
    if (selectedVal && selectedVal.startsWith('__attr__')) {
      const attrKey = selectedVal.slice(8);
      attrHtml = `<option value="${selectedVal}" selected>${attrKey}</option>
        <option value="__attr_custom__">+ Session attribute…</option>`;
    } else {
      attrHtml = `<option value="__attr_custom__"${'__attr_custom__' === selectedVal ? ' selected' : ''}>+ Session attribute…</option>`;
    }

    return `<option value="__ignore__"${'__ignore__' === selectedVal ? ' selected' : ''}>— Ignore this column —</option>
      <option value="__create__"${'__create__' === selectedVal ? ' selected' : ''}>+ Create new metric...</option>
      <option value="__attribute__"${'__attribute__' === selectedVal ? ' selected' : ''}>+ Add session attribute...</option>
      <optgroup label="── Session field ──"><option value="__session_type__"${'__session_type__' === selectedVal ? ' selected' : ''}>Session type (column)</option></optgroup>
      <optgroup label="── Player fields ──">${pfEntries.map(e => opt(e.metric_key, METRIC_LABEL[e.metric_key] || e.metric_key)).join('')}</optgroup>
      <optgroup label="── Core metrics ──">${coreHtml}</optgroup>
      ${custMetrics.length ? `<optgroup label="── Custom metrics ──">${custMetrics.map(d => opt(d.key, d.label + (d.unit ? ` (${d.unit})` : ''))).join('')}</optgroup>` : ''}
      <optgroup label="── Session attributes ──">${attrHtml}</optgroup>
      <optgroup label="── Special ──">${specEntries.map(e => opt(e.metric_key, METRIC_LABEL[e.metric_key] || e.metric_key)).join('')}</optgroup>`;
  }

  function _s2RowCls(c, catalog) {
    if (c.excluded) return '';
    if (c.attribute) return 'matched-attr';
    const def  = catalog.find(d => d.key === c.metric);
    const conf = c.confidence;
    if (def && !def.is_core && (conf === 'high' || conf === 'saved' || conf === 'medium')) return 'matched-custom';
    if (conf === 'high' || conf === 'saved') return 'matched-auto';
    if (conf === 'medium') return 'matched-guess';
    return 'matched-none';
  }

  function _s2SelCls(metricKey, conf, catalog) {
    if (metricKey && (metricKey.startsWith('__attr__') || metricKey === '__attr_custom__')) return 'is-attr';
    const def = catalog.find(d => d.key === metricKey);
    if (def && !def.is_core) return 'is-blue';
    if (conf === 'high' || conf === 'saved') return 'is-green';
    if (conf === 'medium') return 'is-yellow';
    return '';
  }

  // Auto-detect number locale from numeric columns. Run once; user can override.
  function _detectDecimalSep(rows, headerRow, columnMap, catalog) {
    const numericCols = Object.entries(columnMap).filter(([, c]) => {
      const m = c.metric;
      if (!m || m === 'time_played') return false;
      if (GPS_REPORT_COLS.has(m)) return true;
      if ((catalog || []).some(d => d.key === m && !d.is_core)) return true;
      return false;
    }).map(([i]) => +i);
    if (!numericCols.length) return 'dot';
    const dataRows = rows.slice(headerRow + 1).filter(r => r.some(c => c !== ''));
    const COMMA_DEC = /,\d{1,2}(\D|$)/;
    for (const row of dataRows.slice(0, 100)) {
      for (const ci of numericCols) {
        if (COMMA_DEC.test(String(row[ci] ?? '').trim())) return 'comma';
      }
    }
    return 'dot';
  }

  function renderStep2(body, footer) {
    const { columnMap } = _wizState;
    const catalog = _wizState.metricCatalog || [];
    const rows = Object.entries(columnMap);
    const custCount = catalog.filter(d => !d.is_core).length;

    // Auto-detect decimal separator once; user can override via selector
    if (!_wizState.decimalSep) {
      _wizState.decimalSep = _detectDecimalSep(_wizState.rows, _wizState.headerRow, columnMap, catalog);
    }
    const INP_SM = 'padding:5px 10px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1.4 var(--cm-font-sans)';

    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:8px 12px;background:var(--cm-bg-soft);border:1px solid var(--cm-border);border-radius:var(--cm-r-3)">
        <span style="font:600 11px/1 var(--cm-font-sans);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);white-space:nowrap">Number format</span>
        <select id="wizDecimalSep" style="${INP_SM}">
          <option value="dot"${_wizState.decimalSep === 'dot' ? ' selected' : ''}>1,234.56 — dot decimal (US / UK)</option>
          <option value="comma"${_wizState.decimalSep === 'comma' ? ' selected' : ''}>1.234,56 — comma decimal (European)</option>
        </select>
      </div>
      <p style="font:500 12px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted);margin:0 0 12px">
        Map each file column to a ClavaMetrics metric.
        <span style="display:inline-flex;align-items:center;gap:4px;color:var(--cm-success)"><span style="width:8px;height:8px;border-radius:2px;background:currentColor;display:inline-block"></span>Core</span>
        <span style="display:inline-flex;align-items:center;gap:4px;color:var(--cm-accent);margin-left:8px"><span style="width:8px;height:8px;border-radius:2px;background:currentColor;display:inline-block"></span>Custom${custCount ? ` (${custCount})` : ''}</span>
        <span style="display:inline-flex;align-items:center;gap:4px;color:var(--cm-info);margin-left:8px"><span style="width:8px;height:8px;border-radius:2px;background:currentColor;display:inline-block"></span>Session attribute</span>
        <span style="display:inline-flex;align-items:center;gap:4px;color:#b45309;margin-left:8px"><span style="width:8px;height:8px;border-radius:2px;background:currentColor;display:inline-block"></span>Possible match</span>
      </p>
      <div style="overflow-x:auto">
      <table class="gp-map-table">
        <thead><tr><th>File column</th><th>Map to metric</th><th>Unit conversion</th></tr></thead>
        <tbody>${rows.map(([i, c]) => {
          if (c.excluded) {
            return `<tr data-ci="${i}" style="opacity:0.45">
              <td style="font:500 12px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${c.sourceCol}
                <span style="margin-left:6px;padding:1px 4px;border:1px solid var(--cm-border);border-radius:3px;font:600 9px/1.4 var(--cm-font-mono);color:var(--cm-fg-faint)">excluded in preview</span>
              </td>
              <td><select disabled style="opacity:0.5;padding:4px 6px;border:1px solid var(--cm-border);border-radius:5px;background:var(--cm-bg-soft);color:var(--cm-fg-muted);font:500 11.5px/1 var(--cm-font-mono)">
                <option>— Excluded in preview —</option>
              </select></td>
              <td style="color:var(--cm-fg-faint);font:500 11.5px/1 var(--cm-font-mono)">—</td>
            </tr>`;
          }
          const conf     = c.confidence;
          const rowCls   = _s2RowCls(c, catalog);
          const selected = c.attribute ? `__attr__${c.attribute}` : c.field === 'session_type' ? '__session_type__' : (c.metric || '__ignore__');
          const selCls   = _s2SelCls(selected, conf, catalog);
          const tooltip  = conf === 'high' || conf === 'saved'
            ? 'Auto-matched (exact)'
            : conf === 'medium'
            ? `Possible match · score ${Math.round((c.score || 0) * 100)}%`
            : 'No match — ignored by default';
          return `<tr class="${rowCls}" data-ci="${i}">
            <td style="font:500 12px/1 var(--cm-font-mono);color:var(--cm-fg)">${c.sourceCol}</td>
            <td>
              <select class="gp-map-sel ${selCls}" data-ci="${i}" title="${tooltip}">
                ${_buildSelOptions(selected)}
              </select>
              <div class="gp-create-inline" data-ci="${i}"></div>
            </td>
            <td>${_wizConvCell(i, c)}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`;

    body.querySelectorAll('.gp-map-sel').forEach(sel => {
      sel.addEventListener('change', e => {
        const ci  = +e.target.dataset.ci;
        const val = e.target.value;
        if (val === '__create__') {
          _showCreateMetricForm(ci, e.target);
          return;
        }
        if (val === '__attribute__' || val === '__attr_custom__') {
          _showCreateAttrForm(ci, e.target);
          return;
        }
        // Clear any open inline form for this column
        body.querySelector(`.gp-create-inline[data-ci="${ci}"]`).innerHTML = '';
        if (val === '__session_type__') {
          _wizState.columnMap[ci].field     = 'session_type';
          _wizState.columnMap[ci].metric    = null;
          _wizState.columnMap[ci].attribute = null;
          e.target.className = 'gp-map-sel is-attr';
        } else if (val.startsWith('__attr__')) {
          const attrKey = val.slice(8);
          _wizState.columnMap[ci].attribute = attrKey;
          _wizState.columnMap[ci].metric    = null;
          _wizState.columnMap[ci].field     = null;
          e.target.className = 'gp-map-sel is-attr';
        } else {
          _wizState.columnMap[ci].attribute = null;
          _wizState.columnMap[ci].metric    = val === '__ignore__' ? null : val;
          _wizState.columnMap[ci].field     = null;
          e.target.className = 'gp-map-sel ' + _s2SelCls(val, 'high', _wizState.metricCatalog || []);
        }
      });
    });
    body.querySelectorAll('.gp-conv-inp').forEach(inp => {
      inp.addEventListener('change', e => {
        const ci = +e.target.dataset.ci;
        _wizState.columnMap[ci].conversion = +e.target.value || 1;
      });
    });
    body.querySelectorAll('.gp-unit-sel').forEach(sel => {
      sel.addEventListener('change', e => {
        const ci = +e.target.dataset.ci, kind = e.target.dataset.kind;
        _wizState.columnMap[ci].conversion = window.GpsUnits.factorFor(kind, e.target.value);
        e.target.parentElement.querySelector('.gp-unit-hint')?.remove();   // user chose → drop the suggestion
      });
    });
    body.querySelector('#wizDecimalSep')?.addEventListener('change', e => {
      _wizState.decimalSep = e.target.value;
    });

    footer.innerHTML = `
      <span style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">Step 2 of 5</span>
      <div class="right">
        <button class="cm-btn is-outline is-sm" id="wizBack2">Back</button>
        <button class="cm-btn is-primary is-sm" id="wizNext2">Next: Match players</button>
      </div>`;
    footer.querySelector('#wizBack2').addEventListener('click', () => setWizStep(1));
    footer.querySelector('#wizNext2').addEventListener('click', async () => {
      await saveMappingsToDB();
      buildPlayerMatches();
      setWizStep(3);
    });
  }

  // ── Create new metric inline form ─────────────────────────
  function _showCreateMetricForm(ci, sel) {
    const inlineDiv = document.querySelector(`.gp-create-inline[data-ci="${ci}"]`);
    if (!inlineDiv) return;
    // Close any other open forms
    document.querySelectorAll('.gp-create-inline').forEach(d => { if (+d.dataset.ci !== ci) d.innerHTML = ''; });

    const colName = _wizState.columnMap[ci]?.sourceCol || '';
    const suggestedKey = _toSlug(colName);

    inlineDiv.innerHTML = `
      <div class="gp-create-metric-form" style="margin-top:6px">
        <div style="font:600 10.5px/1 var(--cm-font-mono);color:var(--cm-accent);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">New metric</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Label *</label>
            <input id="nmLabel${ci}" type="text" value="${colName}" placeholder="e.g. Player Load Slow"
              style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans);box-sizing:border-box">
            <div style="margin-top:2px;font:400 9.5px/1.3 var(--cm-font-mono);color:var(--cm-fg-muted)">key: <span id="nmKeyPrev${ci}">${suggestedKey}</span></div>
          </div>
          <div>
            <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Unit</label>
            <input id="nmUnit${ci}" type="text" placeholder="m, km/h, AU, %…"
              style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans);box-sizing:border-box">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Category *</label>
            <select id="nmCategory${ci}" style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans);box-sizing:border-box">
              <option value="custom">custom</option>
              <option value="distance">distance</option>
              <option value="speed">speed</option>
              <option value="acceleration">acceleration</option>
              <option value="load">load</option>
              <option value="time">time</option>
              <option value="count">count</option>
            </select>
          </div>
          <div>
            <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Decimals *</label>
            <input id="nmDecimals${ci}" type="number" value="2" min="0" max="4"
              style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans);box-sizing:border-box">
          </div>
        </div>
        <div style="margin-bottom:8px">
          <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Description</label>
          <textarea id="nmDesc${ci}" rows="2" placeholder="Optional…"
            style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans);resize:vertical;box-sizing:border-box"></textarea>
        </div>
        <div id="nmErr${ci}" style="display:none;font:500 10.5px/1.3 var(--cm-font-sans);color:var(--cm-danger);margin-bottom:6px"></div>
        <div style="display:flex;gap:6px;justify-content:flex-end">
          <button class="cm-btn is-outline is-sm" id="nmCancel${ci}">Cancel</button>
          <button class="cm-btn is-primary is-sm" id="nmSave${ci}">Save metric</button>
        </div>
      </div>`;

    // Live key preview
    const labelInp = document.getElementById(`nmLabel${ci}`);
    const keySpan  = document.getElementById(`nmKeyPrev${ci}`);
    labelInp.addEventListener('input', () => { keySpan.textContent = _toSlug(labelInp.value); });

    // Cancel
    document.getElementById(`nmCancel${ci}`).addEventListener('click', () => {
      inlineDiv.innerHTML = '';
      sel.value = _wizState.columnMap[ci]?.metric || '__ignore__';
    });

    // Save
    document.getElementById(`nmSave${ci}`).addEventListener('click', async () => {
      const label    = labelInp.value.trim();
      const key      = _toSlug(label);
      const unit     = document.getElementById(`nmUnit${ci}`).value.trim() || null;
      const category = document.getElementById(`nmCategory${ci}`).value;
      const decimals = Math.max(0, Math.min(4, +document.getElementById(`nmDecimals${ci}`).value || 2));
      const desc     = document.getElementById(`nmDesc${ci}`).value.trim() || null;
      const errDiv   = document.getElementById(`nmErr${ci}`);

      if (!label) { errDiv.textContent = 'Label is required.'; errDiv.style.display = ''; return; }
      if (!/^[a-z][a-z0-9_]*$/.test(key)) { errDiv.textContent = `Generated key "${key}" is invalid — label must start with a letter.`; errDiv.style.display = ''; return; }
      if ((_wizState.metricCatalog || []).find(d => d.key === key)) {
        errDiv.textContent = `Key "${key}" already exists in the catalog.`; errDiv.style.display = ''; return;
      }

      const saveBtn = document.getElementById(`nmSave${ci}`);
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';

      const newDef = {
        club_id: _wizState.clubId, key, label, unit, category,
        decimals, description: desc, is_core: false,
        display_order: 200 + (_wizState.metricCatalog || []).filter(d => !d.is_core).length,
      };
      const { error } = await window.sb.from('gps_metric_definitions').insert(newDef);
      if (error) {
        errDiv.textContent = error.message; errDiv.style.display = '';
        saveBtn.disabled = false; saveBtn.textContent = 'Save metric';
        return;
      }

      // Update local catalog cache
      _wizState.metricCatalog = [...(_wizState.metricCatalog || []), { ...newDef }];

      // Update the select for this column
      sel.innerHTML = _buildSelOptions(key);
      sel.value = key;
      sel.className = 'gp-map-sel is-blue';
      _wizState.columnMap[ci].metric = key;

      inlineDiv.innerHTML = '';
    });
  }

  async function _showCreateAttrForm(ci, sel) {
    const inlineDiv = document.querySelector(`.gp-create-inline[data-ci="${ci}"]`);
    if (!inlineDiv) return;
    document.querySelectorAll('.gp-create-inline').forEach(d => { if (+d.dataset.ci !== ci) d.innerHTML = ''; });

    inlineDiv.innerHTML = `
      <div class="gp-create-metric-form" style="margin-top:6px;border-bottom-color:var(--cm-info)">
        <div style="font:600 10.5px/1 var(--cm-font-mono);color:var(--cm-info);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Session attribute</div>
        <div style="margin-bottom:6px">
          <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Attribute key</label>
          <input id="naKey${ci}" type="text" placeholder="e.g. Rival, MD Code, Weather…"
            style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans);box-sizing:border-box">
          <div id="naSlug${ci}" style="margin-top:4px;min-height:14px;font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-faint)"></div>
        </div>
        <div id="naSugg${ci}" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px"></div>
        <div id="naErr${ci}" style="display:none;font:500 10.5px/1.3 var(--cm-font-sans);color:var(--cm-danger);margin-bottom:6px"></div>
        <div style="display:flex;gap:6px;justify-content:flex-end">
          <button class="cm-btn is-outline is-sm" id="naCancel${ci}">Cancel</button>
          <button class="cm-btn is-primary is-sm" id="naSave${ci}">Use attribute</button>
        </div>
      </div>`;

    const keyInp  = document.getElementById(`naKey${ci}`);
    const slugDiv = document.getElementById(`naSlug${ci}`);
    const suggDiv = document.getElementById(`naSugg${ci}`);
    keyInp.focus();

    // Live slug preview
    keyInp.addEventListener('input', () => {
      const slug = _toAttrSlug(keyInp.value);
      if (slug) {
        slugDiv.textContent = `→ ${slug}`;
        slugDiv.style.color = /^[a-z]/.test(slug) ? 'var(--cm-info)' : 'var(--cm-warning)';
      } else {
        slugDiv.textContent = '';
      }
    });

    // Load existing attribute keys for this club as suggestion chips
    (async () => {
      try {
        const { data } = await window.sb
          .from('training_sessions')
          .select('session_attributes')
          .eq('club_id', _wizState.clubId)
          .not('session_attributes', 'eq', '{}')
          .limit(300);
        const keySet = new Set();
        (data || []).forEach(r => {
          if (r.session_attributes) Object.keys(r.session_attributes).forEach(k => keySet.add(k));
        });
        const suggs = [...keySet].sort();
        if (suggs.length) {
          suggDiv.innerHTML = `<span style="font:500 9.5px/1.4 var(--cm-font-mono);color:var(--cm-fg-faint);align-self:center">Used before:</span>` +
            suggs.map(k =>
              `<button type="button"
                style="padding:2px 8px;border:1px solid var(--cm-info);border-radius:12px;background:var(--cm-info-bg);color:var(--cm-info);font:600 10.5px/1.4 var(--cm-font-mono);cursor:pointer"
                data-key="${k}">${k}</button>`
            ).join('');
          suggDiv.querySelectorAll('button[data-key]').forEach(btn => {
            btn.addEventListener('click', () => {
              keyInp.value = btn.dataset.key;
              keyInp.dispatchEvent(new Event('input'));
            });
          });
        }
      } catch (_) {}
    })();

    document.getElementById(`naCancel${ci}`).addEventListener('click', () => {
      inlineDiv.innerHTML = '';
      sel.value = _wizState.columnMap[ci]?.attribute
        ? `__attr__${_wizState.columnMap[ci].attribute}`
        : (_wizState.columnMap[ci]?.metric || '__ignore__');
    });

    document.getElementById(`naSave${ci}`).addEventListener('click', () => {
      const slug   = _toAttrSlug(keyInp.value);
      const errDiv = document.getElementById(`naErr${ci}`);
      if (!slug) { errDiv.textContent = 'Key is required.'; errDiv.style.display = ''; return; }
      if (!/^[a-z][a-z0-9_]*$/.test(slug)) {
        errDiv.textContent = `"${slug}" must start with a letter (a–z).`;
        errDiv.style.display = ''; return;
      }
      _wizState.columnMap[ci].attribute = slug;
      _wizState.columnMap[ci].metric    = null;
      sel.innerHTML = _buildSelOptions(`__attr__${slug}`);
      sel.className = 'gp-map-sel is-attr';
      inlineDiv.innerHTML = '';
    });
  }

  async function saveMappingsToDB() {
    const { clubId, sourceLabel, columnMap } = _wizState;
    if (!clubId) return;
    const upserts = Object.values(columnMap)
      .filter(c => (c.metric && c.metric !== '__ignore__') || c.attribute || c.excluded)
      .map(c => {
        const target = c.excluded ? '__ignore__' : (c.attribute ? '__attr__' + c.attribute : c.metric);
        const rec = {
          club_id: clubId, source_label: sourceLabel,
          source_column_name: c.sourceCol,
          target_metric: target,
          unit_conversion: c.conversion || 1,
          updated_at: new Date().toISOString(),
        };
        if (c.parseFormat) rec.parse_format = c.parseFormat;
        if (c.colType)     rec.column_type  = c.colType;
        if (c.excluded)    rec.excluded     = true;
        return rec;
      });
    if (!upserts.length) return;
    await window.sb.from('gps_column_mappings').upsert(upserts, { onConflict: 'club_id,source_label,source_column_name' });
  }

  // ── Step 3 — Player matching ───────────────────────────────
  function buildPlayerMatches() {
    const { rows, headerRow, columnMap, squadPlayers } = _wizState;

    const _colOf = metric => Object.entries(columnMap).find(([, c]) => c.metric === metric)?.[0];
    const playerNameIdx  = _colOf('player_name');
    const firstNameIdx   = _colOf('player_first_name');
    const lastNameIdx    = _colOf('player_last_name');
    const jerseyIdx      = _colOf('jersey_number');
    const positionIdx    = _colOf('position');
    const extGpsIdIdx    = _colOf('player_external_gps_id');

    const dataRows = rows.slice(headerRow + 1).filter(r => r.some(c => c !== ''));
    const seen = new Set();
    const matches = {};

    dataRows.forEach(row => {
      let rawName   = playerNameIdx  != null ? String(row[+playerNameIdx]  ?? '').trim() : '';
      const rawFirst = firstNameIdx  != null ? String(row[+firstNameIdx]   ?? '').trim() : '';
      const rawLast  = lastNameIdx   != null ? String(row[+lastNameIdx]    ?? '').trim() : '';
      if (!rawName && (rawFirst || rawLast)) rawName = (rawFirst + ' ' + rawLast).trim();

      const rawJersey   = jerseyIdx    != null ? String(row[+jerseyIdx]    ?? '').trim() : '';
      const rawPosition = positionIdx  != null ? String(row[+positionIdx]  ?? '').trim() : '';
      const rawExtGpsId = extGpsIdIdx  != null ? String(row[+extGpsIdIdx]  ?? '').trim() : '';

      // Jersey is the primary key when mapped; fall back to name
      const key = rawJersey || rawName;
      if (!key || seen.has(key)) return;
      seen.add(key);

      matches[key] = {
        ...findBestMatch(rawName, rawJersey, rawExtGpsId, squadPlayers),
        rawName, rawJersey, rawPosition, rawExtGpsId,
      };
    });

    _wizState.playerMatches = matches;
    _wizState.confirmedMap  = {}; // key → player_id
  }

  // Matcher delegates to the shared core (assets/gps-matcher.js). Behavior unchanged.
  function findBestMatch(rawName, rawJersey, rawExtGpsId, squad) {
    return window.CMGpsMatch.findBestMatch(rawName, rawJersey, rawExtGpsId, squad);
  }

  // ── Step 3 UX helpers ──────────────────────────────────────
  // Badge-color thresholds (presentation). Bucketing decision lives in
  // CMGpsMatch.categorize — keep these in sync with CMGpsMatch.S3_HIGH/S3_MED.
  const _S3_HIGH = 0.85;
  const _S3_MED  = 0.60;

  // Category based on score (independent of match.confidence)
  function _s3Cat(match) {
    return window.CMGpsMatch.categorize(match);
  }

  // Read current counts from live DOM (data-cat is updated as user confirms/adds)
  function _s3Counts(list) {
    let unmatched = 0, verify = 0, matched = 0;
    list.querySelectorAll('.gp-match-row').forEach(r => {
      const c = r.dataset.cat;
      if (c === 'unmatched') unmatched++;
      else if (c === 'verify') verify++;
      else matched++;
    });
    return { all: unmatched + verify + matched, unmatched, verify, matched };
  }

  // Update bulk-action buttons and tab counters
  function _refreshS3Bar(body) {
    const list = body.querySelector('#wizMatchList');
    if (!list) return;
    const { all, unmatched, verify, matched } = _s3Counts(list);
    body.querySelectorAll('.s3-tab').forEach(tab => {
      const f = tab.dataset.filter;
      const n = f === 'all' ? all : f === 'unmatched' ? unmatched : f === 'verify' ? verify : matched;
      const span = tab.querySelector('.s3-tc');
      if (span) span.textContent = n;
    });
    const addBtn  = body.querySelector('#s3AddAllBtn');
    const confBtn = body.querySelector('#s3ConfirmAllBtn');
    if (addBtn)  {
      addBtn.style.display = unmatched > 0 ? '' : 'none';
      const sp = addBtn.querySelector('.s3-bc');
      if (sp) sp.textContent = unmatched;
    }
    if (confBtn) {
      confBtn.style.display = verify > 0 ? '' : 'none';
      const sp = confBtn.querySelector('.s3-bc');
      if (sp) sp.textContent = verify;
    }
  }

  // Show/hide rows by category; update tab active style
  function _applyS3Filter(body, filter) {
    const list = body.querySelector('#wizMatchList');
    if (!list) return;
    list.querySelectorAll('.gp-match-row').forEach(r => {
      r.style.display = (filter === 'all' || r.dataset.cat === filter) ? '' : 'none';
    });
    body.querySelectorAll('.s3-tab').forEach(tab => {
      const on = tab.dataset.filter === filter;
      tab.classList.toggle('is-on', on);
      tab.style.background  = on ? 'var(--cm-accent-soft)' : 'var(--cm-bg-soft)';
      tab.style.borderColor = on ? 'var(--cm-accent)'      : 'var(--cm-border)';
      tab.style.color       = on ? 'var(--cm-accent)'      : 'var(--cm-fg-muted)';
    });
  }

  // Build a single player-match row element
  function _buildS3Row(rawKey, match) {
    const p      = match.player;
    const score  = match.score || 0;
    const cat    = _s3Cat(match);
    const pctStr = Math.round(score * 100) + '%';
    const badgeCls = score > _S3_HIGH ? 'high' : score >= _S3_MED ? 'medium' : 'low';

    // Col 1 — player from file: name on first line, secondary info on second
    const nameLine = match.rawName || rawKey;
    const subLine  = [
      match.rawJersey   ? `#${match.rawJersey}` : '',
      match.rawPosition || '',
    ].filter(Boolean).join(' · ');

    // Col 3 — squad match info (varies by confidence tier)
    let matchColHtml;
    if (cat === 'unmatched') {
      const closest = p
        ? `<button class="gp-closest-toggle" data-key="${rawKey}"
             style="background:none;border:none;font:500 10.5px/1 var(--cm-font-sans);color:var(--cm-accent);cursor:pointer;text-decoration:underline;padding:0;text-align:left">
             View closest match (${pctStr})</button>
           <div class="gp-closest-detail" style="display:none;font:500 11px/1.3 var(--cm-font-sans);color:var(--cm-fg-muted)">
             ${p.first_name} ${p.last_name} · #${p.number || '?'} · ${p.position || '—'}
           </div>`
        : '';
      matchColHtml = `<span style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-faint)">No match found in squad</span>${closest}`;
    } else {
      const pLabel = p ? `${p.first_name} ${p.last_name} · #${p.number || '?'} · ${p.position || '—'}` : '—';
      const prefix = cat === 'verify'
        ? `<span style="font:600 9px/1 var(--cm-font-mono);text-transform:uppercase;color:#b45309;letter-spacing:.04em">Possible match — verify</span>`
        : '';
      matchColHtml = `${prefix}<span style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${pLabel}</span>`;
    }

    // Col 4 — action buttons
    let actionsHtml;
    if (cat === 'matched') {
      actionsHtml = `<span class="gp-match-badge high">Auto-matched</span>`;
    } else if (cat === 'verify' && p) {
      actionsHtml = `
        <button class="gp-match-confirm" data-key="${rawKey}" data-pid="${p.id}">Confirm</button>
        <button class="gp-match-confirm" data-key="${rawKey}" data-create="1">Add as new</button>`;
    } else {
      actionsHtml = `<button class="gp-match-confirm" data-key="${rawKey}" data-create="1">Add to squad</button>`;
    }

    const row = document.createElement('div');
    row.className = 'gp-match-row';
    row.dataset.key = rawKey;
    row.dataset.cat = cat;
    row.innerHTML = `
      <div class="s3-cell">
        <span style="font:600 12px/1.3 var(--cm-font-sans);color:var(--cm-fg)">${nameLine}</span>
        ${subLine ? `<span style="font:400 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${subLine}</span>` : ''}
      </div>
      <div class="s3-cell" style="align-items:center;justify-content:center">
        <span class="gp-match-badge ${badgeCls}">${pctStr}</span>
      </div>
      <div class="s3-cell">${matchColHtml}</div>
      <div class="s3-cell gp-match-actions" style="align-items:flex-start;justify-content:center;gap:6px">${actionsHtml}</div>`;

    if (cat === 'matched' && p) {
      _renderPositionWarning(row.querySelector('.gp-match-actions'), rawKey, match, p);
    }
    return row;
  }

  // Bulk: batch-insert all unmatched players in one Supabase query
  async function _bulkAddUnmatched(body, list) {
    const unmatchedRows = [...list.querySelectorAll('.gp-match-row[data-cat="unmatched"]')];
    if (!unmatchedRows.length) return;
    const n = unmatchedRows.length;

    // Build insert data first (before opening modal)
    const rowData   = [];
    const insertArr = [];
    for (const rowEl of unmatchedRows) {
      const key   = rowEl.dataset.key;
      const match = _wizState.playerMatches[key];
      if (!match) continue;
      const parts = (match.rawName || key).trim().split(/\s+/);
      const fn    = parts.slice(0, -1).join(' ') || parts[0] || '';
      const ln    = parts.length > 1 ? parts.slice(-1)[0] : (parts[0] || '');
      // Canonical code via the shared vocabulary; null when unknown (never guess 'MF').
      const pos   = window.cmNormalizePosition ? window.cmNormalizePosition(match.rawPosition) : null;
      const _jn   = parseInt(String(match.rawJersey ?? '').trim(), 10);
      const number = Number.isFinite(_jn) ? _jn : null;   // non-numeric jersey → null (players.number is integer)
      const rec = { club_id: _wizState.clubId, first_name: fn, last_name: ln, position: pos, number, status: 'available' };
      if (window._gpTeamId) rec.team_id = window._gpTeamId;
      if (match.rawExtGpsId) rec.external_gps_id = match.rawExtGpsId;
      rowData.push({ rowEl, key, match, fn, ln });
      insertArr.push(rec);
    }
    if (!insertArr.length) return;

    // Preview: first 4 names + count of remaining
    const previewNames = rowData.slice(0, 4).map(d => d.match.rawName || d.key);
    const previewStr   = previewNames.join(', ') + (n > 4 ? ` and ${n - 4} more` : '');

    await new Promise(resolve => {
      const ov = makeModal(
        `Add ${n} new player${n !== 1 ? 's' : ''} to squad?`,
        `<p style="font:500 12px/1.5 var(--cm-font-sans);color:var(--cm-fg);margin:0 0 6px">${previewStr}</p>
        <p style="font:400 12px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted);margin:0 0 16px">
          Players will be created with the name and position from the file. You can edit details later in Squad.
        </p>
        <div id="bulkAddErr" style="display:none;margin-bottom:10px;padding:8px 10px;background:var(--cm-danger-bg);border:1px solid var(--cm-danger);border-radius:var(--cm-r-3);font:500 11.5px/1.4 var(--cm-font-sans);color:var(--cm-danger)"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="bulkAddCancel" class="cm-btn is-outline is-sm">Cancel</button>
          <button id="bulkAddConfirm" class="cm-btn is-primary is-sm">Add ${n} player${n !== 1 ? 's' : ''}</button>
        </div>`
      );
      ov.querySelector('#bulkAddCancel').addEventListener('click', () => { ov.remove(); resolve(false); });
      ov.querySelector('#bulkAddConfirm').addEventListener('click', async () => {
        const confirmBtn = ov.querySelector('#bulkAddConfirm');
        const errDiv     = ov.querySelector('#bulkAddErr');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Adding…';

        // Single batch INSERT — Supabase returns IDs in insertion order
        const { data, error } = await window.sb.from('players').insert(insertArr).select('id');
        if (error) {
          errDiv.textContent = 'Error: ' + error.message;
          errDiv.style.display = 'block';
          confirmBtn.disabled = false;
          confirmBtn.textContent = `Add ${n} player${n !== 1 ? 's' : ''}`;
          return; // modal stays open — user can retry
        }

        // Map returned IDs back to rows (Supabase preserves insertion order)
        const { confirmedMap } = _wizState;
        (data || []).forEach((rec, i) => {
          if (!rowData[i]) return;
          const { rowEl, key, match, fn, ln } = rowData[i];
          confirmedMap[key] = rec.id;
          _wizState.squadPlayers.push({ id: rec.id, first_name: fn, last_name: ln, position: insertArr[i].position, number: insertArr[i].number, external_gps_id: match.rawExtGpsId || null });
          rowEl.setAttribute('data-cat', 'matched');
          const actEl = rowEl.querySelector('.gp-match-actions');
          if (actEl) actEl.innerHTML = `<span class="gp-match-badge high">Created</span>`;
        });

        showToast(`Added ${(data || []).length} player${(data || []).length !== 1 ? 's' : ''} to squad`);
        ov.remove();
        _refreshS3Bar(body);
        const activeTab = body.querySelector('.s3-tab.is-on');
        if (activeTab) _applyS3Filter(body, activeTab.dataset.filter);
        resolve(true);
      });
    });
  }

  // Bulk: confirm all verify-category rows that have a player suggestion
  function _bulkConfirmVerify(body, list) {
    const verifyRows = [...list.querySelectorAll('.gp-match-row[data-cat="verify"]')];
    const { confirmedMap } = _wizState;
    let confirmed = 0;
    verifyRows.forEach(rowEl => {
      const key   = rowEl.dataset.key;
      const match = _wizState.playerMatches[key];
      if (!match?.player) return;
      confirmedMap[key] = match.player.id;
      rowEl.setAttribute('data-cat', 'matched');
      const actEl = rowEl.querySelector('.gp-match-actions');
      if (actEl) {
        actEl.innerHTML = `<span class="gp-match-badge high">Confirmed</span>`;
        _renderPositionWarning(actEl, key, match, match.player);
      }
      confirmed++;
    });
    showToast(`Confirmed ${confirmed} match${confirmed !== 1 ? 'es' : ''}`);
    _refreshS3Bar(body);
    const activeTab = body.querySelector('.s3-tab.is-on');
    if (activeTab) _applyS3Filter(body, activeTab.dataset.filter);
  }

  // ── Step 3 — Player matching ───────────────────────────────
  function renderStep3(body, footer) {
    const { playerMatches, confirmedMap } = _wizState;
    const entries = Object.entries(playerMatches);

    if (!entries.length) {
      body.innerHTML = `<p style="color:var(--cm-fg-muted);font:500 13px/1.5 var(--cm-font-sans)">No player name column detected — all rows will be imported without player assignment.<br>Go back and map a column to <strong>Player name</strong>.</p>`;
      footer.innerHTML = `
        <span style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">Step 3 of 5</span>
        <div class="right">
          <button class="cm-btn is-outline is-sm" id="wizBack3">Back</button>
          <button class="cm-btn is-primary is-sm" id="wizNext3">Next: Session info</button>
        </div>`;
      footer.querySelector('#wizBack3').addEventListener('click', () => setWizStep(2));
      footer.querySelector('#wizNext3').addEventListener('click', () => setWizStep(4));
      return;
    }

    // Auto-confirm all high-score matches upfront
    entries.forEach(([key, match]) => {
      if (_s3Cat(match) === 'matched' && match.player) confirmedMap[key] = match.player.id;
    });

    const TAB_BASE  = 'padding:3px 10px;border:1px solid var(--cm-border);border-radius:4px;font:500 10.5px/1.4 var(--cm-font-sans);cursor:pointer;background:var(--cm-bg-soft);color:var(--cm-fg-muted)';
    // Shared grid template — must be identical on header and body grids
    const GRID_COLS = 'minmax(200px,1.5fr) 72px minmax(240px,2fr) 190px';

    body.innerHTML = `
      <!-- Sticky block: action bar + column headers scroll with wizBody -->
      <div id="s3Sticky" style="position:sticky;top:0;z-index:2;background:var(--cm-bg)">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:12px">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button id="s3AddAllBtn" class="cm-btn is-outline is-sm" style="display:none">
              Add all unmatched to squad (<span class="s3-bc">0</span>)
            </button>
            <button id="s3ConfirmAllBtn" class="cm-btn is-outline is-sm" style="display:none">
              Confirm all possible matches (<span class="s3-bc">0</span>)
            </button>
          </div>
          <div style="display:flex;gap:4px;margin-left:auto;flex-wrap:wrap">
            <button class="s3-tab" data-filter="all"       style="${TAB_BASE}">All (<span class="s3-tc">0</span>)</button>
            <button class="s3-tab" data-filter="unmatched" style="${TAB_BASE}">Unmatched (<span class="s3-tc">0</span>)</button>
            <button class="s3-tab" data-filter="verify"    style="${TAB_BASE}">Verify (<span class="s3-tc">0</span>)</button>
            <button class="s3-tab" data-filter="matched"   style="${TAB_BASE}">Matched (<span class="s3-tc">0</span>)</button>
          </div>
        </div>
        <!-- Column header row — same grid-template-columns as #wizMatchList -->
        <div style="display:grid;grid-template-columns:${GRID_COLS};background:var(--cm-bg-soft);border-top:1px solid var(--cm-border-soft);border-bottom:2px solid var(--cm-border);border-radius:var(--cm-r-3) var(--cm-r-3) 0 0">
          <div class="s3-hdr-cell">Player from file</div>
          <div class="s3-hdr-cell" style="text-align:center">Conf.</div>
          <div class="s3-hdr-cell">Best squad match</div>
          <div class="s3-hdr-cell">Action</div>
        </div>
      </div>
      <!-- Body grid — display:contents rows are direct grid children -->
      <div id="wizMatchList" style="display:grid;grid-template-columns:${GRID_COLS};border:1px solid var(--cm-border-soft);border-top:none;border-radius:0 0 var(--cm-r-3) var(--cm-r-3);overflow-x:auto"></div>`;

    const list = body.querySelector('#wizMatchList');
    entries.forEach(([rawKey, match]) => list.appendChild(_buildS3Row(rawKey, match)));

    // Compute counts and set smart default filter
    _refreshS3Bar(body);
    const { unmatched, verify } = _s3Counts(list);
    _applyS3Filter(body, unmatched > 0 ? 'unmatched' : verify > 0 ? 'verify' : 'all');

    // Single delegated click handler
    body.addEventListener('click', async e => {
      // Filter tabs
      const tab = e.target.closest('.s3-tab');
      if (tab?.dataset.filter) { _applyS3Filter(body, tab.dataset.filter); return; }

      // Bulk add all unmatched
      if (e.target.closest('#s3AddAllBtn')) { await _bulkAddUnmatched(body, list); return; }

      // Bulk confirm all verify
      if (e.target.closest('#s3ConfirmAllBtn')) { _bulkConfirmVerify(body, list); return; }

      // "View closest" toggle
      const toggleBtn = e.target.closest('.gp-closest-toggle');
      if (toggleBtn) {
        const detail = toggleBtn.closest('.gp-match-row')?.querySelector('.gp-closest-detail');
        if (detail) {
          const open = detail.style.display !== 'none';
          detail.style.display = open ? 'none' : 'block';
          toggleBtn.textContent = open
            ? `View closest match (${Math.round((_wizState.playerMatches[toggleBtn.dataset.key]?.score || 0) * 100)}%)`
            : 'Hide closest match';
        }
        return;
      }

      // Individual row buttons
      const btn = e.target.closest('[data-key]');
      if (!btn) return;
      const key   = btn.dataset.key;
      const match = _wizState.playerMatches[key];
      const rowEl = [...list.querySelectorAll('.gp-match-row')].find(r => r.dataset.key === key);
      const actEl = rowEl?.querySelector('.gp-match-actions');

      if (btn.dataset.pid && !btn.dataset.create) {
        // Confirm single verify match
        confirmedMap[key] = btn.dataset.pid;
        if (actEl) actEl.innerHTML = `<span class="gp-match-badge high">Confirmed</span>`;
        rowEl?.setAttribute('data-cat', 'matched');
        if (actEl && match) _renderPositionWarning(actEl, key, match, match.player);
        _refreshS3Bar(body);
        const activeTab = body.querySelector('.s3-tab.is-on');
        if (activeTab) _applyS3Filter(body, activeTab.dataset.filter);
      } else if (btn.classList.contains('gp-pos-keep')) {
        btn.closest('.gp-pos-warn')?.remove();
      } else if (btn.classList.contains('gp-pos-update')) {
        const newPos = btn.dataset.pos;
        const pid    = confirmedMap[key];
        if (pid) {
          window.sb.from('players').update({ position: newPos })
            .eq('id', pid).eq('club_id', _wizState.clubId)
            .then(({ error }) => {
              if (error) showToast('Could not update position: ' + error.message);
              else {
                const sp = _wizState.squadPlayers.find(x => x.id === pid);
                if (sp) sp.position = newPos;
                btn.closest('.gp-pos-warn')?.remove();
                showToast(`Position updated to ${newPos}`);
              }
            });
        }
      } else if (btn.dataset.create) {
        showCreatePlayerForm(key, btn, match, () => {
          rowEl?.setAttribute('data-cat', 'matched');
          _refreshS3Bar(body);
          const activeTab = body.querySelector('.s3-tab.is-on');
          if (activeTab) _applyS3Filter(body, activeTab.dataset.filter);
        });
      }
    });

    footer.innerHTML = `
      <span style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">Step 3 of 5</span>
      <div class="right">
        <button class="cm-btn is-outline is-sm" id="wizBack3">Back</button>
        <button class="cm-btn is-primary is-sm" id="wizNext3">Next: Session info</button>
      </div>`;
    footer.querySelector('#wizBack3').addEventListener('click', () => setWizStep(2));
    footer.querySelector('#wizNext3').addEventListener('click', () => setWizStep(4));
  }

  // Show inline position conflict warning after a player is matched
  function _renderPositionWarning(actionsEl, key, match, player) {
    if (!match.rawPosition || !player?.position) return;
    if (_norm(match.rawPosition) === _norm(player.position)) return;
    const squadPos = player.position;
    const csvPos   = match.rawPosition;
    const warn = document.createElement('div');
    warn.className = 'gp-pos-warn';
    warn.style.cssText = 'margin-top:5px;padding:5px 8px;background:rgba(245,158,11,.08);border:1px solid var(--cm-warning);border-radius:5px;font:500 11px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap';
    warn.innerHTML = `<span><i class="ti ti-alert-triangle" style="color:var(--cm-warning)"></i> Squad: <strong>${squadPos}</strong> · File says <strong>${csvPos}</strong></span>
      <button class="gp-pos-keep gp-match-confirm" data-key="${key}" style="padding:2px 7px;font-size:10.5px">Keep ${squadPos}</button>
      <button class="gp-pos-update gp-match-confirm" data-key="${key}" data-pos="${csvPos}" style="padding:2px 7px;font-size:10.5px">Update to ${csvPos}</button>`;
    actionsEl.appendChild(warn);
  }

  function showCreatePlayerForm(key, btn, matchData, onCreated) {
    // Pre-fill from CSV data
    const nameParts = (matchData?.rawName || '').trim().split(/\s+/);
    const fnGuess   = nameParts.slice(0, -1).join(' ') || nameParts[0] || '';
    const lnGuess   = nameParts.length > 1 ? nameParts.slice(-1)[0] : (nameParts[0] || '');
    const numGuess  = matchData?.rawJersey || '';
    const POSITIONS = (window.CM_POSITIONS && window.CM_POSITIONS.SELECTABLE) || ['GK','CB','FB','MF','WG','ST'];
    // Canonical code via the shared vocabulary; empty when unknown so the user picks.
    const posGuess  = (window.cmNormalizePosition ? window.cmNormalizePosition(matchData?.rawPosition) : null) || '';

    // Mini-modal overlay — z-index:960 so it floats above the import modal (z-index:950)
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(8,10,12,.45);z-index:960;display:flex;align-items:center;justify-content:center';

    const INP = 'width:100%;padding:7px 10px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1 var(--cm-font-sans);box-sizing:border-box';
    const LBL = 'display:block;font:600 10px/1 var(--cm-font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--cm-fg-muted);margin-bottom:5px';

    ov.innerHTML = `
      <div style="background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:var(--cm-r-4);box-shadow:0 16px 48px rgba(0,0,0,.28);width:360px;max-width:94vw;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font:600 13px/1 var(--cm-font-sans);color:var(--cm-fg-strong)">Add new player to squad</span>
          <button id="cpClose" style="background:none;border:none;cursor:pointer;color:var(--cm-fg-muted);font-size:16px;line-height:1;padding:2px"><i class="ti ti-x"></i></button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <label style="${LBL}">First name *</label>
            <input class="cp-fn" placeholder="First" value="${fnGuess}" style="${INP}">
          </div>
          <div>
            <label style="${LBL}">Last name *</label>
            <input class="cp-ln" placeholder="Last" value="${lnGuess}" style="${INP}">
          </div>
          <div>
            <label style="${LBL}">Position</label>
            <select class="cp-pos" style="${INP}">
              <option value=""${posGuess ? '' : ' selected'}>—</option>
              ${POSITIONS.map(p => `<option${p === posGuess ? ' selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="${LBL}">Jersey #</label>
            <input class="cp-num" type="number" placeholder="—" min="1" value="${numGuess}" style="${INP}">
          </div>
        </div>
        <div id="cpErr" style="display:none;margin-bottom:10px;padding:7px 10px;background:var(--cm-danger-bg);border:1px solid var(--cm-danger);border-radius:var(--cm-r-3);font:500 11.5px/1.4 var(--cm-font-sans);color:var(--cm-danger)"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="cpCancel" class="cm-btn is-outline is-sm">Cancel</button>
          <button id="cpSave" class="cm-btn is-primary is-sm">Save &amp; match</button>
        </div>
      </div>`;

    const close = () => ov.remove();
    ov.querySelector('#cpClose').addEventListener('click', close);
    ov.querySelector('#cpCancel').addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    const escHandler = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    ov.querySelector('#cpSave').addEventListener('click', async () => {
      const fn     = ov.querySelector('.cp-fn').value.trim();
      const ln     = ov.querySelector('.cp-ln').value.trim();
      const pos    = ov.querySelector('.cp-pos').value;
      const _jn    = parseInt(String(ov.querySelector('.cp-num').value ?? '').trim(), 10);
      const num    = Number.isFinite(_jn) ? _jn : null;   // non-numeric jersey → null (players.number is integer)
      const errDiv = ov.querySelector('#cpErr');
      const saveBtn = ov.querySelector('#cpSave');

      if (!fn || !ln) {
        errDiv.textContent = 'First name and last name are required.';
        errDiv.style.display = 'block';
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      const insertObj = {
        club_id: _wizState.clubId, first_name: fn, last_name: ln,
        position: pos, number: num, status: 'available',
      };
      if (matchData?.rawExtGpsId) insertObj.external_gps_id = matchData.rawExtGpsId;

      const { data, error } = await window.sb.from('players').insert(insertObj).select('id').single();
      if (error) {
        errDiv.textContent = 'Error creating player: ' + error.message;
        errDiv.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save & match';
        return;
      }

      _wizState.confirmedMap[key] = data.id;
      _wizState.squadPlayers.push({ id: data.id, first_name: fn, last_name: ln, position: pos, number: num, external_gps_id: matchData?.rawExtGpsId || null });

      // Update row UI
      const rowEl = [...document.querySelectorAll('.gp-match-row')].find(r => r.dataset.key === key);
      const actEl = rowEl?.querySelector('.gp-match-actions');
      if (actEl) actEl.innerHTML = `<span class="gp-match-badge high">Created &amp; matched</span>`;

      document.removeEventListener('keydown', escHandler);
      close();
      showToast(`Player ${fn} ${ln} added to squad`);
      onCreated?.();
    });

    document.body.appendChild(ov);
    setTimeout(() => ov.querySelector('.cp-fn')?.focus(), 50);
  }

  // ── GPS report columns that can be persisted ─────────────────
  const GPS_REPORT_COLS = new Set([
    'total_distance','high_speed_distance','very_high_speed_distance',
    'sprint_distance','accelerations','decelerations','max_speed',
    'player_load','avg_speed','hmld','time_played','sprint_count','distance_per_minute',
  ]);
  const GPS_INT_COLS = new Set(['accelerations','decelerations','sprint_count','time_played']);
  const SESSION_TYPES = ['training','match','conditioning','tactical','gym','recovery','rehab','other'];

  // ── Step 4 — Session info ──────────────────────────────────
  // Extracts unique dates from the parsed file (if session_date column is mapped)
  // and returns { uniqueDates, dateMap, doubleDates }.
  function _buildDateMap() {
    const { rows, headerRow, columnMap } = _wizState;
    const _colOf = m => Object.entries(columnMap).find(([, c]) => c.metric === m)?.[0];
    const dateColIdx    = _colOf('session_date');
    const playerNameIdx = _colOf('player_name') ?? _colOf('player_first_name');
    const jerseyIdx     = _colOf('jersey_number');
    if (dateColIdx == null) return { uniqueDates: [], dateMap: {}, doubleDates: [] };

    const fmt      = columnMap[dateColIdx]?.parseFormat || null;
    const dataRows = rows.slice(headerRow + 1).filter(r => r.some(c => c !== ''));
    const dateMap  = {};
    const playerDateSeen = {};

    for (const row of dataRows) {
      const rawDate = String(row[+dateColIdx] || '').trim();
      const parsed  = window.gpParseDate ? window.gpParseDate(rawDate, fmt) : null;
      const iso     = parsed?.iso;
      if (!iso || parsed.invalid) continue;
      dateMap[iso] = (dateMap[iso] || 0) + 1;
      const jersey = jerseyIdx     != null ? String(row[+jerseyIdx]     ?? '').trim() : '';
      const name   = playerNameIdx != null ? String(row[+playerNameIdx] ?? '').trim() : '';
      const pk = jersey || name;
      if (pk) { const k = `${pk}__${iso}`; playerDateSeen[k] = (playerDateSeen[k] || 0) + 1; }
    }

    const uniqueDates = Object.keys(dateMap).sort();
    const doubleCounts = {};
    for (const [k, cnt] of Object.entries(playerDateSeen)) {
      if (cnt > 1) { const date = k.split('__').slice(-1)[0]; doubleCounts[date] = (doubleCounts[date] || 0) + 1; }
    }
    const doubleDates = Object.entries(doubleCounts).map(([date, n]) => ({ date, n }));
    return { uniqueDates, dateMap, doubleDates };
  }

  async function renderStep4Session(body, footer) {
    const { clubId, sessionType, columnMap } = _wizState;
    const today   = cmToday();
    const initType = sessionType === 'auto' ? 'training' : (sessionType || 'training');

    const { uniqueDates, dateMap, doubleDates } = _buildDateMap();
    const hasDateCol   = uniqueDates.length > 0;
    const isMultiDate  = uniqueDates.length > 1;
    const _typeColEntry = Object.entries(_wizState.columnMap || {}).find(([, c]) => c.field === 'session_type');

    // Heuristic: pre-select "Historical" when latest date is >30 days ago
    let suggestHistorical = false;
    if (hasDateCol) {
      const latestDate = new Date(uniqueDates[uniqueDates.length - 1] + 'T00:00:00');
      suggestHistorical = (Date.now() - latestDate.getTime()) > 30 * 86400000;
    }

    if (!_wizState.sessionInfo) {
      _wizState.sessionInfo = {
        mode: hasDateCol ? 'multi' : 'single',
        isHistorical: suggestHistorical,
        sessionType: initType,
        uniqueDates, dateMap, doubleDates,
        // single-mode only
        date: today, title: '', existingId: null, calendarEventId: null,
      };
    }
    const si = _wizState.sessionInfo;

    const LBL = `font:600 11px/1 var(--cm-font-sans);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);display:block;margin-bottom:5px`;
    const INP = `width:100%;padding:7px 10px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1 var(--cm-font-sans);box-sizing:border-box`;
    const typeOpts = SESSION_TYPES.map(t => `<option value="${t}"${t===si.sessionType?' selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('');

    // ── Radio choice: Historical / Real sessions ─────────────
    const choiceHTML = (isHistorical, isHist) => {
      const chk = isHist ? 'checked' : '';
      const alt = !isHist ? 'checked' : '';
      return `
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
        <label style="display:flex;gap:10px;padding:10px 12px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);cursor:pointer;background:var(--cm-bg-soft)">
          <input type="radio" name="s4mode" value="historical" ${chk} style="margin-top:1px;flex-shrink:0">
          <div>
            <div style="font:600 12.5px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong)">Historical data — for analysis only</div>
            <div style="font:400 11.5px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin-top:3px">Sessions won't appear in Calendar, Sessions History, or Daily Planning. GPS data will be fully available for charts, baselines, and comparisons.</div>
          </div>
        </label>
        <label style="display:flex;gap:10px;padding:10px 12px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);cursor:pointer;background:var(--cm-bg-soft)">
          <input type="radio" name="s4mode" value="real" ${alt} style="margin-top:1px;flex-shrink:0">
          <div>
            <div style="font:600 12.5px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong)">Real sessions — full integration</div>
            <div style="font:400 11.5px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin-top:3px">Each date will create a training session visible in Calendar, Sessions History, and Daily Planning.</div>
          </div>
        </label>
      </div>`;
    };

    if (!hasDateCol) {
      // ── Single-date mode (no date column mapped) ─────────────
      body.innerHTML = `
        <p style="font:500 12px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted);margin:0 0 12px">
          No session date column detected. Choose a date and how to treat this import.
        </p>
        ${choiceHTML(true, si.isHistorical)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="${LBL}">Session date</label>
            <input type="date" id="s4Date" value="${si.date}" style="${INP}">
          </div>
          <div>
            <label style="${LBL}">Session type</label>
            <select id="s4Type" style="${INP.replace('12px/1','12px/1.4')}">${typeOpts}</select>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label style="${LBL}">Session title (optional)</label>
          <input type="text" id="s4Title" value="${si.title}" placeholder="Leave blank to auto-generate" style="${INP}">
        </div>
        <div id="s4SessionBanner" style="margin-top:4px"></div>`;

      async function lookupSingle() {
        const date = body.querySelector('#s4Date').value;
        const type = body.querySelector('#s4Type').value;
        const banner = document.getElementById('s4SessionBanner');
        if (!date || !type || !clubId || body.querySelector('[name="s4mode"]:checked')?.value === 'historical') {
          banner.innerHTML = '';
          si.existingId = null;
          return;
        }
        banner.innerHTML = `<div style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">Searching…</div>`;
        const { data } = await window.sb.from('training_sessions')
          .select('id,title,session_date,session_type')
          .eq('club_id', clubId).eq('session_date', date).eq('session_type', type)
          .eq('is_historical', false).limit(3);
        if (data?.length) {
          const s = data[0];
          si.existingId = s.id;
          banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--cm-success-bg);border:1px solid var(--cm-success);border-radius:var(--cm-r-3)">
              <i class="ti ti-circle-check" style="color:var(--cm-success);font-size:16px"></i>
              <div style="flex:1">
                <div style="font:600 12.5px/1 var(--cm-font-sans);color:var(--cm-fg-strong)">${s.title || s.session_type} · ${s.session_date}</div>
                <div style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:3px">Existing session — data will be added to it</div>
              </div>
            </div>`;
        } else {
          si.existingId = null;
          banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--cm-bg-soft);border:1px solid var(--cm-border);border-radius:var(--cm-r-3)">
              <i class="ti ti-plus" style="color:var(--cm-fg-muted);font-size:16px"></i>
              <div style="font:500 12px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted)">No session found — a new session will be created</div>
            </div>`;
        }
      }
      let _deb = null;
      const triggerLookup = () => { clearTimeout(_deb); _deb = setTimeout(lookupSingle, 350); };
      body.querySelector('#s4Date').addEventListener('change', triggerLookup);
      body.querySelector('#s4Type').addEventListener('change', triggerLookup);
      body.querySelectorAll('[name="s4mode"]').forEach(r => r.addEventListener('change', triggerLookup));
      body.querySelector('#s4Title').addEventListener('input', e => { si.title = e.target.value.trim(); });
      lookupSingle();

    } else {
      // ── Multi-date mode (session_date column mapped) ─────────
      const totalRows   = Object.values(dateMap).reduce((a, b) => a + b, 0);
      const earliest    = uniqueDates[0];
      const latest      = uniqueDates[uniqueDates.length - 1];
      const previewDates = uniqueDates.length <= 6
        ? uniqueDates
        : [...uniqueDates.slice(0, 3), null, ...uniqueDates.slice(-2)];

      const dateListHTML = previewDates.map(d =>
        d ? `<div style="display:flex;justify-content:space-between;font:500 12px/1.6 var(--cm-font-sans);color:var(--cm-fg)">
               <span>${d}</span>
               <span style="color:var(--cm-fg-muted)">${dateMap[d]} row${dateMap[d]!==1?'s':''}</span>
             </div>`
          : `<div style="font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted);padding:2px 0">… ${uniqueDates.length - 5} more dates …</div>`
      ).join('');

      const doubleWarning = doubleDates.length ? `
        <div style="margin-bottom:12px;padding:10px 12px;background:rgba(245,158,11,.08);border:1px solid var(--cm-warning);border-radius:var(--cm-r-3)">
          <div style="font:600 12px/1 var(--cm-font-sans);color:var(--cm-warning);margin-bottom:4px">Possible double sessions detected</div>
          ${doubleDates.map(d => `<div style="font:500 11.5px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted)">${d.date} — ${d.n} player${d.n!==1?'s appear':'appears'} more than once</div>`).join('')}
          <div style="font:400 11px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin-top:4px">Duplicate rows per player+date will be deduplicated automatically (last row kept).</div>
        </div>` : '';

      body.innerHTML = `
        <div style="padding:10px 12px;background:var(--cm-bg-soft);border:1px solid var(--cm-border);border-radius:var(--cm-r-3);margin-bottom:12px">
          <div style="font:600 12.5px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong);margin-bottom:6px">
            This file contains data for ${uniqueDates.length} session${uniqueDates.length!==1?'s':''} · ${totalRows} rows
          </div>
          ${dateListHTML}
          <div style="font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted);margin-top:6px">${earliest} → ${latest}</div>
        </div>
        ${doubleWarning}
        <div style="font:600 11px/1 var(--cm-font-sans);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);margin-bottom:8px">How should we treat these sessions?</div>
        ${choiceHTML(true, si.isHistorical)}
        ${!_typeColEntry ? `<div>
          <label style="${LBL}">Session type for all dates</label>
          <select id="s4Type" style="${INP.replace('12px/1','12px/1.4')}">${typeOpts}</select>
        </div>` : ''}`;
    }

    // ── Type vocabulary mapping (shown when a session_type column is mapped) ──
    if (hasDateCol && _typeColEntry) {
      const _typeColIdx = +_typeColEntry[0];
      const _dataRows   = _wizState.rows.slice(_wizState.headerRow + 1).filter(r => r.some(c => c !== ''));
      const _rawTypes   = [...new Set(_dataRows.map(r => String(r[_typeColIdx] ?? '').trim()).filter(Boolean))];
      if (_rawTypes.length) {
        // Build heuristic map on first render; preserve on re-render
        if (!_wizState.typeMap) {
          _wizState.typeMap = {};
          for (const rt of _rawTypes) {
            const nc = rt.toLowerCase();
            let canon = 'training';
            if (/match|partido/.test(nc))            canon = 'match';
            else if (/train|entren/.test(nc))        canon = 'training';
            else if (/rehab|rehabilit/.test(nc))     canon = 'rehab';
            else if (/condition|físic|fisic/.test(nc)) canon = 'conditioning';
            else if (/recover|recup|regenera/.test(nc)) canon = 'recovery';
            else if (/gym|fuerza/.test(nc))           canon = 'gym';
            else if (/tact/.test(nc))                 canon = 'tactical';
            _wizState.typeMap[rt] = canon;
          }
        }
        const _typeRowsHTML = _rawTypes.map(rt => {
          const canon = _wizState.typeMap[rt] || 'training';
          const _topts = SESSION_TYPES.map(t => `<option value="${t}"${t === canon ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');
          return `<tr>
            <td style="font:500 12px/1 var(--cm-font-mono);color:var(--cm-fg);padding:5px 8px">"${rt}"</td>
            <td style="padding:5px 4px;color:var(--cm-fg-muted);font:500 11px/1 var(--cm-font-sans)">→</td>
            <td style="padding:5px 8px;display:flex;align-items:center;gap:6px">
              <select class="gp-typemap-sel" data-raw="${rt.replace(/"/g,'&quot;')}"
                style="padding:4px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans)">
                ${_topts}
              </select>
              <span style="font:500 10px/1 var(--cm-font-sans);color:var(--cm-fg-faint);white-space:nowrap">auto</span>
            </td>
          </tr>`;
        }).join('');
        body.insertAdjacentHTML('beforeend', `
          <div style="margin-top:12px;padding:10px 12px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3)">
            <div style="font:500 12px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:8px">
              Detectamos los tipos automáticamente. Revisá y corregí solo si algo está mal.
            </div>
            <table style="width:100%;border-collapse:collapse"><tbody>${_typeRowsHTML}</tbody></table>
          </div>`);
        body.querySelectorAll('.gp-typemap-sel').forEach(sel => {
          sel.addEventListener('change', e => {
            _wizState.typeMap[e.target.dataset.raw] = e.target.value;
          });
        });
      }
    }

    footer.innerHTML = `
      <span style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">Step 4 of 5</span>
      <div class="right">
        <button class="cm-btn is-outline is-sm" id="wizBack4">Back</button>
        <button class="cm-btn is-primary is-sm" id="wizNext4">Import data</button>
      </div>`;
    footer.querySelector('#wizBack4').addEventListener('click', () => setWizStep(3));
    footer.querySelector('#wizNext4').addEventListener('click', () => {
      si.isHistorical  = body.querySelector('[name="s4mode"]:checked')?.value === 'historical';
      si.sessionType   = body.querySelector('#s4Type')?.value || 'training';
      if (si.mode === 'single') {
        si.date  = body.querySelector('#s4Date')?.value  || today;
        si.title = body.querySelector('#s4Title')?.value.trim() || '';
      }

      // Guardrail: warn if no session will have type='match' (baselines filter by that)
      const _hasTypeCol = Object.entries(_wizState.columnMap || {}).some(([, c]) => c.field === 'session_type');
      const _willHaveMatch = _hasTypeCol
        ? Object.values(_wizState.typeMap || {}).some(t => t === 'match')
        : si.sessionType === 'match';
      const existingNotice = body.querySelector('#s4HistoricalNotice');
      if (si.isHistorical && !_willHaveMatch && !existingNotice) {
        const notice = document.createElement('div');
        notice.id = 's4HistoricalNotice';
        notice.style.cssText = 'margin-top:10px;padding:10px 12px;background:rgba(245,158,11,.08);border:1px solid var(--cm-warning);border-radius:var(--cm-r-3)';
        notice.innerHTML = `<span style="font:500 12px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted)">These sessions won't feed match baselines because the type is not "Match". If these are match records, change the type above before continuing.</span>`;
        body.appendChild(notice);
        return; // first click shows warning; second click proceeds
      }

      setWizStep(5);
      runImport();
    });
  }

  // ── Step 5 — Import progress ───────────────────────────────
  function renderStep5Import(body) {
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:32px 0">
        <i class="ti ti-loader-2" id="wizSpinner" style="font-size:32px;color:var(--cm-accent);animation:gp-spin 1s linear infinite"></i>
        <div id="wizImportStatus" style="font:500 13px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted);text-align:center">Preparing import…</div>
      </div>`;
    document.getElementById('wizFooter').innerHTML = '';
  }

  // ── Build rows from parsed file ──────────────────────────────
  // dateSessionMap: { 'YYYY-MM-DD' → session_id } or null (single-session mode)
  // singleSessionId: fallback session_id when dateSessionMap is null
  // Returns:
  //   insertable  — core rows for gps_reports
  //   extrasMap   — { rowKey → [{metric_key, value}] } for gps_report_metrics
  function buildInsertableRows(dateSessionMap, singleSessionId) {
    const { rows, headerRow, columnMap, clubId, confirmedMap, metricCatalog } = _wizState;
    const _colOf = metric => Object.entries(columnMap).find(([, c]) => c.metric === metric)?.[0];
    const playerNameIdx = _colOf('player_name') ?? _colOf('player_first_name');
    const jerseyIdx     = _colOf('jersey_number');
    const dateColIdx    = _colOf('session_date');
    const typeColIdx    = Object.entries(columnMap).find(([, c]) => c.field === 'session_type')?.[0] ?? null;
    const dateFmt       = dateColIdx != null ? (columnMap[dateColIdx]?.parseFormat || null) : null;
    const dataRows      = rows.slice(headerRow + 1).filter(r => r.some(c => c !== ''));
    const hasPlayerMapping = playerNameIdx != null || jerseyIdx != null;

    // Custom metric keys: in catalog but not in gps_reports columns
    const customMetricKeys = new Set(
      (metricCatalog || []).filter(d => !d.is_core).map(d => d.key)
    );

    const insertable    = [];
    const extrasMap     = {}; // rowKey → [{metric_key, value}]
    const rawAttrsBySess = {}; // session_id → { attrKey → [values seen] }
    let skippedCells = 0;
    let outlierCount = 0;
    const warnings   = [];
    const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const _rowKey    = r => `${r.player_id ?? '_'}__${r.session_id}`;

    for (const row of dataRows) {
      const rawJersey = jerseyIdx     != null ? String(row[+jerseyIdx]     ?? '').trim() : '';
      const rawName   = playerNameIdx != null ? String(row[+playerNameIdx] ?? '').trim() : null;
      const key       = rawJersey || rawName || null;
      const playerId  = key ? (confirmedMap[key] || null) : null;

      if (hasPlayerMapping && !playerId) {
        if (key) warnings.push(`"${key}" not matched — row skipped`);
        continue;
      }

      // Resolve session_id for this row (multi-date or single)
      let sessionId = singleSessionId;
      if (dateColIdx != null && dateSessionMap) {
        const rawDate = String(row[+dateColIdx] || '').trim();
        const parsed  = window.gpParseDate ? window.gpParseDate(rawDate, dateFmt) : null;
        if (parsed?.iso && !parsed.invalid) {
          if (typeColIdx != null) {
            const rawType  = String(row[+typeColIdx] ?? '').trim();
            const canon    = (_wizState.typeMap || {})[rawType] || 'other';
            sessionId = dateSessionMap[`${parsed.iso}__${canon}`] || singleSessionId;
          } else {
            sessionId = dateSessionMap[parsed.iso] || singleSessionId;
          }
        }
      }
      if (!sessionId) continue;

      const rec    = { club_id: clubId, session_id: sessionId, player_id: playerId };
      const extras = [];

      for (const [ci, map] of Object.entries(columnMap)) {
        // Accumulate session attributes (grain = per session, not per player)
        if (map.attribute) {
          const raw = String(row[+ci] ?? '').trim();
          if (raw) {
            if (!rawAttrsBySess[sessionId]) rawAttrsBySess[sessionId] = {};
            if (!rawAttrsBySess[sessionId][map.attribute]) rawAttrsBySess[sessionId][map.attribute] = [];
            rawAttrsBySess[sessionId][map.attribute].push(raw);
          }
          continue;
        }
        if (!map.metric) continue;
        const raw = row[+ci];
        if (raw === '' || raw == null) continue;

        if (GPS_REPORT_COLS.has(map.metric)) {
          // Core metric → gps_reports column
          if (map.metric === 'time_played' && typeof window.gpParseDuration === 'function') {
            const pd = window.gpParseDuration(raw, map.parseFormat || null);
            if (pd.invalid || pd.minutes === null) { skippedCells++; continue; }
            rec.time_played = Math.round(pd.minutes);
            continue;
          }
          const _np = window.gpParseNumber
            ? window.gpParseNumber(raw, { decimal: _wizState.decimalSep || 'dot' })
            : { value: +raw, invalid: !isFinite(+raw) || isNaN(+raw) };
          if (_np.invalid || _np.value === null) { skippedCells++; continue; }
          const num = _np.value * (map.conversion || 1);
          if (!isFinite(num)) { skippedCells++; continue; }
          rec[map.metric] = GPS_INT_COLS.has(map.metric) ? Math.round(num) : +num.toFixed(4);

        } else if (customMetricKeys.has(map.metric)) {
          // Custom metric → gps_report_metrics (EAV)
          const _np = window.gpParseNumber
            ? window.gpParseNumber(raw, { decimal: _wizState.decimalSep || 'dot' })
            : { value: +raw, invalid: !isFinite(+raw) || isNaN(+raw) };
          if (_np.invalid || _np.value === null) { skippedCells++; continue; }
          const num = _np.value * (map.conversion || 1);
          if (!isFinite(num)) { skippedCells++; continue; }
          extras.push({ metric_key: map.metric, value: +num.toFixed(4) });
        }
        // else: player field, session_date, __ignore__ → skip
      }

      if (!UUID_RE.test(rec.club_id) || !UUID_RE.test(rec.session_id)) continue;
      if (rec.player_id && !UUID_RE.test(rec.player_id)) { rec.player_id = null; }

      // Outlier defense: total_distance (canonical metres) above the physical max
      // for one session = noise (e.g. GPS left on in the bus). Insert but flag
      // is_invalid so aggregates exclude it without losing the raw row.
      const _maxM = window.GpsUnits?.OUTLIER_MAX_M ?? 25000;
      if (rec.total_distance != null && rec.total_distance > _maxM) { rec.is_invalid = true; outlierCount++; }

      insertable.push(rec);
      // Overwrite on duplicate key (same as dedup keeps last row)
      if (extras.length) extrasMap[_rowKey(rec)] = extras;
    }

    // Consolidate attribute values: take most frequent; warn if varies within session
    const attrsBySession = {};
    for (const [sid, keyMap] of Object.entries(rawAttrsBySess)) {
      attrsBySession[sid] = {};
      for (const [attrKey, values] of Object.entries(keyMap)) {
        const counts = {};
        for (const v of values) counts[v] = (counts[v] || 0) + 1;
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const chosen = sorted[0][0];
        if (sorted.length > 1) {
          const dateLabel = dateSessionMap
            ? (Object.entries(dateSessionMap).find(([, id]) => id === sid)?.[0] || sid)
            : sid;
          warnings.push(`Attribute "${attrKey}" varies within session ${dateLabel} — using "${chosen}"`);
        }
        attrsBySession[sid][attrKey] = chosen;
      }
    }

    if (outlierCount) warnings.push(`${outlierCount} row${outlierCount === 1 ? '' : 's'} flagged invalid (total_distance > ${((window.GpsUnits?.OUTLIER_MAX_M ?? 25000) / 1000)} km) — inserted but excluded from aggregates`);

    return { insertable, extrasMap, skippedCells, warnings, attrsBySession, outlierCount };
  }

  // ── Main import function ───────────────────────────────────
  async function runImport() {
    const setStatus = (main, sub) => {
      const el = document.getElementById('wizImportStatus');
      if (el) el.innerHTML = main + (sub ? `<br><span style="font:400 11px/1.4 var(--cm-font-sans);opacity:.7">${sub}</span>` : '');
    };

    const finishWithError = msg => {
      document.getElementById('wizSpinner')?.remove();
      const el = document.getElementById('wizImportStatus');
      if (el) el.innerHTML = `<span style="color:var(--cm-danger)">${msg}</span>`;
      document.getElementById('wizFooter').innerHTML = `
        <span style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-danger)">${msg}</span>
        <div class="right">
          <button class="cm-btn is-outline is-sm" id="wizRetry">Retry</button>
          <button class="cm-btn is-outline is-sm" onclick="document.getElementById('gpImportModal')?.remove()">Close</button>
        </div>`;
      document.getElementById('wizRetry')?.addEventListener('click', () => { renderStep5Import(document.getElementById('wizBody')); runImport(); });
    };

    try {
      const { clubId, sessionInfo, confirmedMap } = _wizState;
      const { mode, isHistorical, sessionType, uniqueDates } = sessionInfo;
      const isMultiMode = mode === 'multi' && uniqueDates?.length > 0;

      // ── 1. Create / resolve training_sessions ──────────────
      let dateSessionMap = null;
      let singleSessionId = null;

      // Find (or create) the training_session for a date+type. Shared by all three import
      // paths so the "match existing → else insert" logic is identical AND runs synchronously
      // at commit time. The single-session path used to trust sessionInfo.existingId, which is
      // filled by a 350ms-debounced UI lookup — on rapid re-imports that lookup hadn't finished,
      // so existingId stayed null and a duplicate session was spawned. Resolving here closes it.
      // Match key stays (club, date, type, is_historical) — unchanged — so legitimate double
      // sessions and existing behaviour are untouched; only the missing lookup is added.
      async function _gpResolveSessionId(date, type, title) {
        // Enganchar el GPS a la sesión PLANIFICADA (que trae microciclo/MD) en vez de crear una
        // suelta. Matchea por equipo activo O team-null (importadas/legacy), prefiriendo la del
        // equipo, y ADOPTA la team-null (setea el equipo) para que plan y GPS converjan en una fila.
        // ETAPA 1 (no duplicar): match en 2 pasos, tolerante a diferencias de tipo/is_historical:
        //  1) exacto por tipo (ignora is_historical: un import marcado "histórico" no debe crear una
        //     2da sesión si la planificada del día no es histórica);
        //  2) si no hay exacto → adoptar la sesión planificada del día (misma fecha+equipo, NO gym;
        //     y NO el partido si el GPS es de entreno) en vez de insertar un duplicado por tipo.
        const teamId = window._gpTeamId || null;
        const _pick = async (build) => {
          let q = build(window.sb.from('training_sessions')
            .select('id, team_id').eq('club_id', clubId).eq('session_date', date));
          if (teamId) q = q.or(`team_id.eq.${teamId},team_id.is.null`);
          const { data } = await q.order('team_id', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true }).limit(1);
          return data?.[0] || null;
        };
        let hit = await _pick(q => q.eq('session_type', type));                       // 1) exacto por tipo
        if (!hit) hit = await _pick(q => {                                            // 2) adoptar planificada del día
          q = q.neq('session_type', 'gym');
          return type !== 'match' ? q.neq('session_type', 'match') : q;
        });
        if (hit?.id) {
          if (teamId && hit.team_id == null) {
            try { await window.sb.from('training_sessions').update({ team_id: teamId }).eq('id', hit.id).eq('club_id', clubId); } catch (e) { console.warn('gps import adopt team:', e); }
          }
          return hit.id;
        }
        const { data: newSess, error } = await window.sb.from('training_sessions')
          .insert({ club_id: clubId, title, session_date: date, session_type: type, is_historical: isHistorical, ...(teamId ? { team_id: teamId } : {}) })
          .select('id').single();
        if (error) throw new Error(`Could not create session for ${date}: ${error.message}`);
        return newSess.id;
      }

      if (isMultiMode) {
        dateSessionMap = {};
        const _typeColEntry = Object.entries(_wizState.columnMap).find(([, c]) => c.field === 'session_type');

        if (_typeColEntry) {
          // Per-row type mode: one session per unique (date, canonicalType) combo
          const _tci     = +_typeColEntry[0];
          const _dcIdx   = Object.entries(_wizState.columnMap).find(([, c]) => c.metric === 'session_date')?.[0];
          const _dateFmt = _dcIdx != null ? (_wizState.columnMap[+_dcIdx]?.parseFormat || null) : null;
          const _typeMap = _wizState.typeMap || {};
          const _drows   = _wizState.rows.slice(_wizState.headerRow + 1).filter(r => r.some(c => c !== ''));
          const _sessSet = {};
          for (const row of _drows) {
            if (!_dcIdx) continue;
            const rawDate  = String(row[+_dcIdx] || '').trim();
            const parsed   = window.gpParseDate ? window.gpParseDate(rawDate, _dateFmt) : null;
            if (!parsed?.iso || parsed.invalid) continue;
            const rawType  = String(row[+_tci] ?? '').trim();
            const canon    = _typeMap[rawType] || 'other';
            const k        = `${parsed.iso}__${canon}`;
            if (!_sessSet[k]) _sessSet[k] = { date: parsed.iso, type: canon };
          }
          const _uniqueSess = Object.values(_sessSet).sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
          setStatus('Creating sessions…', `0 / ${_uniqueSess.length}`);

          for (let i = 0; i < _uniqueSess.length; i++) {
            const { date, type } = _uniqueSess[i];
            const title = `${type.charAt(0).toUpperCase() + type.slice(1)} · ${date}`;
            dateSessionMap[`${date}__${type}`] = await _gpResolveSessionId(date, type, title);
            setStatus('Creating sessions…', `${i + 1} / ${_uniqueSess.length}`);
          }
        } else {
          // Original path: one session per unique date, single global type
          const type = sessionType || 'training';
          setStatus('Creating sessions…', `0 / ${uniqueDates.length}`);

          for (let i = 0; i < uniqueDates.length; i++) {
            const date = uniqueDates[i];
            const title = `${type.charAt(0).toUpperCase() + type.slice(1)} · ${date}`;
            dateSessionMap[date] = await _gpResolveSessionId(date, type, title);
            setStatus('Creating sessions…', `${i + 1} / ${uniqueDates.length}`);
          }
        }
      } else {
        // Single-session mode (no date column or manual date)
        setStatus('Resolving session…');
        singleSessionId = sessionInfo.existingId || null;

        if (!singleSessionId) {
          const date  = sessionInfo.date  || cmToday();
          const type  = sessionInfo.sessionType || sessionType || 'training';
          const title = sessionInfo.title || `GPS import · ${date}`;
          // Resolve synchronously (match existing → else insert) instead of blindly inserting:
          // a rapid re-import could reach here with existingId still null (debounced UI lookup
          // unfinished) and create a duplicate session for a date that already had one.
          singleSessionId = await _gpResolveSessionId(date, type, title);
          sessionInfo.existingId = singleSessionId;
        }
      }

      // ── 2. Build insertable rows ───────────────────────────
      setStatus('Mapping rows…');
      const { insertable, extrasMap, skippedCells, warnings, attrsBySession } = buildInsertableRows(dateSessionMap, singleSessionId);

      if (!insertable.length) {
        finishWithError('No importable rows found — check player matching and column mapping.');
        return;
      }

      // Deduplicate: keep last row per (player_id, session_id) to avoid
      // "ON CONFLICT cannot affect row a second time" from Postgres
      const rowKey = r => `${r.player_id ?? '_'}__${r.session_id}`;
      const deduped = [...new Map(insertable.map(r => [rowKey(r), r])).values()];

      // ── 3. Upsert core rows → gps_reports (with RETURNING ids) ──
      const CHUNK = 500;
      let done = 0;
      setStatus('Saving GPS reports…', `0 / ${deduped.length}`);
      const allReturned = [];

      for (let i = 0; i < deduped.length; i += CHUNK) {
        const { data: returned, error } = await window.sb.from('gps_reports')
          .upsert(deduped.slice(i, i + CHUNK), { onConflict: 'player_id,session_id' })
          .select('id,player_id,session_id');
        if (error) throw error;
        if (returned) allReturned.push(...returned);
        done = Math.min(i + CHUNK, deduped.length);
        setStatus('Saving GPS reports…', `${done} / ${deduped.length}`);
      }

      // ── 3b. Upsert custom metrics → gps_report_metrics ───────
      const hasExtras = Object.keys(extrasMap).length > 0;
      if (hasExtras && allReturned.length) {
        setStatus('Saving custom metrics…');
        const metricRows = [];
        for (const report of allReturned) {
          const extras = extrasMap[rowKey(report)];
          if (!extras?.length) continue;
          for (const ex of extras) {
            metricRows.push({ report_id: report.id, club_id: clubId, metric_key: ex.metric_key, value: ex.value });
          }
        }
        for (let i = 0; i < metricRows.length; i += CHUNK) {
          const { error } = await window.sb.from('gps_report_metrics')
            .upsert(metricRows.slice(i, i + CHUNK), { onConflict: 'report_id,metric_key' });
          if (error) throw error;
        }
      }

      // ── 3c. Write session attributes → training_sessions ─────
      const attrSessionIds = Object.keys(attrsBySession);
      if (attrSessionIds.length) {
        setStatus('Saving session attributes…');
        for (const sid of attrSessionIds) {
          const newAttrs = attrsBySession[sid];
          if (!Object.keys(newAttrs).length) continue;
          const { data: existing } = await window.sb.from('training_sessions')
            .select('session_attributes').eq('id', sid).eq('club_id', clubId).single();
          const merged = { ...(existing?.session_attributes || {}), ...newAttrs };
          const { error } = await window.sb.from('training_sessions')
            .update({ session_attributes: merged }).eq('id', sid).eq('club_id', clubId);
          if (error) throw error;
        }
      }

      // ── 4. Persist external_gps_id ───────────────────────
      const extGpsIdMapped = Object.values(_wizState.columnMap).some(c => c.metric === 'player_external_gps_id');
      if (extGpsIdMapped) {
        const extUpdates = Object.entries(confirmedMap).filter(([rawKey, pid]) => {
          const pm = _wizState.playerMatches[rawKey];
          return pid && pm?.rawExtGpsId;
        });
        await Promise.all(extUpdates.map(([rawKey, pid]) => {
          const extId = _wizState.playerMatches[rawKey].rawExtGpsId;
          return window.sb.from('players').update({ external_gps_id: extId }).eq('id', pid).eq('club_id', clubId);
        }));
      }

      // ── 4b. Días con GPS sin Match Day / fuera de todo microciclo ─────────
      // Un día puede recibir datos GPS sin estar en un microciclo, o estando en uno pero sin un MD
      // derivable (sin partido ni override). No lo forzamos: sugerimos (a) crear/extender el MC en
      // Calendar si el día no cae en ninguno, o (b) asignar el MD en Daily Planning si cae en un MC
      // pero no hay MD. Dejarlo sin MD es decisión del usuario. El MD se DERIVA por fecha del MC
      // (mismo criterio que las cards): reusamos window._gpMcForDate / _gpMdDerived del filter bar.
      // Cuando se agregue el sync de proveedor (Catapult/StatSports) puede reusar este chequeo.
      let _mdGapDays = [], _noMcDays = [];
      try {
        const _impSids = isMultiMode ? [...new Set(Object.values(dateSessionMap))] : (singleSessionId ? [singleSessionId] : []);
        if (_impSids.length) {
          const { data: _sr } = await window.sb.from('training_sessions')
            .select('id, session_date, match_day_offset').in('id', _impSids);
          const _noMd  = (_sr || []).filter(r => r.match_day_offset == null);
          const _dates = [...new Set(_noMd.map(r => r.session_date))];
          if (_dates.length) {
            // MD guardado por un sibling del mismo día (Daily Planning) → ya cubierto.
            const { data: _sib } = await window.sb.from('training_sessions')
              .select('session_date').eq('club_id', clubId).in('session_date', _dates)
              .not('match_day_offset', 'is', null);
            const _withMd = new Set((_sib || []).map(s => s.session_date));
            const _mcFn = (typeof window !== 'undefined' && typeof window._gpMcForDate === 'function') ? window._gpMcForDate : null;
            const _mdFn = (typeof window !== 'undefined' && typeof window._gpMdDerived === 'function') ? window._gpMdDerived : null;
            _noMd.filter(r => !_withMd.has(r.session_date)).forEach(r => {
              const d = String(r.session_date).slice(0, 10);
              const md = _mdFn ? _mdFn(d) : '';
              if (md) return;                              // MD derivable del MC → ya aparece, no molestar
              const hasMc = _mcFn ? !!_mcFn(d) : null;     // null = no pudimos determinar (sin filter bar)
              if (hasMc === false) _noMcDays.push({ date: d, sessionId: r.id });   // fuera de todo MC
              else _mdGapDays.push({ date: d, sessionId: r.id });                  // en un MC (o desconocido), sin MD
            });
            _noMcDays.sort((a, b) => a.date.localeCompare(b.date));
            _mdGapDays.sort((a, b) => a.date.localeCompare(b.date));
          }
        }
      } catch (e) { console.warn('gps import MD/MC-gap detection:', e); }

      // ── 5. Success ────────────────────────────────────────
      document.getElementById('wizSpinner')?.remove();
      const sessionCount    = isMultiMode ? Object.keys(dateSessionMap).length : 1;
      const uniquePlayers   = new Set(deduped.map(r => r.player_id).filter(Boolean)).size;
      const sessionLabel    = isHistorical ? 'historical' : 'real';
      const customMetricCount = Object.values(extrasMap).reduce((n, arr) => n + arr.length, 0);
      const attrCount       = Object.values(attrsBySession).reduce((n, a) => n + Object.keys(a).length, 0);
      const warningLines    = [...warnings.slice(0, 5), ...(skippedCells ? [`${skippedCells} cell(s) skipped (invalid values)`] : [])];
      const firstSessionId  = isMultiMode ? (Object.values(dateSessionMap)[0] || null) : singleSessionId;
      const customLine      = customMetricCount
        ? ` · ${customMetricCount} custom metric value${customMetricCount !== 1 ? 's' : ''}` : '';
      const attrLine        = attrCount
        ? ` · ${attrCount} session attribute${attrCount !== 1 ? 's' : ''}` : '';

      document.getElementById('wizBody').innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 0;text-align:center">
          <i class="ti ti-circle-check" style="font-size:36px;color:var(--cm-success)"></i>
          <div>
            <div style="font:600 15px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong);margin-bottom:6px">Import complete</div>
            <div style="font:500 12.5px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted)">
              ${sessionCount} session${sessionCount!==1?'s':''} (${sessionLabel}) · ${deduped.length} GPS report${deduped.length!==1?'s':''}${customLine}${attrLine} · ${uniquePlayers} player${uniquePlayers!==1?'s':''}
            </div>
          </div>
          ${warningLines.length ? `
          <div style="width:100%;padding:8px 12px;background:rgba(245,158,11,.08);border:1px solid var(--cm-warning);border-radius:var(--cm-r-3);text-align:left">
            <div style="font:600 10.5px/1 var(--cm-font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--cm-warning);margin-bottom:5px">Warnings</div>
            ${warningLines.map(w => `<div style="font:500 11.5px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted)">${w}</div>`).join('')}
          </div>` : ''}
          ${_noMcDays.length ? `
          <div style="width:100%;padding:10px 12px;background:rgba(245,158,11,.08);border:1px solid var(--cm-warning);border-radius:var(--cm-r-3);text-align:left">
            <div style="display:flex;align-items:center;gap:6px;font:600 12px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong);margin-bottom:4px"><i class="ti ti-calendar-off" style="font-size:14px;color:var(--cm-warning)"></i>${_wt('gps_import.mc_gap_title','Days not in any microcycle')}</div>
            <div style="font:500 11.5px/1.45 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:7px">${_wt('gps_import.mc_gap_body','These days got GPS data but are not inside any microcycle, so no Match Day can be derived. Create or extend a microcycle in the Calendar to give them their MD.')}</div>
            <div style="font:500 11.5px/1.5 var(--cm-font-mono);color:var(--cm-fg-muted);margin-bottom:8px">${_noMcDays.map(d => d.date).join(' · ')}</div>
            <button class="cm-btn is-ghost is-sm" id="wizCreateMc" style="height:28px"><i class="ti ti-calendar-plus" style="font-size:12px"></i>${_wt('gps_import.mc_gap_cta','Open Calendar')}</button>
          </div>` : ''}
          ${_mdGapDays.length ? `
          <div style="width:100%;padding:10px 12px;background:var(--cm-accent-bg,rgba(59,130,246,.08));border:1px solid var(--cm-accent,#3b82f6);border-radius:var(--cm-r-3);text-align:left">
            <div style="display:flex;align-items:center;gap:6px;font:600 12px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong);margin-bottom:4px"><i class="ti ti-calendar-question" style="font-size:14px;color:var(--cm-accent,#3b82f6)"></i>${_wt('gps_import.md_gap_title','Days with GPS but no Match Day')}</div>
            <div style="font:500 11.5px/1.45 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:7px">${_wt('gps_import.md_gap_body','These days got GPS data but have no Match Day assigned yet. Assign one in Daily Planning, or leave them as they are.')}</div>
            <div style="font:500 11.5px/1.5 var(--cm-font-mono);color:var(--cm-fg-muted);margin-bottom:8px">${_mdGapDays.map(d => d.date).join(' · ')}</div>
            <button class="cm-btn is-ghost is-sm" id="wizAssignMd" style="height:28px"><i class="ti ti-clipboard-list" style="font-size:12px"></i>${_wt('gps_import.md_gap_cta','Assign in Daily Planning')}</button>
          </div>` : ''}
        </div>`;
      document.getElementById('wizFooter').innerHTML = `<div class="right"><button class="cm-btn is-primary is-sm" id="wizDone">Done</button></div>`;
      document.getElementById('wizDone').addEventListener('click', () => {
        document.getElementById('gpImportModal')?.remove();
        window.refreshDashboard?.({ sessionId: firstSessionId });
      });
      // Sugerencia: abrir Daily Planning en el primer día sin MD (con la sesión GPS ya resuelta),
      // para que el usuario le asigne el Match Day. No fuerza nada: puede ignorarlo y cerrar.
      document.getElementById('wizAssignMd')?.addEventListener('click', () => {
        const g = _mdGapDays[0]; if (!g) return;
        window.location.href = `Daily Planning.html?date=${g.date}${g.sessionId ? `&session=${g.sessionId}` : ''}`;
      });
      // Sugerencia: abrir Calendar en el mes del primer día sin microciclo, para crear/extender el MC.
      document.getElementById('wizCreateMc')?.addEventListener('click', () => {
        const g = _noMcDays[0]; if (!g) return;
        window.location.href = `Calendar.html?date=${g.date}`;
      });

      showToast(`Imported ${deduped.length} GPS reports · ${uniquePlayers} players · ${sessionCount} sessions`);
      window.dispatchEvent(new CustomEvent('gps:reports:updated', { detail: { clubId } }));

    } catch (e) {
      finishWithError('Error: ' + (e.message || String(e)));
    }
  }

  // ── Wire up Browse files button + drag-and-drop ────────────
  function initUploadHandlers() {
    const dropZone = document.querySelector('.gp-drop');
    if (!dropZone || dropZone.dataset.uploadInit) return;
    dropZone.dataset.uploadInit = '1';

    // Hidden file input — created once, never re-created
    const fileInput = Object.assign(document.createElement('input'), {
      type: 'file', accept: '.csv,.tsv,.xlsx,.xls', style: 'display:none',
    });
    document.body.appendChild(fileInput);

    const handleFile = f => { if (f) openImportWizard(f); };

    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      fileInput.value = ''; // reset so same file can be re-selected
      handleFile(f);
    });

    // Browse files button — cloneNode strips any pre-existing handlers
    const browseBtn = dropZone.querySelector('.cm-btn.is-outline');
    if (browseBtn) {
      const newBtn = browseBtn.cloneNode(true);
      browseBtn.replaceWith(newBtn);
      newBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
    }

    // Click on drop zone area (not on a button)
    dropZone.addEventListener('click', e => {
      if (e.target.closest('.cm-btn')) return;
      fileInput.click();
    });

    // Drag-and-drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt =>
      dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); })
    );
    dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      dropZone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
  }

  // Lazy-init when drawer opens
  const _origOpenSrc = window._gpOpenSrc;
  document.getElementById('srcBtn')?.addEventListener('click', () => {
    loadXLSX().catch(() => {});
    initUploadHandlers();
  }, { once: true });

  // Also init immediately in case drawer is already open
  document.addEventListener('DOMContentLoaded', () => initUploadHandlers(), { once: true });
  if (document.readyState !== 'loading') initUploadHandlers();

})();
