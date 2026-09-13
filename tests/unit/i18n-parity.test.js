// Los tres idiomas van juntos o no van.
//
// El runtime de i18n cae a inglés cuando falta una clave (assets/i18n.js), así que una
// traducción olvidada NO rompe nada: deja una palabra en inglés en medio de una pantalla en
// español y nadie se entera hasta que lo ve un usuario. Esto lo convierte en un rojo.
//
// Además chequea que ninguna traducción se haya quedado en blanco.
//
// Lo que NO chequea, a propósito: que los tres usen las mismas variables de interpolación. Se
// intentó y son todo falsos positivos — el llamador puede pasar más variables de las que usa el
// inglés y cada idioma elige cuál le sirve. En evaluations.sprint_pct_line el inglés dice
// "{ord} percentile" (ordinal) y el español "percentil {pct}" (número), las dos se pasan y las
// dos están bien. Un test que se queja de eso se termina ignorando, y entonces no sirve.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LANGS = ['en', 'es', 'pt'];
const DICT = Object.fromEntries(
  LANGS.map(l => [l, JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', `${l}.json`), 'utf8'))])
);

/* Las claves que empiezan con "_" no son traducciones: son datos estructurados que las páginas
   de marketing leen con CM_I18N.raw() — _rotator es un array de frases y _how un objeto con los
   cuatro pasos del "cómo funciona". Chequearlas como texto las marca como vacías. */
const esTraduccion = k => !k.startsWith('_');

describe('locales', () => {
  it('los tres archivos tienen exactamente el mismo juego de claves', () => {
    const keys = Object.fromEntries(LANGS.map(l => [l, new Set(Object.keys(DICT[l]))]));
    const faltantes = [];
    for (const l of LANGS) {
      for (const otra of LANGS) {
        if (l === otra) continue;
        for (const k of keys[l]) if (!keys[otra].has(k)) faltantes.push(`${k}: está en ${l}, falta en ${otra}`);
      }
    }
    // Se ordena y se recorta para que el mensaje de error sea legible si alguna vez falla.
    expect(faltantes.sort().slice(0, 40), `\n${faltantes.length} claves desparejas\n${faltantes.sort().slice(0, 40).join('\n')}\n`).toEqual([]);
  });

  it('ninguna traducción quedó vacía', () => {
    const vacias = [];
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(DICT[l])) {
        if (!esTraduccion(k)) continue;
        if (typeof v !== 'string' || !v.trim()) vacias.push(`${l}: ${k}`);
      }
    }
    expect(vacias.slice(0, 30), `\n${vacias.join('\n')}\n`).toEqual([]);
  });

  it('las pestañas de dirección deportiva están traducidas en los tres', () => {
    // Guardia concreta del módulo nuevo: si alguien agrega una zona corporal, una categoría
    // de lesión o una línea del campo y se olvida del diccionario, cae acá.
    const AREAS = ['hamstring', 'quad', 'adductor', 'calf', 'knee', 'ankle', 'shin', 'foot', 'hip',
      'thigh', 'back', 'trunk', 'shoulder', 'arm', 'neck', 'head', 'other', 'unknown'];
    const CATS = ['muscular', 'acl', 'ligament', 'tendon', 'bone', 'other', 'unknown'];
    const MECHS = ['contact', 'non_contact', 'overuse', 'unknown'];
    const LINES = ['gk', 'def', 'mid', 'att', 'unk'];
    const claves = [
      ...AREAS.map(a => `co_dir.area_${a}`),
      ...CATS.map(c => `co_dir.cat_${c}`),
      ...MECHS.map(m => `co_dir.mech_${m}`),
      ...LINES.map(l => `co_dir.line_${l}`),
      ...['t_week', 't_season', 't_injuries', 't_squad', 't_staff', 'subtitle', 'period', 'views'].map(x => `co_dir.${x}`),
      ...Array.from({ length: 12 }, (_, i) => `month_short.${i}`),
      'squad.contract_until',
    ];
    const faltan = [];
    for (const k of claves) for (const l of LANGS) if (DICT[l][k] == null) faltan.push(`${k} (${l})`);
    expect(faltan, `\n${faltan.join('\n')}\n`).toEqual([]);
  });

  it('cada clave que club-overview-director.js pide literalmente existe', () => {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'club-overview-director.js'), 'utf8');
    const usadas = [...src.matchAll(/tt\('([a-z_0-9.]+)'/g)]
      .map(m => m[1])
      .filter(k => !/[_.]$/.test(k));          // los prefijos dinámicos los cubre el test de arriba
    const faltan = [];
    for (const k of new Set(usadas)) for (const l of LANGS) if (DICT[l][k] == null) faltan.push(`${k} (${l})`);
    expect(faltan, `\n${faltan.join('\n')}\n`).toEqual([]);
  });
});
