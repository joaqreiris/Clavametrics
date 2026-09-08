import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

// Daily Planning es un script de navegador: se evalúa como lo haría un <script>,
// con lo justo de DOM para que el arranque no explote. Lo que se prueba acá es la
// lógica pura de las tareas simultáneas (agrupar, ponderar, reordenar), así que el
// pintado se reemplaza por no-ops después de cargar.
const boot = () => {
  const noopEl = () => ({
    innerHTML: '', textContent: '', value: '', style: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, querySelectorAll(){ return []; }, appendChild(){}, remove(){},
  });
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener(){}, body: noopEl(),
  };
  globalThis.localStorage = { _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; } };
  globalThis.addEventListener = () => {};
  globalThis.guardModule = async () => false;        // corta el arranque real de la página
  // Las listas de la página son `let` de nivel superior: en un eval quedan en su
  // propio ámbito y no se pueden tocar desde fuera. Por eso el archivo se evalúa con
  // un apéndice —sólo del test, el archivo en disco no cambia— que las expone.
  const src = fs.readFileSync(path.join(ROOT, 'assets/pages/daily-planning.js'), 'utf8')
    + '\n;globalThis.__dp = { get field(){ return _dpFieldExercises; },'
    + ' set field(v){ _dpFieldExercises = v; }, set club(v){ _dpClubId = v; } };';
  (0, eval)(src);
  // El repintado y el guardado no son lo que se prueba acá.
  globalThis.renderExerciseList = () => {};
  globalThis.dpPaintActStrip = () => {};
  globalThis.dpPaintGkStrip = () => {};
  globalThis.renderGpsProjection = () => {};
  globalThis.dpToast = () => {};
  const ok = () => ({ eq: ok2 });
  const ok2 = () => ({ eq: () => Promise.resolve({ error: null }) });
  globalThis.sb = { from: () => ({ update: ok }) };
  __dp.club = 'club-1';
};

const task = (id, extra = {}) => ({ id, name: id, phase: 'main', duration: 10, ...extra });

describe('tareas simultáneas · agrupado', () => {
  beforeEach(boot);

  it('deja sueltas las tareas sin vínculo', () => {
    const chunks = _dpParChunks([task('a'), task('b')]);
    expect(chunks.map(c => c.par)).toEqual([null, null]);
    expect(chunks.map(c => c.items.length)).toEqual([1, 1]);
  });

  it('junta las enlazadas en el lugar de la primera, aunque el orden las separe', () => {
    const chunks = _dpParChunks([
      task('a', { parallel_group: 'pg1' }),
      task('b'),
      task('c', { parallel_group: 'pg1' }),
    ]);
    expect(chunks.length).toBe(2);
    expect(chunks[0].par).toBe('pg1');
    expect(chunks[0].items.map(x => x.id)).toEqual(['a', 'c']);
    expect(chunks[1].items.map(x => x.id)).toEqual(['b']);
  });

  it('un corchete que quedó con una sola tarea se dibuja suelto', () => {
    const chunks = _dpParChunks([task('a', { parallel_group: 'pg1' }), task('b')]);
    expect(chunks.map(c => c.par)).toEqual([null, null]);
  });
});

