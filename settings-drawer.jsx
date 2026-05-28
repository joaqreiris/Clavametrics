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

/* --- Apply persisted (or default) settings immediately --- */
function initSettings() {
  const persisted = loadSettings();
  const defaults = window.__CM_TWEAK_DEFAULTS || { theme:"light", accent:"neutral" };
  const s = Object.assign(
    { theme: "light", accent: "neutral", radius: "regular", density: "balanced", sidebarHue: "default" },
    defaults,
    persisted
  );
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
      <div className="sd-section-h"><div className="sd-section-l">Workspace subscription</div></div>
      <div className="sd-section-body">
        <div className="sd-billing-card">
          <div className="sd-billing-row">
            <span className="sd-row-label">Plan</span>
            <span className="sd-billing-val">{loading ? '…' : (plan || '—')}</span>
          </div>
          <div className="sd-billing-row">
            <span className="sd-row-label">Monthly amount</span>
            <span className="sd-billing-val">{loading ? '…' : (amount ? `$${amount}` : '—')}</span>
          </div>
          <div className="sd-billing-row">
            <span className="sd-row-label">Next billing date</span>
            <span className="sd-billing-val">{loading ? '…' : (next ? new Date(next).toLocaleDateString([], { month:'long', day:'numeric', year:'numeric' }) : '—')}</span>
          </div>
          <div className="sd-billing-row">
            <span className="sd-row-label">Status</span>
            <span className="sd-billing-val" style={{color: status === 'active' ? 'var(--cm-success)' : 'var(--cm-fg-muted)'}}>{loading ? '…' : (status || '—')}</span>
          </div>
        </div>
        <div style={{padding:'10px 14px', borderTop:'1px solid var(--cm-border-soft)'}}>
          <a href="Billing.html" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12.5,fontWeight:500,color:'var(--cm-accent)',textDecoration:'none'}}>
            Ver detalle completo <i className="ti ti-arrow-right" style={{fontSize:13}}></i>
          </a>
        </div>
        <div className="sd-note" style={{marginTop:12}}>
          <i className="ti ti-brand-stripe"></i>
          Billing is managed via Stripe. Subscription data syncs automatically when the webhook is active. Contact your admin to change plans.
        </div>
      </div>
    </div>
  </>;
};

