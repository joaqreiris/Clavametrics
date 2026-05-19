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

const SettingsDrawer = ({ open, onClose }) => {
  const [s, setS] = React.useState(initSettings);
  React.useEffect(() => { _apply(s); saveSettings(s); }, [s]);
  // Lock scroll
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const set = (patch) => setS((p) => ({ ...p, ...patch }));
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
          <button className="sd-tab is-on"><i className="ti ti-palette"></i>Appearance</button>
          <button className="sd-tab"><i className="ti ti-bell"></i>Notifications</button>
          <button className="sd-tab"><i className="ti ti-shield-lock"></i>Account</button>
          <button className="sd-tab"><i className="ti ti-credit-card"></i>Billing</button>
        </nav>

        <div className="sd-body">

          {/* Theme direction — visual tiles */}
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
            <button className="sd-reset" onClick={() => {
              localStorage.removeItem(SETTINGS_KEY);
              const d = initSettings();
              setS(d);
            }}>
              <i className="ti ti-rotate"></i>Reset to workspace defaults
            </button>
          </Section>

        </div>

        <footer className="sd-foot">
          <span><i className="ti ti-device-floppy"></i>Saved automatically to this device</span>
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

  /* Row helper (unused currently but available) */
  .sd-row { display:flex; align-items:center; gap:12px; padding:6px 0; }
  .sd-row-l { flex:1; }
  .sd-row-label { font:500 13px/1 var(--cm-font-sans); color:var(--cm-fg); }
  .sd-row-sub { font:500 12px/1.3 var(--cm-font-sans); color:var(--cm-fg-muted); margin-top:2px; }
`;

window.SettingsDrawer = SettingsDrawer;
window.openCMSettings = null;  // set by mountSettingsHost
window.initCMSettings  = initSettings;

function SettingsHost() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    window.openCMSettings = () => setOpen(true);
    return () => { window.openCMSettings = null; };
  }, []);
  return <SettingsDrawer open={open} onClose={() => setOpen(false)} />;
}

(function mount() {
  // Apply persisted settings (or page defaults) on load \u2014 before paint.
  initSettings();
  const target = document.getElementById("settings-host") || (() => {
    const d = document.createElement("div");
    d.id = "settings-host";
    document.body.appendChild(d);
    return d;
  })();
  ReactDOM.createRoot(target).render(<SettingsHost />);
  // Auto-wire any element with [data-open-settings]
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-open-settings]");
    if (t) { e.preventDefault(); window.openCMSettings && window.openCMSettings(); }
  });
})();
