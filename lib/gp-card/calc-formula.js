/**
 * lib/gp-card/calc-formula.js
 *
 * Safe arithmetic evaluator for CALCULATED metrics. A calculated metric is a
 * new metric defined by a formula over existing (base) metrics — evaluated
 * PER SESSION, then aggregated like any other metric.
 *
 * SECURITY (non-negotiable): formulas are NEVER executed as code — no eval /
 * new Function. They are tokenized and parsed by a controlled recursive-descent
 * parser that accepts only metric ids, numbers, the operators + - * / ( ) and
 * the functions min/max/abs/round. This mirrors the builder's editor parser
 * (assets/gp-builder/gp-builder.js); keep the two grammars in sync.
 *
 * Grammar:
 *   expr   := term (('+'|'-') term)*
 *   term   := factor (('*'|'/') factor)*
 *   factor := num | metric | fn '(' args ')' | '(' expr ')' | '-' factor
 *
 * @module lib/gp-card/calc-formula
 */

export const CALC_FUNCS = { min: [2, 99], max: [2, 99], abs: [1, 1], round: [1, 1] };

/**
 * Tokenizes a formula into { num, id, fn, op, lp, rp, comma, bad } tokens.
 * @param {string} src
 * @returns {{t:string, v?:(number|string), raw:string}[]}
 */
export function tokenizeFormula(src) {
  const toks = [];
  const re = /\s+|[0-9]*\.?[0-9]+|[A-Za-z_][A-Za-z0-9_]*|[+\-*/(),]|[^\s]/g;
  let m;
  while ((m = re.exec(String(src ?? ''))) !== null) {
    const s = m[0];
    if (/^\s+$/.test(s)) continue;
    if (/^[0-9]*\.?[0-9]+$/.test(s)) toks.push({ t: 'num', v: parseFloat(s), raw: s });
    else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) toks.push(CALC_FUNCS[s] ? { t: 'fn', v: s, raw: s } : { t: 'id', v: s, raw: s });
    else if ('+-*/'.includes(s)) toks.push({ t: 'op', v: s, raw: s });
    else if (s === '(') toks.push({ t: 'lp', raw: s });
    else if (s === ')') toks.push({ t: 'rp', raw: s });
    else if (s === ',') toks.push({ t: 'comma', raw: s });
    else toks.push({ t: 'bad', v: s, raw: s });
  }
  return toks;
}

/**
 * The base metric ids referenced by a formula (so the caller can make sure they
 * are fetched for each session). Functions are not ids; numbers are excluded.
 * @param {string} src
 * @returns {string[]}
 */
export function formulaBaseMetrics(src) {
  return [...new Set(tokenizeFormula(src).filter(t => t.t === 'id').map(t => t.v))];
}

/**
 * Evaluates a formula for ONE session/row. `getVal(id)` returns that metric's
 * value in this row (number), or null/undefined/NaN if the value is missing.
 *
 * Returns a finite number, or **null** when the row cannot produce a clean value:
 * a referenced metric is missing in this session, a division by zero occurs, or
 * the formula is structurally broken. NEVER throws and NEVER returns a silent 0,
 * so a bad session simply drops out of the aggregation set (applyAgg filters
 * non-finite values).
 *
 * @param {string} src
 * @param {(id:string)=>(number|null|undefined)} getVal
 * @returns {number|null}
 */
export function evalFormulaRow(src, getVal) {
  const toks = tokenizeFormula(src);
  if (!toks.length) return null;
  if (toks.some(t => t.t === 'bad')) return null;

  let i = 0;
  const peek = () => toks[i];
  const eat = () => toks[i++];
  let broke = false;
  const fail = () => { broke = true; throw 'E'; };

  function expr() {
    let v = term();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const op = eat().v; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  function term() {
    let v = factor();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) { const op = eat().v; const r = factor(); if (op === '/') { if (r === 0) fail(); v = v / r; } else v = v * r; }
    return v;
  }
  function factor() {
    const tk = peek();
    if (!tk) fail();
    if (tk.t === 'op' && tk.v === '-') { eat(); return -factor(); }
    if (tk.t === 'op' && tk.v === '+') { eat(); return factor(); }
    if (tk.t === 'num') { eat(); return tk.v; }
    if (tk.t === 'id') { eat(); const v = getVal(tk.v); if (v == null || isNaN(v)) fail(); return Number(v); }
    if (tk.t === 'fn') {
      const fn = eat().v;
      if (!peek() || peek().t !== 'lp') fail();
      eat();
      const args = [expr()];
      while (peek() && peek().t === 'comma') { eat(); args.push(expr()); }
      if (!peek() || peek().t !== 'rp') fail();
      eat();
      const a = CALC_FUNCS[fn];
      if (!a || args.length < a[0] || args.length > a[1]) fail();
      if (fn === 'min') return Math.min(...args);
      if (fn === 'max') return Math.max(...args);
      if (fn === 'abs') return Math.abs(args[0]);
      if (fn === 'round') return Math.round(args[0]);
    }
    if (tk.t === 'lp') { eat(); const v = expr(); if (!peek() || peek().t !== 'rp') fail(); eat(); return v; }
    fail();
  }

  try {
    const v = expr();
    if (broke || i < toks.length || v == null || !isFinite(v)) return null;
    return v;
  } catch (e) {
    return null;
  }
}

/** True if a config metric is a calculated metric (carries a formula). */
export function isCalculated(metric, catalog) {
  if (!metric) return false;
  if (metric.formula) return true;
  const cat = catalog && catalog.get ? catalog.get(metric.id) : null;
  return !!(cat && (cat.formula) && (cat.kind === 'calculated' || cat.calculated));
}

/** The formula string for a config metric (from the metric entry or the catalog). */
export function formulaOf(metric, catalog) {
  if (metric && metric.formula) return metric.formula;
  const cat = catalog && catalog.get ? catalog.get(metric.id) : null;
  return cat ? cat.formula || null : null;
}
