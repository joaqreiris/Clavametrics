// Cola de decisiones de Load Monitor: los ítems que deriva y la clave con la que se
// convierten en tareas.
//
// La clave (source_key) es lo único que impide duplicar: el índice único de la migración 152
// es por (club_id, source_key), así que si la clave no lleva el equipo y la fecha adentro,
// dos equipos comparten tarea o el riesgo de esta semana queda tapado por la tarea cerrada de
// la semana pasada. Por eso se prueba acá y no sólo en la UI.
//
// Los roles tienen que ser slugs que acepte el CHECK de tasks.assigned_roles; uno inventado
// hace fallar el insert entero con un 23514 que en pantalla se ve como "no se pudo crear".
import { describe, it, expect, beforeAll } from 'vitest';

let dqItems, dqSourceKey, DQ_PRIO;

// Los que acepta tasks_assigned_roles_check (db/schema.sql).
const ROLES_VALIDOS = new Set(['owner','admin','coach','physio','analyst','nutritionist','staff',
  'sc_coach','fitness_coach','gk_coach','assistant_coach','director_football','head_performance',
  'methodology_director','team_manager']);
// Los que acepta tasks_priority_check.
const PRIOS_VALIDAS = new Set(['low','medium','high','urgent']);
// Los que acepta tasks_category_check.
const CATS_VALIDAS = new Set(['general','match_day','medical','routine','event']);

beforeAll(async () => {
  const nodo = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {}, addEventListener() {}, querySelectorAll: () => [] });
  global.window = { CM_I18N: null };
  global.document = { addEventListener() {}, removeEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: nodo(), head: nodo(), body: nodo(), createElement: nodo, readyState: 'complete' };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  await import('../../assets/load-monitor.js');
  ({ _dqItems: dqItems, _dqSourceKey: dqSourceKey, _DQ_PRIO: DQ_PRIO } = global.window.cmLoadMonitor);
});

/** Un estado mínimo de la pantalla, con los enganches que mira dqItems(). */
function estado(over = {}) {
  return Object.assign({
    teamId: 'team-a', refDate: '2026-09-13', players: [], lastSquad: null, lastStress: null,
  }, over);
}

describe('dqSourceKey', () => {
  it('lleva el equipo y la fecha, así que no se pisan entre equipos ni entre semanas', () => {
    const a = dqSourceKey('hsr', estado());
    expect(a).toBe('lm:hsr:team-a:2026-09-13');
    expect(dqSourceKey('hsr', estado({ teamId: 'team-b' }))).not.toBe(a);
    expect(dqSourceKey('hsr', estado({ refDate: '2026-09-20' }))).not.toBe(a);
    expect(dqSourceKey('rehab', estado())).not.toBe(a);
  });

  it('sin equipo sigue dando una clave estable y no "undefined"', () => {
    const k = dqSourceKey('xi', estado({ teamId: null }));
    expect(k).toBe('lm:xi:noteam:2026-09-13');
    expect(k).not.toContain('undefined');
    expect(k).not.toContain('null');
  });

  it('es estable: la misma pantalla da la misma clave', () => {
    expect(dqSourceKey('md2', estado())).toBe(dqSourceKey('md2', estado()));
  });
});

describe('dqItems', () => {
  it('sin datos deja sólo el ítem que no depende de ellos', () => {
    const items = dqItems(estado());
    expect(items.map(i => i.key)).toEqual(['xi']);
  });

  it('saca el de exposición sólo con ACWR por encima de 1.5', () => {
    const sinRiesgo = dqItems(estado({ lastSquad: { perPlayer: { p1: { acwr: 1.2 } } } }));
    expect(sinRiesgo.some(i => i.key === 'hsr')).toBe(false);

    const conRiesgo = dqItems(estado({
      players: [{ id: 'p1', first_name: 'Ana', last_name: 'Giménez' }],
      lastSquad: { perPlayer: { p1: { acwr: 1.7 } } },
    }));
    const hsr = conRiesgo.find(i => i.key === 'hsr');
    expect(hsr).toBeTruthy();
    expect(hsr.prio).toBe('high');
    expect(hsr.who).toContain('Giménez');
  });

  it('un ACWR nulo no cuenta como riesgo', () => {
    // Sin dato suficiente el motor devuelve acwr null: contarlo abriría tareas fantasma.
    const items = dqItems(estado({ lastSquad: { perPlayer: { p1: { acwr: null, insufficient: true } } } }));
    expect(items.some(i => i.key === 'hsr' || i.key === 'md2')).toBe(false);
  });

  it('toma hasta dos estresores altos y les pone su fecha de vencimiento', () => {
    const st = estado({ lastStress: { stressors: [
      { kind: 'heat',   sev: 'high', date: '2026-09-15', title: 'Calor extremo' },
      { kind: 'travel', sev: 'high', date: '2026-09-17', title: 'Viaje largo' },
      { kind: 'heat',   sev: 'high', date: '2026-09-19', title: 'Tercero' },
      { kind: 'heat',   sev: 'low',  date: '2026-09-20', title: 'Bajo' },
    ] } });
    const items = dqItems(st).filter(i => String(i.key).startsWith('stress:'));
    expect(items).toHaveLength(2);
    expect(items[0].due).toBe('2026-09-15');
    // La clave distingue estresores del mismo día pero de distinto tipo.
    expect(items[0].key).not.toBe(items[1].key);
  });

  it('el de rehab sale con jugadores limitados y va al cuerpo médico', () => {
    const items = dqItems(estado({ players: [
      { id: 'p1', status: 'injured' }, { id: 'p2', status: 'available' },
    ] }));
    const rehab = items.find(i => i.key === 'rehab');
    expect(rehab).toBeTruthy();
    expect(rehab.roles).toEqual(['physio']);
    expect(rehab.cat).toBe('medical');
  });
});

describe('lo que se manda a tasks tiene que pasar sus CHECK', () => {
  const todos = () => dqItems(estado({
    players: [{ id: 'p1', status: 'injured' }],
    lastSquad: { perPlayer: { p1: { acwr: 1.7 }, p2: { acwr: 1.4 } } },
    lastStress: { stressors: [{ kind: 'heat', sev: 'high', date: '2026-09-15', title: 'Calor' }] },
  }));

  it('todos los ítems traen roles válidos', () => {
    for (const i of todos()) {
      for (const r of (i.roles || [])) expect(ROLES_VALIDOS.has(r), `${i.key} → ${r}`).toBe(true);
    }
  });

  it('todas las categorías son válidas', () => {
    for (const i of todos()) expect(CATS_VALIDAS.has(i.cat || 'general'), `${i.key} → ${i.cat}`).toBe(true);
  });

  it('las prioridades se traducen a las que acepta la tabla', () => {
    for (const i of todos()) expect(PRIOS_VALIDAS.has(DQ_PRIO[i.prio]), `${i.key} → ${i.prio}`).toBe(true);
  });

  it('ningún ítem se queda sin clave: sin ella no se puede evitar el duplicado', () => {
    for (const i of todos()) expect(typeof i.key === 'string' && i.key.length > 0, JSON.stringify(i.t)).toBe(true);
  });

  it('las claves de una misma pantalla son únicas entre sí', () => {
    const keys = todos().map(i => dqSourceKey(i.key, estado()));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
