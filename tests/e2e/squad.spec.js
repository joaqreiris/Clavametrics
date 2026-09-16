// @ts-check
import { test, expect } from '@playwright/test';
import { SB, PLAYER, injectSession, mockBase } from './_shared.js';

async function mockSquad(page, opts = {}) {
  const { players = [PLAYER], saveError = false } = opts;

  await mockBase(page);

  await page.route(`${SB}/rest/v1/players**`, async route => {
    const method = route.request().method();
    if (method === 'GET')    return route.fulfill({ json: players });
    if (saveError)           return route.fulfill({ status: 400, json: { message: 'DB error' } });
    if (method === 'POST')   return route.fulfill({ status: 201, json: [{ ...PLAYER, id: 'p-new' }] });
    if (method === 'PATCH')  return route.fulfill({ json: [PLAYER] });
    if (method === 'DELETE') return route.fulfill({ json: [] });
    await route.fallback();   // al mock de abajo, no a la red real
  });
}

/**
 * Abre el modal de edición del primer jugador de la tabla.
 *
 * La fila ya no trae un botón de editar propio (`.sq-edit-btn`, que no existe más): trae un kebab
 * que abre el menú compartido #sqRowMenu, y "Edit" sale de ahí. Clickear la fila entera no sirve
 * de atajo — eso navega al perfil del jugador.
 */
async function abrirEdicion(page) {
  await page.locator('.sq-menu-btn').first().click();
  await page.locator('#sqRowMenu [data-act="edit"]').click();
}

async function gotoSquad(page, opts = {}) {
  await injectSession(page);
  await mockSquad(page, opts);
  await page.goto('/Squad.html');
  // Se espera la TABLA, no el tbody: un tbody sin filas no tiene caja y Playwright no lo da por
  // visible, así que el caso «plantel vacío» —que es un test— moría esperando para siempre.
  await page.waitForSelector('#sqTbody', { state: 'attached', timeout: 10_000 });
  await page.waitForFunction(() => {
    const tb = document.getElementById('sqTbody');
    // Ya pintó: o hay filas, o la tabla dejó de decir que está cargando.
    return !!tb && !/loading|cargando/i.test(tb.textContent || '');
  }, null, { timeout: 10_000 });
}

// ── 1. Render ─────────────────────────────────────────────────────────────────

test.describe('Squad — Render', () => {
  test('player table is visible', async ({ page }) => {
    await gotoSquad(page);
    await expect(page.locator('#sqTbody')).toBeVisible();
  });

  test('renders one row per player', async ({ page }) => {
    await gotoSquad(page, { players: [PLAYER, { ...PLAYER, id: 'p-2', first_name: 'Marco', number: 9 }] });
    await expect(page.locator('#sqTbody tr:not(.is-group)')).toHaveCount(2);
  });

  test('shows player name in row', async ({ page }) => {
    await gotoSquad(page);
    await expect(page.locator('#sqTbody')).toContainText('Lucas', { timeout: 8000 });
  });

  test('shows player number in row', async ({ page }) => {
    await gotoSquad(page);
    await expect(page.locator('#sqTbody')).toContainText('10');
  });

  test('empty state when no players', async ({ page }) => {
    await gotoSquad(page, { players: [] });
    await expect(page.locator('#sqTbody tr:not(.is-group)')).toHaveCount(0);
  });

  test('sidebar shows club name', async ({ page }) => {
    await gotoSquad(page);
    await expect(page.locator('#sideClubName')).toContainText('Test FC', { timeout: 8000 });
  });
});

// ── 2. Modal — open / close ───────────────────────────────────────────────────

test.describe('Squad — Modal open/close', () => {
  test.beforeEach(async ({ page }) => { await gotoSquad(page); });

  test('clicking "Add player" opens modal with "Add player" title', async ({ page }) => {
    await page.locator('button', { hasText: /add player/i }).first().click();
    await expect(page.locator('#sqModalBackdrop')).toHaveClass(/is-open/);
    await expect(page.locator('#sqModalTitle')).toContainText('Add player');
  });

  test('Delete button hidden for new player', async ({ page }) => {
    await page.locator('button', { hasText: /add player/i }).first().click();
    await expect(page.locator('#sqModalDelete')).toBeHidden();
  });

  test('Cancel button closes modal', async ({ page }) => {
    await page.locator('button', { hasText: /add player/i }).first().click();
    await page.click('#sqModalCancel');
    await expect(page.locator('#sqModalBackdrop')).not.toHaveClass(/is-open/);
  });

  test('X button closes modal', async ({ page }) => {
    await page.locator('button', { hasText: /add player/i }).first().click();
    await page.click('#sqModalClose');
    await expect(page.locator('#sqModalBackdrop')).not.toHaveClass(/is-open/);
  });
});

// ── 3. Modal — edit ───────────────────────────────────────────────────────────

