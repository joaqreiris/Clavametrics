// ClavaMetrics — Active sport resolver
// Include AFTER sport-packs.js and supabase-init.js:
//   <script src="assets/sport-packs.js"></script>
//   <script src="assets/sport.js"></script>
//
// WHAT THIS DOES
// Answers one question — "which sport is this club?" — synchronously, from the first
// frame, and keeps the answer fresh.
//
// The sport lives in clubs.sport, which means reading it is a round trip. But the pages
// that need it (Squad's position list, the Planner's pitch, Lineup's slot count) paint
// before that round trip finishes. So we mirror the value in localStorage, exactly the
// way boot-brand.js mirrors the club crest and accent colour: the cached value paints
// frame one, the fetch confirms it, and if they disagree we fire `cm:sport-change` so
// the page can re-render.
//
// Practical consequence: NEVER read the sport straight off a Supabase row in page code.
// Go through CMSport.key() for the synchronous answer or CMSport.ready() when you must
// be certain (writes, migrations, anything destructive).

(function () {
  if (window.CMSport) return;   // idempotent

  const LS_KEY  = 'cm_sport';
  const PACKS   = window.CM_SPORT_PACKS || {};
  const DEFAULT = window.CM_SPORT_DEFAULT || 'football';

  /* ---- normalise any stored / typed value onto a known pack key ------------- */
  function normKey(raw) {
    const k = String(raw == null ? '' : raw).trim().toLowerCase();
    if (!k) return null;
    if (PACKS[k]) return k;
    // Tolerate the spellings that reach us from the register form and from imports.
    const ALIASES = {
      soccer: 'football', futbol: 'football', 'fútbol': 'football', futebol: 'football',
      futsal5: 'futsal', 'futbol sala': 'futsal', 'fútbol sala': 'futsal', futsala: 'futsal',
      basket: 'basketball', basquet: 'basketball', 'básquet': 'basketball',
      basquetbol: 'basketball', 'básquetbol': 'basketball', basquetebol: 'basketball',
      'rugby union': 'rugby', rugbi: 'rugby',
      'field hockey': 'hockey', 'hockey cesped': 'hockey', 'hockey césped': 'hockey',
      hoquei: 'hockey',
    };
    return ALIASES[k] || null;
  }

  /* ---- synchronous cache (survives reloads, primes the first paint) --------- */
  let _key = (function () {
    try { return normKey(localStorage.getItem(LS_KEY)) || DEFAULT; }
    catch (_e) { return DEFAULT; }
  })();

  let _confirmed = false;   // true once the DB has actually answered
  let _promise   = null;

  function cacheKey(k) {
    try { localStorage.setItem(LS_KEY, k); } catch (_e) {}
  }

  /* ---- resolve from the club (once per page load) -------------------------- */
  function resolve() {
    if (_promise) return _promise;
    _promise = (async () => {
      try {
        // getClub() already selects and caches the club row; it selects `sport` too.
        const club = (typeof window.getClub === 'function') ? await window.getClub() : null;
        const k = normKey(club && club.sport);
        // A club with sport NULL (every club created before this shipped) stays on the
        // default rather than being flipped to 'other' — the app it has been using IS
        // the football app. Fase 6 gives them an explicit picker.
        const next = k || DEFAULT;
        _confirmed = true;
        if (next !== _key) {
          _key = next;
          cacheKey(next);
          try {
            window.dispatchEvent(new CustomEvent('cm:sport-change', { detail: { sport: next } }));
          } catch (_e) {}
        } else {
          cacheKey(next);
        }
        return PACKS[_key];
      } catch (_e) {
        // Offline / no session: keep whatever we cached and let the next call retry.
        _promise = null;
        return PACKS[_key];
      }
    })();
    return _promise;
  }

  // Kick the resolution off as soon as a club id is obtainable, without blocking anything.
  // Pages that paint immediately get the cached answer; the event patches them up after.
  function autoResolve() {
    if (typeof window.getClubId !== 'function') return;
    try { resolve(); } catch (_e) {}
  }
  // Redirect the sport's i18n keys before the runtime paints. This listener is registered
  // while sport.js is parsed — ahead of i18n.js, which the sidebar appends with defer — so
  // it runs first and the very first paint already carries the sport's wording.
  function applyOverrides() {
    try { window.CMSport.applyI18nOverrides(document); } catch (_e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { applyOverrides(); autoResolve(); }, { once: true });
  } else {
    applyOverrides(); autoResolve();
  }
  // Confirmed sport differs from the cached one → re-point the keys and ask i18n to repaint.
  window.addEventListener('cm:sport-change', () => {
    applyOverrides();
    try { if (window.CM_I18N && window.CM_I18N.applyTo) window.CM_I18N.applyTo(document); } catch (_e) {}
  });

  window.CMSport = {
    /** Active sport key — synchronous, cached, never null. */
    key() { return _key; },

    /** Active sport pack — synchronous, never null. */
    pack() { return PACKS[_key] || PACKS[DEFAULT]; },

    /** A specific pack by key (accepts aliases). Null when unknown. */
    get(k) { const n = normKey(k); return n ? PACKS[n] : null; },

    /** Pack keys a club can be created with, in menu order. */
    list() { return (window.CM_SPORT_SUPPORTED || [DEFAULT]).slice(); },

    /** True when `k` names a sport we actually model. */
    isSupported(k) {
      const n = normKey(k);
      return !!n && (window.CM_SPORT_SUPPORTED || []).indexOf(n) >= 0;
    },

    /** Free text → canonical pack key, or null. Use for imports and form values. */
    normalize: normKey,

    /** Resolves to the pack once the DB has confirmed it. Use before writes. */
    ready() { return resolve(); },

    /** True once the DB answered — i.e. key() is no longer just the cached guess. */
    isConfirmed() { return _confirmed; },

    /** Force a re-read (after an admin changes the club's sport). */
    refresh() { _promise = null; _confirmed = false; return resolve(); },

    /** An i18n key, redirected to this sport's wording when the pack declares one.
     *  Football returns every key unchanged — it is the vocabulary the app is written in. */
    i18nKey(key) {
      const map = this.at('i18n', null);
      return (map && map[key]) || key;
    },

    /** Rewrite [data-i18n] / [data-i18n-ph] attributes in `root` onto this sport's keys.
     *  Runs before the i18n runtime paints, so a screen opts in just by carrying the key —
     *  no per-page branching on the sport. */
    applyI18nOverrides(root) {
      const map = this.at('i18n', null);
      if (!map || !Object.keys(map).length) return;
      const scope = root || document;
      ['data-i18n', 'data-i18n-ph', 'data-i18n-html'].forEach(attr => {
        scope.querySelectorAll('[' + attr + ']').forEach(el => {
          const k = el.getAttribute(attr);
          if (map[k]) el.setAttribute(attr, map[k]);
        });
      });
    },

    /** The sport's word for a concept, already translated.
     *
     *  A basketball club plays a GAME on a COURT and scores POINTS; a football club plays
     *  a MATCH on a PITCH and scores GOALS. Each pack maps the concept onto its own term
     *  (`vocab`), and the term resolves to an i18n key — so the distinction survives
     *  translation instead of being hardcoded English.
     *
     *    CMSport.word('match')   → 'Game'    (basketball)  /  'Match'  (football)
     *    CMSport.word('surface') → 'Court'                 /  'Pitch'
     *    CMSport.word('score')   → 'Point'                 /  'Goal'
     */
    word(concept, opts) {
      const vocab = this.at('vocab', {}) || {};
      const term = vocab[concept];
      if (!term) return '';
      const plural = !!(opts && opts.plural);
      const key = 'sport.word.' + term + (plural ? '_plural' : '');
      const EN = {
        match: 'Match', game: 'Game', pitch: 'Pitch', court: 'Court',
        goal: 'Goal', point: 'Point',
        match_plural: 'Matches', game_plural: 'Games', pitch_plural: 'Pitches',
        court_plural: 'Courts', goal_plural: 'Goals', point_plural: 'Points',
      };
      const fb = EN[term + (plural ? '_plural' : '')] || term;
      try {
        const v = (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t(key) : null;
        return (v && v !== key) ? v : fb;
      } catch (_e) { return fb; }
    },

    /** Convenience: dot path into the active pack, with a fallback.
     *  CMSport.at('lineup.slots', 11) */
    at(path, fallback) {
      try {
        const v = String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), this.pack());
        return (v === undefined || v === null) ? fallback : v;
      } catch (_e) { return fallback; }
    },
  };
})();
