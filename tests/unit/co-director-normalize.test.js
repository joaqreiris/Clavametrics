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

describe('cmInjuryMechanism', () => {
  /* Taxonomía compartida por Club overview y la ficha clínica (assets/injury-mechanism.js).
     Hasta la migración 149 había DOS columnas para esto y cada pantalla leía una distinta:
     un club que cargaba sus lesiones por el formulario veía "Sin registrar" en todas. Ahora
     queda `mechanism` sola, con los valores que escribe el <select> de Injuries.html. */
  let mech;
  beforeAll(async () => { await import('../../assets/injury-mechanism.js'); mech = global.window.cmInjuryMechanism; });

  it('resuelve los valores que escribe el formulario de Injuries.html', () => {
    // 'non-contact' va CON GUION en el <select>; el enum viejo lo tenía con guion bajo.
    const esperado = {
      contact: ['contact'], non_contact: ['non-contact'], overuse: ['overuse'],
      training_load: ['training'], other: ['other'],
    };
    const fallos = [];
    for (const [k, vals] of Object.entries(esperado)) {
      for (const v of vals) { const got = mech({ mechanism: v }); if (got !== k) fallos.push(`"${v}" → ${got} (se esperaba ${k})`); }
    }
    expect(fallos, `\n${fallos.join('\n')}\n`).toEqual([]);
  });

  it('el guion y el guion bajo son el mismo mecanismo', () => {
    // Si no, el gráfico dibuja dos barras para lo mismo.
    expect(mech({ mechanism: 'non-contact' })).toBe(mech({ mechanism: 'non_contact' }));
    expect(mech({ mechanism: 'Non-Contact' })).toBe('non_contact');
  });

  it('entiende el texto escrito a mano en los tres idiomas', () => {
    expect(mech({ mechanism: 'Sin contacto' })).toBe('non_contact');
    expect(mech({ mechanism: 'Sem contato' })).toBe('non_contact');
    expect(mech({ mechanism: 'Sobrecarga' })).toBe('overuse');
    expect(mech({ mechanism: 'Traumatismo directo' })).toBe('contact');
  });

  it('lo negado gana a lo afirmado', () => {
    // "non_contact" contiene "contact": si el orden se invierte, todo cae en contacto.
    expect(mech({ mechanism: 'non-contact' })).not.toBe('contact');
  });

  it('distingue "no se cargó" de "no supe clasificar"', () => {
    for (const v of [null, undefined, '', '   ']) expect(mech({ mechanism: v })).toBe('unknown');
    expect(mech({ mechanism: 'qwerty' })).toBe('other');
  });

  it('todavía lee un dump anterior a la migración 149', () => {
    // La columna ya no existe, pero un export viejo puede traerla.
    expect(mech({ mechanism: null, injury_mechanism: 'non_contact' })).toBe('non_contact');
    // Con las dos, manda la que el producto escribe hoy.
    expect(mech({ mechanism: 'contact', injury_mechanism: 'overuse' })).toBe('contact');
  });

  it('no se cae con entradas raras', () => {
    for (const v of [123, {}, [], '---', 'LEFT']) {
      expect(() => mech({ mechanism: v })).not.toThrow();
      expect(typeof mech({ mechanism: v })).toBe('string');
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
