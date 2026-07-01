# Packaging & Pricing Spec — ClavaMetrics

> Modelo de monetización cerrado. Define el átomo de venta, el ladder de planes,
> el gating feature por feature, y el panel de super admin para administrarlo.
> Reemplaza el seed obsoleto de `016_billing_plans.sql`.
> Precios = provisorios, fuente única editable (ver §6).
> Estado: spec. No ejecuta cambios.

---

## 1. Modelo (cerrado)

- **Club = tenant / workspace.** Puede ser una institución o el escritorio de un PF
  suelto. Es dueño del branding, theme, multi-tenant, y de la **invoice consolidada**.
- **Categoría = squad = la unidad que se cobra.** Cada categoría elige su tier.
- Un PF solo = un club con una categoría. Un club institucional = un club con N
  categorías. Mismo esqueleto, distinta escala. (Opción B del `billing-audit.md`.)
- **Dos ejes de ingreso, desacoplados:**
  - *Capacidad* (qué módulos) → se sube de tier.
  - *Escala* (cuántas categorías) → se suman categorías.
- Esto resuelve a los dos compradores con un solo modelo: el PF crece por capacidad,
  el club crece por cantidad.

---

## 2. El ladder

Cada tier responde a una **pregunta distinta** del comprador. Esa es la lógica de la
raya, no "más features".

| | **Iniciación** | **Básico** | **Profesional** | **Full** |
|---|---|---|---|---|
| **La pregunta** | ¿sirve? | ¿analizo mi data? | ¿tengo estructura? | ¿opero al máximo? |
| **Para quién** | PF que prueba / squad chico | PF con su GPS / club sin staff | club con fisio, staff | departamento completo |
| **Players (max)** | 15 | 30 | 80 | ilimitado |
| **Precio provisorio** | $0 | $60 | $120 | $150 |
| **Unidad** | / categoría / mes | / categoría / mes | / categoría / mes | / categoría / mes |

> Precios provisorios (placeholder de marketing). La verdad vive en la tabla `plans`,
> editable por super admin (§6). No clavar números en HTML.

**Lógica de conversión:**
- Free → Básico: "quiero meter mi GPS". El fidelizador (GPS Analysis) es el primer
  escalón pago.
- Básico → Pro: "ya tengo fisio / nutri / staff". El upsell se vende contra una
  **realidad organizativa**, no contra un deseo. El que sube, creció.
- Pro → Full: "tengo departamento" (nutrición, video).
- El club crece por el otro eje (más categorías) en cualquier tier.

---

## 3. Gating feature por feature

Mapa de cada módulo → **tier mínimo** que lo desbloquea. Acumulativo (cada tier
incluye lo de abajo). Esto es lo que alimenta `plans.features` y la lógica de
enforcement.

| Módulo / feature | key | Iniciación | Básico | Profesional | Full |
|---|---|:--:|:--:|:--:|:--:|
| Squad | `squad` | ✅ | ✅ | ✅ | ✅ |
| Wellness — **captura** | `wellness_capture` | ✅ | ✅ | ✅ | ✅ |
| RPE — **captura** | `rpe_capture` | ✅ | ✅ | ✅ | ✅ |
| App del atleta | `athlete_app` | ✅ | ✅ | ✅ | ✅ |
| Calendar | `calendar` | ✅ | ✅ | ✅ | ✅ |
| Daily Planning | `daily_planning` | ✅ | ✅ | ✅ | ✅ |
| Sessions Library | `sessions_library` | ✅ | ✅ | ✅ | ✅ |
| Wellness/RPE — **análisis y tendencias** | `wellness_analysis` | — | ✅ | ✅ | ✅ |
| **GPS Analysis** (CSV, dashboards, por sesión/jugador, zonas) | `gps_analysis` | — | ✅ | ✅ | ✅ |
| Annual Planner | `annual_planner` | — | ✅ | ✅ | ✅ |
| Gym Planner / Library | `gym` | — | ✅ | ✅ | ✅ |
| Evaluations | `evaluations` | — | ✅ | ✅ | ✅ |
| Injuries | `injuries` | — | ✅ | ✅ | ✅ |
| Availability | `availability` | — | ✅ | ✅ | ✅ |
| **Load Monitor** (ACWR, CTL/ATL/TSB, zonas de velocidad) | `load_monitor` | — | — | ✅ | ✅ |
| Cruce carga × wellness | `load_wellness_cross` | — | — | ✅ | ✅ |
| Individual Planner | `individual_planner` | — | — | ✅ | ✅ |
| Physio | `physio` | — | — | ✅ | ✅ |
| Rehab Planner | `rehab_planner` | — | — | ✅ | ✅ |
| Match Reports | `match_reports` | — | — | ✅ | ✅ |
| Lineup | `lineup` | — | — | ✅ | ✅ |
| Multi-staff / roles | `multi_staff` | — | — | ✅ | ✅ |
| **Nutrition** (gateado ya; módulo se termina después) | `nutrition` | — | — | — | ✅ |
| Video Room | `video_room` | — | — | — | ✅ |

