import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

// La proyección de Daily Planning se puede leer por línea (migración 180). Lo que se
// prueba acá es la parte que decide QUÉ perfil usa cada columna y cómo se traduce a un
// porcentaje de partido — no el pintado. Mismo arranque que daily-planning-parallel:
// el archivo es un script de navegador y se evalúa con lo justo de DOM.
const boot = () => {
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener(){}, body: { appendChild(){}, addEventListener(){} },
  };
  globalThis.localStorage = { _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; } };
  globalThis.addEventListener = () => {};
  globalThis.guardModule = async () => false;        // corta el arranque real de la página
  globalThis.CM_GPS_METRICS = [
    { key:'total_distance_per_min',      label:'Total dist', mult:1, avgUnit:'m' },
    { key:'high_speed_distance_per_min', label:'HSR',        mult:1, avgUnit:'m' },
  ];
  const src = fs.readFileSync(path.join(ROOT, 'assets/pages/daily-planning.js'), 'utf8')
    + '\n;globalThis.__dp = { set profPos(v){ _dpProfPos = v; }, set matchDem(v){ _dpMatchDem = v; },'
    + ' set club(v){ _dpClubId = v; }, get lineas(){ return _DP_POS_LINES; } };';
  (0, eval)(src);
  __dp.club = 'club-1';
};

// Un bloque de sesión: `duration` minutos de trabajo mapeados a este ejercicio.
const bloque = (exId, min) => ({ e: { planner_exercise_id: exId, duration: min }, factor: 1 });

describe('perfil por línea · qué fila se usa', () => {
  beforeEach(boot);

  it('usa el perfil de la línea cuando tiene muestra suficiente', () => {
    __dp.profPos = { ex1: {
      ALL: { n_instances: 20, total_distance_per_min: 70 },
      MID: { n_instances: 5,  total_distance_per_min: 85 },
    } };
    const pf = dpProfFor('ex1', 'MID');
    expect(pf.row.total_distance_per_min).toBe(85);
    expect(pf.fb).toBe(false);
  });

  it('cae al promedio de equipo por debajo de 3 registros, y lo marca', () => {
    // El caso real: los delanteros tienen 2.3 registros por ejercicio de media.
    __dp.profPos = { ex1: {
      ALL: { n_instances: 20, total_distance_per_min: 70 },
      FWD: { n_instances: 2,  total_distance_per_min: 95 },
    } };
    const pf = dpProfFor('ex1', 'FWD');
    expect(pf.row.total_distance_per_min).toBe(70);
    expect(pf.fb).toBe(true);
  });

  it('cae al promedio de equipo cuando la línea no aparece en el ejercicio', () => {
    __dp.profPos = { ex1: { ALL: { n_instances: 20, total_distance_per_min: 70 } } };
    expect(dpProfFor('ex1', 'WNG')).toEqual({ row: { n_instances: 20, total_distance_per_min: 70 }, fb: true });
  });

  it('el modo equipo nunca queda marcado como caída', () => {
    __dp.profPos = { ex1: { ALL: { n_instances: 20, total_distance_per_min: 70 } } };
    expect(dpProfFor('ex1', null).fb).toBe(false);
  });

  it('un ejercicio sin perfil no devuelve nada', () => {
    __dp.profPos = { ex1: null };
    expect(dpProfFor('ex1', 'MID')).toBe(null);
    expect(dpProfFor('otro', 'MID')).toBe(null);
  });
});

