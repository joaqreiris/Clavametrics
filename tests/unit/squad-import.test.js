import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/* El importador de plantilla es la puerta de entrada de TODO club nuevo: si falla ahí,
   el club no llega a existir dentro del producto. Vivía sin un solo test.

   La lógica está embebida en el <script> de Squad.html, así que se extrae por marcadores
   y se evalúa con stubs de lo único que toca de fuera (posiciones, toasts, i18n). Si
   alguien mueve esos marcadores el test falla ruidosamente en vez de dejar de cubrir en
   silencio — que es el modo de fallo que importa evitar. */

const ROOT = path.resolve(__dirname, '../..');
const SRC  = fs.readFileSync(path.join(ROOT, 'Squad.html'), 'utf8');

function cut(from, to) {
  const a = SRC.indexOf(from);
  const b = SRC.indexOf(to);
  if (a === -1) throw new Error(`Marcador inicial no encontrado en Squad.html: ${from}`);
  if (b === -1 || b <= a) throw new Error(`Marcador final no encontrado en Squad.html: ${to}`);
  return SRC.slice(a, b);
}

// Núcleo puro: alias de cabeceras, saneado, fechas, pie, normalización de fila.
const CORE  = cut('  // ── Import: CSV / Excel ─', '  // Effective row state combining');
// Lo que comparten CSV y Excel: matriz de celdas → filas canónicas.
const SHARED = cut('  // Matriz de celdas → filas canónicas', "  document.getElementById('sqImportBtn')");

function load() {
  const toasts = [];
  const opened = [];
  const ctx = `
    const POS_CFG = { GK:{}, CB:{}, LB:{}, RB:{}, CM:{}, ST:{} };
    const POS_ALIAS = { gk:'GK', portero:'GK', goalkeeper:'GK', arquero:'GK', cb:'CB', dc:'CB',
                        defensa:'CB', lb:'LB', rb:'RB', cm:'CM', mc:'CM', mediocampista:'CM',
                        st:'ST', dl:'ST', delantero:'ST', forward:'ST' };
    function normalizePosition(raw){
      const k = String(raw||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();
      return POS_ALIAS[k] || null;
    }
    function tt(key, fb){ return fb != null ? fb : key; }
    function showToast(msg){ __toasts.push(msg); }
    function openImportModal(rows){ __opened.push(rows); }
    ${CORE}
    ${SHARED}
    return { _impHeader, _impParseDate, _impFoot, _impNormalize, _impNameKey, _impFromMatrix,
             IMPORT_HEADER_ALIASES,
             skippedHeaderRows: () => _importSkippedHeaderRows };
  `;
  const api = new Function('__toasts', '__opened', ctx)(toasts, opened);
  return Object.assign(api, { toasts, opened });
}

let S;
beforeEach(() => { S = load(); });

// ── Cabeceras ────────────────────────────────────────────────────────────────

describe('cabeceras: el club exporta con los nombres que quiere', () => {
  const alias = h => S.IMPORT_HEADER_ALIASES[S._impHeader(h)];

  it('acepta los nombres canónicos', () => {
    expect(alias('first_name')).toBe('first_name');
    expect(alias('date_of_birth')).toBe('date_of_birth');
  });

  it('acepta castellano y portugués con acentos', () => {
    expect(alias('Número')).toBe('number');
    expect(alias('Posición')).toBe('position');
    expect(alias('Fecha de nacimiento')).toBe('date_of_birth');
    expect(alias('Nacimiento')).toBe('date_of_birth');
    expect(alias('Apellidos')).toBe('last_name');
    // Ojo: "Nombre" es el NOMBRE de pila, no el nombre completo. Un club que ponga
    // "Juan Pérez" bajo esa cabecera se lo lleva entero a first_name y sin apellido.
    // Para el nombre completo la cabecera es "Nombre completo".
    expect(alias('Nombre')).toBe('first_name');
    expect(alias('Nombre completo')).toBe('name');
    expect(alias('Sobrenome')).toBe('last_name');
    expect(alias('Pé dominante')).toBe('dominant_foot');
  });

  it('acepta las abreviaturas de los exports reales', () => {
    expect(alias('DOB')).toBe('date_of_birth');
    expect(alias('Shirt #')).toBe('number');
    expect(alias('Pos')).toBe('position');
    expect(alias('Foot')).toBe('dominant_foot');
    expect(alias('Country')).toBe('nationality');
    expect(alias('cm')).toBe('height');
    expect(alias('kg')).toBe('weight');
  });

  it('come el BOM que Excel pone en la primera celda', () => {
    expect(alias('﻿first_name')).toBe('first_name');
  });

  it('una cabecera desconocida no se inventa un destino', () => {
    expect(alias('salario')).toBeUndefined();
    expect(alias('')).toBeUndefined();
  });
});

// ── Fechas ───────────────────────────────────────────────────────────────────