const SettingsDrawer = ({ open, onClose, profile, supabaseSettings, onSettingsChange }) => {
  const [s, setS]       = React.useState(initSettings);
  const [tab, setTab]   = React.useState("appearance");
  const [resetConfirm, setResetConfirm] = React.useState(false);

  // Apply locally + persist localStorage + notify host for Supabase save
  React.useEffect(() => { _apply(s); saveSettings(s); onSettingsChange && onSettingsChange(s); }, [s]);
  // Merge Supabase settings when received from host (e.g. after cross-device change)
  React.useEffect(() => {
    if (!supabaseSettings) return;
    setS(prev => { const m = { ...prev, ...supabaseSettings }; _apply(m); saveSettings(m); return m; });
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

  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const setNotif = (key, val) => set({ notif: { ...s.notif, [key]: val } });
  const themeBg = (t) => t === "dark" ? "#0A0A0A" : (t === "hybrid" ? "linear-gradient(90deg,#0E1116 0%,#0E1116 30%,#FBFBFA 30%,#FBFBFA 100%)" : "#FBFBFA");
  const themeBorder = (t) => t === "dark" ? "rgba(255,255,255,0.10)" : "#E5E7EB";

  const swatchesForTheme = Object.entries(_ACCENT[s.theme]);

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

  return (
    <>
      <style>{SD_CSS}</style>
      <div className={`sd-overlay ${open ? "is-open" : ""}`} onClick={onClose} />
      <aside className={`sd-drawer ${open ? "is-open" : ""}`} role="dialog" aria-label="Settings">
        <header className="sd-head">
          <div className="sd-head-l">
            <i className="ti ti-settings"></i>
            <div>
              <div className="sd-title">Settings</div>
              <div className="sd-sub">Appearance · workspace · account</div>
            </div>
          </div>
          <button className="sd-x" onClick={onClose} aria-label="Close">
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
              <i className={`ti ${icon}`}></i>{label}
            </button>
          ))}
        </nav>

        <div className="sd-body">

          {/* ── APPEARANCE TAB ── */}
          {tab === "appearance" && <>
            <Section label="Theme" hint="How the chrome looks across the app.">
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
                      <span>{t === "light" ? "Light" : t === "dark" ? "Dark" : "Hybrid"}</span>
                      {s.theme === t ? <i className="ti ti-check"></i> : null}
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Accent" hint="Used for primary buttons, active nav, and focus rings.">
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
              <Section label="Sidebar tone">
                <div className="sd-chips">
                  {[
                    { v:"default", l:"Default" },
                    { v:"ink",     l:"Ink" },
                    { v:"slate",   l:"Slate" },
                    { v:"forest",  l:"Forest" },
                    { v:"zinc",    l:"Zinc" },
                  ].map(o => (
                    <button key={o.v} className={`sd-chip ${s.sidebarHue === o.v ? "is-on" : ""}`} onClick={() => set({ sidebarHue: o.v })}>{o.l}</button>
                  ))}
                </div>
              </Section>
            ) : null}

            <Section label="Density" hint="Affects vertical padding inside cards & tables.">
              <div className="sd-chips">
                {[
                  { v:"compact",     l:"Compact" },
                  { v:"balanced",    l:"Balanced" },
                  { v:"comfortable", l:"Comfy" },
                ].map(o => (
                  <button key={o.v} className={`sd-chip ${s.density === o.v ? "is-on" : ""}`} onClick={() => set({ density: o.v })}>{o.l}</button>
                ))}
              </div>
            </Section>

            <Section label="Corners">
              <div className="sd-chips">
                {[
                  { v:"tight",   l:"Tight" },
                  { v:"regular", l:"Regular" },
                  { v:"soft",    l:"Soft" },
                ].map(o => (
                  <button key={o.v} className={`sd-chip ${s.radius === o.v ? "is-on" : ""}`} onClick={() => set({ radius: o.v })}>{o.l}</button>
                ))}
              </div>
            </Section>

            <Section label="Reset">
              {resetConfirm ? (
                <div className="sd-reset-confirm">
                  <span>Reset all appearance settings?</span>
                  <button className="sd-reset-yes" onClick={() => {
                    localStorage.removeItem(SETTINGS_KEY);
                    const d = initSettings();
                    setS(d);
                    setResetConfirm(false);
                  }}><i className="ti ti-check"></i>Yes, reset</button>
                  <button className="sd-reset-no" onClick={() => setResetConfirm(false)}>Cancel</button>
                </div>
              ) : (
                <button className="sd-reset" onClick={() => setResetConfirm(true)}>
                  <i className="ti ti-rotate"></i>Reset to workspace defaults
                </button>
              )}
            </Section>
          </>}

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === "notifications" && <>
            <Section label="In-app alerts" hint="Shown as badges and banners inside the app.">
              {[
                { key:"alertInjury",  label:"Injury reported",         sub:"Badge on the Physio nav item" },
                { key:"alertTask",    label:"Task assigned to me",      sub:"Badge on the Tasks nav item" },
                { key:"alertSession", label:"Session published",        sub:"Shown in Hub activity feed" },
              ].map(({ key, label, sub }) => (
                <div key={key} className="sd-toggle-row">
                  <div className="sd-row-l">
                    <div className="sd-row-label">{label}</div>
                    <div className="sd-row-sub">{sub}</div>
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
            <Section label="Email digest" hint="Requires email delivery to be configured by the workspace admin.">
              {[
                { key:"emailWeekly",  label:"Weekly summary",    sub:"Sent every Monday morning" },
                { key:"emailInjury",  label:"Injury alerts",     sub:"Immediate — for medical staff" },
              ].map(({ key, label, sub }) => (
                <div key={key} className="sd-toggle-row">
                  <div className="sd-row-l">
                    <div className="sd-row-label">{label}</div>
                    <div className="sd-row-sub">{sub}</div>
                  </div>
                  <button
                    role="switch" aria-checked={!!(s.notif && s.notif[key])}
                    className={`sd-toggle ${s.notif && s.notif[key] ? "is-on" : ""}`}
                    onClick={() => setNotif(key, !(s.notif && s.notif[key]))}>
                    <span className="sd-toggle-thumb" />
                  </button>
                </div>
              ))}
              <div className="sd-note"><i className="ti ti-info-circle"></i>Email delivery is not yet configured for this workspace. Preferences are saved for when it is.</div>
            </Section>
          </>}

          {/* ── ACCOUNT TAB ── */}
          {tab === "account" && <>
            <Section label="Signed in as">
              <div className="sd-account-row">
                <div className="sd-account-avatar">{profile ? (profile.full_name || profile.email || '?')[0].toUpperCase() : '?'}</div>
                <div>
                  {profile?.full_name && <div className="sd-row-label">{profile.full_name}</div>}
                  <div className="sd-row-sub">{profile?.email || '—'}</div>
                  <div className="sd-row-sub" style={{marginTop:2}}>{profile?.role || ''}</div>
                </div>
              </div>
            </Section>
            <Section label="Session">
              <button className="sd-reset sd-signout" onClick={async () => {
                await window.sb.auth.signOut();
                window.location.href = 'Login.html';
              }}>
                <i className="ti ti-logout"></i>Sign out
              </button>
            </Section>
          </>}

          {/* ── BILLING TAB ── */}
          {tab === "billing" && <BillingPanel />}

        </div>

        <footer className="sd-foot">
          <span><i className="ti ti-cloud"></i>Saved to cloud &amp; this device</span>
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

  /* Info note */
  .sd-note { display:flex; align-items:flex-start; gap:7px; padding:10px 12px; margin-top:12px; background:var(--cm-bg-soft); border-radius:8px; font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-fg-muted); }
  .sd-note .ti { font-size:14px; flex-shrink:0; margin-top:1px; }

  /* Account tab */
  .sd-account-row { display:flex; align-items:center; gap:12px; padding:6px 0; }
  .sd-account-avatar { width:38px; height:38px; border-radius:50%; background:var(--cm-accent); color:var(--cm-fg-on-accent,#fff); font:600 16px/38px var(--cm-font-sans); text-align:center; flex-shrink:0; }
  .sd-signout { color:var(--cm-danger,#DC2626); }

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

function updateBellBadge(count) {
  const btn = document.querySelector('[title="Notifications"],[aria-label="Notifications"]');
  if (!btn) return;
  let badge = btn.querySelector('.cm-bell-badge');
  if (count <= 0) { badge && badge.remove(); return; }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'cm-bell-badge';
    Object.assign(badge.style, {
      position:'absolute', top:'3px', right:'3px',
      width:'7px', height:'7px', borderRadius:'50%',
      background:'var(--cm-danger,#DC2626)', pointerEvents:'none',
    });
    btn.style.position = 'relative';
    btn.appendChild(badge);
  }
}

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

      // Load appearance + notification settings from Supabase
      window.sb.from('profiles')
        .select('settings, notification_settings')
        .eq('id', uid)
        .single()
        .then(({ data: row }) => {
          if (!row) return;
          const sbSettings = {
            ...(row.settings || {}),
            notif: row.notification_settings || {},
          };
          if (Object.keys(row.settings || {}).length > 0 || Object.keys(row.notification_settings || {}).length > 0) {
            setSbS(sbSettings);
          }
        });

      // Count existing unread notifications
      window.sb.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('read', false)
        .then(({ count }) => { if (count > 0) updateBellBadge(count); });

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
          // Increment bell badge
          const btn = document.querySelector('[title="Notifications"],[aria-label="Notifications"]');
          const cur = btn ? parseInt(btn.dataset.unread || '0', 10) : 0;
          if (btn) btn.dataset.unread = cur + 1;
          updateBellBadge(cur + 1);
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
    saveTimer.current = setTimeout(() => {
      const { notif, ...appearance } = s;
      window.sb.from('profiles').update({
        settings: appearance,
        notification_settings: notif || {},
      }).eq('id', userId);
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
