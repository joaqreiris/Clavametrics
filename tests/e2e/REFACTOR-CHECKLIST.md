# GPS Analysis — checklist de refactor

`GPS Analysis.html` es un monolito. Lo desarmamos por partes, replicando `lib/gp-card/`:
extraer por responsabilidad, en pasos chicos, **sin cambiar comportamiento**. La red de
smoke (`tests/e2e/gps-smoke.spec.js`) es el guardián: si un paso rompe el render, se pone
roja.

## El bucle por cada paso

1. **Extraer** un bloque a su módulo (`lib/gp-ui/…`, `lib/gp-…/`), dejando `GPS Analysis.html`
   apuntando al módulo. Nada de lógica nueva.
2. **Verificar automático** — un solo comando:

   ```
   npm run test:smoke
   ```

   Debe dar **verde**. Cubre el render real: las 5 vistas montan sin `pageerror`, KPI con
   número, tabla con filas, cross-filter dispara `gpfilter:change`, charts dibujan, y las
   vistas `mind`/`mc` renderizan con datos. (`mgrp`/ACWR sólo tiene el guard de no-pageerror
   — ver nota en el spec.)
3. **Verificar manual** — abrir `GPS Analysis.html` en el browser (club con datos reales,
   ej. MOI) y chequear a ojo la vista tocada: monta, muestra números, filtros andan.
4. **Commit** chico y atómico: un paso = un commit. Mensaje describiendo QUÉ se movió.

Si el smoke se pone rojo → **revertir el paso**, no parchear el test. El test es la verdad.

## Anti-flaky (mantener así)

- Fechas de fixture **relativas a hoy** (`_gps-fixtures.js`), nunca hardcodeadas.
- Datos **deterministas** (sin `Math.random`).
- Esperar contenido async con `expect.poll` / web-first assertions, **nunca** `waitForTimeout`
  como aserción.
- Correr 3× antes de confiar en un test nuevo: `npm run test:smoke` tres veces seguidas.

## Orden sugerido de extracción

- **Paso 0** — primitivos UI (`makePopover` / `makeModal` / `showToast`, ~120 líneas puras
  del bloque 1) → `lib/gp-ui/primitives.js`. El corte más chico y seguro; valida el enfoque.
- Luego, por responsabilidad, siempre lo más aislado primero.

## Deuda conocida

- **Código muerto**: barrer todo `GPS Analysis.html` y limpiar lo no usado (son muchísimas
  líneas). Hacerlo como paso propio, con la red de smoke como guardia.
- **12 tests del builder** en quarantine (`gps-builder.spec.js`, `test.fixme`): rescatar
  cuando se reescriba el harness de drag-and-drop del pantry.
