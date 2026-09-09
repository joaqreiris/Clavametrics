import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const load = rel => { (0, eval)(fs.readFileSync(path.join(ROOT, rel), 'utf8')); };

function boot() {
  globalThis.window = {};
  load('assets/wyscout-team-stats.js');
  return window.cmWyscoutTeamStats;
}

/* La forma real del export "Team Stats" de Wyscout, recortada a las columnas que
   importan pero con su rareza intacta: los encabezados van sólo en la primera columna
   de cada grupo, y un grupo no siempre tiene tantos nombres como celdas.

   Fila 0: encabezados · Filas 1-2: rótulos del propio Excel, sin datos · Filas 3-4: los
   dos equipos. */
function sheet() {
  const header = [
    'Date', 'Match', 'Competition', 'Duration', 'Team', 'Scheme',
    'Goals',                            // 1 celda
    'xG',                               // 1 celda
    'Shots / on target', '', '',        // 3 celdas, 2 nombres → el 3.º es el %
    'Possession, %',                    // 1 celda
    'Losses / Low / Medium / High', '', '', '',       // 4 celdas, 4 nombres
    'Recoveries / Low / Medium / High', '', '', '',   // 4 celdas, 4 nombres
    'Progressive passes / accurate', '', '',          // 3 celdas, 2 nombres
    'Penalty area entries (runs / crosses)', '', '',  // el "/" está dentro del paréntesis
    'PPDA',
  ];
  const us = ['2026-09-05', 'Angkor Tiger - Kompong Dewa 0:0', 'Cambodian Premier League', 93,
    'Kompong Dewa', '4-3-3 (100.0%)',
    0, 0.54, 12.0, 6.0, 50.0, 62.14,
    107.0, 21.0, 34.0, 52.0,
    65.0, 36.0, 21.0, 8.0,
    70.0, 49.0, 70.0,
    21.0, 9.0, 4.0,
    5.88];
  const them = ['2026-09-05', 'Angkor Tiger - Kompong Dewa 0:0', 'Cambodian Premier League', 93,
    'Angkor Tiger', '5-3-2 (100.0%)',
    0, 0.81, 14.0, 3.0, 21.43, 37.86,
    104.0, 16.0, 37.0, 51.0,
    68.0, 35.0, 26.0, 7.0,
    57.0, 43.0, 75.44,
    18.0, 3.0, 4.0,
    10.07];
  const label = t => { const r = new Array(header.length).fill(''); r[0] = t; return r; };
  return [header, label('Kompong Dewa'), label('Opponents'), us, them];
}

describe('wyscout team stats · reconocer el archivo', () => {
  let W;
  beforeEach(() => { W = boot(); });

  it('reconoce el export por su encabezado, no por el nombre del archivo', () => {
    expect(W.looks(sheet()[0])).toBe(true);
  });

  it('no confunde una planilla de jugadores con una de equipo', () => {
    expect(W.looks(['Player', 'Minutes played', 'Goals', 'Assists'])).toBe(false);
    expect(W.parse([['Player', 'Goals'], ['Dida', 2]], null)).toBe(null);
  });

  it('tolera un encabezado con otro capitalizado o espaciado', () => {
    const h = sheet()[0].map(x => x === 'Possession, %' ? 'possession,  %' : x);
    expect(W.looks(h)).toBe(true);
  });
});

describe('wyscout team stats · expandir encabezados que abarcan varias columnas', () => {
  let W, parsed, us, them;
  beforeEach(() => {
    W = boot();
    parsed = W.parse(sheet(), 'Angkor Tiger');
    us = parsed.sides.find(s => s.side === 'us').stats;
    them = parsed.sides.find(s => s.side === 'them').stats;
  });

  it('parte un grupo de cuatro nombres en sus cuatro métricas, en orden', () => {
    expect(us.losses).toBe(107);
    expect(us.losses_low).toBe(21);
    expect(us.losses_medium).toBe(34);
    expect(us.losses_high).toBe(52);
    expect(us.recoveries_high).toBe(8);
  });

  it('nombra la tercera columna de "X / accurate" como el porcentaje que es', () => {
    // Éste es el desfase que desalinea todo si se lee el encabezado literal: dos
    // nombres sobre tres celdas.
    expect(us.progressive_passes).toBe(70);
    expect(us.progressive_passes_accurate).toBe(49);
    expect(us.progressive_passes_pct).toBe(70);
    expect(them.progressive_passes_pct).toBeCloseTo(75.44, 2);
  });

  it('no toma como separador el "/" que está dentro de un paréntesis', () => {
    expect(us.penalty_area_entries).toBe(21);
    expect(us.penalty_area_entries_runs).toBe(9);
    expect(us.penalty_area_entries_crosses).toBe(4);
  });

  it('no corre las columnas: la última métrica sigue en su lugar', () => {
    expect(us.ppda).toBeCloseTo(5.88, 2);
    expect(them.ppda).toBeCloseTo(10.07, 2);
  });

  it('reconoce todos los encabezados del archivo', () => {
    expect(parsed.unknown).toEqual([]);
  });
});

