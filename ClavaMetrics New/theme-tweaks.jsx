/* Shared Tweaks panel for ClavaMetrics prototypes.
   Lets the user switch theme direction (light / dark / hybrid) and
   nudge tonalities (accent hue, neutral hue, corner radius, density).
*/

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "neutral",
  "radius": "regular",
  "density": "balanced",
  "sidebarHue": "default"
}/*EDITMODE-END*/;

// Per-page can override defaults by setting window.__CM_TWEAK_DEFAULTS
// before this script loads (typically inline in the HTML <head>).
// Persisted in-app Settings (settings-drawer.jsx) take priority over both.
const _PERSISTED_SETTINGS = (() => {
  try { return JSON.parse(localStorage.getItem("cm-settings.v1") || "{}"); } catch { return {}; }
})();
const RUNTIME_DEFAULTS = Object.assign({}, TWEAK_DEFAULTS, window.__CM_TWEAK_DEFAULTS || {}, _PERSISTED_SETTINGS);

/* ───────── Token recipes per direction ───────── */

const ACCENT_SWATCHES = {
  light: {
    neutral: { swatch: ["#0A0A0A","#E5E7EB"], tokens: { "--cm-accent": "#0A0A0A", "--cm-accent-hover": "#1F1F1F", "--cm-accent-press": "#000", "--cm-fg-on-accent": "#fff" }},
    green:   { swatch: ["#15803D","#ECFDF5"], tokens: { "--cm-accent": "#15803D", "--cm-accent-hover": "#166534", "--cm-accent-press": "#14532D", "--cm-fg-on-accent": "#fff" }},
    blue:    { swatch: ["#2563EB","#EFF6FF"], tokens: { "--cm-accent": "#2563EB", "--cm-accent-hover": "#1D4ED8", "--cm-accent-press": "#1E40AF", "--cm-fg-on-accent": "#fff" }},
    violet:  { swatch: ["#7C3AED","#F5F3FF"], tokens: { "--cm-accent": "#7C3AED", "--cm-accent-hover": "#6D28D9", "--cm-accent-press": "#5B21B6", "--cm-fg-on-accent": "#fff" }},
    gold:    { swatch: ["#A87C2A","#FAF3E2"], tokens: { "--cm-accent": "#A87C2A", "--cm-accent-hover": "#8C6520", "--cm-accent-press": "#75531B", "--cm-fg-on-accent": "#fff" }},
  },
  dark: {
    neutral: { swatch: ["#FAFAFA","#222222"], tokens: { "--cm-accent": "#FAFAFA", "--cm-accent-hover": "#E5E5E5", "--cm-accent-press": "#fff", "--cm-fg-on-accent": "#0A0A0A" }},
    green:   { swatch: ["#22C55E","#0E1B12"], tokens: { "--cm-accent": "#22C55E", "--cm-accent-hover": "#16A34A", "--cm-accent-press": "#15803D", "--cm-fg-on-accent": "#0A0A0A" }},
    blue:    { swatch: ["#3B82F6","#0F1726"], tokens: { "--cm-accent": "#3B82F6", "--cm-accent-hover": "#2563EB", "--cm-accent-press": "#1D4ED8", "--cm-fg-on-accent": "#fff" }},
    violet:  { swatch: ["#A78BFA","#1A1226"], tokens: { "--cm-accent": "#A78BFA", "--cm-accent-hover": "#8B5CF6", "--cm-accent-press": "#7C3AED", "--cm-fg-on-accent": "#0A0A0A" }},
    gold:    { swatch: ["#C9A84C","#1F1810"], tokens: { "--cm-accent": "#C9A84C", "--cm-accent-hover": "#A87C2A", "--cm-accent-press": "#8B6520", "--cm-fg-on-accent": "#0A0A0A" }},
  },
  hybrid: {
    neutral: { swatch: ["#0A0A0A","#E5E7EB"], tokens: { "--cm-accent": "#0A0A0A", "--cm-accent-hover": "#1F1F1F", "--cm-accent-press": "#000", "--cm-fg-on-accent": "#fff", "--cm-side-item-active-bg": "rgba(255,255,255,0.06)", "--cm-side-item-active-fg": "#fff", "--cm-side-accent": "#fff" }},
    green:   { swatch: ["#15803D","#0E1116"], tokens: { "--cm-accent": "#15803D", "--cm-accent-hover": "#166534", "--cm-accent-press": "#14532D", "--cm-fg-on-accent": "#fff", "--cm-side-item-active-bg": "rgba(34,197,94,0.10)", "--cm-side-item-active-fg": "#4ADE80", "--cm-side-accent": "#4ADE80" }},
    blue:    { swatch: ["#2563EB","#0E1116"], tokens: { "--cm-accent": "#2563EB", "--cm-accent-hover": "#1D4ED8", "--cm-accent-press": "#1E40AF", "--cm-fg-on-accent": "#fff", "--cm-side-item-active-bg": "rgba(59,130,246,0.14)", "--cm-side-item-active-fg": "#60A5FA", "--cm-side-accent": "#60A5FA" }},
    violet:  { swatch: ["#7C3AED","#0E1116"], tokens: { "--cm-accent": "#7C3AED", "--cm-accent-hover": "#6D28D9", "--cm-accent-press": "#5B21B6", "--cm-fg-on-accent": "#fff", "--cm-side-item-active-bg": "rgba(167,139,250,0.14)", "--cm-side-item-active-fg": "#A78BFA", "--cm-side-accent": "#A78BFA" }},
    gold:    { swatch: ["#A87C2A","#0E1116"], tokens: { "--cm-accent": "#A87C2A", "--cm-accent-hover": "#8C6520", "--cm-accent-press": "#75531B", "--cm-fg-on-accent": "#fff", "--cm-side-item-active-bg": "rgba(201,168,76,0.16)", "--cm-side-item-active-fg": "#E5C875", "--cm-side-accent": "#E5C875" }},
  },
};