test.describe('Squad — Edit player', () => {
  test('clicking edit button opens modal with "Edit player" title', async ({ page }) => {
    await gotoSquad(page);
    await abrirEdicion(page);
    await expect(page.locator('#sqModalTitle')).toContainText('Edit');
  });

  test('modal pre-fills first name', async ({ page }) => {
    await gotoSquad(page);
    await abrirEdicion(page);
    await expect(page.locator('#sqF_first_name')).toHaveValue('Lucas');
  });

  test('Delete button visible when editing', async ({ page }) => {
    await gotoSquad(page);
    await abrirEdicion(page);
    await expect(page.locator('#sqModalDelete')).toBeVisible();
  });
});

// ── 4. Form validation ────────────────────────────────────────────────────────

test.describe('Squad — Form validation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSquad(page);
    await page.locator('button', { hasText: /add player/i }).first().click();
  });

  test('all main form fields are present', async ({ page }) => {
    await expect(page.locator('#sqF_first_name')).toBeVisible();
    await expect(page.locator('#sqF_last_name')).toBeVisible();
    await expect(page.locator('#sqF_number')).toBeVisible();
    await expect(page.locator('#sqF_dob')).toBeVisible();
    await expect(page.locator('#sqF_nationality')).toBeVisible();
    await expect(page.locator('#sqF_height_cm')).toBeVisible();
    await expect(page.locator('#sqF_weight_kg')).toBeVisible();
  });

  test('shows toast when first name is empty on save', async ({ page }) => {
    await page.click('#sqModalSave');
    await expect(page.locator('#sqToast')).toBeVisible({ timeout: 6000 });
  });

  test('modal stays open after failed validation', async ({ page }) => {
    await page.click('#sqModalSave');
    await expect(page.locator('#sqModalBackdrop')).toHaveClass(/is-open/);
  });
});

// ── 5. Save — new player ──────────────────────────────────────────────────────

test.describe('Squad — Save new player', () => {
  test('closes modal and shows toast on success', async ({ page }) => {
    await gotoSquad(page);
    await page.locator('button', { hasText: /add player/i }).first().click();
    await page.fill('#sqF_first_name', 'Marco');
    await page.fill('#sqF_last_name',  'Silva');
    await page.fill('#sqF_number',     '9');
    // La posición pasó a ser obligatoria: sin ella el formulario responde «Position is required»
    // y no guarda nada. El test la daba por opcional, como cuando se escribió.
    await page.selectOption('#sqF_position', 'CB');
    // La fecha de nacimiento pasó a ser obligatoria (2026-09): es lo único que permite saber
    // si el jugador es menor, y de eso dependen las protecciones sobre sus datos médicos.
    await page.fill('#sqF_dob', '1998-04-12');
    await page.click('#sqModalSave');

    await expect(page.locator('#sqModalBackdrop')).not.toHaveClass(/is-open/, { timeout: 8000 });
    await expect(page.locator('#sqToast')).toBeVisible();
  });

  test('sin fecha de nacimiento no guarda, y dice por qué', async ({ page }) => {
    // No es completitud de datos: sin fecha el club no puede declarar a cuántos MENORES
    // trata, y esa cifra es la primera que pide una autoridad de control. Si esto se afloja,
    // la cláusula del contrato sobre menores deja de ser sostenible.
    await gotoSquad(page);
    await page.locator('button', { hasText: /add player/i }).first().click();
    await page.fill('#sqF_first_name', 'Marco');
    await page.selectOption('#sqF_position', 'CB');
    await page.click('#sqModalSave');

    await expect(page.locator('#sqModalBackdrop')).toHaveClass(/is-open/);
    await expect(page.locator('#sqToast')).toContainText(/menor|minor/i, { timeout: 8000 });
  });

  test('shows saving indicator while request is in flight', async ({ page }) => {
    let release;
    const gate = new Promise(r => (release = r));

    await injectSession(page);
    await mockBase(page);
    await page.route(`${SB}/rest/v1/players**`, async route => {
      if (route.request().method() === 'POST') { await gate; return route.fulfill({ status: 201, json: [PLAYER] }); }
      route.fulfill({ json: [PLAYER] });
    });

    await page.goto('/Squad.html');
    await page.waitForSelector('#sqTbody', { state: 'attached' });
    await page.locator('button', { hasText: /add player/i }).first().click();
    await page.fill('#sqF_first_name', 'Marco');
    await page.fill('#sqF_last_name',  'Silva');
    await page.selectOption('#sqF_position', 'CB');   // obligatoria: sin ella no llega a guardar
    await page.fill('#sqF_dob', '1998-04-12');       // idem, desde 2026-09
    await page.click('#sqModalSave');

    await expect(page.locator('#sqModalSaving')).toBeVisible();
    await expect(page.locator('#sqModalSave')).toBeDisabled();
    release();
  });
});

// ── 6. Delete player ──────────────────────────────────────────────────────────

