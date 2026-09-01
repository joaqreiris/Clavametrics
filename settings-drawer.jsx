/* Settings drawer for ClavaMetrics — the in-app way to change theme,
   accent, density, corners, sidebar tone. Slides in from the right
   when the gear icon in the topbar is clicked. Persists to localStorage.

   The same tokens still flow through theme-tweaks.jsx's applyTokens,
   so designers running with the Tweaks toolbar toggle on get a parallel
   floating control \u2014 in-app users get Settings, designers get Tweaks.
*/

const SETTINGS_KEY = "cm-settings.v1";

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

/* i18n label helper — translated string, or the English fallback if the
   runtime isn't loaded yet. UI copy stays English. */
const _t = (k, fb) => {
  try { return (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t(k) : fb; }
  catch { return fb; }
};

/* --- Same token recipes as theme-tweaks (keep in sync) --- */
const _ACCENT = {
  light: {
    neutral: { hue: "#0A0A0A", soft: "#F4F4F2", tokens: { "--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff" } },
    green:   { hue: "#15803D", soft: "#ECFDF5", tokens: { "--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff" } },
    blue:    { hue: "#2563EB", soft: "#EFF6FF", tokens: { "--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff" } },
    violet:  { hue: "#7C3AED", soft: "#F5F3FF", tokens: { "--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff" } },
    gold:    { hue: "#A87C2A", soft: "#FAF3E2", tokens: { "--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff" } },
  },
  dark: {
    neutral: { hue: "#FAFAFA", soft: "rgba(255,255,255,0.06)", tokens: { "--cm-accent":"#FAFAFA","--cm-accent-hover":"#E5E5E5","--cm-accent-press":"#fff","--cm-accent-soft":"rgba(255,255,255,0.06)","--cm-fg-on-accent":"#0A0A0A" } },
    green:   { hue: "#22C55E", soft: "rgba(34,197,94,0.10)", tokens: { "--cm-accent":"#22C55E","--cm-accent-hover":"#16A34A","--cm-accent-press":"#15803D","--cm-accent-soft":"rgba(34,197,94,0.10)","--cm-fg-on-accent":"#0A0A0A" } },
    blue:    { hue: "#3B82F6", soft: "rgba(59,130,246,0.10)", tokens: { "--cm-accent":"#3B82F6","--cm-accent-hover":"#2563EB","--cm-accent-press":"#1D4ED8","--cm-accent-soft":"rgba(59,130,246,0.10)","--cm-fg-on-accent":"#fff" } },
    violet:  { hue: "#A78BFA", soft: "rgba(167,139,250,0.10)", tokens: { "--cm-accent":"#A78BFA","--cm-accent-hover":"#8B5CF6","--cm-accent-press":"#7C3AED","--cm-accent-soft":"rgba(167,139,250,0.10)","--cm-fg-on-accent":"#0A0A0A" } },
    gold:    { hue: "#C9A84C", soft: "rgba(201,168,76,0.12)", tokens: { "--cm-accent":"#C9A84C","--cm-accent-hover":"#A87C2A","--cm-accent-press":"#8B6520","--cm-accent-soft":"rgba(201,168,76,0.12)","--cm-fg-on-accent":"#0A0A0A" } },
  },
  hybrid: {
    neutral: { hue: "#0A0A0A", soft: "#F4F4F2", tokens: { "--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(255,255,255,0.06)","--cm-side-item-active-fg":"#fff","--cm-side-accent":"#fff" } },
    green:   { hue: "#15803D", soft: "#ECFDF5", tokens: { "--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(34,197,94,0.10)","--cm-side-item-active-fg":"#4ADE80","--cm-side-accent":"#4ADE80" } },
    blue:    { hue: "#2563EB", soft: "#EFF6FF", tokens: { "--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(59,130,246,0.14)","--cm-side-item-active-fg":"#60A5FA","--cm-side-accent":"#60A5FA" } },
    violet:  { hue: "#7C3AED", soft: "#F5F3FF", tokens: { "--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(167,139,250,0.14)","--cm-side-item-active-fg":"#A78BFA","--cm-side-accent":"#A78BFA" } },
    gold:    { hue: "#A87C2A", soft: "#FAF3E2", tokens: { "--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(201,168,76,0.16)","--cm-side-item-active-fg":"#E5C875","--cm-side-accent":"#E5C875" } },
  },
};
const _SIDEBAR_HUE = {
  default: {},
  ink:     { "--cm-side-bg": "#0A0A0A" },
  slate:   { "--cm-side-bg": "#0F172A" },
  forest:  { "--cm-side-bg": "#0D1F17" },
  zinc:    { "--cm-side-bg": "#18181B" },
};
const _RADIUS = {
  tight:   { "--cm-r-2":"4px","--cm-r-3":"5px","--cm-r-4":"6px","--cm-r-5":"8px","--cm-r-6":"10px" },
  regular: {},
  soft:    { "--cm-r-2":"8px","--cm-r-3":"10px","--cm-r-4":"14px","--cm-r-5":"18px","--cm-r-6":"22px" },
};
const _DENSITY = {
  compact:     { "--cm-density-pad": "10px" },
  balanced:    { "--cm-density-pad": "14px" },
  comfortable: { "--cm-density-pad": "20px" },
};

function _apply(s) {
  const root = document.documentElement;
  root.setAttribute("data-theme", s.theme);
  // wipe
  const wipe = ["--cm-accent","--cm-accent-hover","--cm-accent-press","--cm-accent-soft","--cm-fg-on-accent",
    "--cm-side-item-active-bg","--cm-side-item-active-fg","--cm-side-accent","--cm-side-bg",
    "--cm-r-2","--cm-r-3","--cm-r-4","--cm-r-5","--cm-r-6","--cm-density-pad"];
  wipe.forEach(k => root.style.removeProperty(k));
  const acc = (_ACCENT[s.theme] && _ACCENT[s.theme][s.accent]) || {};
  Object.entries(acc.tokens || {}).forEach(([k,v]) => root.style.setProperty(k,v));
  Object.entries(_SIDEBAR_HUE[s.sidebarHue] || {}).forEach(([k,v]) => root.style.setProperty(k,v));
  Object.entries(_RADIUS[s.radius]   || {}).forEach(([k,v]) => root.style.setProperty(k,v));
  Object.entries(_DENSITY[s.density] || {}).forEach(([k,v]) => root.style.setProperty(k,v));
}

const NOTIF_DEFAULTS = { alertInjury: true, alertTask: true, alertSession: true, emailWeekly: true, emailInjury: true };

/* --- Apply persisted (or default) settings immediately --- */
function initSettings() {
  const persisted = loadSettings();
  const defaults = window.__CM_TWEAK_DEFAULTS || { theme:"light", accent:"neutral" };
  const s = Object.assign(
    { theme: "light", accent: "neutral", radius: "regular", density: "balanced", sidebarHue: "default" },
    defaults,
    persisted
  );
  s.notif = { ...NOTIF_DEFAULTS, ...(s.notif || {}) };
  _apply(s);
  return s;
}

/* ── Notification toast (rendered globally by SettingsHost) ── */
const NotificationToast = ({ notif, onDismiss }) => {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="cm-toast" onClick={() => { if (notif.link) window.location.href = notif.link; onDismiss(); }}>
      <i className="ti ti-bell cm-toast-icon"></i>
      <div className="cm-toast-body">
        <div className="cm-toast-title">{notif.title}</div>
        {notif.body && <div className="cm-toast-sub">{notif.body}</div>}
      </div>
      <button className="cm-toast-x" onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
        <i className="ti ti-x"></i>
      </button>
    </div>
  );
};