### La raya del anzuelo (wellness/RPE)
- **Captura: gratis e ilimitada en todos los tiers.** Compite contra el Google Sheet
  y lo supera (automatizado + app del atleta). Es el motor de adopción de abajo
  hacia arriba: lo único que toca al plantel todos los días.
- **Análisis de esa data: pago (Básico+).** Regalás la captura, cobrás la
  inteligencia. El que entra ve su data hoy; para entenderla en el tiempo, sube.

### El motor de conversión Básico → Pro
- En Básico, las cards de `load_monitor` (ACWR, CTL/ATL/TSB) aparecen **bloqueadas
  sobre la propia data del cliente** (ya subió su GPS). Ve el gauge teaseado encima de
  SUS números. El upgrade lo pide el producto, no lo empuja la venta.

---

## 4. Trial

- **Free-forever (Iniciación):** la tierra donde aterriza y se queda el PF. No es trial,
  es piso permanente.
- **Trial de Full, 15 días:** cualquier categoría arranca en Full por 15 días para que
  prueben GPS + ciencia + lo pesado. Al vencer, cae al tier que elige (o a Iniciación).
- El trial va **encima** del free, no lo reemplaza: free para quedarse, trial para
  probar lo caro.

---

## 5. Enforcement (hoy no existe — ver `billing-audit.md` §4.9)

`plans.max_players` y `plans.features` **deben** gatear de verdad:
- `max_players`: bloquea el alta del player N+1 sobre el límite del tier de la categoría.
- `features`: oculta/bloquea el módulo si la key no está en el plan de la categoría.
- Patrón sugerido: helper `hasFeature(categoryId, key)` + `playerLimit(categoryId)`,
  resueltos contra la subscription de la categoría. UI muestra el módulo bloqueado con
  CTA de upgrade (no lo esconde del todo: el bloqueo visible es lo que convierte).

---

## 6. Fuente única de verdad: tabla `plans` editable

Hoy los precios viven hardcodeados en 3 HTML (Pricing, Plan Picker, Billing) y un seed
SQL obsoleto que no coincide con ninguno. **Se colapsa a una sola fuente:** la tabla
`plans`. Marketing / Picker / Billing leen de ahí (directo, o de un `plans.json`
generado en build para no pegarle a DB desde la marketing pública).

Seed de arranque (reemplaza el INSERT obsoleto del 016). Son **defaults**; la verdad
es runtime via panel super admin:

```sql
-- Reemplaza el seed de 016_billing_plans.sql
INSERT INTO plans (slug, name, description, price_monthly, price_yearly, max_players, max_staff, features, sort_order)
VALUES
  ('initiation',  'Iniciación',  'PF que prueba / squad chico',     0,   0,    15,  2,
    '["squad","wellness_capture","rpe_capture","athlete_app","calendar","daily_planning","sessions_library"]'::jsonb, 1),
  ('basic',       'Básico',      'PF con su GPS / club sin staff',  60,  600,  30,  4,
    '["squad","wellness_capture","rpe_capture","athlete_app","calendar","daily_planning","sessions_library","wellness_analysis","gps_analysis","annual_planner","gym","evaluations","injuries","availability"]'::jsonb, 2),
  ('professional','Profesional', 'Club con fisio y staff',          120, 1200, 80,  null,
    '["squad","wellness_capture","rpe_capture","athlete_app","calendar","daily_planning","sessions_library","wellness_analysis","gps_analysis","annual_planner","gym","evaluations","injuries","availability","load_monitor","load_wellness_cross","individual_planner","physio","rehab_planner","match_reports","lineup","multi_staff"]'::jsonb, 3),
  ('full',        'Full',        'Departamento completo',           150, 1500, null, null,
    '["squad","wellness_capture","rpe_capture","athlete_app","calendar","daily_planning","sessions_library","wellness_analysis","gps_analysis","annual_planner","gym","evaluations","injuries","availability","load_monitor","load_wellness_cross","individual_planner","physio","rehab_planner","match_reports","lineup","multi_staff","nutrition","video_room"]'::jsonb, 4)
ON CONFLICT (slug) DO NOTHING;
```

