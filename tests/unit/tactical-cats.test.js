import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const load = rel => { (0, eval)(fs.readFileSync(path.join(ROOT, rel), 'utf8')); };

// The module is a browser script; evaluate it the way a <script> tag would.
function boot(rows, opts = {}) {
  const style = { id: '', textContent: '' };
  const head = { children: [], appendChild(el) { this.children.push(el); } };
  globalThis.document = {
    head,
    getElementById: () => null,
    createElement: () => style,
    addEventListener() {},
  };
  globalThis.window = {
    document: globalThis.document,
    console: { warn() {} },
    CM_I18N: opts.i18n || null,
    sb: {
      from() {
        const q = {
          select: () => q, eq: () => q, order: () => q,
          then: (res) => res(opts.error ? { data: null, error: opts.error } : { data: rows, error: null }),
        };
        return q;
      },
    },
  };
  load('lib/tactical-cats.js');
  return { api: globalThis.window.cmTacticalCats, style };
}

describe('cmTacticalCats · fábrica', () => {
  let api;
  beforeEach(() => { api = boot([]).api; });

  it('mantiene las seis categorías de siempre, con sus keys y su orden', () => {
    const cats = api.factory();
    expect(cats.map(c => c.key)).toEqual(
      ['offensive', 'defensive', 'transition_off', 'transition_def', 'set_pieces', 'other']);
    expect(cats.map(c => c.color)).toEqual(
      ['green', 'blue', 'amber', 'pink', 'violet', 'teal']);
    expect(cats.every(c => c.is_default)).toBe(true);
  });

  it('un equipo sin filas propias sigue viendo las de fábrica', async () => {
    const { rows, cats } = await api.load('club', 'team');
    expect(rows).toEqual([]);
    expect(cats.map(c => c.key)).toEqual(api.factory().map(c => c.key));
  });

  it('si la consulta falla, no rompe: cae en las de fábrica', async () => {
    const bad = boot([], { error: { code: '42P01', message: 'tactical_categories does not exist' } }).api;
    const res = await bad.load('club', 'team');
    expect(res.error).toBeTruthy();
    expect(res.cats).toHaveLength(6);
  });
});

describe('cmTacticalCats · categorías del equipo', () => {
  it('el nombre propio pisa al de fábrica y el color propio al del tono original', async () => {
    const { api } = boot([
      { id: '1', key: 'offensive', name: 'Con balón', color: 'indigo', position: 0 },
      { id: '2', key: 'defensive', name: null, color: 'blue', position: 1 },
      { id: '3', key: 'c_ab12cd34', name: 'Presión tras pérdida', color: 'red', position: 2 },
    ]);
    const { rows, cats } = await api.load('club', 'team');
    expect(rows).toHaveLength(3);
    expect(cats[0].name).toBe('Con balón');
    expect(cats[0].custom_name).toBe(true);
    expect(cats[0].color).toBe('indigo');
    expect(cats[1].name).toBe('Defensive');      // sin nombre propio → el de fábrica
    expect(cats[1].custom_name).toBe(false);
    expect(cats[2].is_default).toBe(false);
  });

  it('traduce las de fábrica sin nombre propio', async () => {
    const { api } = boot([{ id: '2', key: 'defensive', name: null, color: 'blue', position: 0 }], {
      i18n: { t: k => (k === 'tactical.cat_defensive' ? 'Defensivo' : k) },
    });
    const { cats } = await api.load('club', 'team');
    expect(cats[0].name).toBe('Defensivo');
  });
});

describe('cmTacticalCats · colores y keys', () => {
  let api;
  beforeEach(() => { api = boot([]).api; });

  it('cada tono de la paleta tiene su valor en claro y en oscuro', () => {
    expect(api.palette.length).toBeGreaterThanOrEqual(6);
    api.palette.forEach(p => {
      expect(p.light).toMatch(/^#[0-9A-F]{6}$/i);
      expect(p.dark).toMatch(/^#[0-9A-F]{6}$/i);
    });
    expect(new Set(api.palette.map(p => p.slug)).size).toBe(api.palette.length);
  });

  it('publica los tonos como variables CSS en ambos temas', () => {
    const { style } = boot([]);
    expect(style.id).toBe('cm-tac-palette');
    expect(style.textContent).toContain('--tpc-green:#16A34A');
    expect(style.textContent).toContain('[data-theme="dark"]');
  });

  it('colorVar devuelve la variable del tono y gris para lo desconocido', () => {
    expect(api.colorVar({ color: 'green' })).toBe('var(--tpc-green)');
    expect(api.colorVar('blue')).toBe('var(--tpc-blue)');
    expect(api.colorVar({ color: 'no-existe' })).toBe('var(--cm-fg-faint)');
    expect(api.colorVar(undefined)).toBe('var(--cm-fg-faint)');
  });

  it('una categoría nueva toma el siguiente tono libre de la secuencia', () => {
    expect(api.nextColor(['green', 'blue'])).toBe('amber');
    expect(api.nextColor(api.palette.map(p => p.slug))).toBeTruthy();   // sin libres, no rompe
  });

  it('la key nueva es estable y no se confunde con las de fábrica', () => {
    const k = api.newKey();
    expect(k).toMatch(/^c_[0-9a-f]{8}$/);
    expect(api.defaults.some(d => d.key === k)).toBe(false);
  });

  it('un objetivo de una categoría borrada se sigue pudiendo pintar', () => {
    const o = api.orphan('c_deadbeef');
    expect(o.orphan).toBe(true);
    expect(o.name).toBe('c_deadbeef');
    expect(api.colorVar(o)).toBe('var(--cm-fg-faint)');
    // una key de fábrica borrada conserva su etiqueta
    expect(api.orphan('set_pieces').name).toBe('Set pieces');
  });
});
