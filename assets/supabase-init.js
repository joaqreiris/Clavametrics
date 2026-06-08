// ClavaMetrics — Shared Supabase client + club context
// Include before any page logic:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="assets/supabase-init.js"></script>

(function () {
  const SB_URL = 'https://xesrumijvdmqjrufgeka.supabase.co';
  const SB_KEY = 'sb_publishable_p4DBCWsAm9u-Wf5-_CP-Yw_MYh_3cR6';

  window.sb = supabase.createClient(SB_URL, SB_KEY);

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

  window.resetSupabaseCache = function () {
    _clubId = null; _profile = null; _club = null;
    _clubIdPromise = null; _clubPromise = null; _profilePromise = null;
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
    let q = window.sb.from('players')
      .select('id,first_name,last_name,number,position,status,team_id')
      .eq('club_id', clubId)
      .neq('status', 'inactive')
      .order('number');
    if (teamId) q = q.eq('team_id', teamId);
    const { data } = await q;
    return data || [];
  };

  // Returns all teams for a club, ordered by name.
  window.getTeams = async function (clubId) {
    const { data } = await window.sb.from('teams')
      .select('id,name,season')
      .eq('club_id', clubId)
      .order('name');
    return data || [];
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
