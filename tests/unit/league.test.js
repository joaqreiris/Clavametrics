/**
 * Liga interna — motor de puntos (assets/league.js).
 *
 * Lo que se prueba es la parte que decide QUIÉN SUMA QUÉ: el reparto por grupo,
 * la regla de arqueros (con rotación puntúan por goles recibidos, no por el
 * resultado del equipo), la corrección manual y el orden de la tabla del mes.
 * La persistencia (Supabase) no se toca acá.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

let L;
beforeAll(() => {
  globalThis.window = { cmToday: () => '2026-08-30', CM_I18N: { current: 'es' } };
  globalThis.document = { documentElement: { lang: 'es' } };
  (0, eval)(fs.readFileSync(path.join(ROOT, 'assets/league.js'), 'utf8'));
  L = globalThis.window.CMLeague;
});

const P = { win: 3, draw: 1, loss: 0 };
const GROUPS = [
  { id: 'g1', name: 'Rojos',  players: ['p1', 'p2', 'gkA'] },
  { id: 'g2', name: 'Azules', players: ['p3', 'p4', 'gkB'] },
];
const pts = rows => rows.map(r => [r.player_id, r.outcome, r.points]);

describe('el mes', () => {
  it('resuelve el mes en fechas locales, sin corrimiento UTC', () => {
    expect(L.monthBounds('2026-08-30')).toEqual({ start: '2026-08-01', end: '2026-08-31', year: 2026, month: 8 });
    // Al este de UTC, un 1° de mes convertido con toISOString cae en el mes anterior.
    expect(L.monthBounds('2026-09-01').start).toBe('2026-09-01');
  });

  it('cierra febrero bisiesto en el 29', () => {
    expect(L.monthBounds('2028-02-10').end).toBe('2028-02-29');
  });
});

describe('reparto por grupo', () => {
  it('da 3 al ganador y 0 al perdedor', () => {
    expect(pts(L.compute(GROUPS, { outcomes: { g1: 'win', g2: 'loss' } }, P))).toEqual([
      ['p1', 'win', 3], ['p2', 'win', 3], ['gkA', 'win', 3],
      ['p3', 'loss', 0], ['p4', 'loss', 0], ['gkB', 'loss', 0],
    ]);
  });

  it('da 1 a todos en el empate', () => {
    const out = L.compute(GROUPS, { outcomes: { g1: 'draw', g2: 'draw' } }, P);
    expect(out.every(r => r.outcome === 'draw' && r.points === 1)).toBe(true);
    expect(out).toHaveLength(6);
  });

  it('no puntúa al grupo sin resultado marcado', () => {
    expect(pts(L.compute(GROUPS, { outcomes: { g1: 'win' } }, P))).toEqual([
      ['p1', 'win', 3], ['p2', 'win', 3], ['gkA', 'win', 3],
    ]);
  });
});

describe('arqueros', () => {
  it('puntúa por goles recibidos aunque su equipo haya perdido', () => {
    const out = L.compute(GROUPS, {
      outcomes: { g1: 'loss', g2: 'win' }, ga: { gkA: 1, gkB: 3 }, keepers: ['gkA', 'gkB'],
    }, P);
    const by = Object.fromEntries(out.map(r => [r.player_id, r]));
    expect(by.gkA.outcome).toBe('win');    // recibió menos, aunque los Rojos perdieron
    expect(by.gkB.outcome).toBe('loss');
    expect(by.p1.outcome).toBe('loss');    // los de campo sí siguen a su equipo
    expect(by.p3.outcome).toBe('win');
  });

  it('empata a los arqueros que reciben los mismos goles', () => {
    const out = L.compute(GROUPS, { outcomes: { g1: 'win', g2: 'loss' }, ga: { gkA: 2, gkB: 2 } }, P);
    const by = Object.fromEntries(out.map(r => [r.player_id, r]));
    expect([by.gkA.outcome, by.gkB.outcome]).toEqual(['draw', 'draw']);
  });

  it('con un solo arquero cargado no hay con quién comparar: puntúa como su equipo', () => {
    const out = L.compute(GROUPS, { outcomes: { g1: 'win', g2: 'loss' }, ga: { gkA: 2 } }, P);
    const by = Object.fromEntries(out.map(r => [r.player_id, r]));
    expect(by.gkA.outcome).toBe('win');
    expect(by.gkB.outcome).toBe('loss');
  });

  it('con tres arqueros, el del medio empata', () => {
    const tres = [
      { id: 'g1', players: ['gkA'] }, { id: 'g2', players: ['gkB'] }, { id: 'g3', players: ['gkC'] },
    ];
    expect(pts(L.compute(tres, { ga: { gkA: 0, gkB: 2, gkC: 5 } }, P)))
      .toEqual([['gkA', 'win', 3], ['gkB', 'draw', 1], ['gkC', 'loss', 0]]);
  });
});

describe('corrección manual', () => {
  it('pisa tanto al grupo como a la regla de arqueros', () => {
    const out = L.compute(GROUPS, {
      outcomes: { g1: 'win', g2: 'loss' }, ga: { gkA: 0, gkB: 9 }, manual: { p1: 'loss', gkA: 'draw' },
    }, P);
    const by = Object.fromEntries(out.map(r => [r.player_id, r]));
    expect(by.p1.outcome).toBe('loss');    // su grupo ganó
    expect(by.gkA.outcome).toBe('draw');   // recibió menos goles que el otro
    expect(by.p2.outcome).toBe('win');     // el resto del grupo no se mueve
  });

  it('marca is_manual solo en el jugador corregido', () => {
    const out = L.compute(GROUPS, { outcomes: { g1: 'win', g2: 'loss' }, manual: { p1: 'loss' } }, P);
    expect(out.filter(r => r.is_manual).map(r => r.player_id)).toEqual(['p1']);
  });
});

describe('tabla del mes', () => {
  const season = { min_participation: 0.60, points_win: 3, points_draw: 1, points_loss: 0 };
  const players = [{ id: 'p1', last_name: 'Uno' }, { id: 'p2', last_name: 'Dos' }, { id: 'p3', last_name: 'Tres' }];
  // 10 tareas competitivas en el mes.
  const results = [];
  for (let i = 0; i < 10; i++) results.push({ player_id: 'p1', outcome: i < 6 ? 'win' : 'draw', points: i < 6 ? 3 : 1 });
  for (let i = 0; i < 3; i++)  results.push({ player_id: 'p2', outcome: 'win', points: 3 });   // lesionado: solo 3
  for (let i = 0; i < 10; i++) results.push({ player_id: 'p3', outcome: i < 7 ? 'win' : 'draw', points: i < 7 ? 3 : 1 });

  it('exige el 60% de las tareas para clasificar', () => {
    expect(L.standings(season, results, 10, players).min_played).toBe(6);
  });

  it('deja sin puesto al que no llegó al mínimo, aunque tenga el mejor promedio', () => {
    const { rows } = L.standings(season, results, 10, players);
    const by = Object.fromEntries(rows.map(r => [r.player_id, r]));
    expect(by.p2.avg).toBe(3);            // promedio perfecto…
    expect(by.p2.ranked).toBe(false);     // …pero jugó 3 de 10
    expect(by.p2.position).toBe(null);
    expect(by.p3.position).toBe(1);
    expect(by.p1.position).toBe(2);
  });

  it('ordena por puntos por tarea, no por total', () => {
    // Un suplente que juega poco pero gana siempre no puede quedar debajo de uno
    // que jugó todo con peor rendimiento… siempre que llegue al mínimo.
    const rs = [];
    for (let i = 0; i < 10; i++) rs.push({ player_id: 'a', outcome: 'draw', points: 1 });   // 10 pts, avg 1
    for (let i = 0; i < 6; i++)  rs.push({ player_id: 'b', outcome: 'win',  points: 3 });   //  18 pts, avg 3
    const { rows } = L.standings(season, rs, 10, [{ id: 'a' }, { id: 'b' }]);
    expect(rows.map(r => r.player_id)).toEqual(['b', 'a']);
    expect(rows[0].ranked).toBe(true);
  });
});