const SIDEBAR_HUE = {
  default: {},  // theme default
  ink:     { "--cm-side-bg": "#0A0A0A" },
  slate:   { "--cm-side-bg": "#0F172A" },
  forest:  { "--cm-side-bg": "#0D1F17" },
  zinc:    { "--cm-side-bg": "#18181B" },
};

const RADIUS = {
  tight:   { "--cm-r-2":"4px","--cm-r-3":"5px","--cm-r-4":"6px","--cm-r-5":"8px","--cm-r-6":"10px" },
  regular: {},
  soft:    { "--cm-r-2":"8px","--cm-r-3":"10px","--cm-r-4":"14px","--cm-r-5":"18px","--cm-r-6":"22px" },
};

const DENSITY = {
  compact:    { "--cm-page-pad-y":"20px", "--cm-page-pad-x":"24px" },
  balanced:   {},
  comfortable:{ "--cm-page-pad-y":"40px", "--cm-page-pad-x":"40px" },
};

function applyTokens(theme, accent, radius, density, sidebarHue) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);

  // Wipe previously-set inline custom props so we re-apply cleanly.
  const wipe = [
    "--cm-accent","--cm-accent-hover","--cm-accent-press","--cm-fg-on-accent",
    "--cm-side-item-active-bg","--cm-side-item-active-fg","--cm-side-accent","--cm-side-bg",
    "--cm-r-2","--cm-r-3","--cm-r-4","--cm-r-5","--cm-r-6",
    "--cm-page-pad-y","--cm-page-pad-x"
  ];
  wipe.forEach(k => root.style.removeProperty(k));

  const accentRecipe = (ACCENT_SWATCHES[theme] && ACCENT_SWATCHES[theme][accent]) || {};
  Object.entries(accentRecipe.tokens || {}).forEach(([k,v]) => root.style.setProperty(k,v));

  Object.entries(SIDEBAR_HUE[sidebarHue] || {}).forEach(([k,v]) => root.style.setProperty(k,v));
  Object.entries(RADIUS[radius]   || {}).forEach(([k,v]) => root.style.setProperty(k,v));
  Object.entries(DENSITY[density] || {}).forEach(([k,v]) => root.style.setProperty(k,v));
}

