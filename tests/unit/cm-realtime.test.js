/**
 * cm-realtime.js — el motor del refresco en vivo (Nivel 1).
 * Se prueba la lógica delicada: coalescing, supresión de ecos propios,
 * respeto por la edición en curso y filtro de relevancia.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

let cmLive, handlers, subscribeCb, removed;

function fakeEl() {
  const el = {
    style: {}, innerHTML: '', id: '',
    setAttribute() {}, appendChild() {},
    querySelector: () => ({ set onclick(_) {} }),
  };
  return el;
}

beforeAll(async () => {
  handlers = [];
  global.window = {
    fetch: vi.fn(() => Promise.resolve({ ok: true })),
    addEventListener() {},
    sb: {
      channel: () => ({
        on(_evt, cfg, cb) { handlers.push({ cfg, cb }); return this; },
        subscribe(cb) { subscribeCb = cb; return this; },
      }),
      removeChannel: () => { removed = true; },
    },
  };
  global.document = {
    hidden: false,
    activeElement: null,
    body: { classList: { contains: () => false }, appendChild() {} },
    querySelector: () => null,
    createElement: fakeEl,
    addEventListener() {},
  };
  await import('../../assets/cm-realtime.js');
  cmLive = global.window.cmLive;
});

beforeEach(() => { handlers = []; vi.useFakeTimers(); });

const evt = (table, row, type = 'UPDATE') => ({ table, eventType: type, new: row, old: row });
const fire = payload => handlers.filter(h => h.cfg.table === payload.table).forEach(h => h.cb(payload));

describe('cmLive.watch', () => {
  it('refresca una sola vez ante una ráfaga de cambios ajenos', async () => {
    const onRefresh = vi.fn(async () => {});
    cmLive.watch({ name: 't1', tables: [{ table: 'training_sessions' }], onRefresh });

    fire(evt('training_sessions', { id: 'a' }));
    fire(evt('training_sessions', { id: 'b' }));
    fire(evt('training_sessions', { id: 'c' }));
    expect(onRefresh).not.toHaveBeenCalled();      // aún coalescando

    await vi.advanceTimersByTimeAsync(700);
    expect(onRefresh).toHaveBeenCalledTimes(1);    // una sola recarga para las tres
  });

  it('no refresca al toque si el cambio es eco de una escritura propia', async () => {
    const onRefresh = vi.fn(async () => {});
    cmLive.watch({ name: 't2', tables: [{ table: 'calendar_events' }], onRefresh });

    // Escritura de esta misma pestaña (así la detecta: fetch mutante a /rest/v1/…)
    window.fetch('https://x.supabase.co/rest/v1/calendar_events?id=eq.1', { method: 'PATCH' });
    fire(evt('calendar_events', { id: '1' }));

    await vi.advanceTimersByTimeAsync(700);
    expect(onRefresh).not.toHaveBeenCalled();      // era lo que acabo de guardar yo

    // Pasada la ventana de eco sí se recarga: cubre el cambio ajeno simultáneo.
    await vi.advanceTimersByTimeAsync(6000);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('no pisa la pantalla mientras el usuario está editando; refresca al soltar', async () => {
    const onRefresh = vi.fn(async () => {});
    let editing = true;
    cmLive.watch({ name: 't3', tables: [{ table: 'session_exercises' }], busy: () => editing, onRefresh });

    fire(evt('session_exercises', { id: 'x' }));
    await vi.advanceTimersByTimeAsync(3000);
    expect(onRefresh).not.toHaveBeenCalled();

    editing = false;
    await vi.advanceTimersByTimeAsync(1600);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('ignora los cambios que no tocan lo que está en pantalla', async () => {
    const onRefresh = vi.fn(async () => {});
    cmLive.watch({
      name: 't4',
      tables: [{ table: 'availability' }],
      relevant: row => row.date === '2026-08-28',
      onRefresh,
    });

    fire(evt('availability', { id: '1', date: '2026-09-15', player_id: 'p' }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(onRefresh).not.toHaveBeenCalled();

    fire(evt('availability', { id: '2', date: '2026-08-28', player_id: 'p' }));
    await vi.advanceTimersByTimeAsync(700);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('recupera lo perdido cuando el canal se reconecta', async () => {
    const onRefresh = vi.fn(async () => {});
    cmLive.watch({ name: 't5', tables: [{ table: 'microcycles' }], onRefresh });

    subscribeCb('CHANNEL_ERROR');
    subscribeCb('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(700);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('con la pestaña en segundo plano posterga, y aplica al volver', async () => {
    const onRefresh = vi.fn(async () => {});
    const w = cmLive.watch({ name: 't6', tables: [{ table: 'treatments' }], onRefresh });

    document.hidden = true;
    fire(evt('treatments', { id: 'z' }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(onRefresh).not.toHaveBeenCalled();

    document.hidden = false;
    w.wake();
    await vi.advanceTimersByTimeAsync(700);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
