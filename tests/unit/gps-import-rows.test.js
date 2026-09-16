import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/* Dos cosas que rompían el import de un CSV de Catapult de verdad:

   1. el nombre viene como "Attacker - Sitha Mathew" — posición y jugador en la misma
      celda — y el matcher buscaba a alguien llamado así, que no existe;
   2. el export cierra con varias filas "Average" (una por posición) que entraban como
      si fueran atletas.

   Se extraen las funciones tal cual están en el wizard. Si alguien mueve el bloque, el
   test falla ruidosamente en vez de dejar de cubrir en silencio. */

const ROOT = path.resolve(__dirname, '../..');
const SRC  = fs.readFileSync(path.join(ROOT, 'assets/gps-import-wizard.js'), 'utf8');

function boot(wizState = {}) {
  // Posiciones reales del pack de fútbol, no un stub: el corte de "¿esto es una
  // posición?" es justo lo que decide si se parte el nombre o no.
  global.window = { addEventListener() {} };
  global.document = { readyState: 'complete', addEventListener() {},
                      documentElement: { setAttribute() {}, getAttribute() {} },
                      querySelectorAll: () => [], getElementById: () => null };
  global.localStorage = { _d: { cm_sport: 'football' },
                          getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; } };
  for (const f of ['assets/sport-packs.js', 'assets/sport.js', 'assets/positions.js']) {
    (0, eval)(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  }
  const i = SRC.indexOf('  /* ── Filas que no son jugadores');
  const j = SRC.indexOf('  function _norm(s)');
  if (i === -1 || j === -1 || j <= i) throw new Error('no se encontró el bloque en gps-import-wizard.js');
  return new Function('_wizState',
    SRC.slice(i, j) + '\nreturn { _isSummaryRow, _wizDataRows, _wizSummaryCount, _splitPosName };'
  )(wizState);
}

const W = boot();

describe('posición y nombre en la misma celda', () => {
  it('parte los nombres que exporta Catapult', () => {
    expect(W._splitPosName('Attacker - Sitha Mathew')).toMatchObject({ name: 'Sitha Mathew', positionCode: 'ST' });
    expect(W._splitPosName('Full Back - NY Sokry')).toMatchObject({ name: 'NY Sokry', positionCode: 'FB' });
    expect(W._splitPosName('Defender - Pedro NUNES')).toMatchObject({ name: 'Pedro NUNES', positionCode: 'CB' });
    expect(W._splitPosName('Midfielder - San SOVATHE')).toMatchObject({ name: 'San SOVATHE', positionCode: 'CM' });
    expect(W._splitPosName('Winger - Khorn NARONG')).toMatchObject({ name: 'Khorn NARONG', positionCode: 'WG' });
    expect(W._splitPosName('Goalkeeper - Pedro Silva')).toMatchObject({ name: 'Pedro Silva', positionCode: 'GK' });
  });

  it('en español y portugués también', () => {
    expect(W._splitPosName('Arquero - Juan Pérez')).toMatchObject({ name: 'Juan Pérez', positionCode: 'GK' });
    expect(W._splitPosName('Zagueiro - Otávio Pinheiro')).toMatchObject({ name: 'Otávio Pinheiro', positionCode: 'CB' });
  });

  it('NO parte lo que no es una posición — ese es el riesgo de cortar por el primer guión', () => {
    for (const n of ['Jean - Pierre Dupont', 'Smith - Jones', 'García - López', 'Anne-Marie Dubois']) {
      const r = W._splitPosName(n);
      expect([n, r.name]).toEqual([n, n.trim()]);
      expect(r.position).toBe('');
    }
  });

  it('un nombre sin guión queda igual', () => {
    expect(W._splitPosName('Sitha Mathew')).toEqual({ name: 'Sitha Mathew', position: '' });
    expect(W._splitPosName('')).toEqual({ name: '', position: '' });
  });

  it('acepta los guiones largos y los espacios de más', () => {
    expect(W._splitPosName('Attacker   –   Kim Hyeonsu')).toMatchObject({ name: 'Kim Hyeonsu' });
    expect(W._splitPosName('Winger—Mon RADO')).toMatchObject({ name: 'Mon RADO' });
  });
});

describe('filas que no son jugadores', () => {
  const fila = v => [v, '01:00:00', '4000', '68'];

  it('reconoce las etiquetas de resumen en tres idiomas', () => {
    ['Average', 'AVERAGE', 'Averages', 'Avg', 'Mean', 'Total', 'Totals', 'Sum',
     'Team', 'Squad', 'Media', 'Promedio', 'Médias', 'Totales'].forEach(v =>
      expect([v, W._isSummaryRow(fila(v))]).toEqual([v, true]));
  });

  it('acepta las combinaciones que usan los proveedores', () => {
    ['Team Average', 'Total (all)', 'Average:', 'Overall'].forEach(v =>
      expect([v, W._isSummaryRow(fila(v))]).toEqual([v, true]));
  });

  // Un atleta que se llame así NO puede desaparecer del import en silencio: perder un
  // jugador de verdad es peor que colar una fila de promedios, que se ve a simple vista.
  it('un jugador no es una fila de resumen, aunque empiece por una de esas palabras', () => {
    ['Sitha Mathew', 'Attacker - Kim Hyeonsu', 'Averardo Bianchi', 'Total Silva',
     'Team Nogueira', 'Medina Torres', 'Summers Johnson'].forEach(v =>
      expect([v, W._isSummaryRow(fila(v))]).toEqual([v, false]));
  });

  it('descarta las de resumen y deja los jugadores', () => {
    const rows = [
      ['Name', 'Total Duration'],
      ['Attacker - Sitha Mathew', '01:05:22'],
      ['Full Back - NY Sokry', '01:05:22'],
      ['Average', '01:00:56'],
      ['Average', '00:53:06'],
    ];
    expect(W._wizSummaryCount(rows, 0)).toBe(2);
    expect(W._wizDataRows(rows, 0)).toHaveLength(2);
  });

  it('si el club decide incluirlas, entran', () => {
    const conResumen = boot({ includeSummary: true });
    const rows = [['Name'], ['Sitha Mathew'], ['Average']];
    expect(conResumen._wizDataRows(rows, 0)).toHaveLength(2);
  });

  it('las filas vacías no cuentan', () => {
    const rows = [['Name', 'X'], ['Sitha Mathew', '1'], ['', ''], ['Average', '2']];
    expect(W._wizDataRows(rows, 0)).toHaveLength(1);
  });
});
