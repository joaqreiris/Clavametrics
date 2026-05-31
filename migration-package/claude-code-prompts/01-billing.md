# Prompt 01 — Fase 1: Billing

```
Vamos con la Fase 1: Billing. Riesgo bajo, 3 pantallas standalone.

PASO 1 — Branch:
- Crear branch `feature/billing` desde main.

PASO 2 — Copiar archivos:
Copiá desde `migration-package/files-to-add/` a la raíz del repo:
- Billing.html
- Pricing.html
- Plan Picker.html
- tweaks-panel.jsx

NO modifiques ningún archivo existente todavía.

PASO 3 — Migración SQL:
- Revisá `migration-package/sql-migrations/016_billing_plans.sql`.
- Validá que las tablas no existan ya (`SELECT * FROM pg_tables WHERE
  tablename IN ('plans','subscriptions','invoices')`).
- Aplicar la migración en Supabase dev.
- Crear `migrations/016_billing_plans.sql` en el repo (copia del paquete).

PASO 4 — Wirear con Supabase (quirúrgico):
Las 3 pantallas tienen MOCK DATA. Reemplazar:

(a) Billing.html:
- Buscá donde están los valores hardcoded ('Pro', '$199/mo', etc).
- Reemplazá con queries a:
  * `clubs` (billing_plan, billing_amount, billing_next_date, billing_status)
  * `invoices` (historial)
  * `payment_methods`
- Usar `getClub()`, `getClubId()`, `window.sb` (NO crear cliente nuevo).
- Filtrar TODO por club_id.

(b) Pricing.html:
- Cargar `plans` desde Supabase.
- El botón "Subscribe" debe llamar tu flujo de Stripe (si existe) o quedar
  como TODO marcado con un comment claro.

(c) Plan Picker.html:
- Usar SOLO durante onboarding. Leer `plans`, escribir
  `clubs.billing_plan` al seleccionar.

PASO 5 — Modificación quirúrgica en settings-drawer.jsx:
En `BillingPanel`, después del último `<div className="sd-billing-row">`
y ANTES del `</div>` que cierra `.sd-billing-card`, agregar:

```jsx
</div>
<div style={{marginTop:12, textAlign:'right'}}>
  <a href="Billing.html" style={{font:'500 12.5px/1 var(--cm-font-sans)', color:'var(--cm-accent)', textDecoration:'none'}}>
    Ver detalle completo <i className="ti ti-arrow-right"></i>
  </a>
</div>
```

NO toques nada más de ese archivo.

PASO 6 — Test e2e:
Crear `tests/e2e/billing.spec.js` con un smoke test:
- login → ir a /Billing.html → verificar que renderiza plan + monto.

PASO 7 — Validación pre-merge:
- npm test verde
- Smoke manual: login → ver Settings > Billing → click "Ver detalle
  completo" → llega a Billing.html
- Probar con 2 clubs distintos (RLS check)

PASO 8 — Commit y PR:
- Commits atómicos (no un megacommit)
- Push branch
- Crear PR con título: "feat(billing): add billing/pricing/plan-picker
  pages + migration 016"

Cuando termines, devolveme:
- URL del PR
- Lista de archivos modificados
- Resultado de npm test
- Cualquier issue que encontraste

Si encontrás conflictos con el BillingPanel existente, FRENÁ y consultame.
```
