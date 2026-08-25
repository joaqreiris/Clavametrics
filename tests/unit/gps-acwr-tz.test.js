import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// gps-acwr.js: la aritmética de fechas debe ser idéntica en CUALQUIER zona horaria.
// Bug real (2026-08): parseo de medianoche LOCAL + formateo toISOString (UTC) corría el
// gráfico −2 días al este de UTC (Camboya +7) y descartaba los últimos días de datos.
// El motor es un IIFE sobre window y node cachea TZ, así que se corre en un CHILD con
// la TZ fijada — así el guard funciona aunque CI corra en UTC o América.
const SCRIPT = `
  global.window = {};
  eval(require('fs').readFileSync(${JSON.stringify(fileURLToPath(new URL('../../assets/gps-acwr.js', import.meta.url)))}, 'utf8'));
  const eng = global.window.gpsACWR;
  const days = eng.dailyFill([], '2026-08-01', '2026-08-03').map(d => d.date);
  const byPlayer = { p1: ['2026-08-05','2026-08-06','2026-08-07','2026-08-08','2026-08-10']
    .map(date => ({ date, value: 100 })) };
  const s = eng.squadTimeline(byPlayer, '2026-08-01', '2026-08-12', { model: 'ewma', coupled: false });
  console.log(JSON.stringify({ days, first: s.dates[0], last: s.dates[s.dates.length - 1],
    nonNull: s.squadAcwr.filter(v => v != null).length }));
`;

function runInTz(tz) {
  const out = execFileSync(process.execPath, ['-e', SCRIPT], { env: { ...process.env, TZ: tz } });
  return JSON.parse(String(out));
}

describe('gps-acwr — fechas estables en cualquier zona horaria', () => {
  for (const tz of ['Asia/Phnom_Penh', 'America/Montevideo', 'UTC']) {
    it(`enumeración y ventana exactas en ${tz}`, () => {
      const r = runInTz(tz);
      expect(r.days).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
      expect(r.first).toBe('2026-08-01');   // el eje arranca EXACTO en from (sin corrimiento)
      expect(r.last).toBe('2026-08-12');    // e incluye el último día pedido
      expect(r.nonNull).toBeGreaterThan(0); // con ≥4 sesiones reales hay valores
    });
  }

  it('los tres husos producen exactamente la misma serie', () => {
    const a = runInTz('Asia/Phnom_Penh'), b = runInTz('America/Montevideo'), c = runInTz('UTC');
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });
});
