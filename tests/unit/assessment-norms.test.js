import { describe, it, expect, beforeAll } from 'vitest';

// IIFE module: import for side effect, then read the global it installs.
import '../../assets/assessment-norms.js';

let AN;
beforeAll(() => { AN = globalThis.assessNorms; });

// ── shared defs ──────────────────────────────────────────────────────────────
const kneeExt   = { test_type: 'ISO · Knee extension 90°', higher_is_better: true,  value_type: 'numeric', thresholds: { alert_below: 90, watch_below: 95 } };
const aslr      = { test_type: 'MOB · ASLR',               higher_is_better: true,  value_type: 'numeric', thresholds: { alert_below: 70, watch_below: 80 } };
const beighton  = { test_type: 'MOB · Beighton',           higher_is_better: false, value_type: 'score',   thresholds: { watch_above: 4 } };
const thomas    = { test_type: 'MOB · Thomas test',        higher_is_better: false, value_type: 'binary',  thresholds: {} };
const postChain = { test_type: 'ISO · Posterior chain 30°',higher_is_better: true,  value_type: 'numeric', thresholds: {}, asym_watch_pct: 10, asym_alert_pct: 15 };

// ── statusFor: absolute thresholds, both directions ──────────────────────────
describe('statusFor — absolute thresholds', () => {
  it('higher-is-better: below alert → alert', () => expect(AN.statusFor(kneeExt, { value: 85 }).status).toBe('alert'));
  it('higher-is-better: between alert/watch → watch', () => expect(AN.statusFor(kneeExt, { value: 92 }).status).toBe('watch'));
  it('higher-is-better: above watch → ok', () => expect(AN.statusFor(kneeExt, { value: 100 }).status).toBe('ok'));

  it('lower-is-better: above alert threshold-less → watch (watch_above)', () => expect(AN.statusFor(beighton, { value: 6 }).status).toBe('watch'));
  it('lower-is-better: at/below watch_above → ok', () => expect(AN.statusFor(beighton, { value: 3 }).status).toBe('ok'));

  it('ASLR low → alert', () => expect(AN.statusFor(aslr, { value: 65 }).status).toBe('alert'));
  it('ASLR mid → watch', () => expect(AN.statusFor(aslr, { value: 75 }).status).toBe('watch'));
});

// ── statusFor: baseline drop, no absolute threshold ──────────────────────────
describe('statusFor — baseline drop', () => {
  it('drop >15% vs baseline → alert', () => expect(AN.statusFor(postChain, { value: 80, baseline: 100 }).status).toBe('alert'));
  it('drop >10% vs baseline → watch', () => expect(AN.statusFor(postChain, { value: 88, baseline: 100 }).status).toBe('watch'));
  it('small drop → ok', () => expect(AN.statusFor(postChain, { value: 96, baseline: 100 }).status).toBe('ok'));
  it('single datum, no threshold, no baseline → none', () => expect(AN.statusFor(postChain, { value: 300 }).status).toBe('none'));
});

// ── binary ───────────────────────────────────────────────────────────────────
describe('statusFor — binary (Thomas)', () => {
  it('positive (1) with lower-is-better → watch', () => expect(AN.statusFor(thomas, { value: 1 }).status).toBe('watch'));
  it('negative (0) → ok', () => expect(AN.statusFor(thomas, { value: 0 }).status).toBe('ok'));
});

// ── asymmetry ─────────────────────────────────────────────────────────────────
describe('asymmetry & asymStatus', () => {
  it('0% asymmetry → ok', () => expect(AN.asymStatus(postChain, 100, 100).status).toBe('ok'));
  it('9% asymmetry → ok', () => expect(AN.asymStatus(postChain, 100, 91).status).toBe('ok'));
  it('12% asymmetry → watch', () => expect(AN.asymStatus(postChain, 100, 88).status).toBe('watch'));
  it('20% asymmetry → alert', () => expect(AN.asymStatus(postChain, 100, 80).status).toBe('alert'));

  it('pct math and higher side', () => {
    const a = AN.asymmetry(100, 80);
    expect(Math.round(a.pct)).toBe(20);
    expect(a.higherSide).toBe('L');
  });
  it('defaults to 10/15 when def has no asym fields', () => {
    expect(AN.asymStatus({}, 100, 88).status).toBe('watch');
  });
});

