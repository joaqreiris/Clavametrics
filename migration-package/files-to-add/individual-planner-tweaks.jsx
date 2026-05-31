/* Tweaks for Individual S&C Planner. */

const IP_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "view": "kanban",
  "showKpis": true,
  "showTrainbar": true,
  "showSidePanel": true,
  "density": "regular"
}/*EDITMODE-END*/;

function IndividualPlannerTweaks() {
  const [t, setTweak] = useTweaks(IP_TWEAK_DEFAULTS);

  React.useEffect(() => {
    const apply = () => {
      const api = window.__ipApi;
      if (!api) { setTimeout(apply, 80); return; }
      api.showView(t.view);
      api.setShowKpis(t.showKpis);
      api.setShowTrainbar(t.showTrainbar);
      api.setShowSidePanel(t.showSidePanel);
      api.setDensity(t.density);
    };
    apply();
  }, [t]);

  return (
    <TweaksPanel title="Tweaks">
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
        label="KPI strip"
        value={t.showKpis}
        onChange={(v) => setTweak('showKpis', v)}
      />
      <TweakToggle
        label="Training phases bar"
        value={t.showTrainbar}
        onChange={(v) => setTweak('showTrainbar', v)}
      />
      <TweakToggle
        label="Side panel"
        value={t.showSidePanel}
        onChange={(v) => setTweak('showSidePanel', v)}
      />
    </TweaksPanel>
  );
}

const ipTweaksRoot = ReactDOM.createRoot(document.getElementById('tweaks-root'));
ipTweaksRoot.render(<IndividualPlannerTweaks />);