test.describe('Squad — Delete player', () => {
  test('cancel on confirm dialog keeps modal open', async ({ page }) => {
    await gotoSquad(page);
    await abrirEdicion(page);
    page.on('dialog', d => d.dismiss());
    await page.click('#sqModalDelete');
    await expect(page.locator('#sqModalBackdrop')).toHaveClass(/is-open/);
  });

  test('confirming delete closes modal and shows toast', async ({ page }) => {
    await gotoSquad(page);
    await abrirEdicion(page);
    page.on('dialog', d => d.accept());
    await page.click('#sqModalDelete');
    await expect(page.locator('#sqModalBackdrop')).not.toHaveClass(/is-open/, { timeout: 8000 });
    await expect(page.locator('#sqToast')).toBeVisible();
  });
});

// ── 7. Auth guard ─────────────────────────────────────────────────────────────

test.describe('Squad — Auth guard', () => {
  test('redirects to Login.html when no session', async ({ page }) => {
    await page.route(`${SB}/auth/v1/**`, route =>
      route.fulfill({ status: 401, json: { error: 'not authenticated' } })
    );
    await page.goto('/Squad.html');
    // El servidor de pruebas sirve las páginas sin «.html», así que el redirect llega a
    // /Login y no a /Login.html. Se aceptan las dos formas.
    await page.waitForURL(/Login(\.html)?(\?|$)/, { timeout: 8000 });
  });
});

/**
 * Derechos de imagen.
 *
 * Son un derecho DISTINTO del RGPD: que el club tenga aceptada la política de privacidad no
 * da permiso sobre la cara de nadie. Y quién tiene que autorizar depende de la edad, así que
 * lo que se prueba aquí es que el formulario pida a las personas correctas — y que no deje
 * registrar nada cuando no se sabe la edad, que es el caso de las fichas sin fecha.
 *
 * El mock se registra DESPUÉS de gotoSquad a propósito: mockBase trae un catch-all de
 * /rest/v1 y en Playwright gana la ruta registrada más tarde. Como el GET de consentimientos
 * sale al abrir el modal (no al cargar la página), llega a tiempo igual.
 */
test.describe('derechos de imagen', () => {
  const iso = d => d.toISOString().slice(0, 10);
  const haceAnios = n => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return iso(d); };

  async function mockConsents(page, filas = []) {
    await page.route(`${SB}/rest/v1/player_image_consents**`, async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: filas });
      return route.fulfill({ status: 201, json: [] });
    });
  }

  test('a un jugador adulto se le pide su propia autorización, y a nadie más', async ({ page }) => {
    await gotoSquad(page);
    await mockConsents(page);
    await abrirEdicion(page);

    const casillas = page.locator('[data-consent-chk^="internal_analysis:"]');
    await expect(casillas).toHaveCount(1);
    await expect(page.locator('[data-consent-chk="internal_analysis:player"]')).toBeVisible();
    // Un mayor de edad no necesita a sus padres: si aparecen, el formulario está pidiendo
    // datos de terceros que no hacen falta.
    await expect(page.locator('[data-consent-chk="internal_analysis:guardian1"]')).toHaveCount(0);
  });

  test('a un menor de 14 a 17 se le piden los dos progenitores y él mismo', async ({ page }) => {
    await gotoSquad(page);
    await mockConsents(page);
    await abrirEdicion(page);

    // Fecha relativa, no fija: un menor con fecha fija cumple 18 y el test se cae solo.
    await page.fill('#sqF_dob', haceAnios(16));

    await expect(page.locator('[data-consent-chk^="internal_analysis:"]')).toHaveCount(3);
    for (const quien of ['guardian1', 'guardian2', 'player']) {
      await expect(page.locator(`[data-consent-chk="internal_analysis:${quien}"]`)).toBeVisible();
    }
    // Y los dos alcances son independientes: la difusión pide su propio permiso.
    await expect(page.locator('[data-consent-chk^="public_release:"]')).toHaveCount(3);
  });

  test('sin fecha de nacimiento no se puede registrar el consentimiento', async ({ page }) => {
    await gotoSquad(page);
    await mockConsents(page);
    await abrirEdicion(page);

    await page.fill('#sqF_dob', '');

    // Ni una sola casilla: sin saber la edad no se sabe quién tiene que firmar, y asumir el
    // régimen más laxo es exactamente el error que esto evita.
    await expect(page.locator('[data-consent-chk]')).toHaveCount(0);
    await expect(page.locator('#sqF_consent')).toContainText(/fecha de nacimiento|date of birth/i);
  });

  test('un consentimiento marcado sin decir quién lo dio no se guarda', async ({ page }) => {
    await gotoSquad(page);
    await mockConsents(page);
    await abrirEdicion(page);

    await page.check('[data-consent-chk="internal_analysis:player"]');
    // Se marca pero no se escribe el nombre: una fecha sin nombre no acredita nada.
    await page.click('#sqModalSave');

    await expect(page.locator('#sqModalBackdrop')).toHaveClass(/is-open/);
    await expect(page.locator('#sqToast')).toContainText(/autoriza|authoris/i, { timeout: 8000 });
  });
});
