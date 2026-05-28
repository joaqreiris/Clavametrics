// lineup-tweaks.jsx — Tweaks panel for the Lineup builder.
// Exposes: poster style, formation, language, show jersey numbers,
// captain badge on/off. Talks to window.LineupAPI installed by lineup.js.

const LINEUP_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "style": "editorial",
  "formation": "4-3-3",
  "language": "es",
  "showNumbers": true,
  "captainBadge": true
}/*EDITMODE-END*/;

function LineupTweaksApp() {
  const [t, setTweak] = useTweaks(LINEUP_TWEAK_DEFAULTS);

  // Whenever a tweak changes, push it into the page via LineupAPI.
  React.useEffect(() => {
    if (!window.LineupAPI) return;
    window.LineupAPI.setStyle(t.style);
  }, [t.style]);
  React.useEffect(() => {
    if (!window.LineupAPI) return;
    window.LineupAPI.setFormation(t.formation);
  }, [t.formation]);
  React.useEffect(() => {
    if (!window.LineupAPI) return;
    window.LineupAPI.setLanguage(t.language);
  }, [t.language]);
  React.useEffect(() => {
    if (!window.LineupAPI) return;
    window.LineupAPI.setShowNumbers(t.showNumbers);
  }, [t.showNumbers]);
  React.useEffect(() => {
    if (!window.LineupAPI) return;
    window.LineupAPI.setCaptainBadge(t.captainBadge);
  }, [t.captainBadge]);

  return (
    <TweaksPanel title="Lineup Tweaks">
      <TweakSection label="Poster style" />
      <TweakSelect
        label="Look & feel"
        value={t.style}
        options={[
          { value: 'editorial', label: 'Editorial · oscuro' },
          { value: 'stadium',   label: 'Stadium · broadcast' },
          { value: 'magazine',  label: 'Magazine · papel' },
          { value: 'ticket',    label: 'Ticket · vintage' },
        ]}
        onChange={(v) => setTweak('style', v)}
      />

      <TweakSection label="Formación" />
      <TweakSelect
        label="Sistema"
        value={t.formation}
        options={['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '3-4-3']}
        onChange={(v) => setTweak('formation', v)}
      />

      <TweakSection label="Contenido" />
      <TweakRadio
        label="Idioma"
        value={t.language}
        options={[
          { value: 'es', label: 'ES' },
          { value: 'en', label: 'EN' },
        ]}
        onChange={(v) => setTweak('language', v)}
      />
      <TweakToggle
        label="Dorsales en el campo"
        value={t.showNumbers}
        onChange={(v) => setTweak('showNumbers', v)}
      />
      <TweakToggle
        label="Distintivo de capitán"
        value={t.captainBadge}
        onChange={(v) => setTweak('captainBadge', v)}
      />
    </TweaksPanel>
  );
}

(function mount() {
  const root = document.getElementById('tweaks-root');
  if (!root) return;
  ReactDOM.createRoot(root).render(<LineupTweaksApp />);
})();
