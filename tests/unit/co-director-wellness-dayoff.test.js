// Cumplimiento de wellness: el día libre no puede contar como incumplimiento.
//
// El bug era una asimetría con el RPE: `session_rpe_status` descuenta al que está de día libre
// y el wellness no, así que un día libre con tres partes cargados contaba como tres de
// veinticuatro. Y no alcanza con copiar el criterio del RPE, porque el día libre vive en tres
// tablas distintas y la que el RPE mira (availability) es justamente la que NO guarda el caso
// más común: el día libre de equipo entero sólo deja rastro en calendar_events /
// training_sessions.
import { describe, it, expect, beforeAll } from 'vitest';

let wellStats;

const TEAM = 't1', OTHER = 't2';
const PLAYERS = Array.from({ length: 10 }, (_, i) => ({ id: 'p' + i, team_id: TEAM }));

// Un core mínimo con los mismos índices que arma loadCore().
function core({ wellness = [], avail = [], calOff = [], sessOff = [], players = PLAYERS } = {}) {
  const pmap = {}; players.forEach(p => { pmap[String(p.id)] = p; });
  const availOf = {}; avail.forEach(a => { (availOf[a.date] = availOf[a.date] || []).push(a); });
  const calOffOf = {}; calOff.forEach(e => { (calOffOf[e.date] = calOffOf[e.date] || []).push(e); });
  const sessOffOf = {}; sessOff.forEach(s => { (sessOffOf[s.date] = sessOffOf[s.date] || []).push(s.team_id || null); });
  return { players, pmap, wellness, availOf, calOffOf, sessOffOf };
}
// Mediodía local para que el día se resuelva igual en cualquier zona.
const checkIn = (pid, day, readiness = 7) => ({ player_id: pid, readiness, submitted_at: day + 'T12:00:00' });
const stats = c => wellStats(c, new Set([TEAM]), '2026-09-01', '2026-09-30');

beforeAll(async () => {
  global.window = { CM_I18N: null };
  await import('../../assets/club-overview-director.js');
  wellStats = global.window.cmCoDirector._wellStats;
});

describe('cumplimiento de wellness', () => {
  it('un día normal: cargaron 6 de 10', () => {
    const r = stats(core({ wellness: [0,1,2,3,4,5].map(i => checkIn('p' + i, '2026-09-01')) }));
    expect(r.got).toBe(6);
    expect(r.expected).toBe(10);
    expect(Math.round(r.pct)).toBe(60);
    expect(r.offDays).toBe(0);
  });

  it('día libre de EQUIPO ENTERO (Calendar): los tres que cargaron no son 3 de 10', () => {
    // Este es el caso que el criterio del RPE no ve: no hay una sola fila en availability.
    const c = core({
      wellness: [0,1,2].map(i => checkIn('p' + i, '2026-09-02')),
      calOff: [{ date: '2026-09-02', team_id: TEAM, player_ids: [] }],
    });
    const r = stats(c);
    expect(r.expected).toBe(3);
    expect(r.got).toBe(3);
    expect(r.pct).toBe(100);
    expect(r.offDays).toBe(1);
  });

  it('el día libre de equipo también se anota como sesión', () => {
    const r = stats(core({
      wellness: [checkIn('p0', '2026-09-03')],
      sessOff: [{ date: '2026-09-03', team_id: TEAM }],
    }));
    expect(r.expected).toBe(1);
    expect(r.pct).toBe(100);
  });

  it('día libre parcial: descuenta sólo a los nombrados', () => {
    // p0..p3 de día libre; de los seis que sí se esperaban, cargaron cuatro.
    const r = stats(core({
      wellness: [4,5,6,7].map(i => checkIn('p' + i, '2026-09-04')),
      avail: [0,1,2,3].map(i => ({ player_id: 'p' + i, team_id: TEAM, status: 'day_off', date: '2026-09-04' })),
    }));
    expect(r.expected).toBe(6);
    expect(r.got).toBe(4);
    expect(Math.round(r.pct)).toBe(67);
  });

  it('el día libre de OTRO equipo no descuenta a nadie', () => {
    const r = stats(core({
      wellness: [checkIn('p0', '2026-09-05')],
      calOff: [{ date: '2026-09-05', team_id: OTHER, player_ids: [] }],
      avail: [{ player_id: 'p1', team_id: OTHER, status: 'day_off', date: '2026-09-05' }],
    }));
    expect(r.expected).toBe(10);
    expect(r.offDays).toBe(0);
  });

  it('cargar el parte en un día libre nunca empeora el número, y no pasa de 100%', () => {
    const sinCargar = stats(core({
      wellness: [0,1,2,3,4].map(i => checkIn('p' + i, '2026-09-06')),
      calOff: [{ date: '2026-09-06', team_id: TEAM, player_ids: ['p5','p6','p7','p8','p9'] }],
    }));
    const cargando = stats(core({
      // Los mismos cinco, más dos que estaban de día libre y lo cargaron igual.
      wellness: [0,1,2,3,4,5,6].map(i => checkIn('p' + i, '2026-09-06')),
      calOff: [{ date: '2026-09-06', team_id: TEAM, player_ids: ['p5','p6','p7','p8','p9'] }],
    }));
    expect(sinCargar.pct).toBe(100);          // 5 de 5 esperados
    expect(cargando.pct).toBe(100);           // 7 de 7: los dos suman arriba y abajo
    expect(cargando.pct).toBeLessThanOrEqual(100);
    expect(cargando.pct).toBeGreaterThanOrEqual(sinCargar.pct);
  });

  it('el enfermo que carga igual tampoco puede llevar el porcentaje por encima de 100%', () => {
    const r = stats(core({
      wellness: PLAYERS.map(p => checkIn(p.id, '2026-09-07')),
      avail: [{ player_id: 'p0', team_id: TEAM, status: 'sick', date: '2026-09-07' }],
    }));
    expect(r.expected).toBe(9);
    expect(r.got).toBe(9);
    expect(r.pct).toBe(100);
  });

  it('un día sin ningún parte no entra: casi siempre es descanso, no incumplimiento', () => {
    const r = stats(core({ wellness: [checkIn('p0', '2026-09-08')] }));
    expect(r.days).toBe(1);
    expect(r.expected).toBe(10);
  });
});
