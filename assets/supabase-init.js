// ClavaMetrics — Shared Supabase client + club context
// Include before any page logic:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="assets/supabase-init.js"></script>

(function () {
  const SB_URL = 'https://xesrumijvdmqjrufgeka.supabase.co';
  const SB_KEY = 'sb_publishable_p4DBCWsAm9u-Wf5-_CP-Yw_MYh_3cR6';

  window.sb = supabase.createClient(SB_URL, SB_KEY);

  let _clubId  = null;
  let _profile = null;
  let _club    = null;

  window.getClubId = async function () {
    if (_clubId) return _clubId;
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session?.user) return null;
    const { data: profile } = await window.sb.from('profiles')
      .select('club_id, role, full_name, avatar_url')
      .eq('id', session.user.id)
      .single();
    if (profile) {
      _clubId  = profile.club_id;
      _profile = profile;
    }
    return _clubId;
  };

  window.getClub = async function () {
    if (_club) return _club;
    const clubId = await window.getClubId();
    if (!clubId) return null;
    const { data } = await window.sb.from('clubs')
      .select('*')
      .eq('id', clubId)
      .single();
    _club = data;
    return _club;
  };

  window.getProfile = async function () {
    if (_profile) return _profile;
    await window.getClubId();
    return _profile;
  };

  window.requireAuth = async function (redirectTo = 'Login.html') {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) {
      window.location.replace(redirectTo);
      return false;
    }
    return true;
  };

  // Applies club accent_color to --cm-accent CSS variable
  window.applyClubTheme = async function () {
    const club = await window.getClub();
    const hex = club?.accent_color || club?.primary_color;
    if (!hex) return;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const s = document.documentElement.style;
    s.setProperty('--cm-accent',     hex);
    s.setProperty('--cm-accent-rgb', `${r},${g},${b}`);
  };
})();
