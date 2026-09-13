// ClavaMetrics — shared exercise search & tag filtering (vanilla, no deps, no build).
// --------------------------------------------------------------------------
// One engine behind both the Gym Library screen and the Gym Planner picker, so
// a fix lands in both. Pure data in / data out: no DOM, no i18n, no Supabase.
//
// Two ideas carry the whole thing:
//   1. A tag is reachable by TYPING it. Every term the coach types is resolved
//      against CMTaxonomy's trilingual alias table, so "isquios", "polea" and
//      "cadena posterior" hit the exercises tagged hamstrings / cable /
//      superficial_back_line without anyone opening a dropdown.
//   2. Explicit chips are the same thing, pinned. Selecting from a dropdown
//      adds a chip; chips OR within a dimension and AND across dimensions.
//
// Exposes window.CMExerciseFilter (browser) and module.exports (node/tests).
(function () {
  'use strict';

  const TAX = (typeof window !== 'undefined' && window.CMTaxonomy)
    || (typeof require === 'function' ? require('./exercise-taxonomy.js') : null);

  // ── Filterable dimensions ─────────────────────────────────────────────
  // dim      = CMTaxonomy dimension key (null for the non-taxonomy ones)
  // column   = array column on gym_exercises
  // legacy   = pre-taxonomy scalar column, read only when the array is empty
  // level    = 'primary' shows in the always-visible row; 'more' sits behind
  //            the "More filters" disclosure. Purpose/muscle/equipment/
  //            complexity stay primary because coaches already use them there.
  const DIMENSIONS = [
    { key: 'purpose',          dim: 'purpose',          column: 'purposes',          legacy: 'primary_purpose', level: 'primary' },
    { key: 'muscle_group',     dim: 'muscle_group',     column: 'muscle_groups',     legacy: 'muscle_group',    level: 'primary' },
    { key: 'equipment',        dim: 'equipment',        column: 'equipment_tags',                               level: 'primary' },
    { key: 'complexity',       dim: null,               column: null,                legacy: 'complexity',      level: 'primary', scalar: true, values: ['Low', 'Medium', 'High'] },
    { key: 'movement_pattern', dim: 'movement_pattern', column: 'movement_patterns',                            level: 'more' },
    { key: 'myofascial_chain', dim: 'myofascial_chain', column: 'myofascial_chains',                            level: 'more' },
    { key: 'contraction_type', dim: 'contraction_type', column: 'contraction_types',                            level: 'more' },
    { key: 'movement_speed',   dim: 'movement_speed',   column: 'movement_speeds',                              level: 'more' },
    { key: 'plane',            dim: 'plane',            column: 'planes',                                       level: 'more' },
  ];

  const BY_KEY = {};
  DIMENSIONS.forEach(d => { BY_KEY[d.key] = d; });

  // Sentinel chip value meaning "exercises with nothing tagged on this axis".
  // Makes the tagging debt visible instead of silently shrinking every result.
  const UNTAGGED = '__untagged__';

  function norm(s) {
    if (TAX && TAX.norm) return TAX.norm(s);
    return String(s || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Tokens an exercise carries on one dimension. The array column wins; the
  // legacy scalar is the fallback so libraries tagged before the taxonomy
  // landed still filter instead of reading as untagged.
  function tagsOf(ex, key) {
    const d = BY_KEY[key];
    if (!ex || !d) return [];
    if (d.scalar) { const v = ex[d.legacy]; return v ? [v] : []; }
    const arr = (ex[d.column] || []).filter(Boolean);
    if (arr.length) return [...new Set(arr)];
    const legacy = d.legacy ? ex[d.legacy] : null;
    return legacy ? [legacy] : [];
  }

  // Every tag on an exercise, flattened to { key, token } — used by free-text
  // matching so one typed word can hit any axis.
  function allTags(ex) {
    const out = [];
    DIMENSIONS.forEach(d => tagsOf(ex, d.key).forEach(token => out.push({ key: d.key, token })));
    return out;
  }

  // ── Counting ──────────────────────────────────────────────────────────
  // Counts are always computed over a given set of exercises, never over the
  // whole library: the caller passes the set matching every OTHER dimension so
  // "Prevention · 31" means "31 more you can still reach from here".
  function countTokens(exercises, key) {
    const counts = {};
    let untagged = 0;
    (exercises || []).forEach(ex => {
      const tags = tagsOf(ex, key);
      if (!tags.length) { untagged++; return; }
      tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    return { counts, untagged };
  }

  // Present tokens ordered by the canonical taxonomy, then unknown/custom ones
  // alphabetically, each with its count. Tokens with no matches are dropped.
  function optionsFor(exercises, key) {
    const d = BY_KEY[key];
    if (!d) return { options: [], untagged: 0 };
    const { counts, untagged } = countTokens(exercises, key);
    const canonical = d.values || (d.dim && TAX ? TAX.tokens(d.dim) : []);
    const ordered = canonical.filter(t => counts[t] != null);
    const extras = Object.keys(counts).filter(t => !ordered.includes(t)).sort();
    return {
      options: [...ordered, ...extras].map(token => ({ token, count: counts[token] })),
      untagged,
    };
  }

  // ── Query parsing ─────────────────────────────────────────────────────
  // Terms are split on whitespace, then greedily re-joined up to MAX_GRAM words
  // so multi-word aliases survive: "cadena posterior" resolves as one term
  // rather than two misses. Quoted "..." forces a literal text term.
  const MAX_GRAM = 3;

  function resolveTerm(text) {
    if (!TAX) return [];
    const hits = [];
    DIMENSIONS.forEach(d => {
      if (!d.dim) return;
      const token = TAX.resolve(d.dim, text);
      if (token) hits.push({ key: d.key, token });
    });
    // Complexity has no taxonomy dimension; match its three values by name.
    const cx = { low: 'Low', medium: 'Medium', high: 'High' }[norm(text)];
    if (cx) hits.push({ key: 'complexity', token: cx });
    return hits;
  }

  function parseQuery(input) {
    const raw = String(input || '').trim();
    if (!raw) return { terms: [] };
    const terms = [];
    // Pull quoted phrases out first — they stay literal.
    const rest = raw.replace(/"([^"]+)"/g, (_, phrase) => {
      terms.push({ text: phrase.trim(), literal: true, tags: [] });
      return ' ';
    });
    const words = rest.split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < words.length) {
      let matched = null;
      for (let n = Math.min(MAX_GRAM, words.length - i); n >= 1; n--) {
        const phrase = words.slice(i, i + n).join(' ');
        const tags = resolveTerm(phrase);
        if (tags.length) { matched = { text: phrase, tags, n }; break; }
      }
      if (matched) { terms.push({ text: matched.text, literal: false, tags: matched.tags }); i += matched.n; }
      else { terms.push({ text: words[i], literal: false, tags: [] }); i += 1; }
    }
    return { terms };
  }

  // A term matches an exercise when it appears in its text OR resolves to a tag
  // the exercise carries. That OR is the whole point: typing "isquios" finds
  // hamstrings work, and typing "copenhague" still finds it by name.
  function haystack(ex) {
    return norm(`${ex.name || ''} ${ex.description || ''}`);
  }

  // Every normalized string that names a token (its slug, label and aliases),
  // built once per dimension. Used for prefix matching while typing.
  const NAMES = {};
  function namesFor(key, token) {
    const d = BY_KEY[key];
    if (!d || !d.dim || !TAX) return [norm(token)];
    if (!NAMES[key]) {
      NAMES[key] = {};
      (TAX.LISTS[d.dim] || []).forEach(item => {
        const set = new Set([norm(item.token), norm(item.token.replace(/_/g, ' ')), norm(item.label)]);
        (item.aliases || []).forEach(a => set.add(norm(a)));
        NAMES[key][item.token] = [...set];
      });
    }
    return NAMES[key][token] || [norm(token)];
  }

  // Half-typed tag: "cadena" is not an alias of anything on its own, but it
  // prefixes "cadena posterior". Without this the list empties out mid-word and
  // only comes back once the suggestion is accepted — so prefixes count too,
  // from three characters up to keep short fragments from matching everything.
  // Only from the START of a tag name: matching mid-phrase words would let a
  // compound alias like "glute activation" answer to "glu" and drag every
  // activation drill into a search for glute work.
  const MIN_PREFIX = 3;
  function prefixMatches(ex, needle) {
    if (needle.length < MIN_PREFIX) return false;
    for (const d of DIMENSIONS) {
      if (!d.dim) continue;
      for (const token of tagsOf(ex, d.key)) {
        if (namesFor(d.key, token).some(n => n.startsWith(needle))) return true;
      }
    }
    return false;
  }

  function termMatches(ex, term, hay) {
    const needle = norm(term.text);
    if (term.text && hay.includes(needle)) return true;
    if (term.literal) return false;
    if (term.tags.some(t => tagsOf(ex, t.key).includes(t.token))) return true;
    return prefixMatches(ex, needle);
  }

  // ── Filtering ─────────────────────────────────────────────────────────
  // state = { search: '', chips: { <dimKey>: [tokens…] }, extra: fn(ex)->bool }
  // Chips OR inside a dimension, AND across dimensions; search terms all AND.
  function chipsMatch(ex, key, tokens) {
    if (!tokens || !tokens.length) return true;
    const tags = tagsOf(ex, key);
    return tokens.some(t => (t === UNTAGGED ? tags.length === 0 : tags.includes(t)));
  }

  function matches(ex, state) {
    const chips = (state && state.chips) || {};
    for (const key of Object.keys(chips)) {
      if (!chipsMatch(ex, key, chips[key])) return false;
    }
    if (state && typeof state.extra === 'function' && !state.extra(ex)) return false;
    const terms = (state && state.terms) || parseQuery(state && state.search).terms;
    if (terms.length) {
      const hay = haystack(ex);
      for (const term of terms) if (!termMatches(ex, term, hay)) return false;
    }
    return true;
  }

  function filter(exercises, state) {
    // Parse once, not per exercise.
    const prepared = Object.assign({}, state, { terms: parseQuery(state && state.search).terms });
    return (exercises || []).filter(ex => matches(ex, prepared));
  }

  // Set matching everything EXCEPT one dimension — the honest denominator for
  // that dimension's option counts.
  function filterExcept(exercises, state, exceptKey) {
    const chips = Object.assign({}, (state && state.chips) || {});
    delete chips[exceptKey];
    return filter(exercises, Object.assign({}, state, { chips }));
  }

  // ── Empty-state diagnosis ─────────────────────────────────────────────
  // "No exercises found" hides whether the library lacks them or the coach
  // over-filtered. Drop one constraint at a time and report the first that
  // brings results back, so the UI can offer to undo exactly that.
  function explainEmpty(exercises, state) {
    const all = exercises || [];
    if (!all.length) return { reason: 'empty_library' };
    const chips = (state && state.chips) || {};
    const keys = Object.keys(chips).filter(k => (chips[k] || []).length);
    for (const key of keys) {
      const without = Object.assign({}, chips);
      delete without[key];
      if (filter(all, Object.assign({}, state, { chips: without })).length) {
        return { reason: 'chip', key, tokens: chips[key] };
      }
    }
    if (state && state.search) {
      // Prefer the precise answer: when several terms are typed, name the one
      // at fault so the UI can offer to drop just that word.
      const terms = parseQuery(state.search).terms;
      if (terms.length > 1) {
        for (const term of terms) {
          const kept = terms.filter(t => t !== term);
          if (all.filter(ex => matches(ex, Object.assign({}, state, { terms: kept }))).length) {
            return { reason: 'term', term: term.text };
          }
        }
      }
      if (filter(all, Object.assign({}, state, { search: '' })).length) {
        return { reason: 'search', search: state.search };
      }
    }
    if (keys.length > 1) return { reason: 'combination', keys };
    return { reason: 'no_match' };
  }

  // ── Typeahead ─────────────────────────────────────────────────────────
  // Suggests tags whose label/alias starts with (or contains) what's typed,
  // annotated with dimension and count so an unfamiliar axis is discoverable.
  // Only the last word is completed — earlier words are already filtering.
  function suggest(input, exercises, opts) {
    const options = opts || {};
    const limit = options.limit || 8;
    const active = options.chips || {};
    const words = String(input || '').trim().split(/\s+/);
    const last = norm(words[words.length - 1] || '');
    if (last.length < 2 || !TAX) return [];

    // Count against what's already narrowed down, so a suggestion never
    // promises more than it delivers.
    const pool = options.pool || exercises || [];
    const out = [];
    DIMENSIONS.forEach(d => {
      if (!d.dim) return;
      const { counts } = countTokens(pool, d.key);
      TAX.tokens(d.dim).forEach(token => {
        const count = counts[token] || 0;
        if (!count) return;
        if ((active[d.key] || []).includes(token)) return;
        const label = TAX.label(d.dim, token);
        const candidates = [norm(token.replace(/_/g, ' ')), norm(label)];
        const item = (TAX.LISTS[d.dim] || []).find(x => x.token === token);
        (item && item.aliases || []).forEach(a => candidates.push(norm(a)));
        let rank = -1;
        for (const c of candidates) {
          if (c === last) { rank = 0; break; }
          if (c.startsWith(last)) { rank = rank === -1 ? 1 : Math.min(rank, 1); }
          else if (c.includes(last) && rank === -1) rank = 2;
        }
        if (rank === -1) return;
        out.push({ key: d.key, dim: d.dim, token, label, count, rank });
      });
    });
    out.sort((a, b) => (a.rank - b.rank) || (b.count - a.count) || a.label.localeCompare(b.label));
    return out.slice(0, limit);
  }

  // Remove the word a suggestion completes, so accepting it doesn't leave the
  // typed fragment behind as a stray text filter.
  function stripLastWord(input) {
    const s = String(input || '');
    const trimmed = s.replace(/\s+$/, '');
    const cut = trimmed.lastIndexOf(' ');
    return cut === -1 ? '' : trimmed.slice(0, cut + 1);
  }

  // ── Chip state helpers ────────────────────────────────────────────────
  function toggleChip(chips, key, token) {
    const next = Object.assign({}, chips);
    const cur = (next[key] || []).slice();
    const at = cur.indexOf(token);
    if (at === -1) cur.push(token); else cur.splice(at, 1);
    if (cur.length) next[key] = cur; else delete next[key];
    return next;
  }

  function countChips(chips) {
    return Object.keys(chips || {}).reduce((n, k) => n + (chips[k] || []).length, 0);
  }

  const API = {
    DIMENSIONS, BY_KEY, UNTAGGED,
    norm, tagsOf, allTags,
    countTokens, optionsFor,
    parseQuery, resolveTerm,
    filter, filterExcept, matches,
    explainEmpty, suggest, stripLastWord,
    toggleChip, countChips,
  };

  if (typeof window !== 'undefined') window.CMExerciseFilter = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
