import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

// Es un script de navegador: se evalúa como lo haría un <script>.
beforeAll(() => {
  globalThis.window = globalThis;
  (0, eval)(fs.readFileSync(path.join(ROOT, 'assets/share-tracker.js'), 'utf8'));
});

// Lo que reporta un reproductor: play, una tanda de ticks y lo que haga falta.
function playFrom(clip, from, to, step = 0.5) {
  clip.play();
  for (let t = from; t <= to + 1e-9; t += step) clip.time(Number(t.toFixed(3)));
}

describe('cmShareTracking · qué cuenta como visto', () => {
  it('la reproducción continua suma segundo a segundo', () => {
    const c = window.cmShareTracking.createClip();
    c.setDuration(100);
    playFrom(c, 0, 20);
    const s = c.snapshot();
    expect(s.watched).toBe(20);
    expect(s.position).toBe(20);
    expect(s.plays).toBe(1);
    expect(s.tracking).toBe('player');
  });

  it('arrastrar la barra hasta el final no cuenta como haberlo visto', () => {
    const c = window.cmShareTracking.createClip();
    c.setDuration(600);
    c.play();
    c.time(0);
    c.time(595);          // el salto mueve la posición…
    const s = c.snapshot();
    expect(s.watched).toBe(0);        // …pero no el tiempo visto
    expect(s.position).toBe(595);
    // Llegó al 99% de la barra: la posición sí lo da por completo, y eso es
    // deliberado — lo que no infla es el tiempo realmente reproducido.
    expect(s.completed).toBe(true);
    expect(s.watched).toBeLessThan(s.position);
  });

  it('volver atrás y mirar el mismo tramo otra vez suma de nuevo', () => {
    const c = window.cmShareTracking.createClip();
    c.setDuration(100);
    playFrom(c, 0, 10);
    c.time(5);            // rebobina: el salto no suma
    playFrom(c, 5, 10);   // y vuelve a mirar esos cinco segundos
    const s = c.snapshot();
    expect(s.watched).toBe(15);
    expect(s.position).toBe(10);
  });

  it('un tick muy espaciado (pestaña de fondo) no regala tiempo visto', () => {
    const c = window.cmShareTracking.createClip();
    c.setDuration(100);
    c.play();
    c.time(0);
    c.time(30);           // 30 s de golpe: o fue un seek o el timer se durmió
    expect(c.snapshot().watched).toBe(0);
  });

  it('completed sale del 90% o del evento de fin', () => {
    const porRatio = window.cmShareTracking.createClip();
    porRatio.setDuration(100);
    playFrom(porRatio, 80, 89);
    expect(porRatio.snapshot().completed).toBe(false);
    porRatio.time(90);
    expect(porRatio.snapshot().completed).toBe(true);

    const porEvento = window.cmShareTracking.createClip();
    porEvento.setDuration(100);
    playFrom(porEvento, 0, 5);
    expect(porEvento.snapshot().completed).toBe(false);
    porEvento.ended();
    const s = porEvento.snapshot();
    expect(s.completed).toBe(true);
    expect(s.position).toBe(100);     // el fin del video es el final, no el segundo 5
  });

  it('sin duración conocida no se inventa un completo', () => {
    const c = window.cmShareTracking.createClip();
    playFrom(c, 0, 300);
    expect(c.snapshot().completed).toBe(false);
  });
});

describe('cmShareTracking · medido vs estimado', () => {
  it('sólo tiempo en pantalla queda marcado como estimado', () => {
    const c = window.cmShareTracking.createClip();
    c.addVisible(40);
    const s = c.snapshot();
    expect(s.tracking).toBe('viewport');
    expect(s.visible).toBe(40);
    expect(s.watched).toBe(0);
    expect(s.plays).toBe(0);
  });

  it('en cuanto habla un reproductor, el dato pasa a medido', () => {
    const c = window.cmShareTracking.createClip();
    c.addVisible(10);
    c.play();
    c.time(1);
    expect(c.snapshot().tracking).toBe('player');
  });

  it('los valores viajan como enteros', () => {
    const c = window.cmShareTracking.createClip();
    c.setDuration(90.7);
    playFrom(c, 0, 3.5, 0.25);
    c.addVisible(2.4);
    const s = c.snapshot();
    Object.entries({ watched: s.watched, position: s.position, duration: s.duration, visible: s.visible })
      .forEach(([, v]) => expect(Number.isInteger(v)).toBe(true));
  });
});

describe('cmShareTracking · qué se manda en cada beat', () => {
  it('sólo van los cortes con algo nuevo que contar', () => {
    const set = window.cmShareTracking.createSet(3);
    set.clip(0).play();
    set.clip(0).time(4);

    const first = set.pending();
    expect(first).toHaveLength(1);
    expect(first[0].index).toBe(0);

    // Mientras no llegue la confirmación, se sigue reintentando.
    expect(set.pending()).toHaveLength(1);
    set.markSent(first);
    expect(set.pending()).toHaveLength(0);

    // Un corte nuevo vuelve a marcar el envío como pendiente.
    set.clip(2).addVisible(3);
    const second = set.pending();
    expect(second.map(i => i.index)).toEqual([2]);
  });

  it('el envío final manda lo ya confirmado, pero nunca un corte intacto', () => {
    const set = window.cmShareTracking.createSet(2);
    set.clip(1).play();
    set.clip(1).time(2);
    set.markSent(set.pending());

    const all = set.pending({ all: true });
    expect(all.map(i => i.index)).toEqual([1]);   // el 0 no se abrió: no genera fila
  });

  it('cada corte lleva su propia cuenta', () => {
    const set = window.cmShareTracking.createSet(2);
    playFrom(set.clip(0), 0, 6);
    playFrom(set.clip(1), 0, 2);
    const byIndex = Object.fromEntries(set.pending().map(i => [i.index, i.watched]));
    expect(byIndex).toEqual({ 0: 6, 1: 2 });
  });

  it('la sesión identifica la apertura para que un beat repetido no sume dos veces', () => {
    const a = window.cmShareTracking.createSet(1);
    const b = window.cmShareTracking.createSet(1);
    expect(a.session).toBeTruthy();
    expect(a.session).not.toBe(b.session);
  });
});