describe('tareas simultáneas · peso en la proyección GPS', () => {
  beforeEach(boot);

  it('una tarea suelta aporta su carga entera', () => {
    const w = dpProjWeights([task('a', { players_count: 10 })]);
    expect(w[0].factor).toBe(1);
  });

  it('dos en paralelo se promedian por jugadores en vez de sumarse', () => {
    const w = dpProjWeights([
      task('a', { parallel_group: 'pg1', players_count: 12 }),
      task('b', { parallel_group: 'pg1', players_count: 6 }),
    ]);
    expect(w.map(x => x.factor)).toEqual([12 / 18, 6 / 18]);
    expect(w.reduce((s, x) => s + x.factor, 0)).toBeCloseTo(1);   // el bloque cuenta una vez
  });

  it('manda el reparto en grupos de la card por encima del nº del ejercicio', () => {
    const w = dpProjWeights([
      task('a', { parallel_group: 'pg1', players_count: 99, player_groups: [{ id:'g1', players:['1','2','3'] }] }),
      task('b', { parallel_group: 'pg1', players_count: 99, player_groups: [{ id:'g1', players:['4'] }] }),
    ]);
    expect(w.map(x => x.factor)).toEqual([3 / 4, 1 / 4]);
  });

  it('sin compañera cubierta, la tarea del bloque aporta entera', () => {
    // La otra mitad del bloque no tiene perfil GPS: queda fuera del promedio igual que
    // queda fuera del total, y la nota "cubre X de Y" es la que lo explica.
    const w = dpProjWeights([task('a', { parallel_group: 'pg1', players_count: 12 })]);
    expect(w[0].factor).toBe(1);
  });
});

describe('tareas simultáneas · reordenar', () => {
  beforeEach(boot);

  it('arrastrar una tarea del bloque se lleva a la compañera', async () => {
    const list = [
      task('a', { parallel_group: 'pg1' }),
      task('b', { parallel_group: 'pg1' }),
      task('c'),
    ];
    __dp.field = list;
    await dpReorderExercise('a', 'c', true, 'field');   // soltar detrás de c
    expect(__dp.field.map(x => x.id)).toEqual(['c', 'a', 'b']);
    expect(__dp.field.map(x => x.position)).toEqual([0, 1, 2]);
  });

  it('soltar sobre un bloque nunca cae en medio del corchete', async () => {
    const list = [
      task('a'),
      task('b', { parallel_group: 'pg1' }),
      task('c', { parallel_group: 'pg1' }),
    ];
    __dp.field = list;
    await dpReorderExercise('a', 'b', true, 'field');   // detrás de la PRIMERA del bloque
    expect(__dp.field.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('reordenar dentro del mismo bloque no cambia nada', async () => {
    const list = [task('a', { parallel_group: 'pg1' }), task('b', { parallel_group: 'pg1' })];
    __dp.field = list;
    await dpReorderExercise('a', 'b', true, 'field');
    expect(__dp.field.map(x => x.id)).toEqual(['a', 'b']);
  });
});

describe('tareas simultáneas · enlazar y soltar', () => {
  beforeEach(boot);

  it('enlazar dos tareas les pone el mismo vínculo', async () => {
    __dp.field = [task('a'), task('b'), task('c')];
    await dpLinkParallel('a', 'b');
    const [a, b, c] = __dp.field;
    expect(a.parallel_group).toBeTruthy();
    expect(b.parallel_group).toBe(a.parallel_group);
    expect(c.parallel_group).toBeUndefined();
  });

  it('enlazar con una tarea que ya está en un bloque la suma a ÉSE', async () => {
    __dp.field = [
      task('a'),
      task('b', { parallel_group: 'pg1' }),
      task('c', { parallel_group: 'pg1' }),
    ];
    await dpLinkParallel('a', 'b');
    expect(__dp.field.every(x => x.parallel_group === 'pg1')).toBe(true);
  });

  it('sacar una tarea de un bloque de dos suelta también a la que queda', async () => {
    __dp.field = [
      task('a', { parallel_group: 'pg1' }),
      task('b', { parallel_group: 'pg1' }),
      task('c'),
    ];
    await dpUnlinkParallel('a');
    expect(__dp.field.map(x => x.parallel_group)).toEqual([null, null, undefined]);
  });

  it('sacar una tarea de un bloque de tres deja el bloque en pie', async () => {
    __dp.field = [
      task('a', { parallel_group: 'pg1' }),
      task('b', { parallel_group: 'pg1' }),
      task('c', { parallel_group: 'pg1' }),
    ];
    await dpUnlinkParallel('a');
    expect(__dp.field.map(x => x.parallel_group)).toEqual([null, 'pg1', 'pg1']);
  });
});
