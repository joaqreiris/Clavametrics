/**
 * cm-lock.js — candado suave por presencia.
 * Lo que importa es quién queda como dueño: el que llegó primero, sin que dos
 * pestañas de la misma persona se bloqueen entre sí, y con el forzado como
 * escape.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

let cmLock, syncCb, tracked, TAB, presence;
const docListeners = {};
const disparar = (evt, e) => (docListeners[evt] || []).forEach(cb => cb(e));

// El helper lee chan.presenceState() en cada sync, así que la simulación pasa
// por acá y no por el argumento del callback.
function sync(state) { presence = state; syncCb(); }

function fakeEl() {
  return {
    style: {}, innerHTML: '', id: '', setAttribute() {}, appendChild() {},
    querySelector: () => null, querySelectorAll: () => [],
  };
}

beforeAll(async () => {
  global.window = {
    addEventListener() {},
    getProfile: async () => ({ full_name: 'Yo Mismo' }),
    sb: {
      auth: { getUser: async () => ({ data: { user: { id: 'user-me' } } }) },
      channel: () => ({
        on(_t, _cfg, cb) { syncCb = cb; return this; },
        subscribe(cb) { cb('SUBSCRIBED'); return this; },
        track(meta) { tracked = meta; },
        untrack() {},
        presenceState: () => presence || {},
      }),
      removeChannel() {},
    },
  };
  global.document = {
    body: { appendChild() {}, classList: { add() {}, remove() {}, contains: () => false } },
    createElement: fakeEl,
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener(evt, cb) { (docListeners[evt] = docListeners[evt] || []).push(cb); },
    hidden: false,
  };
  global.requestAnimationFrame = cb => cb();
  global.addEventListener = () => {};
  global.innerHeight = 800;
  await import('../../assets/cm-lock.js');
  cmLock = global.window.cmLock;
  TAB = cmLock.TAB_ID;
});

beforeEach(() => { syncCb = null; tracked = null; presence = null; });

// Deja correr el connect() interno (auth + profile son promesas).
const settle = () => new Promise(r => setTimeout(r, 0));

const other = (over = {}) => ({
  tabId: 'tab-otro', userId: 'user-otro', name: 'Martín',
  since: 1000, resource: 'dp:t1:2026-08-28', forced: false, ...over,
});
const meMeta = (over = {}) => ({ ...tracked, ...over });

describe('cmLock.claim', () => {
  it('el que llegó primero se queda el candado; el segundo pasa a lectura', async () => {
    const states = [];
    cmLock.claim({
      resource: 'dp:t1:2026-08-28', clubId: 'c1', label: 'esta sesión',
      onState: s => states.push(s),
    });
    await settle();

    // Martín entró antes (since menor) → yo miro.
    sync({ 'tab-otro': [other()], [TAB]: [meMeta({ since: 5000 })] });
    expect(states.at(-1).isOwner).toBe(false);
    expect(states.at(-1).owner.name).toBe('Martín');

    // Martín cierra la pestaña → el candado cae solo en mí.
    sync({ [TAB]: [meMeta({ since: 5000 })] });
    expect(states.at(-1).isOwner).toBe(true);
  });

  it('guarda lo que estaba en vuelo ANTES de bloquear, y no lo repite después', async () => {
    const orden = [];
    cmLock.claim({
      resource: 'dp:t1:2026-08-28', clubId: 'c1',
      onLosing: () => orden.push('flush'),
      onState: ({ isOwner }) => orden.push(isOwner ? 'edita' : 'bloquea'),
    });
    await settle();

    // Llega el sync y me saca la edición: el guardado tiene que salir primero,
    // o el autosave con debounce queda frenado y se pierde lo tipeado.
    sync({ 'tab-otro': [other()], [TAB]: [meMeta({ since: 5000 })] });
    expect(orden).toEqual(['flush', 'bloquea']);

    // Syncs posteriores estando ya bloqueado no vuelven a flushear.
    sync({ 'tab-otro': [other()], [TAB]: [meMeta({ since: 5000 })] });
    expect(orden.filter(x => x === 'flush')).toHaveLength(1);
  });

  it('no flushea cuando el candado es mío', async () => {
    const orden = [];
    cmLock.claim({
      resource: 'dp:t1:2026-08-28', clubId: 'c1',
      onLosing: () => orden.push('flush'),
      onState: () => {},
    });
    await settle();
    sync({ [TAB]: [meMeta({ since: 5000 })] });
    expect(orden).toEqual([]);
  });

  it('la misma persona en dos pestañas no se bloquea a sí misma', async () => {
    const states = [];
    cmLock.claim({ resource: 'dp:t1:2026-08-28', clubId: 'c1', onState: s => states.push(s) });
    await settle();

    // Otra pestaña MÍA, abierta antes.
    sync({
      'tab-mio-2': [other({ tabId: 'tab-mio-2', userId: 'user-me', name: 'Yo Mismo', since: 100 })],
      [TAB]: [meMeta({ since: 5000 })],
    });
    expect(states.at(-1).isOwner).toBe(true);
  });

  it('ignora a quien está editando OTRO día', async () => {
    const states = [];
    cmLock.claim({ resource: 'dp:t1:2026-08-28', clubId: 'c1', onState: s => states.push(s) });
    await settle();

    sync({
      'tab-otro': [other({ since: 10, resource: 'dp:t1:2026-09-01' })],
      [TAB]: [meMeta({ since: 5000 })],
    });
    expect(states.at(-1).isOwner).toBe(true);
  });

  it('warnOnly avisa pero no bloquea, y dice quién está del otro lado', async () => {
    const states = [];
    const lock = cmLock.claim({
      resource: 'exercise:e1', clubId: 'c1', warnOnly: true,
      onState: s => states.push(s),
    });
    await settle();

    sync({ 'tab-otro': [other({ resource: 'exercise:e1' })], [TAB]: [meMeta({ since: 5000 })] });
    expect(states.at(-1).isOwner).toBe(false);   // el candado es de Martín…
    expect(lock.isOwner()).toBe(true);           // …pero acá nadie queda bloqueado
    expect(lock.otherEditor().name).toBe('Martín');
  });

  it('sin recurso (borrador sin guardar) no compite con nadie', async () => {
    const lock = cmLock.claim({ resource: '', clubId: 'c1', warnOnly: true });
    await settle();

    sync({ 'tab-otro': [other({ resource: '' })], [TAB]: [meMeta({ resource: '', since: 5000 })] });
    expect(lock.otherEditor()).toBeNull();
    expect(lock.isOwner()).toBe(true);
  });

  it('al cambiar de día se anuncia el nuevo recurso', async () => {
    const lock = cmLock.claim({ resource: 'dp:t1:2026-08-28', clubId: 'c1' });
    await settle();
    expect(tracked.resource).toBe('dp:t1:2026-08-28');

    lock.setResource('dp:t1:2026-08-29');
    expect(tracked.resource).toBe('dp:t1:2026-08-29');
    expect(tracked.forced).toBe(false);   // el forzado no se arrastra al día nuevo
  });

  it('anuncia en qué campo está parado el usuario, y lo suelta al salir', async () => {
    cmLock.claim({ resource: 'dp:t1:2026-08-28', clubId: 'c1', fields: 'input' });
    await settle();
    expect(tracked.field).toBeNull();

    disparar('focusin', { target: { id: 'dpNotes', matches: () => true } });
    expect(tracked.field).toBe('dpNotes');

    // Saltar a otro campo no manda un "salí" intermedio: la marca del otro no
    // debe parpadear en cada tabulación.
    disparar('focusout', {});
    disparar('focusin', { target: { id: 'dpStartTime', matches: () => true } });
    expect(tracked.field).toBe('dpStartTime');

    // Salir del formulario sí lo suelta, pasado el respiro.
    disparar('focusout', {});
    await new Promise(r => setTimeout(r, 300));   // este archivo usa timers reales
    expect(tracked.field).toBeNull();
  });

  it('quien forzó queda como editor aunque no tenga el candado', async () => {
    const states = [];
    cmLock.claim({ resource: 'dp:t1:2026-08-28', clubId: 'c1', onState: s => states.push(s) });
    await settle();

    sync({ 'tab-otro': [other()], [TAB]: [meMeta({ since: 5000, forced: true })] });
    // Un `forced` que llega por la presencia no me habilita a mí: el forzado es
    // una decisión local, y solo la toma el botón «Editar igual».
    const st = states.at(-1);
    expect(st.owner.name).toBe('Martín');   // el candado sigue siendo de él
    expect(st.isOwner).toBe(false);
  });
});