const BillingPanel = () => {
  const [club, setClub] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.getClub && window.getClub().then(c => { setClub(c); setLoading(false); });
  }, []);

  const plan   = club?.billing_plan   || null;
  const amount = club?.billing_amount || null;
  const next   = club?.billing_next_date || null;
  const status = club?.billing_status || null;

  return <>
    <div className="sd-section">
      <div className="sd-section-h"><div className="sd-section-l">{_t("settings.workspace_subscription","Workspace subscription")}</div></div>
      <div className="sd-section-body">
        <div className="sd-billing-card">
          <div className="sd-billing-row">
            <span className="sd-row-label">{_t("settings.plan","Plan")}</span>
            <span className="sd-billing-val">{loading ? '…' : (plan || '—')}</span>
          </div>
          <div className="sd-billing-row">
            <span className="sd-row-label">{_t("settings.monthly_amount","Monthly amount")}</span>
            <span className="sd-billing-val">{loading ? '…' : (amount ? `$${amount}` : '—')}</span>
          </div>
          <div className="sd-billing-row">
            <span className="sd-row-label">{_t("settings.next_billing","Next billing date")}</span>
            <span className="sd-billing-val">{loading ? '…' : (next ? new Date(next).toLocaleDateString((window.CM_I18N && CM_I18N.current) || [], { month:'long', day:'numeric', year:'numeric' }) : '—')}</span>
          </div>
          <div className="sd-billing-row">
            <span className="sd-row-label">{_t("settings.status","Status")}</span>
            <span className="sd-billing-val" style={{color: status === 'active' ? 'var(--cm-success)' : 'var(--cm-fg-muted)'}}>{loading ? '…' : (status || '—')}</span>
          </div>
        </div>
        <div style={{padding:'10px 14px', borderTop:'1px solid var(--cm-border-soft)'}}>
          <a href="Billing.html" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12.5,fontWeight:500,color:'var(--cm-accent)',textDecoration:'none'}}>
            {_t("settings.view_full_detail","View full detail")} <i className="ti ti-arrow-right" style={{fontSize:13}}></i>
          </a>
        </div>
        <div className="sd-note" style={{marginTop:12}}>
          <i className="ti ti-brand-stripe"></i>
          {_t("settings.billing_stripe_note","Billing is managed via Stripe. Subscription data syncs automatically when the webhook is active. Contact your admin to change plans.")}
        </div>
      </div>
    </div>
  </>;
};

/* Presentational shells — MUST live at module scope. Defined inside SettingsDrawer they
   got a new component identity on every render, so React unmounted/remounted the whole
   subtree on each keystroke: text inputs lost focus and the avatar <img> reloaded (flicker). */
const Section = ({ label, children, hint }) => (
  <div className="sd-section">
    <div className="sd-section-h">
      <div className="sd-section-l">{label}</div>
      {hint ? <div className="sd-section-hint">{hint}</div> : null}
    </div>
    <div className="sd-section-body">{children}</div>
  </div>
);

const Row = ({ label, sub, children }) => (
  <div className="sd-row">
    <div className="sd-row-l">
      <div className="sd-row-label">{label}</div>
      {sub ? <div className="sd-row-sub">{sub}</div> : null}
    </div>
    <div className="sd-row-c">{children}</div>
  </div>
);

