/* ClavaMetrics — Home Tweaks
   Lets the user compare 3 hero directions live. The hero is plain HTML,
   so the tweak applies each variant by editing the DOM (eyebrow / h1 / sub)
   and starting or stopping the headline rotator. Brand stays locked. */

const HOME_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "hero": "category"
}/*EDITMODE-END*/;

const HERO_VARIANTS = {
  category: {
    label: "Category",
    eyebrow: "Performance OS for sport",
    h1: 'The performance OS for<br><span class="rotator" id="rotator"><span>football clubs</span></span>',
    rotator: true,
    sub: "Plan microcycles, monitor load, track availability and analyze GPS — across every category, in one workspace. From the senior squad down to the Sub-14.",
  },
  outcome: {
    label: "Outcome",
    eyebrow: "Train smarter · Stay available",
    h1: 'Fewer injuries.<br>Sharper calls.<br><span class="hl">Every category.</span>',
    rotator: false,
    sub: "Plan microcycles, monitor workload and track availability in one workspace — so your staff walks into every session knowing exactly who's ready and what to do.",
  },
  scale: {
    label: "Scale",
    eyebrow: "From the Sub-14 to the first team",
    h1: 'One performance workspace<br>for <span class="hl">every category</span>',
    rotator: false,
    sub: "From a single youth squad to a full federation — plan, monitor and analyze every team in one place. No more spreadsheets, group chats or disconnected tools.",
  },
};

function applyHero(key) {
  const v = HERO_VARIANTS[key] || HERO_VARIANTS.category;
  const eyebrow = document.querySelector(".hero-eyebrow");
  const h1 = document.querySelector(".hero h1");
  const sub = document.querySelector(".hero p.sub");
  if (!h1) return;
  if (window.__stopRotator) window.__stopRotator();
  if (eyebrow) eyebrow.textContent = v.eyebrow;
  h1.innerHTML = v.h1;
  if (sub) sub.textContent = v.sub;
  if (v.rotator && window.__startRotator) window.__startRotator();
}

function HomeTweaks() {
  const [t, setTweak] = useTweaks(HOME_TWEAK_DEFAULTS);

  React.useEffect(() => { applyHero(t.hero); }, [t.hero]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Hero direction" />
      <TweakRadio
        label="Headline"
        value={HERO_VARIANTS[t.hero] ? HERO_VARIANTS[t.hero].label : "Category"}
        options={Object.keys(HERO_VARIANTS).map((k) => HERO_VARIANTS[k].label)}
        onChange={(label) => {
          const key = Object.keys(HERO_VARIANTS).find((k) => HERO_VARIANTS[k].label === label);
          setTweak("hero", key);
        }}
      />
      <p className="cm-tweak-hint">Compare three ways to open the page — a product-category line, an outcome promise, or a scale story.</p>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("tweaks-root")).render(<HomeTweaks />);