function ThemeTweaks() {
  const { TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakColor, TweakSelect } = window;
  const [t, setTweak] = useTweaks(RUNTIME_DEFAULTS);

  // Apply tokens whenever any tweak changes.
  React.useEffect(() => {
    applyTokens(t.theme, t.accent, t.radius, t.density, t.sidebarHue);
    // Mirror to the in-app Settings persistence so both surfaces share state.
    try {
      localStorage.setItem("cm-settings.v1", JSON.stringify({
        theme: t.theme, accent: t.accent, radius: t.radius, density: t.density, sidebarHue: t.sidebarHue
      }));
    } catch {}
  }, [t.theme, t.accent, t.radius, t.density, t.sidebarHue]);

  const swatchesForTheme = (theme) =>
    Object.entries(ACCENT_SWATCHES[theme]).map(([k,v]) => v.swatch);

  const swatchKeys = Object.keys(ACCENT_SWATCHES[t.theme]);
  const currentSwatch = ACCENT_SWATCHES[t.theme][t.accent]?.swatch || swatchesForTheme(t.theme)[0];

  return (
    <TweaksPanel title="Tweaks · ClavaMetrics">
      <TweakSection label="Direction">
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={[
            { value: "light",  label: "Light" },
            { value: "dark",   label: "Dark" },
            { value: "hybrid", label: "Hybrid" },
          ]}
          onChange={(v) => {
            // Reset accent to first available for the new theme if current doesn't exist
            const nextAccent = ACCENT_SWATCHES[v][t.accent] ? t.accent : "neutral";
            setTweak({ theme: v, accent: nextAccent });
          }}
        />
      </TweakSection>

      <TweakSection label="Accent">
        <TweakColor
          label="Primary"
          value={currentSwatch}
          options={swatchesForTheme(t.theme)}
          onChange={(swatch) => {
            // Find which key this swatch belongs to
            const entry = Object.entries(ACCENT_SWATCHES[t.theme]).find(
              ([_,v]) => JSON.stringify(v.swatch) === JSON.stringify(swatch)
            );
            if (entry) setTweak("accent", entry[0]);
          }}
        />
      </TweakSection>

      {t.theme === "hybrid" || t.theme === "dark" ? (
        <TweakSection label="Sidebar tone">
          <TweakRadio
            label="Hue"
            value={t.sidebarHue}
            options={[
              { value: "default", label: "Default" },
              { value: "ink",     label: "Ink" },
              { value: "slate",   label: "Slate" },
              { value: "forest",  label: "Forest" },
              { value: "zinc",    label: "Zinc" },
            ]}
            onChange={(v) => setTweak("sidebarHue", v)}
          />
        </TweakSection>
      ) : null}

      <TweakSection label="Shape">
        <TweakRadio
          label="Corners"
          value={t.radius}
          options={[
            { value: "tight",   label: "Tight" },
            { value: "regular", label: "Regular" },
            { value: "soft",    label: "Soft" },
          ]}
          onChange={(v) => setTweak("radius", v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={[
            { value: "compact",     label: "Compact" },
            { value: "balanced",    label: "Balanced" },
            { value: "comfortable", label: "Comfy" },
          ]}
          onChange={(v) => setTweak("density", v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

(function mount() {
  const target = document.getElementById("tweaks-root") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "tweaks-root" }));
  // Apply defaults immediately so the page renders correctly before mounting
  applyTokens(RUNTIME_DEFAULTS.theme, RUNTIME_DEFAULTS.accent, RUNTIME_DEFAULTS.radius, RUNTIME_DEFAULTS.density, RUNTIME_DEFAULTS.sidebarHue);
  const root = ReactDOM.createRoot(target);
  root.render(<ThemeTweaks />);
})();