const SettingsDrawer = ({ open, onClose, profile, userId, setProfile, supabaseSettings, onSettingsChange }) => {
  const [s, setS]       = React.useState(initSettings);
  const [tab, setTab]   = React.useState("appearance");
  const [resetConfirm, setResetConfirm] = React.useState(false);
  // My profile (editable Account form)
  const [pf, setPf]           = React.useState(null);   // form fields; null until loaded
  const [pfPhoto, setPfPhoto] = React.useState(null);   // pending File
  const [pfPreview, setPfPreview] = React.useState(null);
  const [pfState, setPfState] = React.useState("idle"); // idle | saving | saved
  const [pfErr, setPfErr]     = React.useState(null);
  // Language (wired to CM_I18N; "Auto" = no explicit choice → runtime detection)
  const [curLang, setCurLang]           = React.useState(() => (window.CM_I18N ? window.CM_I18N.current : "en"));
  const [langExplicit, setLangExplicit] = React.useState(() => { try { return !!localStorage.getItem("cm_lang"); } catch { return false; } });
  const [teams, setTeams]               = React.useState([]);   // club teams, for the per-type notification filter

  // Load the club's teams once the drawer is opened (for the "by team" notification filter).
  React.useEffect(() => {
    if (!open || teams.length || !window.getClub || !window.getTeams) return;
    window.getClub().then(c => c && window.getTeams(c.id)).then(t => t && setTeams(t)).catch(() => {});
  }, [open]);

  // Apply locally + persist localStorage + notify host for Supabase save
  const didMount = React.useRef(false);
  React.useEffect(() => {
    _apply(s); saveSettings(s);
    if (!didMount.current) { didMount.current = true; return; }
    onSettingsChange && onSettingsChange(s);
  }, [s]);
  // Merge Supabase settings when received from host (e.g. after cross-device change)
  React.useEffect(() => {
    if (!supabaseSettings) return;
    setS(prev => {
      const { notif: sbNotif, ...sbRest } = supabaseSettings;
      const m = { ...prev, ...sbRest, notif: { ...prev.notif, ...(sbNotif || {}) } };
      _apply(m); saveSettings(m); return m;
    });
  }, [supabaseSettings]);
  // ESC to close
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);
  // Lock scroll
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  // Reset confirm clears if drawer closes
  React.useEffect(() => { if (!open) setResetConfirm(false); }, [open]);
  // Keep the language highlight in sync with runtime changes
  React.useEffect(() => {
    const h = (e) => setCurLang((e.detail && e.detail.lang) || (window.CM_I18N && window.CM_I18N.current) || "en");
    document.addEventListener("cm:langchanged", h);
    return () => document.removeEventListener("cm:langchanged", h);
  }, []);

  // Load the editable profile fields on open (getProfile omits phone/birth_date/preferred_lang).
  React.useEffect(() => {
    if (!open || pf || !userId || !window.sb) return;
    window.sb.from('profiles')
      .select('first_name,last_name,phone,birth_date,preferred_lang,avatar_url,full_name')
      .eq('id', userId).single()
      .then(({ data }) => {
        const d = data || {};
        setPf({
          first_name: d.first_name || '',
          last_name:  d.last_name  || '',
          phone:      d.phone      || '',
          birth_date: d.birth_date || '',
          preferred_lang: (window.CM_I18N && window.CM_I18N.current) || d.preferred_lang || 'en',
          avatar_url: d.avatar_url || (profile && profile.avatar_url) || null,
        });
      }, () => {});
  }, [open, userId]);

  // Stable avatar src across renders — resolving it inline re-ran on every keystroke.
  const pfAvaUrl = React.useMemo(
    () => pfPreview || (pf && window.cmAvatarUrl ? window.cmAvatarUrl(pf) : null),
    [pfPreview, pf && pf.avatar_url]
  );

  const setPfField = (k, v) => setPf(p => ({ ...(p || {}), [k]: v }));
  const onPfPhoto = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setPfPhoto(f);
    try { setPfPreview(URL.createObjectURL(f)); } catch {}
  };
  async function saveProfile() {
    if (!pf) return;
    const first = (pf.first_name || '').trim(), last = (pf.last_name || '').trim();
    if (!first || !last) { setPfErr(_t('settings.profile.name_required', 'Please enter your first and last name.')); return; }
    setPfErr(null); setPfState('saving');
    try {
      const uid = userId || (profile && profile.id);
      if (!uid || !window.sb) throw new Error('no session');
      let avatarUrl = pf.avatar_url || null;
      if (pfPhoto) {
        // A face renders at 40px — never ship the 8 MB original a phone hands us. The
        // signed URL below changes on every upload, so caching forever is safe.
        const photo = await window.cmShrinkImage(pfPhoto, { maxDim: 512, maxBytes: 150 * 1024 });
        const ext = ((photo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'jpg';
        const path = uid + '/avatar.' + ext;
        const { error: upErr } = await window.sb.storage.from('profile-avatars')
          .upload(path, photo, { upsert: true, contentType: photo.type || 'image/jpeg', cacheControl: window.CM_CACHE_IMMUTABLE });
        if (upErr) throw upErr;
        const { data: signed } = await window.sb.storage.from('profile-avatars').createSignedUrl(path, 315360000);
        avatarUrl = (signed && signed.signedUrl) || avatarUrl;
      }
      const fullName = (first + ' ' + last).trim();
      const patch = {
        first_name: first, last_name: last, phone: pf.phone || null, birth_date: pf.birth_date || null,
        preferred_lang: pf.preferred_lang, full_name: fullName,
      };
      if (avatarUrl) patch.avatar_url = avatarUrl;
      const { error } = await window.sb.from('profiles').update(patch).eq('id', uid);
      if (error) throw error;
      // Switch the whole app to the chosen language if it changed.
      if (pf.preferred_lang && pf.preferred_lang !== curLang) {
        if (window.CM_I18N && window.CM_I18N.setLang) { try { window.CM_I18N.setLang(pf.preferred_lang); } catch {} }
        try { localStorage.setItem('cm_lang', pf.preferred_lang); } catch {}
        setCurLang(pf.preferred_lang); setLangExplicit(true);
      }
      // Reflect immediately: drawer header / "Signed in as" + global cache + listeners (Hub greeting).
      const updated = { ...(profile || {}), ...patch };
      if (avatarUrl) updated.avatar_url = avatarUrl;
      try { window.__cm_profile = { ...(window.__cm_profile || {}), ...updated }; } catch {}
      setProfile && setProfile(updated);
      setPf(p => ({ ...(p || {}), avatar_url: avatarUrl }));
      setPfPhoto(null); setPfPreview(null);
      try { document.dispatchEvent(new CustomEvent('cm:profileupdated', { detail: { profile: updated } })); } catch {}
      setPfState('saved'); setTimeout(() => setPfState('idle'), 2000);
    } catch (e) {
      setPfErr((e && e.message) || _t('settings.profile.save_error', "Couldn't save your profile."));
      setPfState('idle');
    }
  }

  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const setNotif = (key, val) => set({ notif: { ...s.notif, [key]: val } });

  // Per-type team filter. Stored under notif.teamFilter[type] as an explicit array of
  // visible team ids; an absent entry means "all teams". Toggling a team off the first
  // time seeds the list with every team, then removes the one being hidden.
  const allTeamIds = () => teams.map(t => t.id);
  const teamAllowed = (type, teamId) => {
    const cur = s.notif && s.notif.teamFilter && s.notif.teamFilter[type];
    return !Array.isArray(cur) || cur.includes(teamId);
  };
  const toggleTeamFilter = (type, teamId) => {
    const tf = { ...((s.notif && s.notif.teamFilter) || {}) };
    let cur = Array.isArray(tf[type]) ? tf[type] : allTeamIds();
    cur = cur.includes(teamId) ? cur.filter(x => x !== teamId) : [...cur, teamId];
    tf[type] = cur;
    const nextNotif = { ...s.notif, teamFilter: tf };
    set({ notif: nextNotif });
    // Let the bell (assets/sidebar.js) refresh its filter without a page reload.
    try { document.dispatchEvent(new CustomEvent('cm:notiffilterchanged', { detail: tf })); } catch {}
  };
  const langCodes = (window.CM_I18N && window.CM_I18N.langs) || ["en", "es", "pt"];
  const langNames = (window.CM_I18N && window.CM_I18N.name) || { en:"English", es:"Español", pt:"Português" };
  const chooseLang = (code) => {
    if (window.CM_I18N) window.CM_I18N.setLang(code);   // persists local + cloud (via cloudSaver)
    setCurLang(code); setLangExplicit(true);
  };
  const chooseAuto = async () => {
    try { localStorage.removeItem("cm_lang"); } catch {}
    // Drop the saved cloud pref so detection (user/club/browser) can take over.
    try {
      if (window.sb && profile?.id) {
        const { data: r } = await window.sb.from("profiles").select("settings").eq("id", profile.id).single();
        const next = { ...(r?.settings || {}) }; delete next.language;
        await window.sb.from("profiles").update({ settings: next }).eq("id", profile.id);
      }
    } catch {}
    window.location.reload();
  };
  const themeBg = (t) => t === "dark" ? "#0A0A0A" : (t === "hybrid" ? "linear-gradient(90deg,#0E1116 0%,#0E1116 30%,#FBFBFA 30%,#FBFBFA 100%)" : "#FBFBFA");
  const themeBorder = (t) => t === "dark" ? "rgba(255,255,255,0.10)" : "#E5E7EB";

  const swatchesForTheme = Object.entries(_ACCENT[s.theme]);

  return (
    <>
      <style>{SD_CSS}</style>
      <div className={`sd-overlay ${open ? "is-open" : ""}`} onClick={onClose} />
      <aside className={`sd-drawer ${open ? "is-open" : ""}`} role="dialog" aria-label={_t("settings.title","Settings")}>
        <header className="sd-head">
          <div className="sd-head-l">
            <i className="ti ti-settings"></i>
            <div>
              <div className="sd-title">{_t("settings.title","Settings")}</div>
              <div className="sd-sub">{_t("settings.subtitle","Appearance · workspace · account")}</div>
            </div>
          </div>
          <button className="sd-x" onClick={onClose} aria-label={_t("settings.close","Close")}>
            <i className="ti ti-x"></i>
          </button>
        </header>

        <nav className="sd-tabs">
          {[
            { id:"appearance",    icon:"ti-palette",      label:"Appearance" },
            { id:"notifications", icon:"ti-bell",         label:"Notifications" },
            { id:"account",       icon:"ti-shield-lock",  label:"Account" },
            { id:"billing",       icon:"ti-credit-card",  label:"Billing" },
          ].map(({ id, icon, label }) => (
            <button key={id} className={`sd-tab ${tab === id ? "is-on" : ""}`} onClick={() => setTab(id)}>
              <i className={`ti ${icon}`}></i>{_t("settings.tab." + id, label)}
            </button>
          ))}
        </nav>

        <div className="sd-body">

          {/* ── APPEARANCE TAB ── */}
          {tab === "appearance" && <>
            <Section label={_t("settings.theme","Theme")} hint={_t("settings.theme.hint","How the chrome looks across the app.")}>
              <div className="sd-tiles">
                {["light","dark","hybrid"].map((t) => (
                  <button
                    key={t}
                    className={`sd-tile ${s.theme === t ? "is-on" : ""}`}
                    onClick={() => set({ theme: t, accent: _ACCENT[t][s.accent] ? s.accent : "green" })}>
                    <div className="sd-tile-pv" style={{ background: themeBg(t), borderColor: themeBorder(t) }}>
                      <div className="sd-tile-pv-bar" style={{ background: t === "dark" ? "rgba(255,255,255,0.08)" : (t === "hybrid" ? "rgba(255,255,255,0.06)" : "#EFEFED") }}/>
                      <div className="sd-tile-pv-c" style={{ background: t === "dark" ? "#161616" : "#fff", borderColor: themeBorder(t) }} />
                    </div>
                    <div className="sd-tile-label">
                      <span>{_t("settings.theme_" + t, t === "light" ? "Light" : t === "dark" ? "Dark" : "Hybrid")}</span>
                      {s.theme === t ? <i className="ti ti-check"></i> : null}
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            <Section label={_t("settings.accent","Accent")} hint={_t("settings.accent.hint","Used for primary buttons, active nav, and focus rings.")}>
              <div className="sd-swatches">
                {swatchesForTheme.map(([key, v]) => (
                  <button
                    key={key}
                    className={`sd-swatch ${s.accent === key ? "is-on" : ""}`}
                    onClick={() => set({ accent: key })}
                    title={key}>
                    <span className="sd-swatch-hue" style={{ background: v.hue }} />
                    <span className="sd-swatch-name">{key}</span>
                  </button>
                ))}
              </div>
            </Section>

            {s.theme !== "light" ? (
              <Section label={_t("settings.sidebar_tone","Sidebar tone")}>
                <div className="sd-chips">
                  {[
                    { v:"default", l:"Default" },
                    { v:"ink",     l:"Ink" },
                    { v:"slate",   l:"Slate" },
                    { v:"forest",  l:"Forest" },
                    { v:"zinc",    l:"Zinc" },
                  ].map(o => (
                    <button key={o.v} className={`sd-chip ${s.sidebarHue === o.v ? "is-on" : ""}`} onClick={() => set({ sidebarHue: o.v })}>{_t("settings.tone_" + o.v, o.l)}</button>
                  ))}
                </div>
              </Section>
            ) : null}

            <Section label={_t("settings.density","Density")} hint={_t("settings.density.hint","Affects vertical padding inside cards & tables.")}>
              <div className="sd-chips">
                {[
                  { v:"compact",     l:"Compact",  k:"compact" },
                  { v:"balanced",    l:"Balanced", k:"balanced" },
                  { v:"comfortable", l:"Comfy",    k:"comfy" },
                ].map(o => (
                  <button key={o.v} className={`sd-chip ${s.density === o.v ? "is-on" : ""}`} onClick={() => set({ density: o.v })}>{_t("settings.density_" + o.k, o.l)}</button>
                ))}
              </div>
            </Section>

            <Section label={_t("settings.corners","Corners")}>
              <div className="sd-chips">
                {[
                  { v:"tight",   l:"Tight" },
                  { v:"regular", l:"Regular" },
                  { v:"soft",    l:"Soft" },
                ].map(o => (
                  <button key={o.v} className={`sd-chip ${s.radius === o.v ? "is-on" : ""}`} onClick={() => set({ radius: o.v })}>{_t("settings.corners_" + o.v, o.l)}</button>
                ))}
              </div>
            </Section>

            <Section label={_t("settings.reset","Reset")}>
              {resetConfirm ? (
                <div className="sd-reset-confirm">
                  <span>{_t("settings.reset_confirm","Reset all appearance settings?")}</span>
                  <button className="sd-reset-yes" onClick={() => {
                    localStorage.removeItem(SETTINGS_KEY);
                    const d = initSettings();
                    setS(d);
                    setResetConfirm(false);
                  }}><i className="ti ti-check"></i>{_t("settings.reset_yes","Yes, reset")}</button>
                  <button className="sd-reset-no" onClick={() => setResetConfirm(false)}>{_t("settings.cancel","Cancel")}</button>
                </div>
              ) : (
                <button className="sd-reset" onClick={() => setResetConfirm(true)}>
                  <i className="ti ti-rotate"></i>{_t("settings.reset_defaults","Reset to workspace defaults")}
                </button>
              )}
            </Section>
          </>}

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === "notifications" && <>
            <Section label={_t("settings.inapp_alerts","In-app alerts")} hint={_t("settings.inapp_alerts.hint","Shown as badges and banners inside the app.")}>
              {[
                { key:"alertInjury",  k:"injury",  label:"Injury reported",         sub:"Badge on the Treatments nav item" },
                { key:"alertTask",    k:"task",     label:"Task assigned to me",      sub:"Badge on the Tasks nav item" },
                { key:"alertSession", k:"session",  label:"Session published",        sub:"Shown in Hub activity feed" },
              ].map(({ key, k, label, sub }) => (
                <div key={key} className="sd-toggle-row">
                  <div className="sd-row-l">
                    <div className="sd-row-label">{_t("settings.alert_" + k, label)}</div>
                    <div className="sd-row-sub">{_t("settings.alert_" + k + ".sub", sub)}</div>
                  </div>
                  <button
                    role="switch" aria-checked={!!(s.notif && s.notif[key])}
                    className={`sd-toggle ${s.notif && s.notif[key] ? "is-on" : ""}`}
                    onClick={() => setNotif(key, !(s.notif && s.notif[key]))}>
                    <span className="sd-toggle-thumb" />
                  </button>
                </div>
              ))}
            </Section>
            <Section label={_t("settings.notif_teams","Notifications by team")} hint={_t("settings.notif_teams.hint","For each alert, pick which teams you want notifications about. Club-wide alerts always show.")}>
              {teams.length < 2 ? (
                <div className="sd-row-sub">{_t("settings.notif_teams.single","You only have one team — nothing to filter here.")}</div>
              ) : [
                { type:"wellness_alert",  label:"Discomfort reported",  sub:"Wellness & post-RPE discomfort alerts" },
                { type:"task_reminder",   label:"Task reminders",       sub:"Reminders for tasks due soon" },
                { type:"player_birthday", label:"Player birthdays",     sub:"Birthday reminders for players" },
              ].map(({ type, label, sub }) => (
                <div key={type} className="sd-teamrow">
                  <div className="sd-teamrow-h">
                    <div className="sd-row-label">{_t("settings.notif_type_" + type, label)}</div>
                    <div className="sd-row-sub">{_t("settings.notif_type_" + type + ".sub", sub)}</div>
                  </div>
                  <div className="sd-teamchips">
                    {teams.map(tm => {
                      const on = teamAllowed(type, tm.id);
                      return (
                        <button key={tm.id} type="button"
                          className={`sd-teamchip ${on ? "is-on" : ""}`}
                          aria-pressed={on}
                          onClick={() => toggleTeamFilter(type, tm.id)}>
                          <i className={`ti ${on ? "ti-check" : "ti-plus"}`}></i>{tm.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Section>
            <Section label={_t("settings.email_digest","Email digest")} hint={_t("settings.email_digest.hint","Requires email delivery to be configured by the workspace admin.")}>
              {[
                { key:"emailWeekly",  k:"weekly",  label:"Weekly summary",    sub:"Sent every Monday morning" },
                { key:"emailInjury",  k:"injury",  label:"Injury alerts",     sub:"Immediate — for medical staff" },
              ].map(({ key, k, label, sub }) => (
                <div key={key} className="sd-toggle-row">
                  <div className="sd-row-l">
                    <div className="sd-row-label">{_t("settings.email_" + k, label)}</div>
                    <div className="sd-row-sub">{_t("settings.email_" + k + ".sub", sub)}</div>
                  </div>
                  <button
                    role="switch" aria-checked={!!(s.notif && s.notif[key])}
                    className={`sd-toggle ${s.notif && s.notif[key] ? "is-on" : ""}`}
                    onClick={() => setNotif(key, !(s.notif && s.notif[key]))}>
                    <span className="sd-toggle-thumb" />
                  </button>
                </div>
              ))}
              <div className="sd-note"><i className="ti ti-info-circle"></i>{_t("settings.email_note","Email delivery is not yet configured for this workspace. Preferences are saved for when it is.")}</div>
            </Section>
          </>}

          {/* ── ACCOUNT TAB ── */}
          {tab === "account" && <>
            <Section label={_t("settings.profile.title","My profile")}>
              {!pf ? <div className="sd-row-sub">{_t("settings.profile.loading","Loading…")}</div> : <div className="sd-pf">
                <div className="sd-pf-photo">
                  <div className="sd-pf-ava">
                    {pfAvaUrl
                      ? <img src={pfAvaUrl} alt="" />
                      : <span>{window.cmInitials ? window.cmInitials(((pf.first_name || '') + ' ' + (pf.last_name || '')).trim() || (profile && profile.email) || '?') : '?'}</span>}
                  </div>
                  <label className="sd-pf-photobtn">
                    <i className="ti ti-camera"></i>{_t("settings.profile.change_photo","Change photo")}
                    <input type="file" accept="image/*" onChange={onPfPhoto} style={{display:'none'}} />
                  </label>
                </div>
                <div className="sd-pf-grid">
                  <label className="sd-pf-f"><span>{_t("settings.profile.first_name","First name")}</span>
                    <input value={pf.first_name} onChange={e=>setPfField('first_name', e.target.value)} /></label>
                  <label className="sd-pf-f"><span>{_t("settings.profile.last_name","Last name")}</span>
                    <input value={pf.last_name} onChange={e=>setPfField('last_name', e.target.value)} /></label>
                  <label className="sd-pf-f"><span>{_t("settings.profile.phone","Phone")}</span>
                    <input type="tel" value={pf.phone} onChange={e=>setPfField('phone', e.target.value)} /></label>
                  <label className="sd-pf-f"><span>{_t("settings.profile.birth_date","Birth date")}</span>
                    <input type="date" value={pf.birth_date || ''} onChange={e=>setPfField('birth_date', e.target.value)} /></label>
                  <label className="sd-pf-f sd-pf-wide"><span>{_t("settings.profile.language","Language")}</span>
                    <select value={pf.preferred_lang} onChange={e=>{ const v=e.target.value; setPfField('preferred_lang', v); chooseLang(v); }}>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="pt">Português</option>
                    </select></label>
                </div>
                {pfErr ? <div className="sd-pf-err">{pfErr}</div> : null}
                <div className="sd-pf-actions">
                  <button className="sd-pf-save" disabled={pfState === 'saving'} onClick={saveProfile}>
                    {pfState === 'saving' ? _t("settings.profile.saving","Saving…") : pfState === 'saved' ? _t("settings.profile.saved","Saved") : _t("settings.profile.save","Save")}
                  </button>
                </div>
              </div>}
            </Section>
            <Section label={_t("settings.signed_in_as","Signed in as")}>
              <div className="sd-account-row">
                <div className="sd-account-avatar">{profile ? (profile.full_name || profile.email || '?')[0].toUpperCase() : '?'}</div>
                <div>
                  {profile?.full_name && <div className="sd-row-label">{profile.full_name}</div>}
                  <div className="sd-row-sub">{profile?.email || '—'}</div>
                  <div className="sd-row-sub" style={{marginTop:2}}>{profile?.role || ''}</div>
                </div>
              </div>
            </Section>
            <Section label={_t("settings.session","Session")}>
              <button className="sd-reset sd-signout" onClick={async () => {
                await window.sb.auth.signOut();
                window.location.href = 'Login.html';
              }}>
                <i className="ti ti-logout"></i>{_t("settings.sign_out","Sign out")}
              </button>
            </Section>
          </>}

          {/* ── BILLING TAB ── */}
          {tab === "billing" && <BillingPanel />}

        </div>

        <footer className="sd-foot">
          <span><i className="ti ti-cloud"></i>{_t("settings.saved_footer","Saved to cloud & this device")}</span>
        </footer>
      </aside>
    </>
  );
};

const SD_CSS = `
  .sd-overlay { position:fixed; inset:0; background:rgba(8,10,12,0.45); backdrop-filter:blur(4px); opacity:0; pointer-events:none; transition:opacity 200ms cubic-bezier(.2,.7,.2,1); z-index:900; }
  .sd-overlay.is-open { opacity:1; pointer-events:auto; }

  .sd-drawer {
    position:fixed; top:0; right:0; bottom:0; width:420px; max-width:96vw;
    background:var(--cm-bg);
    color:var(--cm-fg);
    border-left:1px solid var(--cm-border);
    box-shadow:0 24px 80px rgba(0,0,0,0.18);
    transform:translateX(100%);
    transition:transform 280ms cubic-bezier(.2,.7,.2,1);
    z-index:910;
    display:flex; flex-direction:column;
    font:var(--cm-body);
  }
  .sd-drawer.is-open { transform:translateX(0); }

  .sd-head { display:flex; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid var(--cm-border); }
  .sd-head-l { display:flex; align-items:center; gap:12px; flex:1; }
  .sd-head-l > i { font-size:20px; color:var(--cm-fg-muted); }
  .sd-title { font:600 16px/1 var(--cm-font-sans); letter-spacing:-0.01em; color:var(--cm-fg-strong); }
  .sd-sub { font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-muted); margin-top:3px; }
  .sd-x { width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px; border:1px solid var(--cm-border); background:transparent; color:var(--cm-fg-muted); cursor:pointer; }
  .sd-x:hover { background:var(--cm-bg-soft); color:var(--cm-fg); }
  .sd-x .ti { font-size:16px; }

  .sd-tabs { display:flex; gap:2px; padding:8px 12px; border-bottom:1px solid var(--cm-border); overflow-x:auto; }
  .sd-tab {
    display:inline-flex; align-items:center; gap:6px;
    height:30px; padding:0 10px;
    border:1px solid transparent; border-radius:7px;
    background:transparent; color:var(--cm-fg-muted);
    font:500 12.5px/1 var(--cm-font-sans); cursor:pointer;
    white-space:nowrap;
  }
  .sd-tab .ti { font-size:14px; }
  .sd-tab:hover { background:var(--cm-bg-soft); color:var(--cm-fg); }
  .sd-tab.is-on { background:var(--cm-accent-soft); color:var(--cm-fg-strong); border-color:var(--cm-border); }

  .sd-body { flex:1; overflow-y:auto; padding:8px 20px 24px; }
  .sd-section { padding:18px 0; border-bottom:1px solid var(--cm-border-soft); }
  .sd-section:last-child { border-bottom:0; }
  .sd-section-h { margin-bottom:12px; }
  .sd-section-l { font:600 13px/1 var(--cm-font-sans); color:var(--cm-fg-strong); }
  .sd-section-hint { font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-fg-muted); margin-top:4px; }

  /* Theme tiles */
  .sd-tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .sd-tile {
    border:1px solid var(--cm-border);
    border-radius:10px;
    padding:8px 8px 10px;
    background:var(--cm-surface);
    cursor:pointer;
    text-align:left;
    transition:border-color 120ms, box-shadow 120ms;
  }
  .sd-tile:hover { border-color:var(--cm-border-strong); }
  .sd-tile.is-on { border-color:var(--cm-accent); box-shadow:0 0 0 3px var(--cm-focus-ring); }
  .sd-tile-pv {
    height:64px; border-radius:6px; overflow:hidden;
    position:relative; border:1px solid;
  }
  .sd-tile-pv-bar { position:absolute; top:0; left:0; right:0; height:12px; }
  .sd-tile-pv-c { position:absolute; left:30%; top:18px; right:8px; bottom:8px; border-radius:4px; border:1px solid; }
  .sd-tile-label { display:flex; align-items:center; justify-content:space-between; padding:8px 4px 0; font:500 13px/1 var(--cm-font-sans); color:var(--cm-fg-strong); }
  .sd-tile-label .ti { font-size:14px; color:var(--cm-accent); }

  /* Accent swatches */
  .sd-swatches { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; }
  .sd-swatch {
    border:1px solid var(--cm-border);
    background:var(--cm-surface);
    border-radius:9px;
    padding:8px 6px 7px;
    display:flex; flex-direction:column; align-items:center; gap:6px;
    cursor:pointer;
    transition:border-color 120ms, box-shadow 120ms;
  }
  .sd-swatch:hover { border-color:var(--cm-border-strong); }
  .sd-swatch.is-on { border-color:var(--cm-accent); box-shadow:0 0 0 3px var(--cm-focus-ring); }
  .sd-swatch-hue { width:26px; height:26px; border-radius:50%; border:1px solid rgba(0,0,0,0.06); }
  .sd-swatch-name { font:500 10.5px/1 var(--cm-font-mono); color:var(--cm-fg-muted); text-transform:capitalize; letter-spacing:0.01em; }
  .sd-swatch.is-on .sd-swatch-name { color:var(--cm-fg-strong); }

  /* Chips */
  .sd-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .sd-chip {
    height:30px; padding:0 12px;
    border:1px solid var(--cm-border); border-radius:7px;
    background:var(--cm-surface); color:var(--cm-fg-muted);
    font:500 12.5px/1 var(--cm-font-sans);
    cursor:pointer;
    transition:border-color 120ms, color 120ms, background 120ms;
  }
  .sd-chip:hover { color:var(--cm-fg); border-color:var(--cm-border-strong); }
  .sd-chip.is-on { background:var(--cm-accent-soft); color:var(--cm-fg-strong); border-color:var(--cm-border-strong); }

  .sd-reset {
    display:inline-flex; align-items:center; gap:6px;
    height:32px; padding:0 12px;
    border:1px solid var(--cm-border); border-radius:7px;
    background:var(--cm-bg-soft); color:var(--cm-fg);
    font:500 12.5px/1 var(--cm-font-sans);
    cursor:pointer;
  }
  .sd-reset .ti { font-size:14px; }
  .sd-reset:hover { background:var(--cm-bg-sunk); }

  .sd-foot {
    padding:12px 20px;
    border-top:1px solid var(--cm-border);
    background:var(--cm-bg-soft);
    font:500 11.5px/1 var(--cm-font-mono);
    color:var(--cm-fg-muted);
    display:flex; align-items:center; gap:8px;
  }
  .sd-foot .ti { font-size:13px; }

  /* Row helper */
  .sd-row { display:flex; align-items:center; gap:12px; padding:6px 0; }
  .sd-row-l { flex:1; }
  .sd-row-label { font:500 13px/1 var(--cm-font-sans); color:var(--cm-fg); }
  .sd-row-sub { font:500 12px/1.3 var(--cm-font-sans); color:var(--cm-fg-muted); margin-top:2px; }

  /* Toggle rows (Notifications) */
  .sd-toggle-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--cm-border-soft); }
  .sd-toggle-row:last-child { border-bottom:0; }
  .sd-toggle {
    flex-shrink:0; width:40px; height:22px; border-radius:11px;
    border:none; cursor:pointer; position:relative;
    background:var(--cm-bg-sunk,#E5E5E5); transition:background 160ms;
  }
  .sd-toggle.is-on { background:var(--cm-accent); }
  .sd-toggle-thumb {
    position:absolute; top:3px; left:3px;
    width:16px; height:16px; border-radius:50%;
    background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.2);
    transition:left 160ms;
  }
  .sd-toggle.is-on .sd-toggle-thumb { left:21px; }

  /* Per-type team filter */
  .sd-teamrow { padding:12px 0; border-bottom:1px solid var(--cm-border-soft); }
  .sd-teamrow:last-child { border-bottom:0; }
  .sd-teamrow-h { margin-bottom:8px; }
  .sd-teamchips { display:flex; flex-wrap:wrap; gap:6px; }
  .sd-teamchip {
    display:inline-flex; align-items:center; gap:5px; cursor:pointer;
    padding:5px 10px; border-radius:999px; font:600 12px/1 var(--cm-font-sans);
    border:1px solid var(--cm-border); background:var(--cm-bg-soft); color:var(--cm-fg-muted);
    transition:background 140ms, color 140ms, border-color 140ms;
  }
  .sd-teamchip.is-on { background:var(--cm-accent-soft,var(--cm-accent)); border-color:var(--cm-accent); color:var(--cm-accent); }
  .sd-teamchip .ti { font-size:13px; }

  /* Info note */
  .sd-note { display:flex; align-items:flex-start; gap:7px; padding:10px 12px; margin-top:12px; background:var(--cm-bg-soft); border-radius:8px; font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-fg-muted); }
  .sd-note .ti { font-size:14px; flex-shrink:0; margin-top:1px; }

  /* Account tab */
  .sd-account-row { display:flex; align-items:center; gap:12px; padding:6px 0; }
  .sd-account-avatar { width:38px; height:38px; border-radius:50%; background:var(--cm-accent); color:var(--cm-fg-on-accent,#fff); font:600 16px/38px var(--cm-font-sans); text-align:center; flex-shrink:0; }
  .sd-signout { color:var(--cm-danger,#DC2626); }
  /* My profile (editable) */
  .sd-pf { display:flex; flex-direction:column; gap:12px; }
  .sd-pf-photo { display:flex; align-items:center; gap:12px; }
  .sd-pf-ava { width:56px; height:56px; border-radius:50%; overflow:hidden; background:var(--cm-bg-sunk); border:1px solid var(--cm-border); display:flex; align-items:center; justify-content:center; font:600 18px/1 var(--cm-font-sans); color:var(--cm-fg-muted); flex-shrink:0; }
  .sd-pf-ava img { width:100%; height:100%; object-fit:cover; }
  .sd-pf-photobtn { display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px; border:1px solid var(--cm-border); border-radius:8px; background:var(--cm-bg-soft); color:var(--cm-fg); font:500 12px/1 var(--cm-font-sans); cursor:pointer; }
  .sd-pf-photobtn:hover { border-color:var(--cm-accent); }
  .sd-pf-photobtn .ti { font-size:15px; }
  .sd-pf-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .sd-pf-f { display:flex; flex-direction:column; gap:5px; min-width:0; }
  .sd-pf-f.sd-pf-wide { grid-column:1 / -1; }
  .sd-pf-f > span { font:500 11.5px/1 var(--cm-font-sans); color:var(--cm-fg-muted); }
  .sd-pf-f input, .sd-pf-f select { height:36px; padding:0 10px; background:var(--cm-bg-soft); border:1px solid var(--cm-border); border-radius:8px; font:var(--cm-body-sm); color:var(--cm-fg); outline:none; box-sizing:border-box; width:100%; }
  .sd-pf-f input:focus, .sd-pf-f select:focus { border-color:var(--cm-accent); }
  .sd-pf-err { font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-danger,#DC2626); background:var(--cm-danger-bg,#FEF2F2); border-radius:8px; padding:8px 10px; }
  .sd-pf-actions { display:flex; justify-content:flex-end; }
  .sd-pf-save { height:34px; padding:0 16px; border:0; border-radius:8px; background:var(--cm-accent); color:var(--cm-fg-on-accent,#fff); font:600 12.5px/1 var(--cm-font-sans); cursor:pointer; }
  .sd-pf-save:disabled { opacity:.6; cursor:default; }
  .sd-pf-save:hover:not(:disabled) { background:var(--cm-accent-hover,var(--cm-accent)); }

  /* Reset confirmation */
  .sd-reset-confirm { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .sd-reset-confirm span { font:500 12.5px/1 var(--cm-font-sans); color:var(--cm-fg); }
  .sd-reset-yes { display:inline-flex; align-items:center; gap:5px; height:30px; padding:0 12px; border-radius:7px; border:none; background:var(--cm-danger,#DC2626); color:#fff; font:500 12.5px/1 var(--cm-font-sans); cursor:pointer; }
  .sd-reset-yes .ti { font-size:13px; }
  .sd-reset-no { display:inline-flex; align-items:center; height:30px; padding:0 12px; border-radius:7px; border:1px solid var(--cm-border); background:var(--cm-bg-soft); color:var(--cm-fg-muted); font:500 12.5px/1 var(--cm-font-sans); cursor:pointer; }

  /* Billing tab */
  .sd-billing-card { background:var(--cm-bg-soft); border:1px solid var(--cm-border); border-radius:8px; overflow:hidden; }
  .sd-billing-row { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--cm-border-soft); }
  .sd-billing-row:last-child { border-bottom:0; }
  .sd-billing-val { font:500 13px/1 var(--cm-font-mono); color:var(--cm-fg-strong); }

  /* Notification toasts */
  .cm-notif-stack { position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
  .cm-toast {
    pointer-events:auto;
    display:flex; align-items:flex-start; gap:10px;
    padding:14px 14px 14px 14px;
    min-width:280px; max-width:380px;
    background:var(--cm-bg); border:1px solid var(--cm-border);
    border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.18);
    cursor:pointer;
    animation:cm-toast-in 220ms cubic-bezier(.2,.7,.2,1);
  }
  .cm-toast:hover { background:var(--cm-bg-soft); }
  .cm-toast-icon { font-size:16px; color:var(--cm-accent); flex-shrink:0; margin-top:2px; }
  .cm-toast-body { flex:1; min-width:0; }
  .cm-toast-title { font:600 13px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); }
  .cm-toast-sub { font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-fg-muted); margin-top:3px; }
  .cm-toast-x { flex-shrink:0; width:22px; height:22px; border:none; background:transparent; color:var(--cm-fg-muted); cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:5px; }
  .cm-toast-x:hover { background:var(--cm-bg-sunk); }
  .cm-toast-x .ti { font-size:12px; }
  @keyframes cm-toast-in { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
`;

window.SettingsDrawer  = SettingsDrawer;
window.openCMSettings  = null;
window.initCMSettings  = initSettings;

// El contador de la campana lo pinta sidebar.js (#cm-nbadge, con el número y filtrado por
// equipo). Acá vivía un segundo indicador — un puntito rojo — que buscaba el botón por
// title/aria-label "Notifications": no existen en 23 de las 37 páginas con campana, y en las
// otras 14 i18n los traduce, así que no aparecía casi nunca. Se eliminó en vez de arreglarlo:
// hacerlo funcionar habría puesto dos marcas encima de la misma campana.

function SettingsHost() {
  const [open, setOpen]             = React.useState(false);
  const [profile, setProfile]       = React.useState(null);
  const [userId, setUserId]         = React.useState(null);
  const [supabaseSettings, setSbS]  = React.useState(null);
  const [notifPopups, setPopups]    = React.useState([]);
  const saveTimer  = React.useRef(null);
  const channelRef = React.useRef(null);

  // On mount: get user, load Supabase settings, subscribe to realtime notifications
  React.useEffect(() => {
    if (!window.sb) return;
    window.sb.auth.getSession().then(({ data }) => {
      const uid = data?.session?.user?.id;
      if (!uid) return;
      setUserId(uid);

      // ── i18n detection signals ──
      if (window.CM_I18N) {
        window.CM_I18N.setCloudSaver(async (lang) => {
          const { data: r } = await window.sb.from('profiles').select('settings').eq('id', uid).single();
          const next = { ...(r?.settings || {}), language: lang };
          await window.sb.from('profiles').update({ settings: next }).eq('id', uid);
        });
      }
      window.getClub && window.getClub().then(c => { if (c && window.CM_I18N) window.CM_I18N.setClubCountry(c.country); });

      // Load appearance + notification settings from Supabase
      window.sb.from('profiles')
        .select('settings, notification_settings')
        .eq('id', uid)
        .single()
        .then(({ data: row }) => {
          if (!row) return;
          if (window.CM_I18N && row.settings && row.settings.language) window.CM_I18N.setUserPref(row.settings.language);
          const sbSettings = {
            ...(row.settings || {}),
            notif: row.notification_settings || {},
          };
          if (Object.keys(row.settings || {}).length > 0 || Object.keys(row.notification_settings || {}).length > 0) {
            setSbS(sbSettings);
          }
        });

      // (el conteo de no leídos lo hace sidebar.js; acá sólo escuchamos para el popup)

      // Subscribe to new notifications via realtime
      channelRef.current = window.sb
        .channel('cm-notif-' + uid)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${uid}`,
        }, (payload) => {
          const n = payload.new;
          const id = Date.now() + Math.random();
          setPopups(prev => [...prev, { ...n, _popupId: id }]);
        })
        .subscribe();
    });
    return () => {
      channelRef.current && window.sb.removeChannel(channelRef.current);
    };
  }, []);

  // Expose open function globally
  React.useEffect(() => {
    window.openCMSettings = () => setOpen(true);
    return () => { window.openCMSettings = null; };
  }, []);

  // Load profile on first open
  React.useEffect(() => {
    if (!open || profile) return;
    window.getProfile && window.getProfile().then(p => setProfile(p));
  }, [open]);

  // Debounced Supabase save whenever settings change in the drawer
  function handleSettingsChange(s) {
    if (!userId || !window.sb) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { notif, ...appearance } = s;
      // The appearance save replaces the whole settings jsonb — preserve the
      // language pref (owned by CM_I18N.cloudSaver) so it isn't wiped.
      let _cm; try { _cm = localStorage.getItem('cm_lang'); } catch {}
      if (window.CM_I18N && _cm) appearance.language = window.CM_I18N.current;
      else delete appearance.language;
      const { error } = await window.sb.from('profiles').update({
        settings: appearance,
        notification_settings: notif || {},
      }).eq('id', userId);
      if (error) console.warn('[settings] cloud save failed:', error.message);
    }, 800);
  }

  function dismissPopup(popupId) {
    setPopups(prev => prev.filter(p => p._popupId !== popupId));
  }

  return <>
    <SettingsDrawer
      open={open}
      onClose={() => setOpen(false)}
      profile={profile}
      userId={userId}
      setProfile={setProfile}
      supabaseSettings={supabaseSettings}
      onSettingsChange={handleSettingsChange}
    />
    <div className="cm-notif-stack">
      {notifPopups.map(n => (
        <NotificationToast key={n._popupId} notif={n} onDismiss={() => dismissPopup(n._popupId)} />
      ))}
    </div>
  </>;
}

(function mount() {
  initSettings();
  const target = document.getElementById("settings-host") || (() => {
    const d = document.createElement("div");
    d.id = "settings-host";
    document.body.appendChild(d);
    return d;
  })();
  ReactDOM.createRoot(target).render(<SettingsHost />);
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-open-settings]");
    if (t) { e.preventDefault(); window.openCMSettings && window.openCMSettings(); }
  });
})();