> `price_yearly` = 10× mensual como placeholder (2 meses gratis). Provisorio.
> Naming de tier: español por ahora (consistente con marketing actual). Revisar contra
> regla "UI en inglés + i18n" cuando se cierre el idioma de marketing.
> Nota: las columnas `stripe_*` del 016 se renombran a agnósticas (`provider_*`) — ver §7.5.

---

## 7. Panel Super Admin (bloque nuevo)

Pestaña para vos (platform owner) que administra el negocio: precios, qué feature entra
en cada plan, límites, y una **calculadora de presupuesto** para cotizaciones custom.
Esto es lo que hace reales los "precios blandos".

### Qué hace
1. **CRUD de `plans`:** editar `price_monthly` / `price_yearly` / `max_players` /
   `max_staff` por tier, sin tocar código.
2. **Matriz de features por plan:** toggles que escriben `plans.features`. Cada toggle =
   una key del §3. (Nota de interpretación: "features de cada categoría" se entiende
   como features de cada **plan**; una categoría hereda las del plan que tiene asignado.
   Confirmá si querés además overrides por categoría individual — ver §9.)
3. **Calculadora de presupuesto:** input = N categorías, cada una con su tier (+ extras
   futuros: espacio/almacenamiento, add-ons). Output = total mensual / anual. Herramienta
   interna para las cotizaciones Custom/Enterprise. Lee de `plans`, no inventa números.

### Decisiones de arquitectura (NO resueltas — necesitan tu OK, §9)

Esto es lo que te quería marcar antes de clavarlo:

- **No existe el rol "super admin" hoy.** `profiles.role` es admin/coach/physio/… pero
  está **scopeado al club** (RLS filtra todo por `club_id`). Un platform owner es
  **cross-club**: ve y edita por encima de todos los tenants. No se puede meter como un
  valor más de `profiles.role` sin romper el modelo. Recomendado: tabla
  `platform_admins(user_id)` + función `is_platform_admin()` usada en las policies. Es
  un concepto de plataforma, no de club.
- **`plans` hoy es SELECT-only para authenticated.** Hace falta policy de
  INSERT/UPDATE **restringida a `is_platform_admin()`**. Que un admin de club pueda
  editar precios sería un desastre. Esta es la barrera de seguridad crítica del bloque.
- **Dónde vive.** Página separada, **fuera** del workspace de club. No es `Admin.html`
  (eso es admin de club). Algo tipo `Platform.html`, con redirect si el user no es
  platform admin. No aparece en el sidebar normal.
- **La calculadora no necesita schema nuevo** para arrancar (es función pura sobre
  `plans`). Si después querés **guardar** cotizaciones, ahí sí entra una tabla `quotes`.

---

## 7.5. Billing provider — Paddle (Merchant of Record) ✅

PSP elegido: **Paddle**, en modelo **Merchant of Record (MoR)**. Razón: el modelo es B2B
(se le vende a clubes = empresas), per-category con proración y upgrades a mitad de ciclo,
clientes en España (VAT UE) y LATAM. Paddle cubre eso mejor que las alternativas
(VAT B2B reverse-charge UE, proración, multi-seat, infra de impuestos madura). Stripe
directo no está disponible para Uruguay; con un MoR no importa, porque Paddle es el
vendedor legal y a Joaco le llega el payout. Uruguay está soportado como seller.

### Qué cambia en el modelo por ser MoR
- **El cliente paga con su tarjeta normal (crédito/débito).** Paddle NO reemplaza la
  tarjeta: es la caja. El checkout y la gestión del método de pago son **hosted por
  Paddle**. Para el usuario es transparente: mete su tarjeta y paga.
