// @ts-check
// Platform Admin → pestaña Trials: el tablero de seguimiento comercial.
//
// Lo que se prueba acá es lo que la pantalla decide por su cuenta: a quién poner
// primero, qué teléfonos se pueden abrir en WhatsApp y a quién no se puede prospectar.
// Los datos vienen del RPC sales_pipeline(), que se mockea.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SB, injectSession } from './_shared.js';

// Cuatro clubes elegidos para cubrir el orden completo: el cliente que paga va último
// aunque sea el más activo, y la prueba que nunca arrancó va primera aunque le sobren días.
const PIPELINE = [
  {
    club_id: 'c-cliente', club_name: 'Clava FC', country: 'Spain', sport: 'football',
    created_at: '2026-05-20T10:00:00Z', trial_ends_at: null, days_left: null,
    stage: 'customer', health: 'active', plan: 'professional', is_comp: false,
    onboarded_at: '2026-05-20T11:00:00Z',
    utm_source: null, utm_medium: null, utm_campaign: null, referrer: null, landing_page: null,
    contact_name: 'Joaquín R', contact_email: 'jr@clavafc.com', contact_phone: '+34600111222',
    contact_job: 'Director deportivo', marketing_opt_in: true,
    users: 4, players: 45, teams: 3, sessions: 503, wellness_entries: 900, gps_reports: 120,
    events_7d: 1808, active_users_7d: 3, last_activity_at: '2026-09-14T08:00:00Z',
  },
  {
    club_id: 'c-activo', club_name: 'Bigúa', country: 'Uruguay', sport: 'football',
    created_at: '2026-09-01T10:00:00Z', trial_ends_at: '2026-09-16T10:00:00Z', days_left: 2,
    stage: 'trial', health: 'active', plan: 'free', is_comp: false, onboarded_at: null,
    utm_source: 'instagram', utm_medium: 'cpc', utm_campaign: 'pretemporada',
    referrer: null, landing_page: '/Home.html',
    contact_name: 'Ana Pérez', contact_email: 'ana@bigua.uy', contact_phone: '+59899111222',
    contact_job: 'Preparadora física', marketing_opt_in: true,
    users: 3, players: 28, teams: 2, sessions: 12, wellness_entries: 40, gps_reports: 3,
    events_7d: 210, active_users_7d: 2, last_activity_at: '2026-09-13T08:00:00Z',
  },
  {
    club_id: 'c-frio', club_name: 'Donna FC', country: null, sport: 'football',
    created_at: '2026-09-03T10:00:00Z', trial_ends_at: '2026-09-18T10:00:00Z', days_left: 4,
    stage: 'trial', health: 'cold', plan: 'free', is_comp: false, onboarded_at: null,
    utm_source: null, utm_medium: null, utm_campaign: null, referrer: null, landing_page: null,
    contact_name: 'Donna', contact_email: 'donna@fc.com',
    // Sin prefijo de país: no se puede armar un enlace de WhatsApp con esto.
    contact_phone: '086604394',
    contact_job: null, marketing_opt_in: false,
    users: 1, players: 0, teams: 0, sessions: 0, wellness_entries: 0, gps_reports: 0,
    events_7d: 0, active_users_7d: 0, last_activity_at: null,
  },
  {
    club_id: 'c-vencido', club_name: 'MOI U18', country: 'Cambodia', sport: 'football',
    created_at: '2026-08-12T10:00:00Z', trial_ends_at: '2026-08-27T10:00:00Z', days_left: -18,
    stage: 'expired', health: 'warm', plan: 'free', is_comp: false, onboarded_at: null,
    utm_source: null, utm_medium: null, utm_campaign: null, referrer: 'https://www.google.com/', landing_page: '/Pricing.html',
    contact_name: 'Bunty', contact_email: 'bunty@moi.kh', contact_phone: '+855884411289',
    contact_job: null, marketing_opt_in: true,
    users: 1, players: 11, teams: 1, sessions: 0, wellness_entries: 0, gps_reports: 0,
    events_7d: 0, active_users_7d: 0, last_activity_at: '2026-08-17T08:00:00Z',
  },
];

