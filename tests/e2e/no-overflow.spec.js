// @ts-check
// Ninguna página puede sacarle scroll horizontal al documento.
//
// Esto existe porque el problema no se ve mirando: se acumula. Un botón que en
// inglés entra justo se sale en español, y nadie lo nota hasta que alguien
// manda una foto. Los textos en español y portugués son ~25% más largos que en
// inglés, así que el idioma es una dimensión del test, no un detalle.
//
// Por defecto corre en tablet y en español, que es el caso más apretado y el
// más rápido. Con FULL_OVERFLOW=1 barre los dos tamaños y los tres idiomas.
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FULL = !!process.env.FULL_OVERFLOW;
const VIEWPORTS = FULL
  ? [{ name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }]
  : [{ name: 'tablet', width: 768, height: 1024 }];
const LANGS = FULL ? ['en', 'es', 'pt'] : ['es'];

// Las páginas de la app, tal cual se sirven.
const PAGES = fs.readdirSync(ROOT)
  .filter(f => f.endsWith('.html') && !f.startsWith('_'))
  .sort();

const ADMIN = { id: 'user-1', club_id: 'club-1', role: 'admin', club_role: 'Owner', first_name: 'Test', last_name: 'User', full_name: 'Test User' };

/** Quién se sale por la derecha, y no por culpa de un padre que ya se salía. */
const PROBE = () => {
  const vw = document.documentElement.clientWidth;
  const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')
    + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  // Un elemento sólo ensancha el documento si nada por encima lo contiene: ni un
  // ancestro fixed (sale del flujo) ni uno que ya recorta o scrollea en X.
  const contained = el => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const c = getComputedStyle(p);
      if (c.position === 'fixed') return true;
      if (/auto|scroll|hidden|clip/.test(c.overflowX)) return true;
    }
    return false;
  };
  const over = [];
  for (const el of document.querySelectorAll('body *')) {
    const c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden' || c.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right > vw + 1 && !contained(el)) over.push([el, r]);
  }
  const set = new Set(over.map(x => x[0]));
  return {
    overflow: document.documentElement.scrollWidth - vw,
    // El originador: si su padre ya se salía, el culpable es el padre.
    culpables: over.filter(([e]) => !set.has(e.parentElement))
      .map(([e, r]) => ({ sel: desc(e), w: Math.round(r.width), sale: Math.round(r.right - vw) }))
      .sort((a, b) => b.sale - a.sale).slice(0, 3),
  };
};

for (const vp of VIEWPORTS) {
  for (const lang of LANGS) {
    test.describe(`Sin scroll horizontal · ${vp.name} · ${lang}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, locale: lang });

      test(`las ${PAGES.length} páginas entran en ${vp.width}px`, async ({ page }) => {
        test.setTimeout(PAGES.length * 6000 + 30000);

        await page.addInitScript(`localStorage.setItem('cm_lang', '${lang}')`);
        await injectSession(page);
        await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [ADMIN] }));
        await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [{ id: 'club-1', name: 'Test FC' }] }));
        await page.route(`${SB}/**`, r => r.fulfill({ json: [] }));
        page.on('dialog', d => d.dismiss().catch(() => {}));

        const fallos = [];
        for (const f of PAGES) {
          const slug = encodeURIComponent(f.replace(/\.html$/, ''));
          try {
            await page.goto(`/${slug}`, { waitUntil: 'networkidle', timeout: 25000 });
          } catch { continue; }               // una página que no carga es problema de otro test
          // Una página que redirige (sin plan, sin onboarding) no es esta página.
          const landed = decodeURIComponent(new URL(page.url()).pathname).replace(/^\//, '');
          if (landed !== f.replace(/\.html$/, '')) continue;
          await page.evaluate(() => document.fonts.ready).catch(() => {});
          await page.waitForTimeout(300);

          const r = await page.evaluate(PROBE);
          if (r.overflow > 0) {
            const quien = r.culpables.map(c => `${c.sel} (ancho ${c.w}, se sale ${c.sale}px)`).join(', ') || 'sin culpable identificable';
            fallos.push(`${f}: la página se sale ${r.overflow}px — ${quien}`);
          }
        }

        expect(fallos, `\n${fallos.join('\n')}\n`).toEqual([]);
      });
    });
  }
}
