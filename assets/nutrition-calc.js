// assets/nutrition-calc.js — Nutrition calculation module for ClavaMetrics
// Pure calculation functions, no external dependencies.
// All functions exposed on window.nutriCalc.
// RMR formulas (Fase B) NOT included yet — pending exact-coefficient
// verification against the source papers (see nutrition-module-spec.md §4).
(function () {
  'use strict';

  const round = (n, d = 1) => {
    const f = Math.pow(10, d);
    return Math.round((Number(n) || 0) * f) / f;
  };

  window.nutriCalc = {

    // ── macros de un alimento a una cantidad dada ──────────────
    // food: { kcal, protein_g, carbs_g, fats_g, fiber_g } por 100 g.
    // quantityG: gramos (o ml) consumidos.
    // Devuelve los macros escalados (food × quantity/100).
    macrosForQuantity(food, quantityG) {
      const k = (Number(quantityG) || 0) / 100;
      return {
        kcal:      round((food.kcal      || 0) * k),
        protein_g: round((food.protein_g || 0) * k),
        carbs_g:   round((food.carbs_g   || 0) * k),
        fats_g:    round((food.fats_g    || 0) * k),
        fiber_g:   round((food.fiber_g   || 0) * k),
      };
    },

    // ── macros de un meal_plan_item (food + quantity_g) ────────
    // item: { quantity_g, food: {...} }  ó  (item, food) por separado.
    macrosForItem(item, food) {
      const f = food || item.food || item.foods; // tolera el join de supabase
      return this.macrosForQuantity(f, item.quantity_g);
    },

    // ── sumar una lista de macros ──────────────────────────────
    sumMacros(list) {
      return (list || []).reduce((acc, m) => ({
        kcal:      round(acc.kcal      + (m.kcal      || 0)),
        protein_g: round(acc.protein_g + (m.protein_g || 0)),
        carbs_g:   round(acc.carbs_g   + (m.carbs_g   || 0)),
        fats_g:    round(acc.fats_g    + (m.fats_g    || 0)),
        fiber_g:   round(acc.fiber_g   + (m.fiber_g   || 0)),
      }), { kcal: 0, protein_g: 0, carbs_g: 0, fats_g: 0, fiber_g: 0 });
    },

    // ── total de un array de items (food + quantity) ───────────
    totalForItems(items) {
      return this.sumMacros((items || []).map(it => this.macrosForItem(it)));
    },

    // ── escalar una cantidad por el scale_factor del jugador ───
    scaleQuantity(quantityG, scaleFactor) {
      return round((Number(quantityG) || 0) * (Number(scaleFactor) || 1), 0);
    },

    // ── lean mass desde peso + % graso ─────────────────────────
    leanMass(weightKg, bodyFatPct) {
      if (weightKg == null || bodyFatPct == null) return null;
      return round(weightKg * (1 - bodyFatPct / 100), 1);
    },

    // ── distribución de macros (% de kcal por macro) ───────────
    // 4 kcal/g proteína y carbo, 9 kcal/g grasa.
    macroSplitPct(m) {
      const pK = (m.protein_g || 0) * 4;
      const cK = (m.carbs_g   || 0) * 4;
      const fK = (m.fats_g    || 0) * 9;
      const tot = pK + cK + fK;
      if (!tot) return { protein: 0, carbs: 0, fats: 0 };
      return {
        protein: round((pK / tot) * 100, 0),
        carbs:   round((cK / tot) * 100, 0),
        fats:    round((fK / tot) * 100, 0),
      };
    },

  };
})();
