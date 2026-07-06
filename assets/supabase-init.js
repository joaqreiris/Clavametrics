// ClavaMetrics — Shared Supabase client + club context
// Include before any page logic:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="assets/supabase-init.js"></script>

(function () {
  const SB_URL = 'https://xesrumijvdmqjrufgeka.supabase.co';
  const SB_KEY = 'sb_publishable_p4DBCWsAm9u-Wf5-_CP-Yw_MYh_3cR6';

  window.sb = supabase.createClient(SB_URL, SB_KEY);

  // ── Paginated fetch — defeats PostgREST's server max-rows cap (≈1000) ──────────
  // The server silently truncates any query to ~1000 rows; client-side .limit(50000)
  // does NOT override it. This is the ONLY robust way to read >1000 rows: page through
  // with .range() until a short page comes back. CRITICAL for BI accuracy (squad/long-
  // range reads of gps_reports easily exceed 1000 rows → silently incomplete aggregates).
  //
  // Pass a FACTORY that builds a FRESH query each call (a query builder is single-use):
  //   const rows = await window.cmFetchAll(() =>
  //     window.sb.from('gps_reports').select('session_id,player_load').eq('club_id', cid));
  // Do NOT add .range()/.limit() yourself — the helper owns paging. Pass opts.orderBy
  // (default 'id') so ranges are CONSISTENT across pages (PostgREST needs an explicit
  // order with range, else pages can overlap/skip). Returns the full array (throws on the
  // first-page error; later-page errors stop paging and return what was gathered).
  // ── Instrumentation (perf audit) — cheap counters to measure round-trips ────────
  // Read with window.cmFetchStatsDump() in the console; reset with .reset(). One entry
  // per label: { calls, pages (round-trips), rows, ms }. Use to compare before/after a
  // dashboard load — the goal is fewer calls/pages/rows for the same view.
  const _stats = (window.__cmFetchStats = window.__cmFetchStats || {});
  window.cmFetchStatsDump = function () {
    const t = { calls: 0, pages: 0, rows: 0, ms: 0 };
    for (const k in _stats) { t.calls += _stats[k].calls; t.pages += _stats[k].pages; t.rows += _stats[k].rows; t.ms += _stats[k].ms; }
    console.table({ ..._stats, TOTAL: { ...t, ms: Math.round(t.ms) } });
    return _stats;
  };
  window.cmFetchStatsDump.reset = function () { for (const k in _stats) delete _stats[k]; };

  // ── GPS resolver cache invalidation ─────────────────────────────────────────────
  // The GPS dashboard shares one fetch across cards via window.__gpResolverCache
  // (getSessionIds/fetchReports keyed by club/team/scope/range/sessionIds). Call this
  // after anything that changes the underlying data — GPS import/sync, flag/un-flag a
  // report, assign rivals (creates sessions) — so the next dashboard refresh reads fresh
  // data instead of a cached promise. Safe no-op if the cache was never created. Does NOT
  // break cross-card sharing: the cache simply repopulates on the next resolve.
  window.cmInvalidateGpsCache = function () {
    try { window.__gpResolverCache && window.__gpResolverCache.clear(); } catch (e) { /* noop */ }
  };

  window.cmFetchAll = async function (queryFactory, opts) {
    const pageSize = (opts && opts.pageSize) || 1000;
    const maxPages = (opts && opts.maxPages) || 50;          // 50k-row safety ceiling
    const label    = (opts && opts.label)    || 'cmFetchAll';
    const orderBy  = (opts && 'orderBy' in opts) ? opts.orderBy : 'id';
    const _s = (_stats[label] = _stats[label] || { calls: 0, pages: 0, rows: 0, ms: 0 });
    const _t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
    _s.calls++;
    const all = [];
    for (let page = 0; page < maxPages; page++) {
      _s.pages++;
      const from = page * pageSize, to = from + pageSize - 1;
      let qb = queryFactory();
      if (orderBy) qb = qb.order(orderBy, { ascending: true });
      const { data, error } = await qb.range(from, to);
      if (error) {
        if (page === 0) throw error;                         // surface like a normal query
        console.error(`[cmFetchAll:${label}] page ${page} error — returning ${all.length} rows so far:`, error);
        break;
      }
      if (!data || !data.length) break;
      all.push(...data);
      if (data.length < pageSize) break;                     // short page → last page
      if (page === maxPages - 1) {
        console.warn(`[cmFetchAll:${label}] hit maxPages=${maxPages} (${all.length} rows) — result may be truncated`);
      }
    }
    _s.rows += all.length;
    if (_t0) _s.ms += performance.now() - _t0;
    return all;
  };

  let _clubId          = null;
  let _profile         = null;
  let _club            = null;
  let _clubIdPromise   = null;
  let _clubPromise     = null;

  window.getClubId = function () {
    if (_clubId) return Promise.resolve(_clubId);
    if (_clubIdPromise) return _clubIdPromise;
    _clubIdPromise = (async () => {
      // getUser() validates against the server — more reliable than getSession() (localStorage-only)
      const { data: { user }, error: authErr } = await window.sb.auth.getUser();
      if (authErr) console.warn('[supabase-init] getUser error:', authErr.message);
      if (!user) return null;
      // Override de super-admin: club activo elegido en el switcher
      const _ov = window.getActiveClubOverride && window.getActiveClubOverride();
      if (_ov && await window.isSuperAdmin()) {
        // Cargar tu profile REAL (tu id), independiente del club override
        if (!_profile) {
          const { data: realProf } = await window.sb.from('profiles')
            .select('club_id, role, full_name').eq('id', user.id).single();
          if (realProf) { _profile = realProf; window.__cm_profile = realProf; }
        }
        _clubId = _ov;
        return _clubId;
      }
      const { data: profile, error: profileErr } = await window.sb.from('profiles')
        .select('club_id, role, full_name')
        .eq('id', user.id)
        .single();
      if (profileErr) console.warn('[supabase-init] profile fetch error:', profileErr.message);
      if (profile) {
        _clubId  = profile.club_id;
        _profile = profile;
        window.__cm_profile = profile;
      }
      return _clubId;
    })();
    return _clubIdPromise;
  };

  window.getClub = function () {
    if (_club) return Promise.resolve(_club);
    if (_clubPromise) return _clubPromise;
    _clubPromise = (async () => {
      const clubId = await window.getClubId();
      if (!clubId) return null;
      const { data } = await window.sb.from('clubs')
        .select('id, name, country, primary_color, logo_url, created_at')
        .eq('id', clubId)
        .single();
      _club = data;
      return _club;
    })();
    return _clubPromise;
  };

  let _profilePromise = null;
  window.getProfile = function () {
    if (_profile) return Promise.resolve(_profile);
    if (_profilePromise) return _profilePromise;
    _profilePromise = window.getClubId().then(() => _profile);
    return _profilePromise;
  };

  let _superAdmin = null;
  window.isSuperAdmin = function () {
    if (_superAdmin !== null) return Promise.resolve(_superAdmin);
    return (async () => {
      try { const { data } = await window.sb.rpc('is_super_admin'); _superAdmin = !!data; }
      catch { _superAdmin = false; }
      return _superAdmin;
    })();
  };
  // Club activo elegido por un super-admin (override). Devuelve null si no aplica.
  window.getActiveClubOverride = function () {
    try { return sessionStorage.getItem('cm_active_club') || null; } catch { return null; }
  };
  window.setActiveClubOverride = function (clubId) {
    try { if (clubId) sessionStorage.setItem('cm_active_club', clubId); else sessionStorage.removeItem('cm_active_club'); } catch {}
    window.resetSupabaseCache();
  };

  window.resetSupabaseCache = function () {
    _clubId = null; _profile = null; _club = null;
    _clubIdPromise = null; _clubPromise = null; _profilePromise = null;
    _modPromise = null;
  };

  // ── Taxonomía única de secciones (consumida por sidebar + Admin) ──
  window.CM_SECTIONS = [
    { key:'planner',          href:'Planner.html',             icon:'ti-clipboard-list',    name:'Drill Designer',        feature:'drill_designer' },
    { key:'sessions-lib',     href:'Exercises Library.html',    icon:'ti-list-tree',         name:'Exercises Library',     feature:'sessions_library' },
    { key:'daily-planning',   href:'Daily Planning.html',      icon:'ti-soccer-field',      name:'Daily planning',        feature:'daily_planning' },
    { key:'sessions-history', href:'Sessions History.html',    icon:'ti-history',           name:'Sessions history',      feature:null },
    { key:'annual-planner',   href:'Annual Planner.html',      icon:'ti-calendar-stats',    name:'Annual Planner',        feature:'annual_planner' },
    { key:'squad',            href:'Squad.html',               icon:'ti-users-group',       name:'Squad',                 feature:'squad' },
    { key:'lineup',           href:'Lineup.html',              icon:'ti-clipboard-check',   name:'Lineup',                feature:'lineup' },
    { key:'availability',     href:'Availability.html',        icon:'ti-user-check',        name:'Availability',          feature:'availability' },
    { key:'evaluations',      href:'Evaluations.html',         icon:'ti-chart-dots',        name:'Evaluations',           feature:'evaluations' },
    { key:'match-reports',    href:'Match Reports.html',       icon:'ti-report-analytics',  name:'Match reports',         feature:'match_reports' },
    { key:'wellness',         href:'Wellness.html',            icon:'ti-heartbeat',         name:'Wellness',              feature:'wellness_capture' },
    { key:'rpe',              href:'RPE.html',                 icon:'ti-activity',          name:'RPE',                   feature:'rpe_capture' },
    { key:'load-monitor',     href:'Load Monitor.html',        icon:'ti-chart-line',        name:'Load monitor',          feature:'load_monitor' },
    { key:'gps',              href:'GPS Analysis.html',        icon:'ti-radar-2',           name:'GPS analysis',          feature:'gps_analysis' },
    { key:'gym-planner',      href:'Gym Planner.html',         icon:'ti-barbell',           name:'Gym planner',           feature:'gym' },
    { key:'individual-sc',    href:'Individual Plans.html',    icon:'ti-user-cog',          name:'Individual S&C',        feature:'individual_planner' },
    { key:'gym-library',      href:'Gym Library.html',         icon:'ti-books',             name:'Gym library',           feature:'gym' },
    { key:'nutrition',        href:'Nutrition.html',           icon:'ti-apple',             name:'Nutrition',             feature:'nutrition' },
    { key:'clinical',         href:'Clinical Records.html',    icon:'ti-clipboard-heart',   name:'Clinical records',      feature:null },
    { key:'injuries',         href:'Injuries.html',            icon:'ti-bandage',           name:'Injuries',              feature:'injuries' },
    { key:'treatments',       href:'Physio.html',              icon:'ti-stethoscope',       name:'Treatments',            feature:'physio' },
    { key:'rehab',            href:'Rehab & Preventives.html', icon:'ti-activity-heartbeat',name:'Rehab & preventives',   feature:'rehab_planner' },
    { key:'video-room',       href:'Video Room.html',          icon:'ti-video',             name:'Video Room',            feature:'video_room' },
  ];

  let _modPromise = null;
  // Devuelve { all:boolean, keys:Set } — admin/owner o sin filas asignadas => all:true (acceso completo)
  window.getMyModules = function () {
    if (_modPromise) return _modPromise;
    _modPromise = (async () => {
      try {
        const prof = await window.getProfile();
        const role = (prof?.role || '').toLowerCase();
        if (role === 'admin' || role === 'owner') return { all: true, keys: new Set() };
        const clubId = await window.getClubId();
        const { data: { user } } = await window.sb.auth.getUser();
        if (!clubId || !user) return { all: true, keys: new Set() }; // fail-open
        const { data } = await window.sb.from('member_modules')
          .select('module_key').eq('club_id', clubId).eq('profile_id', user.id);
        const rows = data || [];
        // '__managed__' es un centinela: su presencia = usuario GESTIONADO (restringido),
        // sin importar cuántas páginas tenga permitidas. No es en sí una página.
        const keys = new Set(rows.map(r => r.module_key).filter(k => k !== '__managed__'));
        return { all: rows.length === 0, keys }; // sin filas = no gestionado = acceso completo (fail-open)
      } catch (e) {
        return { all: true, keys: new Set() }; // ante error, no bloquear navegación
      }
    })();
    return _modPromise;
  };
  window.canAccess = async function (key) {
    const m = await window.getMyModules();
    return m.all || m.keys.has(key);
  };

  // ── Plan gating (entitlement por plan del club) ──────────────────
  // Eje SEPARADO de getMyModules (que es permiso por staff). Un módulo se
  // ve si pasa AMBOS candados: canAccess (RBAC) Y planAllows (plan del club).
  // INTERRUPTOR MAESTRO: mientras esté en false, planAllows() siempre da true
  // (el mecanismo queda armado pero no esconde nada). Prender cuando Paddle
  // esté vivo y los comps sembrados a clubes/testers.
  window.CM_PLAN_GATING_ENABLED = false;

  // Equipo activo global (lo setea el selector del sidebar y las páginas).
  // Fuente única de verdad para el gating per-team (Opción B).
  window.getActiveTeamId = function () {
    try {
      return sessionStorage.getItem('cal_active_team')
          || localStorage.getItem('cal_active_team')
          || null;
    } catch (e) { return null; }
  };

  let _planPromise = null;
  // Set de features a las que el club del usuario tiene derecho. Fail-open:
  // ante error devuelve null = "desconocido" → planAllows permite todo.
  window.getPlanFeatures = function () {
    if (_planPromise) return _planPromise;
    _planPromise = (async () => {
      try {
        const teamId = window.getActiveTeamId && window.getActiveTeamId();
        let data, error;
        if (teamId) {
          ({ data, error } = await window.sb.rpc('team_features', { p_team_id: teamId }));
        } else {
          // sin equipo activo (ej. página sin selector y storage vacío) → rollup del club
          ({ data, error } = await window.sb.rpc('my_plan_features'));
        }
        if (error || !Array.isArray(data)) return null; // fail-open
        return new Set(data);
      } catch (e) {
        return null; // ante error, no gatear
      }
    })();
    return _planPromise;
  };

  // ¿El plan del club permite este módulo? (por su key de CM_SECTIONS)
  window.planAllows = async function (key) {
    try {
      if (!window.CM_PLAN_GATING_ENABLED) return true;   // interruptor maestro OFF
      const sec = (window.CM_SECTIONS || []).find(s => s.key === key);
      const feat = sec ? sec.feature : null;
      if (!feat) return true;                            // sin feature = always-on
      const feats = await window.getPlanFeatures();
      if (!feats) return true;                           // fail-open
      return feats.has(feat);
    } catch (e) {
      return true;                                       // fail-open
    }
  };

  // Mapa archivo → key, derivado de CM_SECTIONS (decodifica %20, etc.)
  window.moduleKeyForPage = function (file) {
    const f = decodeURIComponent(file || (location.pathname.split('/').pop() || '')).toLowerCase();
    const hit = (window.CM_SECTIONS || []).find(s => decodeURIComponent(s.href).toLowerCase() === f);
    return hit ? hit.key : null;
  };

  // Guard: si el usuario no puede ver el módulo de ESTA página, lo manda a Hub.
  // Llamar al inicio del boot de cada página gateable: await window.guardModule();
  window.guardModule = async function (key) {
    try {
      const ok = await window.requireAuth('Login.html');
      if (!ok) return false;
      const k = key || window.moduleKeyForPage();
      if (!k) return true;                 // página no gateable → pasa
      if (!(await window.canAccess(k))) { window.location.replace('Hub.html'); return false; }   // RBAC
      if (!(await window.planAllows(k))) { window.location.replace('Plan Picker.html'); return false; } // plan
      return true;
    } catch (e) {
      return true;                         // fail-open: ante error no bloquear
    }
  };

  window.setClubLogo = function (url) {
    if (_club) _club.logo_url = url;
    document.dispatchEvent(new CustomEvent('clublogochanged', { detail: { logo_url: url } }));
  };

  window.requireAuth = async function (redirectTo = 'Login.html') {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) {
      window.location.replace(redirectTo);
      return false;
    }
    return true;
  };

  window.logout = async function (redirectTo = 'Login.html') {
    await window.sb.auth.signOut();
    _clubId = null; _profile = null; _club = null;
    _clubIdPromise = null; _clubPromise = null; _profilePromise = null;
    window.location.replace(redirectTo);
  };

  window.sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace('Login.html');
  });

  // ── Opponent crest helpers ─────────────────────────────────────────
  // Slug for Storage path: "Atlético Madrid" → "atletico-madrid"
  window.slugifyOpponent = function (name) {
    return (name || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'rival';
  };

  // 2-letter initials: "Real Madrid" → "RM"
  window.rivalInitials = function (name) {
    const words = (name || '').split(/\s+/).filter(Boolean);
    return words.length >= 2
      ? words.slice(0, 2).map(w => w[0].toUpperCase()).join('')
      : (name || '?').slice(0, 2).toUpperCase() || '?';
  };

  // Cached crest lookup: calendar_events.rival_crest_url → opponent_branding
  const _crestCache = new Map();

  window.getOpponentCrest = async function ({ clubId, opponentName, matchId } = {}) {
    const norm     = (opponentName || '').toLowerCase().trim();
    const nameKey  = `n|${clubId}|${norm}`;
    const matchKey = matchId ? `m|${matchId}` : null;

    if (matchKey && _crestCache.has(matchKey)) return _crestCache.get(matchKey);
    if (norm && _crestCache.has(nameKey))       return _crestCache.get(nameKey);

    // Per-match override wins
    if (matchId) {
      const { data } = await window.sb.from('calendar_events')
        .select('rival_crest_url').eq('id', matchId).maybeSingle();
      if (data?.rival_crest_url) {
        if (matchKey) _crestCache.set(matchKey, data.rival_crest_url);
        if (norm)     _crestCache.set(nameKey,  data.rival_crest_url);
        return data.rival_crest_url;
      }
    }

    // Fallback: opponent_branding (case-insensitive by opponent name)
    if (!norm || !clubId) return null;
    const { data } = await window.sb.from('opponent_branding')
      .select('crest_url').eq('club_id', clubId)
      .ilike('opponent_name', opponentName.trim()).maybeSingle();
    const url = data?.crest_url || null;
    _crestCache.set(nameKey, url);
    if (matchKey) _crestCache.set(matchKey, url);
    return url;
  };

  window.invalidateCrestCache = function (clubId, opponentName, matchId) {
    if (matchId) _crestCache.delete(`m|${matchId}`);
    if (clubId && opponentName) {
      _crestCache.delete(`n|${clubId}|${(opponentName || '').toLowerCase().trim()}`);
    }
  };

  // Returns active players for the club (excludes inactive), ordered by number.
  // Pass teamId to restrict to a specific team/category.
  window.getActivePlayers = async function (clubId, teamId) {
    // Con teamId filtramos por MEMBRESÍA (player_teams!inner), no por players.team_id (primario),
    // para que un player multi-categoría aparezca también en sus categorías secundarias.
    const sel = 'id,first_name,last_name,number,position,status,team_id'
      + (teamId ? ', player_teams!inner(team_id)' : '');
    let q = window.sb.from('players')
      .select(sel)
      .eq('club_id', clubId)
      .neq('status', 'inactive')
      .is('archived_at', null)
      .order('number');
    if (teamId) q = q.eq('player_teams.team_id', teamId);
    const { data } = await q;
    if (!data) return [];
    // Dedup por id por si el inner join devolviera filas repetidas, y quitar el
    // player_teams anidado para devolver exactamente los mismos campos que antes.
    const seen = new Set();
    const out = [];
    for (const p of data) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      delete p.player_teams;
      out.push(p);
    }
    return out;
  };

  // Roster de players por MEMBRESÍA (junction player_teams), no por players.team_id.
  // Así un player multi-categoría aparece también en sus categorías secundarias.
  // Devuelve un query builder de PostgREST (encadenable: .order, .in, .neq, etc.).
  // Pasar teamId para restringir a una categoría; sin teamId → todo el club.
  // El campo anidado player_teams en los resultados es inofensivo (se ignora).
  window.cmTeamPlayers = function (teamId, selectFields) {
    const sel = (selectFields || 'id') + ', player_teams!inner(team_id)';
    let q = window.sb.from('players').select(sel);
    if (teamId) q = q.eq('player_teams.team_id', teamId);
    else q = q.eq('club_id', _clubId);   // sin team → todo el club (club del contexto)
    q = q.is('archived_at', null);       // ocultar players archivados (soft-delete)
    return q;
  };

  // ── GPS per-minute profile: catálogo de métricas + preferencia del usuario ──
  // Las columnas vienen de v_exercise_gps_profile. `mult` lleva total_distance de
  // Preferencia compartida entre pantallas (Exercises Library + Drill Designer) vía
  // localStorage. Each metric carries two reads of the same drill: PER MINUTE
  // (intensity, key) and AVG TOTAL per session (volume, avgKey). All distances are
  // ALREADY stored in metres (gps_period_reports + the views), so mult:1 across the
  // board — total_distance no longer needs the legacy km→m ×1000.
  window.CM_GPS_METRICS = [
    { key:'total_distance_per_min',           label:'Total dist',  unit:'m/min',  mult:1,    dec:0,  avgKey:'total_distance_avg',           avgUnit:'m',  avgMult:1,    avgDec:0 },
    { key:'high_speed_distance_per_min',      label:'HSR',         unit:'m/min',  mult:1,    dec:1,  avgKey:'high_speed_distance_avg',      avgUnit:'m',  avgMult:1,    avgDec:0 },
    { key:'very_high_speed_distance_per_min', label:'VHSR',        unit:'m/min',  mult:1,    dec:1,  avgKey:'very_high_speed_distance_avg', avgUnit:'m',  avgMult:1,    avgDec:0 },
    { key:'sprint_distance_per_min',          label:'Sprint dist', unit:'m/min',  mult:1,    dec:1,  avgKey:'sprint_distance_avg',          avgUnit:'m',  avgMult:1,    avgDec:0 },
    { key:'hmld_per_min',                     label:'HMLD',        unit:'m/min',  mult:1,    dec:1,  avgKey:'hmld_avg',                     avgUnit:'m',  avgMult:1,    avgDec:0 },
    { key:'sprint_count_per_min',             label:'Sprints',     unit:'/min',   mult:1,    dec:2,  avgKey:'sprint_count_avg',             avgUnit:'',   avgMult:1,    avgDec:1 },
    { key:'accelerations_per_min',            label:'Accel',       unit:'/min',   mult:1,    dec:2,  avgKey:'accelerations_avg',            avgUnit:'',   avgMult:1,    avgDec:1 },
    { key:'decelerations_per_min',            label:'Decel',       unit:'/min',   mult:1,    dec:2,  avgKey:'decelerations_avg',            avgUnit:'',   avgMult:1,    avgDec:1 },
    { key:'player_load_per_min',              label:'Player load', unit:'AU/min', mult:1,    dec:1,  avgKey:'player_load_avg',              avgUnit:'AU', avgMult:1,    avgDec:1 },
  ];
  const _GPS_DEFAULT = ['total_distance_per_min','high_speed_distance_per_min','very_high_speed_distance_per_min','sprint_distance_per_min','player_load_per_min'];
  const _GPS_LS_KEY  = 'cm_gps_profile_metrics';

  // Claves seleccionadas (orden del catálogo). Fallback al default si vacío/inválido.
  window.cmGetGpsMetrics = function () {
    try {
      const v = JSON.parse(localStorage.getItem(_GPS_LS_KEY));
      if (Array.isArray(v)) {
        const valid = v.filter(k => window.CM_GPS_METRICS.some(m => m.key === k));
        if (valid.length) return window.CM_GPS_METRICS.map(m => m.key).filter(k => valid.includes(k));
      }
    } catch (_) {}
    return _GPS_DEFAULT.slice();
  };
  window.cmSetGpsMetrics = function (keys) { try { localStorage.setItem(_GPS_LS_KEY, JSON.stringify(keys)); } catch (_) {} };

  // Convierte una fila de v_exercise_gps_profile en celdas {l,v} de las métricas
  // elegidas. mode='avg' → AVG TOTAL (volume); cualquier otro → PER MINUTE.
  window.cmFormatGpsCells = function (row, mode) {
    const num = x => (x == null || x === '') ? null : Number(x);
    const avg = mode === 'avg';
    return window.cmGetGpsMetrics().map(k => {
      const m = window.CM_GPS_METRICS.find(x => x.key === k); if (!m) return null;
      const col  = avg ? m.avgKey  : m.key;
      const unit = avg ? m.avgUnit : m.unit;
      const mult = avg ? m.avgMult : m.mult;
      const dec  = avg ? m.avgDec  : m.dec;
      const raw = num(row[col]);
      return { l: m.label, v: raw == null ? '—' : `${(raw * mult).toFixed(dec)} ${unit}`.trim() };
    }).filter(Boolean);
  };

  // Popover de selección de métricas (compartido). onSaved() corre tras cada cambio.
  window.cmOpenGpsMetricPicker = function (anchorEl, onSaved) {
    document.getElementById('cmGpsPickerPop')?.remove();
    const sel = new Set(window.cmGetGpsMetrics());
    const pop = document.createElement('div');
    pop.id = 'cmGpsPickerPop';
    pop.style.cssText = 'position:fixed;z-index:10000;background:var(--cm-bg);border:1px solid var(--cm-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);padding:6px;min-width:210px;max-height:340px;overflow:auto';
    pop.innerHTML = `<div style="font:600 9px/1 var(--cm-font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cm-fg-muted);padding:6px 9px 7px">Metrics to show</div>` +
      window.CM_GPS_METRICS.map(m =>
        `<label style="display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:6px;cursor:pointer;font:500 12px var(--cm-font-sans);color:var(--cm-fg)">
          <input type="checkbox" value="${m.key}" ${sel.has(m.key) ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--cm-accent)">
          <span>${m.label} <span style="color:var(--cm-fg-faint);font:500 10px var(--cm-font-mono)">${m.unit}</span></span>
        </label>`).join('');
    document.body.appendChild(pop);
    const r = anchorEl.getBoundingClientRect();
    pop.style.top  = Math.max(8, Math.min(r.bottom + 4, window.innerHeight - pop.offsetHeight - 8)) + 'px';
    pop.style.left = Math.max(8, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    pop.querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) sel.add(cb.value); else sel.delete(cb.value);
      window.cmSetGpsMetrics(window.CM_GPS_METRICS.map(m => m.key).filter(k => sel.has(k)));
      if (onSaved) onSaved();
    }));
    setTimeout(() => {
      const close = e => { if (!pop.contains(e.target) && e.target !== anchorEl) { pop.remove(); document.removeEventListener('mousedown', close); } };
      document.addEventListener('mousedown', close);
    }, 0);
  };

  // Returns all teams for a club, ordered by name.
  window.getTeams = async function (clubId) {
    const { data } = await window.sb.from('teams')
      .select('id,name,season')
      .eq('club_id', clubId)
      .is('archived_at', null)
      .order('name');
    return data || [];
  };

  window.COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo (Brazzaville)","Congo (Kinshasa)","Costa Rica","Côte d'Ivoire","Croatia","Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"];

  // Populate a <select> with the country list. If `selected` isn't in the canonical
  // list (e.g. a legacy value like "Brasil"/"España"), it's kept so it still displays.
  window.fillCountrySelect = function (sel, selected, placeholder) {
    if (!sel) return;
    let list = window.COUNTRIES.slice();
    if (selected && !list.includes(selected)) list = [selected, ...list];
    const opts = [];
    if (placeholder) opts.push(`<option value="">${placeholder}</option>`);
    for (const c of list) opts.push(`<option value="${c}"${c === selected ? ' selected' : ''}>${c}</option>`);
    sel.innerHTML = opts.join('');
    if (selected) sel.value = selected;
  };

  // Returns "First Last" trimmed from a player row.
  window.formatPlayerName = function (player) {
    return `${player.first_name || ''} ${player.last_name || ''}`.trim();
  };

  // Applies club accent_color to --cm-accent CSS variable
  window.applyClubTheme = async function () {
    const club = await window.getClub();
    const hex = club?.primary_color;
    if (!hex) return;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const s = document.documentElement.style;
    s.setProperty('--cm-accent',     hex);
    s.setProperty('--cm-accent-rgb', `${r},${g},${b}`);
  };
})();
