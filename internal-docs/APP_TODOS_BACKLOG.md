# Backlog — cosas sin funcionar / a corregir

Registro vivo de items detectados que hay que arreglar más adelante. Se va
apendeando. No se sirve público (vive en `internal-docs/`, excluido en `.vercelignore`).

Formato por item: **qué** · dónde · evidencia · estado · acción.

---

## 1. Limpieza de código pendiente

### 1.1 console.log de diagnóstico ACWR sin quitar
- **Qué:** quedan 4 `console.warn('[ACWR DIAG] …')` de diagnóstico temporal.
- **Dónde:** `GPS Analysis.html` — 2 en `gpRenderScienceCards` (`enter`, `histSessions`) + el bloque `// TEMP DIAG (ACWR blank card)` con su `try/catch`.
- **Evidencia:** `grep -c "ACWR DIAG" "GPS Analysis.html"` → 4 en `lm-redesign-BADBASE`. Los introdujeron los commits `diag(temp)` (en `main`: `009af89`, `6fd1c37`; equivalentes a `f57ba21`, `f7ff78e`).
- **Estado:** el bug que investigaban ya está resuelto (`d32ce18` + `10c8ab3`). Los quité una vez, pero quedó **sin commitear** porque el árbol estaba en medio de un merge en `main` (se pidió "no more changes"). En esta rama siguen presentes.
- **Acción:** eliminar las 4 líneas `[ACWR DIAG]` (no tocar `console.error` de catch). Verificar que ACWR sigue renderizando.

---

## 2. Features de la app marcadas como TODO al documentar el centro de soporte (batch 2)

> Detectadas leyendo el código para escribir las páginas de `/support`. Son
> features que aparecen en la UI pero **no se pudo confirmar** que funcionen, o
> que están explícitamente "coming soon". Cada una quedó como bloque `> TODO`
> en el `.md` correspondiente.

### Daily Planning (`Daily Planning.html`)
- **2.1 Botón "Load template"** — está en el header de la sesión pero **sin handler visible**. No se pudo confirmar que existan/carguen plantillas de sesión. → verificar si la feature está implementada o es un stub.
- **2.2 "✓ Applied" en adaptación de fisio** — al clickear solo baja la opacidad de la card en la UI; **no se encontró persistencia**. → confirmar si registra algo (dismiss/ack) o es puro visual.

### Squad (`Squad.html`)
- **2.3 Columna "Joined"** — el header existe pero renderiza "—" para todos. → confirmar si falta cablear el campo de fecha o es feature pendiente.
- **2.4 Estado "modified"** — aparece como opción de status pero el campo está `disabled` en el modal. Uso/trigger poco claro. → definir qué significa y cómo se setea.

### Availability (`Availability.html`)
- **2.5 Vista "Today"** — el segmented control la muestra pero parece marcada "coming soon". → definir qué muestra vs. Matrix e implementar.
- **2.6 Botones "Filters" y "Group by"** — placeholders en el toolbar, sin handler activo. → implementar o quitar.
- **2.7 Atajos de teclado (A / P / I)** — mencionados en la leyenda; los listeners no parecen del todo cableados. → verificar/implementar.
- **2.8 Estado "Absent"** — solo aparece en el contexto de minutos de partido (0'). Su uso más amplio (p.ej. DNP) no está claro. → definir caso de uso.

### RPE (`RPE.html`)
- **2.9 Tendencia / histórico de carga por jugador** — hay un control en la card pero está como "coming soon". → implementar el trend por jugador.
- **2.10 Sin botón de export** — no se encontró export en esta página (los totales semanales / ACWR viven en Load Monitor). → confirmar si debería exportar o queda a propósito en Load Monitor.
