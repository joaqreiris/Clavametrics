/**
 * cm-save.js — guardar solo lo que cambió, sin pisar al de al lado.
 *
 * Los dos comportamientos que importan: que viaje únicamente el campo tocado
 * (para que dos personas en campos distintos no se borren), y que un cambio
 * ajeno llegado en el medio no se sobrescriba a ciegas.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

let cmSave, updates, filaEnBase, filasAfectadas;

// Constructor mínimo del builder de supabase-js: encadena .eq() y termina en
// .select(), que es donde se resuelve.
function fakeFrom() {
  return {
    _eq: {}, _patch: null,
    update(patch) { this._patch = patch; return this; },
    select() {
      // Tras un update, select() resuelve (devuelve las filas afectadas). En una
      // lectura suelta sigue encadenando hasta maybeSingle().
      if (!this._patch) return this;
      updates.push({ patch: this._patch, filtros: { ...this._eq } });
      const afecta = filasAfectadas.shift();
      return Promise.resolve({ data: afecta ? [{ updated_at: filaEnBase.updated_at }] : [], error: null });
    },
    eq(col, val) { this._eq[col] = val; return this; },
    maybeSingle() { return Promise.resolve({ data: filaEnBase, error: null }); },
  };
}

beforeAll(async () => {
  global.window = { sb: { from: () => fakeFrom() } };
  await import('../../assets/cm-save.js');
  cmSave = global.window.cmSave;
});

beforeEach(() => { updates = []; filasAfectadas = []; filaEnBase = null; });

describe('cmSave.diff', () => {
  it('deja pasar solo lo que cambió', () => {
    const prev = { title: 'A', notes: 'x', duration: 60 };
    expect(cmSave.diff(prev, { title: 'A', notes: 'y', duration: 60 })).toEqual({ notes: 'y' });
  });

  it('compara los jsonb por contenido, no por referencia', () => {
    const prev = { gps_targets: { dist: 5000 } };
    expect(cmSave.diff(prev, { gps_targets: { dist: 5000 } })).toEqual({});
    expect(cmSave.diff(prev, { gps_targets: { dist: 6000 } })).toEqual({ gps_targets: { dist: 6000 } });
  });

  it('null y undefined son lo mismo para una columna vacía', () => {
    expect(cmSave.diff({ notes: null }, { notes: undefined })).toEqual({});
  });
});

describe('cmSave.patch', () => {
  const base = {
    table: 'training_sessions', id: 's1', clubId: 'c1',
    prev: { title: 'Entrenamiento', notes: 'viejas', session_time: '08:30' },
  };

  it('manda solo el campo tocado, no la ficha entera', async () => {
    filasAfectadas = [true];
    filaEnBase = { updated_at: 't2' };
    const r = await cmSave.patch({ ...base, next: { ...base.prev, notes: 'nuevas' }, since: 't1' });

    expect(r.status).toBe('ok');
    expect(updates).toHaveLength(1);
    expect(updates[0].patch).toEqual({ notes: 'nuevas' });        // ← el título y la hora NO viajan
    expect(updates[0].filtros.updated_at).toBe('t1');             // ← condicionado a que nadie la tocara
  });

  it('sin cambios no escribe nada', async () => {
    const r = await cmSave.patch({ ...base, next: { ...base.prev }, since: 't1' });
    expect(r.status).toBe('noop');
    expect(updates).toHaveLength(0);
  });

  it('si otro guardó en el medio, refresca lo ajeno y reintenta sobre la versión nueva', async () => {
    filasAfectadas = [false, true];   // el primer intento no afecta filas: la tocaron
    filaEnBase = { id: 's1', title: 'Entrenamiento', notes: 'viejas', session_time: '09:00', updated_at: 't9' };
    const refrescos = [];

    const r = await cmSave.patch({
      ...base, next: { ...base.prev, notes: 'nuevas' }, since: 't1',
      onRemote: (fila, mios) => refrescos.push({ fila, mios }),
    });

    expect(r.status).toBe('merged');
    expect(updates).toHaveLength(2);
    expect(updates[1].filtros.updated_at).toBe('t9');             // reintenta contra la versión nueva
    expect(refrescos[0].fila.session_time).toBe('09:00');         // la página se entera del cambio ajeno…
    expect(refrescos[0].mios).toEqual({ notes: 'nuevas' });       // …y de qué NO tiene que tocar
  });

  it('onRemote puede rehacer el patch: así se fusiona un jsonb clave por clave', async () => {
    filasAfectadas = [false, true];
    // En la base ya está el target de sprint que puso el otro.
    filaEnBase = { id: 's1', gps_targets: { sprint: 200 }, updated_at: 't9' };

    const r = await cmSave.patch({
      table: 'training_sessions', id: 's1', clubId: 'c1',
      prev: { gps_targets: {} }, next: { gps_targets: { dist: 5000 } }, since: 't1',
      // Mis métricas encima de las suyas, en vez de devolverle el objeto entero
      // como estaba en mi pantalla.
      onRemote: fila => ({ gps_targets: { ...fila.gps_targets, dist: 5000 } }),
    });

    expect(r.status).toBe('merged');
    expect(updates[1].patch.gps_targets).toEqual({ sprint: 200, dist: 5000 });   // sobreviven las dos
  });

  it('si la fila sigue moviéndose corta en el segundo intento, no reintenta para siempre', async () => {
    filasAfectadas = [false, false];
    filaEnBase = { id: 's1', updated_at: 't9' };
    const r = await cmSave.patch({ ...base, next: { ...base.prev, notes: 'nuevas' }, since: 't1' });
    expect(r.status).toBe('conflict');
    expect(updates).toHaveLength(2);
  });

  it('sin `since` (tabla sin trigger de updated_at) escribe igual, sin condición', async () => {
    filasAfectadas = [true];
    filaEnBase = { updated_at: null };
    const r = await cmSave.patch({ ...base, next: { ...base.prev, notes: 'nuevas' } });
    expect(r.status).toBe('ok');
    expect(updates[0].filtros.updated_at).toBeUndefined();
  });

  it('avisa si la fila ya no existe', async () => {
    filasAfectadas = [false];
    filaEnBase = null;
    const r = await cmSave.patch({ ...base, next: { ...base.prev, notes: 'nuevas' }, since: 't1' });
    expect(r.status).toBe('gone');
  });
});
