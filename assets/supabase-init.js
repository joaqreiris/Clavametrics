// ClavaMetrics — Shared Supabase client + club context
// Include before any page logic:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="assets/supabase-init.js"></script>

(function () {
  const SB_URL = 'https://xesrumijvdmqjrufgeka.supabase.co';
  const SB_KEY = 'sb_publishable_p4DBCWsAm9u-Wf5-_CP-Yw_MYh_3cR6';

  window.sb = supabase.createClient(SB_URL, SB_KEY);

  // ── Local date helpers ────────────────────────────────────────────────────
  // Dates in the app are calendar dates (no time zone). "Today" must be the
  // USER'S LOCAL day, not UTC — `new Date().toISOString()` returns the UTC date,
  // which is a day behind for anyone east of UTC (e.g. Cambodia UTC+7 before 7am).
  // cmYMD(d) formats a Date as local YYYY-MM-DD; cmToday() is today, local.
  window.cmYMD = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };
  window.cmToday = function () { return window.cmYMD(new Date()); };

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
  // opts.concurrency (default 1 = sequential): >1 fetches pages after the first in parallel
  // batches — use on reads known to span many pages so wall time ≈ 2 round trips.
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
    // concurrency>1 (opt-in) fetches pages in parallel BATCHES after page 0: multi-page reads cost
    // ~2 round trips instead of N sequential ones. Page 0 always goes alone so small results (the
    // common case) never pay for speculative extra requests.
    const conc     = Math.max(1, (opts && opts.concurrency) || 1);
    const _s = (_stats[label] = _stats[label] || { calls: 0, pages: 0, rows: 0, ms: 0 });
    const _t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
    _s.calls++;
    const fetchPage = (page) => {
      _s.pages++;
      const from = page * pageSize, to = from + pageSize - 1;
      let qb = queryFactory();
      if (orderBy) qb = qb.order(orderBy, { ascending: true });
      return qb.range(from, to);
    };
    const all = [];
    let page = 0, done = false;
    while (!done && page < maxPages) {
      const n = (page === 0) ? 1 : Math.min(conc, maxPages - page);
      const results = await Promise.all(Array.from({ length: n }, (_, i) => fetchPage(page + i)));
      for (let i = 0; i < results.length; i++) {
        const { data, error } = results[i];
        if (error) {
          if (page + i === 0) throw error;                   // surface like a normal query
          console.error(`[cmFetchAll:${label}] page ${page + i} error — returning ${all.length} rows so far:`, error);
          done = true; break;
        }
        if (!data || !data.length) { done = true; break; }
        all.push(...data);
        if (data.length < pageSize) { done = true; break; }  // short page → last page
      }
      page += n;
      if (!done && page >= maxPages) {
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
  let _tzSynced        = false;

  // Persist the browser's IANA timezone (e.g. 'Europe/Madrid', 'Asia/Phnom_Penh') on the
  // user's profile so server-side jobs (birthday reminders, etc.) compute "today" against the
  // user's LOCAL calendar day instead of UTC. Fire-and-forget; only writes when it changed.
  function syncProfileTimezone(userId, current) {
    if (_tzSynced || !userId) return;
    _tzSynced = true;
    let tz;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return; }
    if (!tz || tz === current) return;
    window.sb.from('profiles').update({ timezone: tz }).eq('id', userId)
      .then(({ error }) => { if (error) console.warn('[supabase-init] timezone sync failed:', error.message); },
            () => {});
  }

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
            .select('club_id, role, club_role, full_name, first_name, last_name, email, job_title, avatar_url, onboarded, timezone').eq('id', user.id).single();
          if (realProf) { _profile = realProf; window.__cm_profile = realProf; syncProfileTimezone(user.id, realProf.timezone); }
        }
        _clubId = _ov;
        return _clubId;
      }
      const { data: profile, error: profileErr } = await window.sb.from('profiles')
        .select('club_id, role, club_role, full_name, first_name, last_name, email, job_title, avatar_url, onboarded, timezone')
        .eq('id', user.id)
        .single();
      if (profileErr) console.warn('[supabase-init] profile fetch error:', profileErr.message);
      if (profile) {
        _clubId  = profile.club_id;
        _profile = profile;
        window.__cm_profile = profile;
        syncProfileTimezone(user.id, profile.timezone);
      }
      return _clubId;
    })();
    // Un null NO se cachea: si la sesión todavía no estaba restaurada (getUser sin user) o el
    // fetch del profile falló, la promesa cacheada dejaría el club en null para toda la vida de
    // la página (→ páginas sin equipos, inserts con team_id null que RLS rechaza). Al resolver
    // null soltamos la promesa para que el próximo getClubId() reintente de verdad.
    _clubIdPromise = _clubIdPromise.then(
      id => { if (!id) _clubIdPromise = null; return id; },
      err => { _clubIdPromise = null; throw err; }
    );
    return _clubIdPromise;
  };

  window.getClub = function () {
    if (_club) return Promise.resolve(_club);
    if (_clubPromise) return _clubPromise;
    _clubPromise = (async () => {
      const clubId = await window.getClubId();
      if (!clubId) return null;
      const { data } = await window.sb.from('clubs')
        .select('id, name, country, primary_color, logo_url, created_at, sport')
        .eq('id', clubId)
        .single();
      _club = data;
      // Cache de identidad para el primer pintado. Sin esto, cada carga
      // arranca con el acento por defecto, el nombre vacío y sin escudo, y
      // todo salta cuando llega esta respuesta: el usuario ve la marca
      // cambiar delante suyo. boot-brand.js lo lee de forma síncrona en el
      // <head>, antes del primer frame.
      try {
        if (_club) {
          localStorage.setItem('cm_brand_cache', JSON.stringify({
            id: _club.id, name: _club.name,
            primary_color: _club.primary_color, logo_url: _club.logo_url
          }));
        }
      } catch (_) {}
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

  // ── Club product feature flags ───────────────────────────────────────────────
  // A THIRD gating axis, distinct from plan/billing (getPlanFeatures/planAllows) and generic
  // config (club_settings): switches experimental product behaviour on/off per club. Model is
  // "global default in code + per-club override in club_feature_flags":
  //   value(key) = per-club override (if a row exists) ?? CM_DEFAULT_FLAGS[key].enabled ?? false
  // Roll a beta to one club → insert an override row; ship it to everyone → flip the code default;
  // let a club opt out later → insert a disabled override. FAIL-CLOSED on purpose (unlike plan
  // gating): an unknown key or a failed fetch must NOT leak a half-baked feature to every club.
  const CM_DEFAULT_FLAGS = {
    // E:P (Entrenamiento:Partido) target bands in GPS Analysis "× Match avg" card.
    // config.bands[metric] = [lower, upper] weekly-accumulated ÷ match-reference ratio.
    // Only accumulable metrics; peaks (max_speed…) have no band. Per-club override merges.
    gps_ep_ratio: {
      enabled: false,
      config: {
        bands: {
          total_distance:          [2.5, 3.5],
          high_speed_distance:     [2.0, 2.5],
          very_high_speed_distance:[2.0, 2.5],
          sprint_distance:         [1.5, 2.5],
          accelerations:           [2.6, 3.05],
          decelerations:           [2.6, 3.05],
          player_load:             [2.5, 3.5],
          hmld:                    [2.0, 2.5],
        },
      },
    },
  };
  let _flagsPromise = null;
  let _flagsMap     = null;   // flag_key → { enabled, config } — per-club OVERRIDES only
  window.getClubFlags = function () {
    if (_flagsMap) return Promise.resolve(_flagsMap);
    if (_flagsPromise) return _flagsPromise;
    _flagsPromise = (async () => {
      try {
        const clubId = await window.getClubId();
        if (!clubId) { _flagsPromise = null; return {}; }   // no club yet → only code defaults; retry later
        const { data, error } = await window.sb.from('club_feature_flags')
          .select('flag_key, enabled, config').eq('club_id', clubId);
        if (error || !Array.isArray(data)) { _flagsPromise = null; return {}; } // fail-closed now, retry next call
        const m = {};
        for (const r of data) m[r.flag_key] = { enabled: !!r.enabled, config: r.config || {} };
        _flagsMap = m;
        return m;
      } catch (_e) { _flagsPromise = null; return {}; }
    })();
    return _flagsPromise;
  };
  const _flagDefault = k => !!(CM_DEFAULT_FLAGS[k] && CM_DEFAULT_FLAGS[k].enabled);
  const _flagCfgBase = k => (CM_DEFAULT_FLAGS[k] && CM_DEFAULT_FLAGS[k].config) || {};
  // Async truth: override row wins, else code default, else false.
  window.clubHasFlag = async function (key) {
    const m = await window.getClubFlags();
    if (m && Object.prototype.hasOwnProperty.call(m, key)) return m[key].enabled;
    return _flagDefault(key);
  };
  window.clubFlagConfig = async function (key) {
    const m = await window.getClubFlags();
    return Object.assign({}, _flagCfgBase(key), (m && m[key] && m[key].config) || {});
  };
  // Sync accessors for render loops — meaningful only AFTER getClubFlags() has resolved once;
  // before that they return the code default (fail-closed). Call getClubFlags() during page init.
  window.clubFlagSync = function (key) {
    if (_flagsMap && Object.prototype.hasOwnProperty.call(_flagsMap, key)) return _flagsMap[key].enabled;
    return _flagDefault(key);
  };
  window.clubFlagConfigSync = function (key) {
    return Object.assign({}, _flagCfgBase(key), (_flagsMap && _flagsMap[key] && _flagsMap[key].config) || {});
  };

  // ── Shared display helpers (names + avatars) ─────────────────────────────────
  // One place decides how a person is shown across the app: never the raw email as a
  // name, photos when available (private 'profile-avatars' bucket, signed URLs cached),
  // initials otherwise. All are null-safe and never throw.
  function _cmEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  // Best display name: full_name → "first last" → local part of the email (never the full email).
  window.cmDisplayName = function (p) {
    try {
      if (!p || typeof p !== 'object') return typeof p === 'string' ? p : '';
      let cand = (p.full_name || '').trim();
      if (!cand) cand = ((p.first_name || '').trim() + ' ' + (p.last_name || '').trim()).trim();
      if (!cand) cand = (p.email || '').trim();
      // Never surface a raw full email as a display name — even if full_name itself IS an
      // email (some legacy signups stored the email as full_name). Fall back to its local part.
      if (cand.includes('@')) cand = cand.split('@')[0];
      return cand;
    } catch (_e) { return ''; }
  };
  // 1–2 letter initials from a display name or a profile-like object.
  window.cmInitials = function (x) {
    try {
      const name = (typeof x === 'string' ? x : window.cmDisplayName(x || {}) || '').trim();
      if (!name) return '?';
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } catch (_e) { return '?'; }
  };
  // Resolve a usable avatar URL. Full URL → as-is. Storage path → signed URL from
  // 'profile-avatars' (cached ~55 min; async — returns cached/null now, fills for next render).
  const _cmSignedCache = new Map();   // path → { url, exp }
  window.cmAvatarUrl = function (p) {
    try {
      if (!p || typeof p !== 'object') return null;
      const a = (p.avatar_url || '').trim();
      if (!a) return null;
      if (/^(https?:|data:|blob:)/i.test(a)) return a;         // already a full/usable URL
      const c = _cmSignedCache.get(a);
      if (c && c.exp > Date.now()) return c.url;
      if (window.sb && window.sb.storage) {                    // fire-and-forget resolve for next render
        window.sb.storage.from('profile-avatars').createSignedUrl(a, 3600)
          .then(({ data }) => { if (data && data.signedUrl) _cmSignedCache.set(a, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 }); })
          .catch(() => {});
      }
      return (c && c.url) || null;
    } catch (_e) { return null; }
  };
  // Self-contained avatar chip (inline-styled → renders correctly on any page): <img> when a
  // photo exists, else an initials circle. Class hooks: .cm-ava / .cm-ava-img / .cm-ava-ini.
  window.cmAvatarHtml = function (p, size) {
    try {
      const s = Math.max(16, parseInt(size, 10) || 32);
      const url = window.cmAvatarUrl(p);
      const name = window.cmDisplayName(p || {});
      const box = `display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:${s}px;height:${s}px;border-radius:50%;overflow:hidden;vertical-align:middle`;
      if (url) {
        return `<span class="cm-ava cm-ava-img" title="${_cmEsc(name)}" style="${box};border:1px solid var(--cm-border)">`
          + `<img src="${_cmEsc(url)}" alt="${_cmEsc(name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.classList.add('cm-ava-broken');this.remove()"></span>`;
      }
      const fs = Math.max(9, Math.round(s * 0.42));
      return `<span class="cm-ava cm-ava-ini" title="${_cmEsc(name)}" style="${box};background:var(--cm-bg-sunk);border:1px solid var(--cm-border);color:var(--cm-fg);font:600 ${fs}px/1 var(--cm-font-sans,sans-serif)">${_cmEsc(window.cmInitials(name || p || {}))}</span>`;
    } catch (_e) { return ''; }
  };

  // ── Player photos (players.photo_url → public URL in the 'player-photos' bucket) ──────────
  // Unlike staff avatars (profile-avatars, signed), player photos are plain public URLs. We keep a
  // per-club id→url cache so any page can paint a face over its existing initials avatar without
  // having to change its own DB query — just prime the cache once (cmLoadPlayerPhotos) in boot.
  const _cmPlayerPhotoCache = new Map();      // String(playerId) → url ('' = known, no photo)
  let _cmPlayerPhotoClub = null;
  let _cmPlayerPhotoPromise = null;
  // Load every player's photo_url for a club once and cache it by id. Safe to call repeatedly.
  window.cmLoadPlayerPhotos = function (clubId) {
    try {
      if (!clubId || !window.sb) return Promise.resolve(_cmPlayerPhotoCache);
      if (_cmPlayerPhotoClub === clubId && _cmPlayerPhotoPromise) return _cmPlayerPhotoPromise;
      _cmPlayerPhotoClub = clubId;
      _cmPlayerPhotoPromise = window.sb.from('players').select('id,photo_url').eq('club_id', clubId)
        .then(({ data }) => {
          (data || []).forEach(r => { if (r && r.id != null) _cmPlayerPhotoCache.set(String(r.id), (r.photo_url || '').trim()); });
          return _cmPlayerPhotoCache;
        })
        .catch(() => _cmPlayerPhotoCache);
      return _cmPlayerPhotoPromise;
    } catch (_e) { return Promise.resolve(_cmPlayerPhotoCache); }
  };
  // Resolve a player's photo URL from either a player-like object (photo_url) or a bare id (cache).
  window.cmPlayerPhotoUrl = function (x) {
    try {
      if (x && typeof x === 'object') {
        const u = (x.photo_url || x.photoUrl || '').trim();
        if (/^(https?:|data:|blob:)/i.test(u)) return u;
        if (x.id != null && _cmPlayerPhotoCache.has(String(x.id))) return _cmPlayerPhotoCache.get(String(x.id)) || '';
        return '';
      }
      if (x != null) return _cmPlayerPhotoCache.get(String(x)) || '';
      return '';
    } catch (_e) { return ''; }
  };
  // Inline CSS declarations that paint the player's photo as a cover background over an existing
  // circular avatar element (hiding its initials via transparent text). Empty string when there's
  // no photo → the element keeps showing its initials. Accepts an id or a player-like object.
  // Use this for static/one-shot markup; for anything re-rendered, prefer the data-cm-photo path.
  window.cmPlayerPhotoCss = function (x) {
    const u = window.cmPlayerPhotoUrl(x);
    if (!u) return '';
    return `background-image:url('${String(u).replace(/'/g, "%27")}');background-size:cover;background-position:center center;background-repeat:no-repeat;color:transparent;`;
  };

  // Timing-proof rollout: a page just adds `data-cm-photo="<playerId>"` to its existing initials
  // avatar element and calls cmLoadPlayerPhotos(clubId) once. The painter below fills in the face
  // as soon as BOTH the element and the cached URL exist — order doesn't matter — and a global
  // observer repaints avatars produced by later re-renders. The photo is preloaded first, so a
  // broken/404 URL silently leaves the initials in place instead of an empty circle.
  function _cmPaintPhotoEl(el) {
    try {
      if (!el || el.__cmPhotoDone) return;
      const id = el.getAttribute('data-cm-photo');
      if (id == null || id === '') return;
      if (!_cmPlayerPhotoCache.has(String(id))) return;   // cache not loaded for this id yet
      const url = _cmPlayerPhotoCache.get(String(id)) || '';
      el.__cmPhotoDone = true;                             // resolved (present or absent)
      if (!url) return;                                    // no photo → keep initials
      const probe = new Image();
      const keepText = el.hasAttribute('data-cm-photo-keep-text');   // e.g. pitch tokens: face + jersey number
      probe.onload = function () {
        el.style.backgroundImage = `url('${String(url).replace(/'/g, "%27")}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center center';
        el.style.backgroundRepeat = 'no-repeat';
        if (!keepText) { el.style.color = 'transparent'; el.style.textShadow = 'none'; }
        el.classList.add('cm-has-photo');
      };
      probe.onerror = function () { el.__cmPhotoDone = false; };   // let a later pass retry
      probe.src = url;
    } catch (_e) { }
  }
  // Paint every data-cm-photo element under `root` (default: whole document).
  window.cmPaintPlayerPhotos = function (root) {
    try {
      (root || document).querySelectorAll('[data-cm-photo]').forEach(_cmPaintPhotoEl);
    } catch (_e) { }
  };
  let _cmPhotoObs = null, _cmPhotoObsQueued = false;
  function _cmEnsurePhotoObserver() {
    try {
      if (_cmPhotoObs || typeof MutationObserver === 'undefined' || !document.body) return;
      _cmPhotoObs = new MutationObserver(function () {
        if (_cmPhotoObsQueued) return;
        _cmPhotoObsQueued = true;
        const run = function () { _cmPhotoObsQueued = false; window.cmPaintPlayerPhotos(document); };
        (window.requestAnimationFrame || function (f) { setTimeout(f, 32); })(run);
      });
      _cmPhotoObs.observe(document.body, { childList: true, subtree: true });
    } catch (_e) { }
  }
  // Repaint whenever the cache finishes loading, wiring the observer for future re-renders.
  const _cmLoadPlayerPhotosRaw = window.cmLoadPlayerPhotos;
  window.cmLoadPlayerPhotos = function (clubId) {
    const p = _cmLoadPlayerPhotosRaw(clubId);
    p.then(function () { _cmEnsurePhotoObserver(); window.cmPaintPlayerPhotos(document); }).catch(function () { });
    return p;
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
    try {
      if (clubId) sessionStorage.setItem('cm_active_club', clubId);
      else sessionStorage.removeItem('cm_active_club');
      // Al cambiar de club el equipo activo del club anterior queda stale y filtraría
      // por un equipo ajeno (Squad/Calendar/GPS verían vacío). Lo descartamos para que
      // cada página re-resuelva el equipo por defecto del club nuevo (sidebar → teams[0]).
      sessionStorage.removeItem('cal_active_team');
      localStorage.removeItem('cal_active_team');
    } catch {}
    window.resetSupabaseCache();
  };

  window.resetSupabaseCache = function () {
    _clubId = null; _profile = null; _club = null;
    _clubIdPromise = null; _clubPromise = null; _profilePromise = null;
    _modPromise = null;
    _flagsMap = null; _flagsPromise = null;
    _planPromise = null;
    try { Object.keys(sessionStorage).forEach(k => { if (k.indexOf('cm_pf_') === 0) sessionStorage.removeItem(k); }); } catch (_) {}
    // El cache de marca es de ESTE club: al cambiar de club o cerrar sesión hay
    // que soltarlo, si no el arranque siguiente pinta el escudo del club anterior.
    try { localStorage.removeItem('cm_brand_cache'); } catch (_) {}
  };

  // ── Taxonomía única de secciones (consumida por sidebar + Admin) ──
  window.CM_SECTIONS = [
    { key:'chat-tasks',       href:'Chat & Tasks.html',        icon:'ti-message-circle',    name:'Chat & tasks',          feature:'chat_tasks' },
    { key:'planner',          href:'Planner.html',             icon:'ti-clipboard-list',    name:'Drill Designer',        feature:'drill_designer' },
    { key:'sessions-lib',     href:'Exercises Library.html',    icon:'ti-list-tree',         name:'Exercises Library',     feature:'sessions_library' },
    { key:'daily-planning',   href:'Daily Planning.html',      icon:'ti-soccer-field',      name:'Daily planning',        feature:'daily_planning' },
    { key:'tactical-planning',href:'Tactical Planning.html',   icon:'ti-target',            name:'Tactical planning',     feature:null },
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
    { key:'individual-sc',    href:'Individual Planner.html',  icon:'ti-user-cog',          name:'Individual S&C',        feature:'individual_planner' },
    { key:'top-up',           href:'Top-Up.html',              icon:'ti-run',               name:'Top-Up',                feature:'topup' },
    { key:'gym-library',      href:'Gym Library.html',         icon:'ti-books',             name:'Gym library',           feature:'gym' },
    { key:'nutrition',        href:'Nutrition.html',           icon:'ti-apple',             name:'Nutrition',             feature:'nutrition' },
    { key:'clinical',         href:'Clinical Records.html',    icon:'ti-clipboard-heart',   name:'Clinical records',      feature:null },
    { key:'injuries',         href:'Injuries.html',            icon:'ti-bandage',           name:'Injuries',              feature:'injuries' },
    { key:'treatments',       href:'Physio.html',              icon:'ti-stethoscope',       name:'Treatments',            feature:'physio' },
    { key:'rehab',            href:'Rehab & Preventives.html', icon:'ti-activity-heartbeat',name:'Rehab & preventives',   feature:'rehab_planner' },
    { key:'video-room',       href:'Video Room.html',          icon:'ti-video',             name:'Video Room',            feature:'video_room' },
    { key:'club-overview',    href:'Club Overview.html',       icon:'ti-layout-dashboard',  name:'Club overview',         feature:'club_overview' },
  ];

  let _modPromise = null;
  // Devuelve { all:boolean, keys:Set } — admin/owner o sin filas asignadas => all:true (acceso completo)
  window.getMyModules = function () {
    if (_modPromise) return _modPromise;
    _modPromise = (async () => {
      try {
        const prof = await window.getProfile();
        // Dual-role: full access if EITHER role (primary or secondary) is admin/owner.
        if (window.cmFullAccess(prof)) return { all: true, keys: new Set() };
        // Super-admin de plataforma: bypass total en CUALQUIER club (su profiles.role
        // en un club ajeno no es admin/owner, pero la RLS ya lo exceptúa vía is_super_admin()).
        try { if (await window.isSuperAdmin()) return { all: true, keys: new Set() }; } catch (_) {}
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
  // INTERRUPTOR MAESTRO: en false, planAllows() siempre da true (armado pero no
  // esconde nada). ENCENDIDO 2026-08-11 (Bloque B, Parte 1): Paddle vivo + comps
  // sembrados (MOI/RC Celta full). El candado del navegador ya restringe por plan.
  // OJO: sigue siendo client-only y fail-open; el enforcement server-side (RLS)
  // es la Parte 2. El super admin overridea con grant_comp_subscription(_club).
  window.CM_PLAN_GATING_ENABLED = true;

  // Equipo activo global (lo setea el selector del sidebar y las páginas).
  // Fuente única de verdad para el gating per-team (Opción B).
  window.getActiveTeamId = function () {
    try {
      return sessionStorage.getItem('cal_active_team')
          || localStorage.getItem('cal_active_team')
          || null;
    } catch (e) { return null; }
  };

  // Política de visibilidad de ejercicios del drill designer: un ejercicio se ve para un
  // equipo solo si es su equipo de origen o está compartido con él (visible_teams).
  // visible_teams NULL/[] = compartido con todo el club ("todas las categorías", elección
  // explícita del creador). Sin equipo activo (teamId null) no se oculta nada.
  window.cmExVisibleForTeam = function (ex, teamId) {
    if (!teamId || !ex) return true;
    if (ex.origin_team_id === teamId) return true;
    const vt = ex.visible_teams;
    if (!vt || vt.length === 0) return true;
    return vt.includes(teamId);
  };

  let _planPromise = null;
  // Clave de caché de features por equipo activo (o club si no hay equipo).
  function _pfCacheKey() {
    try { return 'cm_pf_' + ((window.getActiveTeamId && window.getActiveTeamId()) || 'club'); }
    catch (_) { return 'cm_pf_club'; }
  }
  // Set de features a las que el club del usuario tiene derecho. FAIL-CLOSED:
  // ante error, usa el último set conocido (cache de sesión) si existe; si no,
  // devuelve Set vacío → planAllows niega los módulos pagos (no los abre).
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
        if (error || !Array.isArray(data)) {
          try { const c = sessionStorage.getItem(_pfCacheKey()); if (c) return new Set(JSON.parse(c)); } catch (_) {}
          return new Set(); // fail-closed
        }
        try { sessionStorage.setItem(_pfCacheKey(), JSON.stringify(data)); } catch (_) {}
        return new Set(data);
      } catch (e) {
        try { const c = sessionStorage.getItem(_pfCacheKey()); if (c) return new Set(JSON.parse(c)); } catch (_) {}
        return new Set(); // fail-closed
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
      return !!(feats && feats.has(feat));               // fail-closed: sin set → niega
    } catch (e) {
      return false;                                      // fail-closed
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
      if (!(await window.canAccess(k))) {
        try { sessionStorage.setItem('cm_denied', k); } catch (_) {}   // Hub shows a notice on arrival
        window.location.replace('Hub.html'); return false;             // RBAC
      }
      if (!(await window.planAllows(k))) {
        // Feature paga bloqueada: si hay teaser configurado, mostramos el "preview
        // difuminado" con CTA (convierte más que patear al Plan Picker pelado).
        if (window.cmFeatureTeaser && window.cmFeatureTeaser(k)) return false;
        window.location.replace('Plan Picker.html'); return false;   // plan (sin teaser)
      }
      return true;
    } catch (e) {
      return true;                         // fail-open: ante error no bloquear
    }
  };

  // ── Upsell modal reutilizable (venta contextual al tocar un límite) ─────────
  // window.cmUpsell({ title, body, cta, teamId }) → modal con CTA a Plan Picker.
  // Se usa cuando el free/basic toca el tope de jugadores o staff.
  window.cmUpsell = function (opts) {
    opts = opts || {};
    var t = (window.CM_I18N && CM_I18N.t) ? function (k, f, v) { var r = CM_I18N.t(k, v); return (r && r !== k) ? r : f; } : function (k, f) { return f; };
    if (document.getElementById('cm-upsell-overlay')) return;
    var href = 'Plan Picker.html' + (opts.teamId ? ('?team=' + encodeURIComponent(opts.teamId)) : '');
    var st = document.createElement('style');
    st.id = 'cm-upsell-style';
    st.textContent = '#cm-upsell-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(10,12,16,.5);backdrop-filter:blur(6px);padding:24px}'
      + '#cm-upsell-card{width:100%;max-width:420px;background:var(--cm-bg-elevated,var(--cm-surface,#fff));color:var(--cm-fg-strong,#0f1115);border:1px solid var(--cm-border,rgba(0,0,0,.08));border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.3);padding:28px 26px 22px;text-align:center}'
      + '#cm-upsell-card .ic{width:54px;height:54px;border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:color-mix(in srgb,var(--cm-accent,#2da866) 14%,transparent);color:var(--cm-accent,#2da866)}'
      + '#cm-upsell-card h3{margin:0 0 8px;font-size:19px;font-weight:700}'
      + '#cm-upsell-card p{margin:0 0 22px;font-size:14px;line-height:1.5;color:var(--cm-fg-muted,#5b6472)}'
      + '#cm-upsell-card .cta{display:inline-flex;align-items:center;gap:8px;justify-content:center;width:100%;padding:12px 16px;border:0;border-radius:10px;background:var(--cm-accent,#2da866);color:#fff;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none}'
      + '#cm-upsell-card .later{margin-top:12px;background:none;border:0;color:var(--cm-fg-faint,#8a93a0);font-size:13px;cursor:pointer}';
    document.head.appendChild(st);
    var ov = document.createElement('div');
    ov.id = 'cm-upsell-overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div id="cm-upsell-card"><div class="ic"><i class="ti ti-rocket"></i></div><h3 data-u-title></h3><p data-u-body></p>'
      + '<a class="cta" href="' + href + '"><i class="ti ti-arrow-up"></i><span data-u-cta></span></a>'
      + '<div><button type="button" class="later" data-u-later></button></div></div>';
    ov.querySelector('[data-u-title]').textContent = opts.title || t('upsell.title', 'Upgrade your plan');
    ov.querySelector('[data-u-body]').textContent  = opts.body  || t('upsell.body', 'You reached your plan limit. Upgrade to add more.');
    ov.querySelector('[data-u-cta]').textContent   = opts.cta   || t('upsell.cta', 'See plans');
    ov.querySelector('[data-u-later]').textContent = t('upsell.later', 'Not now');
    function close() { ov.remove(); var s = document.getElementById('cm-upsell-style'); if (s) s.remove(); }
    ov.querySelector('.later').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    document.body.appendChild(ov);
  };
  // ¿El error de una operación es un límite de plan? (trigger de jugadores)
  window.cmIsLimitError = function (err) {
    var m = (err && (err.message || err.error_description || err.details || '')) + '';
    return m.indexOf('PLAYER_LIMIT_REACHED') !== -1;
  };

  window.setClubLogo = function (url) {
    if (_club) _club.logo_url = url;
    // Mantener el cache de marca al día, si no el próximo arranque pinta el
    // escudo anterior antes de corregirse.
    try {
      const c = JSON.parse(localStorage.getItem('cm_brand_cache') || 'null');
      if (c) { c.logo_url = url; localStorage.setItem('cm_brand_cache', JSON.stringify(c)); }
    } catch (_) {}
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

  // ── Notification recipients by role bucket ──────────────────────────────────
  // Mirrors the SQL role_bucket() mapping (db/schema.sql). Keep both in sync when
  // roles change. Buckets: 'admin' (owner/admin), 'medical' (medical/physio/doctor/
  // nutritionist), 'sc' (sc_coach/fitness_coach), 'coach' (coach/assistant_coach/
  // gk_coach), 'analyst', 'staff' (anything else).
  window.cmRoleBucket = function (role) {
    switch ((role || '').toLowerCase()) {
      case 'owner': case 'admin': return 'admin';
      case 'medical': case 'physio': case 'doctor': case 'nutritionist': return 'medical';
      case 'sc_coach': case 'fitness_coach': return 'sc';
      case 'coach': case 'assistant_coach': case 'gk_coach': return 'coach';
      case 'analyst': return 'analyst';
      case 'director_football': case 'head_performance': case 'methodology_director': case 'team_manager': return 'direction';
      default: return 'staff';
    }
  };
  // ── Dual-role support ────────────────────────────────────────────────────────
  // A member's effective access = UNION of their primary (role) and secondary
  // (club_role) roles, so a "nutritionist + physio" gets both roles' abilities.
  // Prefer these over the `(profile.role || profile.club_role)` idiom, which only
  // ever reads the primary role and silently drops the secondary one.
  window.cmRoleBuckets = function (profile) {
    var s = new Set();
    if (profile) [profile.role, profile.club_role].forEach(function (r) { if (r) s.add(window.cmRoleBucket(r)); });
    return s;
  };
  window.cmHasBucket  = function (profile, bucket) { return window.cmRoleBuckets(profile).has(bucket); };
  // Full (admin/owner) access if EITHER role maps to the admin bucket.
  window.cmFullAccess = function (profile) { return window.cmRoleBuckets(profile).has('admin'); };
  // ── Tactical Planning access ─────────────────────────────────────────────────
  // Visible SOLO para cuerpo técnico (coach/assistant_coach/gk_coach), preparación
  // física (sc_coach/fitness_coach), dirección (director deportivo / heads) y
  // admin/owner. Medical, analyst y staff: oculto. Única fuente de verdad para el
  // sidebar (data-buckets), el guard de Tactical Planning.html y el bloque de
  // objetivos tácticos en Daily Planning.
  window.cmTacticalAccess = function (profile) {
    var b = window.cmRoleBuckets(profile);
    return b.has('admin') || b.has('coach') || b.has('sc') || b.has('direction');
  };
  // ── GPS provider sync (daily API pull) permission ────────────────────────────
  // Who may TRIGGER a "Sync now" against the club's GPS provider (Catapult, etc.).
  // Buckets: 'admin' (owner/admin) + 'sc' (sc_coach/fitness_coach). This is ONLY the
  // day-to-day pull — CONFIGURATION (connect/verify/map athletes, saving the API token)
  // stays admin-only in Admin.html. Single source of truth for both UI and (mirrored)
  // the gps-sync START gate in supabase/functions/gps-sync/index.ts.
  // ⚠️ When the "Head of performance" role ships: map its slug to the 'sc' bucket in
  //    cmRoleBucket() above (or add its bucket to the check here) AND add the slug to the
  //    _SYNC_ROLES set in gps-sync/index.ts. Otherwise it will NOT be able to sync.
  window.cmCanImportGps = function (profile) {
    var b = window.cmRoleBuckets(profile);
    return b.has('admin') || b.has('sc');
  };
  // Club staff profiles whose bucket ∈ `buckets`, as [{id, role}]. Excludes platform
  // super-admins AND any 'player' profile — players are not auth users, so their id
  // would break the notifications.user_id → auth.users FK and fail the whole
  // all-or-nothing insert. Returns [] on any error (never throws).
  window.cmStaffByBuckets = async function (clubId, buckets) {
    try {
      if (!clubId || !Array.isArray(buckets) || !buckets.length) return [];
      const want = new Set(buckets);
      const { data: profs } = await window.sb.from('profiles')
        .select('id, role, club_role, preferred_lang, notification_settings').eq('club_id', clubId);
      let list = (profs || []).filter(p => (p.role || '').toLowerCase() !== 'player');
      try {
        const { data: padmins } = await window.sb.from('platform_admins').select('user_id');
        const superIds = new Set((padmins || []).map(r => r.user_id));
        list = list.filter(p => !superIds.has(p.id));
      } catch (_) { /* si no se puede leer platform_admins, seguir */ }
      // Dual-role: a member qualifies if EITHER their primary or secondary role is in `buckets`.
      return list.filter(p => want.has(window.cmRoleBucket(p.role)) || (p.club_role && want.has(window.cmRoleBucket(p.club_role))));
    } catch (_) { return []; }
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

  // ── Aviso de vencimiento de prueba ──────────────────────────────────
  // Carga el módulo del aviso en TODA página autenticada (una sola vez).
  (function loadTrialNotice(){
    if (window.__cmTrialNoticeLoaded) return;
    window.__cmTrialNoticeLoaded = true;
    const s = document.createElement('script');
    s.src = 'assets/trial-notice.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
})();