describe('fecha de nacimiento: de ella depende saber quién es menor', () => {
  it('ISO se acepta siempre, sea cual sea el formato elegido', () => {
    for (const fmt of ['auto','dmy','mdy','iso'])
      expect(S._impParseDate('2009-03-07', fmt).value).toBe('2009-03-07');
  });

  it('day-first y month-first leen la MISMA fila distinto', () => {
    expect(S._impParseDate('03/07/2009', 'dmy').value).toBe('2009-07-03');
    expect(S._impParseDate('03/07/2009', 'mdy').value).toBe('2009-03-07');
  });

  it('una fecha imposible en el formato elegido es error, no una fecha silenciosa', () => {
    expect(S._impParseDate('13/07/2009', 'mdy').error).toBe(true);   // no hay mes 13
    expect(S._impParseDate('07/31/2009', 'dmy').error).toBe(true);   // no hay día 31 de mes 7… en día-primero es mes 31
    expect(S._impParseDate('31/02/2009', 'dmy').error).toBe(true);   // 31 de febrero
  });

  it('con ISO elegido, una fecha con barras NO se adivina', () => {
    expect(S._impParseDate('03/07/2009', 'iso').error).toBe(true);
  });

  it('año de dos dígitos: 30 es el corte', () => {
    expect(S._impParseDate('01/01/29', 'dmy').value).toBe('2029-01-01');
    expect(S._impParseDate('01/01/30', 'dmy').value).toBe('1930-01-01');
  });

  it('vacío es válido y vale null — no bloquea la carga', () => {
    expect(S._impParseDate('', 'dmy')).toEqual({ value: null });
    expect(S._impParseDate('   ', 'dmy')).toEqual({ value: null });
  });

  it('basura es error, nunca una fecha', () => {
    expect(S._impParseDate('no sé', 'dmy').error).toBe(true);
    expect(S._impParseDate('2009', 'dmy').error).toBe(true);
  });
});

// ── Pie dominante ────────────────────────────────────────────────────────────

describe('pie dominante en tres idiomas', () => {
  it('izquierdo', () => {
    ['left','L','izquierda','zurdo','esquerdo'].forEach(v =>
      expect(S._impFoot(v).value).toBe('left'));
  });
  it('derecho', () => {
    ['right','R','derecha','diestro','direito'].forEach(v =>
      expect(S._impFoot(v).value).toBe('right'));
  });
  it('ambos', () => {
    ['both','ambos','ambidiestro','ambidestro'].forEach(v =>
      expect(S._impFoot(v).value).toBe('both'));
  });
  it('desconocido avisa y deja el campo vacío', () => {
    expect(S._impFoot('cabeza')).toEqual({ value: null, warn: true });
  });
  it('vacío no avisa: no todos los clubes lo registran', () => {
    expect(S._impFoot('')).toEqual({ value: null });
  });
});

// ── Normalización de fila ────────────────────────────────────────────────────

describe('fila normalizada', () => {
  const row = (src, fmt='dmy') => S._impNormalize(src, fmt);

  it('parte "Nombre completo" por el ÚLTIMO espacio: el apellido es la última palabra', () => {
    const r = row({ name: 'Juan Martín Pérez', number: '10' });
    expect(r.values.first_name).toBe('Juan Martín');
    expect(r.values.last_name).toBe('Pérez');
  });

  it('un nombre de una sola palabra no inventa apellido', () => {
    const r = row({ name: 'Ronaldinho' });
    expect(r.values.first_name).toBe('Ronaldinho');
    expect(r.values.last_name).toBeNull();
  });

  it('sin nombre es ERROR: esa fila no se importa', () => {
    const r = row({ number: '9' });
    expect(r.status).toBe('error');
    expect(r.notes).toContain('no_name');
  });

  it('el dorsal vive entre 1 y 99', () => {
    expect(row({ name:'A B', number:'1'  }).values.number).toBe(1);
    expect(row({ name:'A B', number:'99' }).values.number).toBe(99);
    expect(row({ name:'A B', number:'0'  }).status).toBe('error');
    expect(row({ name:'A B', number:'100'}).status).toBe('error');
    expect(row({ name:'A B', number:'AB' }).status).toBe('error');
  });

  it('sin dorsal se importa igual: se asigna después', () => {
    const r = row({ name: 'A B' });
    expect(r.values.number).toBeNull();
    expect(r.status).not.toBe('error');
  });

  it('sin fecha de nacimiento AVISA pero importa — inventarla sería peor', () => {
    const r = row({ name: 'A B', number: '5' });
    expect(r.notes).toContain('dob_missing');
    expect(r.status).toBe('warning');
    expect(r.values.date_of_birth).toBeNull();
  });

  it('una fecha ilegible deja el campo en blanco, no rompe la fila entera', () => {
    const r = row({ name: 'A B', date_of_birth: '99/99/9999' });
    expect(r.notes).toContain('bad_date');
    expect(r.status).toBe('warning');
    expect(r.values.date_of_birth).toBeNull();
  });

  it('la altura en metros se convierte a centímetros', () => {
    expect(row({ name:'A B', height:'1.78'  }).values.height).toBe(178);
    expect(row({ name:'A B', height:'1,78'  }).values.height).toBe(178);  // coma decimal
    expect(row({ name:'A B', height:'178'   }).values.height).toBe(178);
  });

  it('altura y peso fuera de rango avisan pero no bloquean', () => {
    const h = row({ name:'A B', height:'300' });
    expect(h.notes).toContain('height_range');
    expect(h.status).toBe('warning');
    const w = row({ name:'A B', weight:'400' });
    expect(w.notes).toContain('weight_range');
  });

  it('una posición desconocida NO se guarda como texto crudo', () => {
    const r = row({ name:'A B', position:'XYZ' });
    expect(r.values.position).toBeNull();      // nada que ningún filtro pueda encontrar
    expect(r.notes).toContain('position_unknown');
    expect(r.posRaw).toBe('XYZ');              // pero se recuerda para mostrárselo al club
  });

  it('una posición conocida se mapea a su código', () => {
    expect(row({ name:'A B', position:'Portero' }).values.position).toBe('GK');
    expect(row({ name:'A B', position:'gk'      }).values.position).toBe('GK');
  });
});