async function abrirTrials(page, { pipeline = PIPELINE, esAdmin = true } = {}) {
  await injectSession(page);
  // De lo general a lo específico: en Playwright gana la última ruta registrada.
  await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
  await page.route(`${SB}/auth/v1/**`, route =>
    route.fulfill({ json: { id: 'user-1', email: 'admin@clavametrics.app', aud: 'authenticated', role: 'authenticated' } }));
  await page.route(`${SB}/rest/v1/rpc/**`, route => route.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/rpc/is_super_admin**`, route => route.fulfill({ json: esAdmin }));
  await page.route(`${SB}/rest/v1/rpc/sales_pipeline**`, route => route.fulfill({ json: pipeline }));

  await page.goto('/Platform.html');
  await page.locator('.pf-tab[data-tab="trials"]').click();
  // La lista se dibuja después del RPC: esperar la primera fila y no el panel, que ya
  // existe en el HTML desde el primer pintado.
  await expect(page.locator('#pfTrialsList .pf-trow').first()).toBeVisible({ timeout: 15_000 });
}

test.describe('Platform — Trials', () => {

  test('ordena por urgencia: primero la prueba que nunca arrancó, último el cliente', async ({ page }) => {
    await abrirTrials(page);
    const nombres = await page.locator('#pfTrialsList .pf-tname').allTextContents();
    expect(nombres).toEqual(['Donna FC', 'Bigúa', 'MOI U18', 'Clava FC']);
  });

  test('el resumen cuenta las pruebas que necesitan una llamada', async ({ page }) => {
    await abrirTrials(page);
    const resumen = await page.locator('#pfTrialsSummary').textContent();
    expect(resumen).toContain('4');   // clubes
    expect(resumen).toContain('1');   // una sola prueba necesita llamada (Donna, fría)
  });

  test('el teléfono con prefijo se abre en WhatsApp y el que no lo tiene no se enlaza', async ({ page }) => {
    await abrirTrials(page);
    const frio = page.locator('#pfTrialsList .pf-trow').filter({ hasText: 'Donna FC' });
    await expect(frio.locator('a[href*="wa.me"]')).toHaveCount(0);
    await expect(frio).toContainText('086604394');

    const vencido = page.locator('#pfTrialsList .pf-trow').filter({ hasText: 'MOI U18' });
    await expect(vencido.locator('a[href="https://wa.me/855884411289"]')).toHaveCount(1);
  });

  test('marca a quién no se le puede prospectar', async ({ page }) => {
    await abrirTrials(page);
    const frio = page.locator('#pfTrialsList .pf-trow').filter({ hasText: 'Donna FC' });
    await expect(frio.locator('.ti-shield-off')).toHaveCount(1);

    const activo = page.locator('#pfTrialsList .pf-trow').filter({ hasText: 'Bigúa' });
    await expect(activo.locator('.ti-shield-off')).toHaveCount(0);
  });

  test('muestra de qué campaña vino cada club', async ({ page }) => {
    await abrirTrials(page);
    await expect(page.locator('#pfTrialsList .pf-trow').filter({ hasText: 'Bigúa' }))
      .toContainText('instagram');
    // Sin UTM pero con referrer: vale el dominio, no la URL entera.
    await expect(page.locator('#pfTrialsList .pf-trow').filter({ hasText: 'MOI U18' }))
      .toContainText('www.google.com');
  });

  test('el filtro por etapa deja sólo las pruebas en curso', async ({ page }) => {
    await abrirTrials(page);
    await page.locator('#pfTrialsFilters .pf-chip[data-f="trial"]').click();
    await expect(page.locator('#pfTrialsList .pf-trow')).toHaveCount(2);
    const nombres = await page.locator('#pfTrialsList .pf-tname').allTextContents();
    expect(nombres).toEqual(['Donna FC', 'Bigúa']);
  });

  // El CSV es el puente con el CRM: se baja de acá y se sube a HubSpot.
  test('el CSV sale con las cabeceras que HubSpot reconoce y una fila por club', async ({ page }) => {
    await abrirTrials(page);
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#pfTrialsExport').click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^clavametrics-pipeline-\d{4}-\d{2}-\d{2}\.csv$/);

    const csv = readFileSync(await descarga.path(), 'utf-8');
    // BOM al principio: sin él Excel abre el archivo en Latin-1 y rompe los acentos.
    expect(csv.charCodeAt(0)).toBe(0xFEFF);

    const lineas = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lineas).toHaveLength(5);                       // cabecera + 4 clubes
    expect(lineas[0]).toContain('"Company Name"');
    expect(lineas[0]).toContain('"Club ID"');             // la columna que cruza los dos sistemas
    expect(lineas[0]).toContain('"Marketing Consent"');

    // El nombre del contacto se parte en nombre y apellido, que es como los pide el CRM.
    const bigua = lineas.find(l => l.includes('Bigúa'));
    expect(bigua).toContain('"Ana","Pérez"');
    expect(bigua).toContain('"+59899111222"');
    expect(bigua).toContain('"instagram"');
    expect(bigua).toContain('"Yes"');

    // Quien no dio consentimiento viaja igual, marcado: hay que poder darle soporte.
    expect(lineas.find(l => l.includes('Donna FC'))).toContain('"No"');
  });

  test('el CSV respeta el filtro que está puesto', async ({ page }) => {
    await abrirTrials(page);
    await page.locator('#pfTrialsFilters .pf-chip[data-f="customer"]').click();
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#pfTrialsExport').click(),
    ]);
    const lineas = readFileSync(await descarga.path(), 'utf-8').replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lineas).toHaveLength(2);                       // cabecera + Clava FC
    expect(lineas[1]).toContain('Clava FC');
  });
});
