// Normalización de zona corporal y de posición (Club Overview → dirección deportiva).
//
// injuries.body_area es texto libre y en la base real conviven "Left Hamstring", "hamstring",
// "Isquiotibial", "Rodilla (LCM)" y "Tobillo (LLE)". Sin agrupar, el gráfico de carga por zona
// es una barra de una unidad por cada forma de escribirlo y no dice nada. Estos casos salen de
// los valores REALES que hay hoy en la base (las 20 variantes distintas de los dos clubes con
// datos), más los que va a haber cuando se carguen en portugués.
import { describe, it, expect, beforeAll } from 'vitest';

let normArea, lineOf;

beforeAll(async () => {
  // El módulo es un IIFE de navegador que sólo cuelga cosas de window: con un window falso
  // se puede cargar en node y probar las funciones puras que expone para esto.
  global.window = { CM_I18N: null };
  await import('../../assets/club-overview-director.js');
  normArea = global.window.cmCoDirector._normArea;
  lineOf = global.window.cmCoDirector._lineOf;
});

describe('normArea', () => {
  it('agrupa las variantes reales que hay hoy en la base', () => {
    const esperado = {
      hamstring: ['Left Hamstring', 'hamstring', 'Right Hamstring', 'Isquiotibial derecho', 'Isquiotibiais'],
      adductor: ['Aductor', 'Left Adductor', 'Right Adductor', 'Groin', 'Pubalgia', 'virilha'],
      knee: ['LCA rodilla', 'Left Knee', 'Rodilla (LCM)', 'Tendón rotuliano', 'Joelho', 'Menisco interno'],
      ankle: ['Left Ankle', 'Tobillo (LLE)', 'Tornozelo'],
      foot: ['Right Foot', 'Metatarsiano (fisura)', 'Pie', 'Fascia plantar'],
      calf: ['Gemelo (sóleo)', 'Calf', 'Panturrilha'],
      quad: ['Cuádriceps', 'Quadriceps', 'Recto femoral'],
      shin: ['Left Shin', 'Tibia'],
      back: ['Lower Back', 'Lumbar', 'Espalda baja'],
      thigh: ['Right Thigh', 'Muslo'],
      arm: ['Right Fingers', 'Muñeca', 'Codo'],
      shoulder: ['Left Shoulder', 'Hombro', 'Ombro'],
      hip: ['Cadera', 'Glúteo', 'Quadril'],
    };
    const fallos = [];
    for (const [grupo, textos] of Object.entries(esperado)) {
      for (const t of textos) {
        const got = normArea(t);
        if (got !== grupo) fallos.push(`"${t}" → ${got} (se esperaba ${grupo})`);
      }
    }
    expect(fallos, `\n${fallos.join('\n')}\n`).toEqual([]);
  });

  it('el lado no cambia el grupo: izquierda y derecha son la misma región', () => {
    expect(normArea('Left Hamstring')).toBe(normArea('Right Hamstring'));
    expect(normArea('Tobillo izquierdo')).toBe(normArea('Tobillo derecho'));
    expect(normArea('Left Knee')).toBe(normArea('Rodilla'));
  });

  it('lo específico gana a lo genérico', () => {
    // "Isquiotibial" es muslo, pero tiene que caer en hamstring; "tendón rotuliano" es tendón,
    // pero la REGIÓN es la rodilla.
    expect(normArea('Isquiotibial')).toBe('hamstring');
    expect(normArea('Tendón rotuliano')).toBe('knee');
    expect(normArea('Cuádriceps')).toBe('quad');
  });

  it('distingue "sin dato" de "no lo supe clasificar"', () => {
    expect(normArea('')).toBe('unknown');
    expect(normArea(null)).toBe('unknown');
    expect(normArea(undefined)).toBe('unknown');
    expect(normArea('   ')).toBe('unknown');
    expect(normArea('xyzzy')).toBe('other');
  });

  it('no se cae con entradas raras', () => {
    for (const v of [123, {}, [], '---', '()', 'LEFT', 'left right']) {
      expect(() => normArea(v)).not.toThrow();
      expect(typeof normArea(v)).toBe('string');
    }
  });
});

describe('lineOf', () => {
  it('mapea las posiciones canónicas a su línea', () => {
    const casos = {
      gk: ['GK', 'gk', 'Portero', 'Arquero', 'Goleiro', 'POR'],
      def: ['CB', 'LB', 'RB', 'LWB', 'Defensa', 'Zaguero', 'Lateral'],
      mid: ['CM', 'CDM', 'CAM', 'Volante', 'Mediocampista', 'Pivote'],
      att: ['ST', 'LW', 'RW', 'CF', 'Delantero', 'Extremo', 'Atacante'],
    };
    const fallos = [];
    for (const [linea, posiciones] of Object.entries(casos)) {
      for (const p of posiciones) {
        const got = lineOf(p);
        if (got !== linea) fallos.push(`"${p}" → ${got} (se esperaba ${linea})`);
      }
    }
    expect(fallos, `\n${fallos.join('\n')}\n`).toEqual([]);
  });

  it('sin posición cargada devuelve "unk", no una línea inventada', () => {
    // Importa que sea su propio grupo: un jugador sin puesto no puede contar como
    // profundidad de una línea que quizá no juega.
    expect(lineOf('')).toBe('unk');
    expect(lineOf(null)).toBe('unk');
    expect(lineOf('nosequé')).toBe('unk');
  });
});