describe('clave de nombre para detectar duplicados', () => {
  it('ignora acentos, mayúsculas y espacios de más', () => {
    expect(S._impNameKey(' josé ', 'PÉREZ')).toBe(S._impNameKey('Jose', 'perez'));
  });
  it('sin nombre no hay clave: no se puede deduplicar la nada', () => {
    expect(S._impNameKey('', '')).toBe('');
  });
});

// ── Matriz → filas: el camino que comparten CSV y Excel ──────────────────────

describe('matriz de celdas → filas (compartido por CSV y Excel)', () => {
  it('encuentra la cabecera aunque Excel deje título y filas vacías arriba', () => {
    S._impFromMatrix([
      ['Plantilla 2026/27 — Club X', '', ''],
      ['', '', ''],
      ['Nombre completo', 'Dorsal', 'Nacimiento'],
      ['Juan Pérez', '10', '07/03/2009'],
    ]);
    expect(S.opened).toHaveLength(1);
    expect(S.skippedHeaderRows()).toBe(1);   // la fila vacía ya se descartó al filtrar
    expect(S.opened[0]).toEqual([{ name: 'Juan Pérez', number: '10', date_of_birth: '07/03/2009' }]);
  });

  it('una sola columna reconocible NO alcanza como cabecera', () => {
    S._impFromMatrix([['Nombre completo'], ['Juan Pérez']]);
    expect(S.opened).toHaveLength(0);
    expect(S.toasts.join(' ')).toMatch(/No columns matched/);
  });

  it('cuando nada encaja, le dice al club QUÉ cabeceras encontró', () => {
    S._impFromMatrix([['Salario', 'Agente'], ['1000', 'X']]);
    expect(S.opened).toHaveLength(0);
    expect(S.toasts.join(' ')).toContain('Salario, Agente');
  });

  it('descarta filas totalmente vacías intercaladas', () => {
    S._impFromMatrix([
      ['Nombre completo', 'Dorsal'],
      ['Juan Pérez', '10'],
      ['', ''],
      ['Ana Gómez', '7'],
    ]);
    expect(S.opened[0]).toHaveLength(2);
  });

  it('una matriz vacía no abre el modal', () => {
    S._impFromMatrix([]);
    expect(S.opened).toHaveLength(0);
    expect(S.toasts).toHaveLength(1);
  });

  it('cabecera sin ninguna fila de datos no abre el modal', () => {
    S._impFromMatrix([['Nombre completo', 'Dorsal']]);
    expect(S.opened).toHaveLength(0);
    expect(S.toasts).toHaveLength(1);
  });

  it('columnas desconocidas se ignoran sin arrastrar valores a la columna de al lado', () => {
    S._impFromMatrix([
      ['Nombre completo', 'Salario', 'Dorsal'],
      ['Juan Pérez', '99999', '10'],
    ]);
    expect(S.opened[0][0]).toEqual({ name: 'Juan Pérez', number: '10' });
  });
});

// ── La ruta Excel, extremo a extremo sobre la matriz que produce SheetJS ─────

describe('lo que llega desde una hoja de Excel', () => {
  it('una fecha real de Excel llega en ISO y no depende del selector DD/MM', () => {
    // sheet_to_json con dateNF:'yyyy-mm-dd' entrega la celda ya en ISO.
    S._impFromMatrix([
      ['Nombre completo', 'Dorsal', 'Nacimiento'],
      ['Juan Pérez', 10, '2009-03-07'],
    ]);
    const canon = S.opened[0][0];
    // Se lee igual con cualquier formato elegido: ahí está la ganancia de leer .xlsx.
    for (const fmt of ['dmy', 'mdy', 'iso'])
      expect(S._impNormalize(canon, fmt).values.date_of_birth).toBe('2009-03-07');
  });

  it('un dorsal numérico (Excel no da strings) se normaliza igual', () => {
    S._impFromMatrix([['Nombre completo', 'Dorsal'], ['Ana Gómez', 7]]);
    expect(S._impNormalize(S.opened[0][0], 'dmy').values.number).toBe(7);
  });
});
