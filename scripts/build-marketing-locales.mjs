#!/usr/bin/env node
/**
 * Genera locales/marketing/<lang>.json — el diccionario que cargan las páginas
 * públicas (Home, Pricing, Contact, Login, Register).
 *
 * Por qué: esas páginas usan ~280 claves y se estaban bajando locales/en.json
 * entero, que son 540 KB con las 10.000 claves de la app (Planner, GPS,
 * Physio, Nutrition…). Medio megabyte de JSON para una landing.
 *
 * Cómo se elige qué entra: por prefijo de primer nivel, no por la lista exacta
 * de claves que aparecen en el HTML. El motivo es que varias se arman en
 * tiempo de ejecución —el panel de "how" pide how.<tab>.title— y un recorte
 * exacto las dejaría fuera sin que nadie se entere hasta verlo en producción.
 * Sale más grande de lo mínimo (401 claves en vez de 280) y sigue siendo 23 KB.
 *
 * Uso:  node scripts/build-marketing-locales.mjs [--check]
 *       --check no escribe: falla si lo generado no coincide con lo que hay
 *       en disco (para saber si alguien tocó los locales y no regeneró).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'es', 'pt'];
const PAGES = ['Home.html', 'Pricing.html', 'Contact.html', 'Login.html', 'Register.html'];

/** Prefijos de primer nivel que pertenecen a las páginas públicas. */
const PREFIXES = [
  'nav', 'hero', 'trust', 'sec', 'mod', 'how', 'who', 'devices', 'testi',
  'faq', 'cta', 'foot', 'pr', 'ct', 'login', 'register', 'sport', 'meta',
];

const check = process.argv.includes('--check');

/** Claves que el HTML pide de forma literal — sirve para validar el recorte. */
function keysUsedInPages() {
  const used = new Set();
  const attr = /data-i18n(?:-html|-ph)?=["']([^"']+)["']/g;
  const attrList = /data-i18n-attr=["']([^"']+)["']/g;
  const tCall = /(?:CM_I18N\.)?\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g;
  // CM_I18N.how / CM_I18N.rotator leen la clave "_how" / "_rotator".
  const prop = /CM_I18N\.([a-zA-Z][a-zA-Z0-9_]*)/g;
  const NOT_KEYS = new Set(['t', 'current', 'setLang', 'ready', 'setUserPref',
    'setClubCountry', 'setGeoCountry', 'dump']);
  for (const page of PAGES) {
    const src = readFileSync(join(ROOT, page), 'utf8');
    for (const m of src.matchAll(attr)) used.add(m[1]);
    for (const m of src.matchAll(tCall)) used.add(m[1]);
    for (const m of src.matchAll(prop)) if (!NOT_KEYS.has(m[1])) used.add('_' + m[1]);
    for (const m of src.matchAll(attrList)) {
      for (const part of m[1].split(';')) {
        const i = part.indexOf(':');
        if (i > -1) used.add(part.slice(i + 1).trim());
      }
    }
  }
  return used;
}

/**
 * Las claves que empiezan por "_" no son texto suelto: son objetos que el JS
 * de la página lee por CM_I18N.<nombre> (_how son los cuatro pasos del loop,
 * _rotator las palabras que rotan en el H1). No aparecen en ningún data-i18n,
 * así que el recorte por prefijo las dejaba fuera y la home se quedaba con el
 * texto inglés incrustado en el HTML — traducido en el diccionario y perdido
 * por el camino. Entran todas: son dos y pesan 2 KB.
 */
const inBundle = (key) => key.startsWith('_') || PREFIXES.includes(key.split('.')[0]);

const outDir = join(ROOT, 'locales', 'marketing');
if (!check && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const used = keysUsedInPages();
let failed = false;

for (const lang of LANGS) {
  const full = JSON.parse(readFileSync(join(ROOT, 'locales', `${lang}.json`), 'utf8'));
  const picked = {};
  for (const key of Object.keys(full)) if (inBundle(key)) picked[key] = full[key];

  // Una clave que el HTML pide y el recorte deja fuera saldría en inglés (o en
  // blanco) en producción. Preferimos romper el build.
  if (lang === 'en') {
    const missing = [...used].filter((k) => !(k in picked) && k in full);
    if (missing.length) {
      console.error(`✗ ${missing.length} claves usadas quedan fuera del bundle:`);
      for (const k of missing.slice(0, 20)) console.error(`    ${k}`);
      process.exit(1);
    }
  }

  const body = JSON.stringify(picked, null, 2) + '\n';
  const dest = join(outDir, `${lang}.json`);

  if (check) {
    const current = existsSync(dest) ? readFileSync(dest, 'utf8') : '';
    if (current !== body) {
      console.error(`✗ ${dest} está desactualizado — corré node scripts/build-marketing-locales.mjs`);
      failed = true;
    } else {
      console.log(`✓ ${lang}: al día (${Object.keys(picked).length} claves)`);
    }
    continue;
  }

  writeFileSync(dest, body);
  const fullKb = JSON.stringify(full).length / 1024;
  const cutKb = body.length / 1024;
  console.log(
    `✓ ${lang}: ${Object.keys(picked).length}/${Object.keys(full).length} claves — ` +
    `${cutKb.toFixed(1)} KB (antes ${fullKb.toFixed(1)} KB)`
  );
}

if (failed) process.exit(1);
