// ═══ ClavaMetrics — anthro-calc.js ═══════════════════════════════════════════
// Fórmulas PURAS de antropometría: pliegues → %BF (Siri 1956 vía JP3/JP7/DW4),
// BMI, RFM y somatotipo de Heath-Carter. Nunca tiran excepción; devuelven null
// cuando faltan datos.
//
// NOTA: Evaluations.html mantiene su copia inline de estas mismas funciones
// (helpers "pure, never throw"). Si se corrige una fórmula, actualizar AMBOS
// lugares. Nutrition.html usa este archivo.
(function () {
  'use strict';

  // Sitios requeridos por cada fórmula (JP3 depende del sexo). Claves canónicas.
  function sfFormulaSites(formula, sex) {
    var f = String(formula || '').toUpperCase();
    var isF = String(sex || 'M').toUpperCase().charAt(0) === 'F';
    if (f === 'JP7') return ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh'];
    if (f === 'DW4') return ['biceps', 'triceps', 'subscapular', 'suprailiac'];
    if (f === 'JP3') return isF ? ['triceps', 'suprailiac', 'thigh'] : ['chest', 'abdomen', 'thigh'];
    return [];
  }

  // Densidad corporal → Siri %BF. o = { formula, sex:'M'|'F', age, folds:{site:mm} }.
  function sfBodyFatPct(o) {
    o = o || {};
    var formula = String(o.formula || '').toUpperCase();
    var sex = (String(o.sex || 'M').toUpperCase().charAt(0) === 'F') ? 'F' : 'M';
    var age = parseFloat(o.age);
    var folds = o.folds || {};
    if (!isFinite(age)) return null;
    var sites = sfFormulaSites(formula, sex);
    if (!sites.length) return null;
    var S = 0;
    for (var i = 0; i < sites.length; i++) {
      var v = parseFloat(folds[sites[i]]);
      if (!isFinite(v) || v <= 0) return null;   // todos los sitios requeridos deben estar
      S += v;
    }
    var D = null;
    if (formula === 'JP3') {
      D = sex === 'M' ? 1.10938 - 0.0008267 * S + 0.0000016 * S * S - 0.0002574 * age
                      : 1.0994921 - 0.0009929 * S + 0.0000023 * S * S - 0.0001392 * age;
    } else if (formula === 'JP7') {
      D = sex === 'M' ? 1.112 - 0.00043499 * S + 0.00000055 * S * S - 0.00028826 * age
                      : 1.097 - 0.00046971 * S + 0.00000056 * S * S - 0.00012828 * age;
    } else if (formula === 'DW4') {
      var DW = { M: [[17, 19, 1.1620, 0.0630], [20, 29, 1.1631, 0.0632], [30, 39, 1.1422, 0.0544], [40, 49, 1.1620, 0.0700]],
                 F: [[17, 19, 1.1549, 0.0678], [20, 29, 1.1599, 0.0717], [30, 39, 1.1423, 0.0632], [40, 49, 1.1333, 0.0612]] };
      var rows = DW[sex] || DW.M;
      var row = rows.find(function (r) { return age >= r[0] && age <= r[1]; }) || rows[rows.length - 1];
      D = row[2] - row[3] * Math.log10(S);
    }
    if (!D || D < 0.9 || D > 1.1) return null;
    return +((4.95 / D - 4.50) * 100).toFixed(1);
  }

  function calcBMI(weightKg, heightCm) {
    if (!isFinite(weightKg) || !isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) return null;
    var m = heightCm / 100;
    return +(weightKg / (m * m)).toFixed(1);
  }

  function calcRFM(heightCm, waistCm, gender) {
    if (!isFinite(heightCm) || !isFinite(waistCm) || heightCm <= 0 || waistCm <= 0) return null;
    var sexFactor = gender === 'F' ? 1 : 0;
    return +(64 - (20 * heightCm / waistCm) + (12 * sexFactor)).toFixed(1);
  }

  // Somatotipo Heath-Carter. x = { heightCm, weightKg, sfTriceps, sfSubscap, sfSupraspinal,
  //   sfCalf, humerus, femur, armGirth, calfGirth }. Cada componente sale null si faltan inputs.
  function calcSomatotype(x) {
    var out = { endo: null, meso: null, ecto: null };
    if (!x || !isFinite(x.heightCm) || x.heightCm <= 0) return out;   // los tres usan altura
    var ok = function (v) { return v != null && isFinite(v); };       // isFinite(null) es true
    var clamp = function (v) { var r = +v.toFixed(1); return r < 0.1 ? 0.1 : r; };
    if ([x.sfTriceps, x.sfSubscap, x.sfSupraspinal].every(ok)) {
      var X = (x.sfTriceps + x.sfSubscap + x.sfSupraspinal) * (170.18 / x.heightCm);
      out.endo = clamp(-0.7182 + 0.1451 * X - 0.00068 * X * X + 0.0000014 * X * X * X);
    }
    if ([x.humerus, x.femur, x.armGirth, x.calfGirth, x.sfTriceps, x.sfCalf].every(ok)) {
      var cArm = x.armGirth - x.sfTriceps / 10;
      var cCalf = x.calfGirth - x.sfCalf / 10;
      out.meso = clamp((0.858 * x.humerus + 0.601 * x.femur + 0.188 * cArm + 0.161 * cCalf) - (0.131 * x.heightCm) + 4.5);
    }
    if (isFinite(x.weightKg) && x.weightKg > 0) {
      var HWR = x.heightCm / Math.cbrt(x.weightKg);
      var ecto;
      if (HWR >= 40.75) ecto = 0.732 * HWR - 28.58;
      else if (HWR > 38.25) ecto = 0.463 * HWR - 17.63;
      else ecto = 0.1;
      out.ecto = clamp(ecto);
    }
    return out;
  }

  // Fallbacks EN para labels de sitios (las páginas los pasan por tt('evaluations.bc_site_'+s)).
  var SITE_LABEL = { chest: 'Chest', abdomen: 'Abdomen', thigh: 'Thigh', triceps: 'Triceps',
    subscapular: 'Subscapular', suprailiac: 'Suprailiac', midaxillary: 'Midaxillary', biceps: 'Biceps' };

  window.anthroCalc = { sfFormulaSites: sfFormulaSites, sfBodyFatPct: sfBodyFatPct,
    calcBMI: calcBMI, calcRFM: calcRFM, calcSomatotype: calcSomatotype, SITE_LABEL: SITE_LABEL };
})();
