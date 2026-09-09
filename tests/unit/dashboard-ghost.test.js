import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// Un dashboard propio del club se identifica en la página como 'db-<uuid>' — su CLAVE DE VISTA.
// Ese string se colaba como `report_type` al guardar una card, y saveDashboardCard, al no
// encontrar ningún dashboard con ese report_type, CREABA uno nuevo llamado «db-600756f4-…».
// La card se iba a ese dashboard fantasma y desaparecía de la vista donde se la acababa de crear.

const DASH_ID = '600756f4-3158-4938-a157-f52e5c76d554';
const CLUB = 'club-1';

/** sb de mentira: anota los INSERT y no encuentra nunca un dashboard por report_type. */
function fakeSb(log) {
  const q = (table) => {
    const api = {
      _table: table,
      select: () => api, eq: () => api, order: () => api, limit: () => api,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: { id: 'nuevo-id' }, error: null }),
      insert: (row) => { log.push({ table, row }); return api; },
      then: (res) => res({ data: null, error: null }),
    };
    return api;
  };
  return { from: q };
}

beforeAll(async () => {
  globalThis.window = globalThis.window || {};
  await import('../../assets/gp-builder/gp-persist.js');
});

let log;
beforeEach(() => { log = []; window.sb = fakeSb(log); });

describe('saveDashboardCard · dashboards fantasma', () => {
  it('con una vista custom no crea ningún dashboard: inserta en el que ya existe', async () => {
    let destino = null;
    window.insertCardIntoDashboard = async (config, dashboardId) => { destino = dashboardId; return 'card-1'; };

    const id = await window.saveDashboardCard({ viz: 'box' }, CLUB, `db-${DASH_ID}`, 'user-1', window.sb);

    expect(destino).toBe(DASH_ID);              // va al dashboard de la vista, no a uno nuevo
    expect(id).toBe('card-1');
    expect(log.filter(l => l.table === 'dashboards')).toHaveLength(0);   // ni un insert
  });

  it('una vista predefinida sigue creando su dashboard con nombre de verdad', async () => {
    window.insertCardIntoDashboard = async () => { throw new Error('no debería usarse'); };
    await window.saveDashboardCard({ viz: 'kpi', scope: { level: 'squad' } }, CLUB, 'mgrp', 'user-1', window.sb);
    const creados = log.filter(l => l.table === 'dashboards');
    expect(creados).toHaveLength(1);
    expect(creados[0].row.name).toBe('Load Monitoring');
    expect(creados[0].row.report_type).toBe('mgrp');
  });
});