- **Sin PCI / sin guardar tarjetas.** La tabla `payment_methods` solo **espeja**
  brand/last4 que manda el webhook, para mostrar. El botón "Manage" de Billing.html
  **deep-linkea al portal de Paddle**, no a un form propio de tarjeta.
- **Las invoices las emite Paddle** (su nombre en el recibo). La tabla `invoices` las
  espeja vía webhook; el PDF/URL vienen de Paddle.
- **El tax lo maneja Paddle**, no nosotros → mata la línea "Tax (ARG 21%)" hardcodeada
  (ya estaba para sacar en §7a L5 del audit). No modelamos tax.
- **El webhook de Paddle es el "único escritor"** de subscriptions/invoices/payment_methods
  (consistente con el RLS SELECT-only). Es la edge function que hoy falta.

### Schema agnóstico de proveedor (IMPORTANTE)
Renombrar las columnas `stripe_*` del 016 a **agnósticas**, para que migrar de proveedor
mañana sea config y no refactor:
- `clubs.billing_stripe_customer_id` → `billing_provider` (text) + `billing_provider_customer_id`
- `subscriptions.stripe_subscription_id` → `provider_subscription_id`
- `invoices.stripe_invoice_id` → `provider_invoice_id`
- `payment_methods.stripe_payment_method_id` → `provider_payment_method_id`

### LATAM-local = fase 2 (condicionada a demanda real)
Paddle ya soporta Pix nativo (Brasil) y tarjeta internacional en todos lados. Lo que NO
cubre bien: wallet de Mercado Pago, cuotas argentinas, efectivo. Pero eso es cultura de
**consumo**, no de B2B — un club paga como empresa (tarjeta/transferencia/factura). NO
agregar un segundo riel al lanzar: mezclar Paddle (MoR) con Mercado Pago (PSP, no-MoR)
te vuelve a hacer a vos el merchant of record de esas ventas (tax/facturación propios) +
doble webhook/dunning/reconciliación. Si más adelante aterriza demanda LATAM-local real,
la jugada limpia es un MoR que ya traiga MP+Pix+cuotas, no dos sistemas en paralelo. El
schema agnóstico de arriba deja esa puerta abierta de forma aditiva.

---

## 8. Cómo se conecta con el resto (de billing-audit.md)

Cerrado el modelo, se destraban los bloqueados del §7b del audit:
- Tabla `categories` (FK `club_id`); `subscriptions` pasa a `category_id`; players ganan
  `category_id`.
- Invoice consolidada a nivel club.
- Status real "near limit"/"over" = conteo players de la categoría vs `plans.max_players`.
- Webhook de **Paddle** como único escritor (consistente con RLS). Ver §7.5.
- **Multi-workspace (cambio de producto, no de billing):** hoy `profiles.club_id` asume
  un usuario = un club. Para cubrir al PF que a veces va por su cuenta y a veces por un
  club, una persona debe poder pertenecer a **varios workspaces** a la vez (su workspace
  propio + el del club como staff). El billing cuelga del workspace, no de la persona:
  cada workspace tiene su admin que pone la tarjeta que quiera (personal o institucional).
  Requiere pasar `profiles.club_id` (1:1) a una relación N:N (ej. tabla `memberships`).

---

## 9. Supuestos / decisiones pendientes

1. **Rol platform admin:** ¿tabla `platform_admins` + `is_platform_admin()` como
   propongo? Es la base del panel.
2. **Features por categoría:** ¿alcanza con features por **plan** (una categoría hereda
   del plan), o querés **overrides** por categoría individual (ej: dar `nutrition` a una
   categoría sin subirla a Full)? Lo segundo es más flexible pero complica el modelo y
   el enforcement. Recomiendo arrancar simple: solo por plan.
3. **`max_staff`:** ¿se enforce o es informativo? (Iniciación 2 / Básico 4 / Pro+ ilimitado
   son placeholders.)
4. **PSP: CERRADO → Paddle (MoR).** Ver §7.5. Schema agnóstico de proveedor. LATAM-local
   (Mercado Pago) = fase 2 condicionada a demanda real.
5. **Idioma de tier names** (Iniciación vs Initiation) cuando se cierre el idioma default
   de marketing.