describe('proyección de una columna', () => {
  beforeEach(boot);

  it('suma perfil × minutos de trabajo de cada bloque', () => {
    __dp.profPos = {
      ex1: { ALL: { n_instances: 20, total_distance_per_min: 70 }, MID: { n_instances: 9, total_distance_per_min: 85 } },
      ex2: { ALL: { n_instances: 20, total_distance_per_min: 60 }, MID: { n_instances: 9, total_distance_per_min: 50 } },
    };
    const contribs = [bloque('ex1', 30), bloque('ex2', 20)];
    expect(dpProjectLine(contribs, ['total_distance_per_min'], 'MID').vals.total_distance_per_min)
      .toBe(85 * 30 + 50 * 20);
    expect(dpProjectLine(contribs, ['total_distance_per_min'], null).vals.total_distance_per_min)
      .toBe(70 * 30 + 60 * 20);
  });

  it('cuenta cuántos bloques cayeron al promedio de equipo', () => {
    __dp.profPos = {
      ex1: { ALL: { n_instances: 20, total_distance_per_min: 70 }, WNG: { n_instances: 6, total_distance_per_min: 88 } },
      ex2: { ALL: { n_instances: 20, total_distance_per_min: 60 } },   // esta línea no tiene fila propia
    };
    const col = dpProjectLine([bloque('ex1', 10), bloque('ex2', 10)], ['total_distance_per_min'], 'WNG');
    expect(col.fb).toBe(1);
    expect(col.vals.total_distance_per_min).toBe(88 * 10 + 60 * 10);
  });

  it('respeta el reparto de los bloques en paralelo', () => {
    // Media tarea la hace medio plantel: aporta la mitad (dpProjWeights).
    __dp.profPos = { ex1: { ALL: { n_instances: 20, total_distance_per_min: 70 } } };
    const col = dpProjectLine([{ e: { planner_exercise_id: 'ex1', duration: 20 }, factor: 0.5 }], ['total_distance_per_min'], null);
    expect(col.vals.total_distance_per_min).toBe(700);
  });

  it('un bloque sin perfil no aporta ni rompe la suma', () => {
    __dp.profPos = { ex1: { ALL: { n_instances: 20, total_distance_per_min: 70 } }, ex2: null };
    const col = dpProjectLine([bloque('ex1', 10), bloque('ex2', 40)], ['total_distance_per_min'], null);
    expect(col.vals.total_distance_per_min).toBe(700);
    expect(col.fb).toBe(0);
  });
});

describe('porcentaje de un partido', () => {
  beforeEach(boot);

  it('compara contra la demanda de la línea, no contra la del equipo', () => {
    __dp.matchDem = {
      ALL: { n_matches: 300, total_distance: 9550 },
      MID: { n_matches: 100, total_distance: 10000 },
    };
    expect(dpMatchPct('total_distance_per_min', 'MID', 5000)).toBe(50);
    expect(dpMatchPct('total_distance_per_min', null,  4775)).toBe(50);
  });

  it('no inventa referencia con menos de 3 partidos', () => {
    __dp.matchDem = { MID: { n_matches: 2, total_distance: 10000 } };
    expect(dpMatchPct('total_distance_per_min', 'MID', 5000)).toBe(null);
  });

  it('no inventa referencia si el club todavía no tiene partidos con GPS', () => {
    __dp.matchDem = {};
    expect(dpMatchPct('total_distance_per_min', 'MID', 5000)).toBe(null);
  });

  it('una métrica sin valor de partido se queda sin porcentaje', () => {
    __dp.matchDem = { MID: { n_matches: 100, total_distance: 10000, high_speed_distance: null } };
    expect(dpMatchPct('high_speed_distance_per_min', 'MID', 200)).toBe(null);
  });
});

describe('modo de lectura de la card', () => {
  beforeEach(boot);

  it('arranca en equipo y recuerda la elección', () => {
    expect(dpProjMode()).toBe('team');
    localStorage.setItem('cm_dp_proj_mode', 'lines');
    expect(dpProjMode()).toBe('lines');
  });

  it('ignora un valor guardado que no existe', () => {
    localStorage.setItem('cm_dp_proj_mode', 'porteros');
    expect(dpProjMode()).toBe('team');
  });

  it('los porteros no son una columna', () => {
    expect(__dp.lineas).toEqual(['DEF', 'MID', 'WNG', 'FWD']);
  });
});
