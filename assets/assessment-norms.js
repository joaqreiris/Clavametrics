/* ────────────────────────────────────────────────────────────────────────
   assessment-norms.js — interpretation engine for isometric-strength &
   mobility assessments. Pure functions over plain objects: NO network, NO
   window.sb, NO DOM. Same IIFE style as eval-direction.js.

   Exposes window.assessNorms.{
     statusFor(def, { value, baseline, teamStats }) -> { status, reason, detail, reference, evidenceLevel }
     asymmetry(l, r)        -> { pct, higherSide }
     asymStatus(def, l, r)  -> { status, reason:'asymmetry', pct, higherSide, detail, ... }
     ratios(valuesByTestKey)-> [{ key, side, value, status, reference }]
     normalize(value, bodyweightKg) -> N/kg | null
     explain(result)        -> short tooltip string (detail · reference [level])
   }

   Visible UI text is the CALLER's job via tt(); this module returns stable
   tokens/structures — NOT translated phrases — except the scientific
   `reference` citation, which is intentionally NOT translated.
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  var root = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);

  function num(x){
    if (x === '' || x === null || x === undefined) return null;
    var n = Number(x);
    return Number.isFinite(n) ? n : null;
  }

  // Direction of "better". Prefer the def flag; fall back to window.evalDir; default higher=better.
  function higherIsBetter(def){
    if (def && (def.higher_is_better === true || def.higher_is_better === false)) return def.higher_is_better;
    if (root.evalDir && typeof root.evalDir.isLowerBetter === 'function' && def)
      return !root.evalDir.isLowerBetter(def.test_type, def.unit);
    return true;
  }

  function pack(status, reason, detail, def){
    return {
      status: status,
      reason: reason,
      detail: detail,
      reference: def ? (def.reference || null) : null,
      evidenceLevel: def ? (def.evidence_level || null) : null
    };
  }

  // ── absolute / baseline status for a single value ──────────────────────────
  function statusFor(def, ctx){
    ctx = ctx || {};
    var value = num(ctx.value);
    if (def == null || value == null) return pack('none', 'none', '', def);

    var th  = def.thresholds || {};
    var hib = higherIsBetter(def);

    // binary (e.g. Thomas +/-): positive is a finding when lower-is-better
    if (def.value_type === 'binary'){
      var positive = value !== 0;
      if (!hib && positive) return pack('watch', 'absolute', '+', def);
      return pack('ok', 'absolute', positive ? '+' : '-', def);
    }

    // absolute thresholds
    if (hib){
      if (th.alert_below != null && value < Number(th.alert_below))
        return pack('alert', 'absolute', value + ' < ' + th.alert_below, def);
      if (th.watch_below != null && value < Number(th.watch_below))
        return pack('watch', 'absolute', value + ' < ' + th.watch_below, def);
      if (th.alert_below != null || th.watch_below != null)
        return pack('ok', 'absolute', String(value), def);
    } else {
      if (th.alert_above != null && value > Number(th.alert_above))
        return pack('alert', 'absolute', value + ' > ' + th.alert_above, def);
      if (th.watch_above != null && value > Number(th.watch_above))
        return pack('watch', 'absolute', value + ' > ' + th.watch_above, def);
      if (th.alert_above != null || th.watch_above != null)
        return pack('ok', 'absolute', String(value), def);
    }

    // no absolute threshold: fall back to drop vs own baseline
    var baseline = num(ctx.baseline);
    if (baseline != null && baseline !== 0){
      var dropPct = hib ? (baseline - value) / baseline * 100
                        : (value - baseline) / baseline * 100;
      if (dropPct > 15) return pack('alert', 'baseline', '-' + dropPct.toFixed(0) + '% vs baseline', def);
      if (dropPct > 10) return pack('watch', 'baseline', '-' + dropPct.toFixed(0) + '% vs baseline', def);
      var sign = dropPct >= 0 ? '-' : '+';
      return pack('ok', 'baseline', sign + Math.abs(dropPct).toFixed(0) + '% vs baseline', def);
    }

    // single datum, no threshold → never fire
    return pack('none', 'none', '', def);
  }

  // ── L/R asymmetry ──────────────────────────────────────────────────────────
  function asymmetry(l, r){
    var a = num(l), b = num(r);
    if (a == null || b == null) return { pct: null, higherSide: null };
    var hi = Math.max(a, b);
    if (hi === 0) return { pct: 0, higherSide: null };
    var pct = Math.abs(a - b) / hi * 100;
    var higherSide = (a === b) ? null : (a > b ? 'L' : 'R');
    return { pct: pct, higherSide: higherSide };
  }

  function asymStatus(def, l, r){
    var as = asymmetry(l, r);
    if (as.pct == null)
      return { status: 'none', reason: 'asymmetry', pct: null, higherSide: null, detail: '',
               reference: def ? (def.reference || null) : null,
               evidenceLevel: def ? (def.evidence_level || null) : null };
    var watch = num(def && def.asym_watch_pct); if (watch == null) watch = 10;
    var alert = num(def && def.asym_alert_pct); if (alert == null) alert = 15;
    var status = 'ok';
    if (as.pct >= alert) status = 'alert';
    else if (as.pct >= watch) status = 'watch';
    return {
      status: status, reason: 'asymmetry', pct: as.pct, higherSide: as.higherSide,
      detail: as.pct.toFixed(0) + '% (' + (as.higherSide || '—') + ')',
      reference: def ? (def.reference || null) : null,
      evidenceLevel: def ? (def.evidence_level || null) : null
    };
  }

  // ── derived ratios (per side) ──────────────────────────────────────────────
  var RATIO_CITE = {
    add_abd:        'Thorborg et al., AJSM 2010',
    shoulder_er_ir: 'Ellenbecker & Davies, J Athl Train 2000',
    hip_rot_total:  'ROM de cadera y lesión isquiosural (Gabbe et al. 2005)'
  };

  // Angle-matched pairs — a ratio is computed per angle only when BOTH sides of the pair exist.
  var ADD_ABD_PAIRS = [
    { add:'iso_hip_add_0',  abd:'iso_hip_abd_0',  angle:'0°'  },
    { add:'iso_hip_add_30', abd:'iso_hip_abd_30', angle:'30°' },
    { add:'iso_hip_add_45', abd:'iso_hip_abd_45', angle:'45°' }
  ];
  var ER_IR_PAIRS = [
    { er:'iso_shoulder_er',    ir:'iso_shoulder_ir',    angle:'0°'  },
    { er:'iso_shoulder_er_90', ir:'iso_shoulder_ir_90', angle:'90°' }
  ];

  function ratios(valuesByTestKey){
    var v = valuesByTestKey || {};
    var out = [];
    var sides = ['L', 'R'];

    function side(key, s){ return v[key] ? num(v[key][s]) : null; }

    // ADD : ABD  — ≥0,90 ok · 0,80–0,89 watch · <0,80 alert (per matched angle)
    ADD_ABD_PAIRS.forEach(function(p){
      sides.forEach(function(s){
        var add = side(p.add, s), abd = side(p.abd, s);
        if (add != null && abd != null && abd !== 0){
          var ratio = add / abd;
          var status = ratio >= 0.90 ? 'ok' : (ratio >= 0.80 ? 'watch' : 'alert');
          out.push({ key: 'add_abd', angle: p.angle, side: s, value: ratio, status: status, reference: RATIO_CITE.add_abd });
        }
      });
    });

    // Shoulder ER : IR — 0,66–0,75 ok · fuera de rango watch · <0,66 alert (per matched angle)
    ER_IR_PAIRS.forEach(function(p){
      sides.forEach(function(s){
        var er = side(p.er, s), ir = side(p.ir, s);
        if (er != null && ir != null && ir !== 0){
          var ratio = er / ir;
          var status = ratio < 0.66 ? 'alert' : ((ratio >= 0.66 && ratio <= 0.75) ? 'ok' : 'watch');
          out.push({ key: 'shoulder_er_ir', angle: p.angle, side: s, value: ratio, status: status, reference: RATIO_CITE.shoulder_er_ir });
        }
      });
    });

    // Hip IR + ER total — <80° alert (regla existente en Evaluations.html)
    sides.forEach(function(s){
      var ir = side('mob_hip_ir', s), er = side('mob_hip_er', s);
      if (ir != null && er != null){
        var total = ir + er;
        var status = total < 80 ? 'alert' : 'ok';
        out.push({ key: 'hip_rot_total', side: s, value: total, status: status, reference: RATIO_CITE.hip_rot_total });
      }
    });

    return out;
  }

  // ── normalize to N/kg ──────────────────────────────────────────────────────
  function normalize(value, bodyweightKg){
    var v = num(value), w = num(bodyweightKg);
    if (v == null || w == null || w === 0) return null;
    return v / w;
  }

  // ── tooltip string: what triggered + reference + evidence level ────────────
  function explain(result){
    if (!result) return '';
    var parts = [];
    if (result.detail) parts.push(result.detail);
    if (result.reference) parts.push(result.reference);
    var s = parts.join(' · ');
    if (result.evidenceLevel) s += (s ? ' ' : '') + '[' + result.evidenceLevel + ']';
    return s;
  }

  root.assessNorms = {
    statusFor: statusFor,
    asymmetry: asymmetry,
    asymStatus: asymStatus,
    ratios: ratios,
    normalize: normalize,
    explain: explain
  };
})();