describe('wyscout team stats · quién es quién', () => {
  let W;
  beforeEach(() => { W = boot(); });

  it('identifica al rival por el nombre que ya tiene el partido', () => {
    const p = W.parse(sheet(), 'Angkor Tiger');
    expect(p.matched).toBe(true);
    expect(p.sides.find(s => s.side === 'us').team_name).toBe('Kompong Dewa');
    expect(p.sides.find(s => s.side === 'them').team_name).toBe('Angkor Tiger');
  });

  it('lo identifica aunque el nombre del partido esté abreviado o con otro caso', () => {
    const p = W.parse(sheet(), 'angkor tiger fc');
    expect(p.matched).toBe(true);
    expect(p.sides.find(s => s.side === 'them').team_name).toBe('Angkor Tiger');
  });

  it('sin nombre que comparar cae al orden del archivo y lo dice', () => {
    const p = W.parse(sheet(), null);
    expect(p.matched).toBe(false);
    expect(p.sides[0].side).toBe('us');
    expect(p.sides[1].side).toBe('them');
  });

  it('si el rival del partido no está en el archivo, avisa en vez de asumir', () => {
    const p = W.parse(sheet(), 'Boeung Ket');
    expect(p.matched).toBe(false);
  });

  it('se queda con el dibujo y descarta el porcentaje que Wyscout le pega', () => {
    const p = W.parse(sheet(), 'Angkor Tiger');
    expect(p.sides.find(s => s.side === 'us').formation).toBe('4-3-3');
  });

  it('ignora las filas de rótulo que el propio Excel mete arriba', () => {
    expect(W.parse(sheet(), 'Angkor Tiger').sides.length).toBe(2);
  });
});

describe('wyscout team stats · cómo se muestra', () => {
  let W;
  beforeEach(() => { W = boot(); });

  it('arma la etiqueta con el grupo más el sufijo, sin una cadena por métrica', () => {
    // Sin i18n cargado cae al inglés de Wyscout, que es el que el analista reconoce.
    expect(W.label('progressive_passes')).toBe('Progressive passes');
    expect(W.label('progressive_passes_accurate')).toBe('Progressive passes accurate');
    expect(W.label('recoveries_high')).toBe('Recoveries final third');
  });

  it('separa el grupo del sufijo tomando el sufijo más largo que aplique', () => {
    expect(W.split('shots_on_target')).toEqual({ base: 'shots', sfx: 'on_target' });
    expect(W.split('shots')).toEqual({ base: 'shots', sfx: null });
    // 'crosses' es un grupo por sí mismo Y un sufijo: gana el grupo.
    expect(W.split('crosses').sfx).toBe(null);
  });

  it('escribe los porcentajes con su signo y los enteros sin decimales de más', () => {
    expect(W.format('possession_pct', 62.14)).toBe('62,1 %');
    expect(W.format('shots', 12)).toBe('12');
    expect(W.format('ppda', 5.88)).toBe('5,88');
    expect(W.format('xg', null)).toBe('—');
  });

  it('sabe en qué métricas bajar es mejorar', () => {
    expect(W.lowerIsBetter('ppda')).toBe(true);
    expect(W.lowerIsBetter('losses')).toBe(true);
    expect(W.lowerIsBetter('progressive_passes')).toBe(false);
  });

  it('toda métrica destacada o de tendencia existe en el catálogo', () => {
    const known = new Set(W.allKeys());
    W.HIGHLIGHT.forEach(k => expect(known.has(k), k).toBe(true));
    W.TREND.forEach(k => expect(known.has(k), k).toBe(true));
    W.LOWER_IS_BETTER.forEach(k => expect(known.has(k), k).toBe(true));
  });

  it('no repite una clave entre dos grupos del catálogo', () => {
    const all = W.allKeys();
    expect(all.length).toBe(new Set(all).size);
  });
});
