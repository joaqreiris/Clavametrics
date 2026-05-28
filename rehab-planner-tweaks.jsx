/* Tweaks for Rehab Planner.
   Exposes mode switch, view switch, density, panel toggles.
   Persisted via __edit_mode_set_keys. */

const RP_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "rehab",
  "view": "kanban",
  "showPhasebar": true,
  "showCriteria": true,
  "showMacro": true,
  "showSidePanel": true,
  "density": "regular"
}/*EDITMODE-END*/;

function RehabPlannerTweaks() {
  const [t, setTweak] = useTweaks(RP_TWEAK_DEFAULTS);

  // Apply all tweaks whenever values change (or on mount).
  React.useEffect(() => {
    const api = window.__rpApi;
    if (!api) return;
    api.setMode(t.mode);
    api.showView(t.view);
    api.setShowPhasebar(t.showPhasebar && t.mode === 'rehab');
    api.setShowCriteria(t.showCriteria && t.mode === 'rehab');
    api.setShowMacro(t.showMacro);
    api.setShowSidePanel(t.showSidePanel);
    api.setDensity(t.density);
  }, [t]);

  // If apiwasn't ready on mount (initial picker view), retry once DOM is ready.
  React.useEffect(() => {
    const retry = () => {
      if (window.__rpApi) {
        window.__rpApi.setMode(t.mode);
        window.__rpApi.showView(t.view);
        window.__rpApi.setShowPhasebar(t.showPhasebar && t.mode === 'rehab');
        window.__rpApi.setShowCriteria(t.showCriteria && t.mode === 'rehab');
        window.__rpApi.setShowMacro(t.showMacro);
        window.__rpApi.setShowSidePanel(t.showSidePanel);
        window.__rpApi.setDensity(t.density);
      } else {
        setTimeout(retry, 80);
      }
    };
    retry();
  }, []);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Plan mode" />
      <TweakRadio
        label="Type"
        value={t.mode}
        options={['prev', 'rehab']}
        onChange={(v) => setTweak('mode', v)}
      />

      <TweakSection label="Layout" />
      <TweakRadio
        label="View"
        value={t.view}
        options={['kanban', 'table', 'timeline']}
        onChange={(v) => setTweak('view', v)}
      />
      <TweakRadio
        label="Density"
        value={t.density}
        options={['compact', 'regular', 'spacious']}
        onChange={(v) => setTweak('density', v)}
      />

      <TweakSection label="Panels" />
      <TweakToggle
        label="Rehab timeline"
        value={t.showPhasebar}
        onChange={(v) => setTweak('showPhasebar', v)}
      />
      <TweakToggle
        label="Macro grid"
        value={t.showMacro}
        onChange={(v) => setTweak('showMacro', v)}
      />
      <TweakToggle
        label="Progression criteria"
        value={t.showCriteria}
        onChange={(v) => setTweak('showCriteria', v)}
      />
      <TweakToggle
        label="Side panel"
        value={t.showSidePanel}
        onChange={(v) => setTweak('showSidePanel', v)}
      />
    </TweaksPanel>
  );
}

const rpTweaksRoot = ReactDOM.createRoot(document.getElementById('tweaks-root'));
rpTweaksRoot.render(<RehabPlannerTweaks />);