// ── ratios ─────────────────────────────────────────────────────────────────────
describe('ratios — add:abd', () => {
  const mk = (add, abd) => ({ iso_hip_add_0: { L: add, R: add }, iso_hip_abd_0: { L: abd, R: abd } });
  it('0.95 → ok',   () => expect(AN.ratios(mk(95, 100)).find(r => r.key === 'add_abd').status).toBe('ok'));
  it('0.85 → watch',() => expect(AN.ratios(mk(85, 100)).find(r => r.key === 'add_abd').status).toBe('watch'));
  it('0.75 → alert',() => expect(AN.ratios(mk(75, 100)).find(r => r.key === 'add_abd').status).toBe('alert'));
  it('real MOI case 162/225 → alert', () => {
    const r = AN.ratios({ iso_hip_add_0: { R: 162 }, iso_hip_abd_0: { R: 225 } }).find(x => x.key === 'add_abd' && x.side === 'R');
    expect(r.status).toBe('alert');
    expect(r.value).toBeCloseTo(0.72, 2);
  });
  it('carries Thorborg citation', () => {
    expect(AN.ratios(mk(75, 100))[0].reference).toMatch(/Thorborg/);
  });
});

describe('ratios — hip_rot_total & shoulder', () => {
  it('IR+ER 85 → ok',    () => expect(AN.ratios({ mob_hip_ir: { L: 45 }, mob_hip_er: { L: 40 } }).find(r => r.key === 'hip_rot_total').status).toBe('ok'));
  it('IR+ER 70 → alert', () => expect(AN.ratios({ mob_hip_ir: { L: 35 }, mob_hip_er: { L: 35 } }).find(r => r.key === 'hip_rot_total').status).toBe('alert'));
  it('ER:IR 0.70 → ok',   () => expect(AN.ratios({ iso_shoulder_er: { R: 70 }, iso_shoulder_ir: { R: 100 } }).find(r => r.key === 'shoulder_er_ir').status).toBe('ok'));
  it('ER:IR 0.60 → alert',() => expect(AN.ratios({ iso_shoulder_er: { R: 60 }, iso_shoulder_ir: { R: 100 } }).find(r => r.key === 'shoulder_er_ir').status).toBe('alert'));
  it('ER:IR 0.90 → watch',() => expect(AN.ratios({ iso_shoulder_er: { R: 90 }, iso_shoulder_ir: { R: 100 } }).find(r => r.key === 'shoulder_er_ir').status).toBe('watch'));
});

// ── normalize + null/NaN safety ───────────────────────────────────────────────
describe('normalize & robustness', () => {
  it('N/kg', () => expect(AN.normalize(700, 70)).toBe(10));
  it('missing weight → null', () => expect(AN.normalize(700, null)).toBeNull());
  it('zero weight → null', () => expect(AN.normalize(700, 0)).toBeNull());

  it('null value → none, no throw', () => expect(AN.statusFor(kneeExt, { value: null }).status).toBe('none'));
  it('NaN value → none, no throw', () => expect(AN.statusFor(kneeExt, { value: 'abc' }).status).toBe('none'));
  it('null def → none', () => expect(AN.statusFor(null, { value: 5 }).status).toBe('none'));
  it('asymmetry with a null side → null pct', () => expect(AN.asymmetry(100, null).pct).toBeNull());
  it('ratios with missing complementary test → empty', () => expect(AN.ratios({ iso_hip_add_0: { L: 100 } })).toEqual([]));
  it('explain composes detail + reference + level', () => {
    const s = AN.explain({ detail: '85 < 90', reference: 'Grindem 2016', evidenceLevel: 'strong' });
    expect(s).toBe('85 < 90 · Grindem 2016 [strong]');
  });
});
