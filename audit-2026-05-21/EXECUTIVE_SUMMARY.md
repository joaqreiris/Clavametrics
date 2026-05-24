# RESUMEN EJECUTIVO — Auditoría ClavaMetrics
**Fecha:** 2026-05-21  
**Clasificación:** Documento de dirección técnica

---

## ESTADO REAL DEL PROYECTO

ClavaMetrics es una aplicación de gestión deportiva multi-módulo construida como HTML plano + Vanilla JS + Supabase. Tiene 20 módulos con UI funcional y diseño sólido, pero con una brecha significativa entre lo que parece funcionar y lo que realmente funciona.

**Veredicto honesto:** El proyecto es un excelente prototipo visual que ha comenzado a convertirse en producto real. Pero todavía existe un volumen considerable de "teatro de software" — interfaces que transmiten funcionalidad sin tenerla.

---

## MÉTRICAS CLAVE DE LA AUDITORÍA

| Métrica | Valor |
|---------|-------|
| Total issues detectados | 152 |
| Issues CRÍTICOS | 10 (7%) |
| Issues HIGH | 48 (32%) |
| Issues MEDIUM | 68 (45%) |
| Issues LOW | 26 (17%) |
| Archivos auditados | 20 HTML + 5 assets |
| Líneas de código revisadas | ~800,000+ chars |

---

## PORCENTAJE REAL DE FUNCIONALIDAD

| Módulo | Funcional | Fake/Roto | Estado |
|--------|-----------|-----------|--------|
| Login | 50% | 50% | Google OAuth roto, registro falla |
| Hub | 65% | 35% | Datos cargan pero con HTML fake de fallback |
| Calendar | 25% | 75% | Season ribbon, matches, upcoming = todo fake |
| Chat & Tasks | 40% | 60% | Mensajes básicos; filtros, kanban, toolbar muertos |
| Daily Planning | 20% | 80% | Squad y ejercicios completamente hardcodeados |
| Planner | 10% | 90% | Editor tácticamente no funcional |
| Squad | 70% | 30% | Carga bien, counts hardcodeados |
| Wellness | 75% | 25% | Form funciona, defaults hardcodeados |
| Injuries | 60% | 40% | Body map y type breakdown hardcodeados |
| Load Monitor | 45% | 55% | ACWR chart = SVG estático |
| GPS Analysis | 35% | 65% | Datos cargan, todos los charts hardcodeados |
| Availability | 60% | 40% | Grid carga, KPIs hardcodeados |
| Sessions History | 50% | 50% | Carga bien, filtros CSS-only, dupSess vacío |
| Sessions Library | 50% | 50% | Carga bien, filtros y vistas CSS-only |
| Evaluations | 40% | 60% | Tabs no cambian vista, scores hardcodeados |
| Nutrition | 70% | 30% | Macro targets hardcodeados |
| Physio | 30% | 70% | Save treatment no existe, body zones nunca persisten |
| Match Reports | 55% | 45% | GPS carga, shot map y key stats hardcodeados |
| RPE | 70% | 30% | Form funciona, chips y success state hardcodeados |
| Admin | 30% | 70% | Members cargan, org/clubs/toggles todos hardcodeados |
| Gym Library | 55% | 45% | Exercises cargan, filtros CSS-only |
| Gym Planner | 20% | 80% | Todo hardcodeado, sin save |
| Onboarding | 40% | 60% | Solo guarda nombre del club |

### Promedio global

| Categoría | % |
|-----------|---|
| **Features realmente funcionales** | **~45%** |
| **Features visuales/fake** | **~55%** |

---

## DEUDA TÉCNICA

### Nivel: ALTO-MEDIO

El proyecto tiene deuda técnica significativa pero manejable. No es un proyecto roto — tiene cimientos sólidos (Supabase correctamente configurado, autenticación parcialmente funcional, diseño consistente). La deuda está concentrada en:

1. **HTML de demo no eliminado** — el problema más fácil de resolver y el más impactante visualmente
2. **Features implementadas a medias** — hay código de fetch pero sin renderizado real (Calendar ribbon)
3. **Features totalmente no implementadas** — canvas del Planner, save del Physio, Onboarding incompleto
4. **Auth rota** — el camino crítico del producto tiene bugs que bloquean el acceso

### Índice de deuda por categoría

| Categoría | Score (1-10, 10=máxima deuda) |
|-----------|-------------------------------|
| Datos hardcodeados | 9 |
| Botones muertos | 8 |
| Features parciales | 7 |
| Auth/Backend rota | 6 |
| Arquitectura | 3 |
| CSS/UI | 2 |

---

## PRINCIPALES RIESGOS PARA PRODUCCIÓN

### RIESGO 1 — CRÍTICO: Usuarios no pueden registrarse
"Database error saving new user" bloquea el onboarding completo para nuevos usuarios. Si alguien intenta hacer signup con email en producción, falla.

### RIESGO 2 — CRÍTICO: Google OAuth no funciona
Ambas páginas (Login y Register) tienen el botón de Google roto. En 2026, el 60-80% de los usuarios esperan poder usar Google. Esta es una barrera de conversión enorme.

### RIESGO 3 — ALTO: Datos falsos en Calendar confunden usuarios reales
Cuando un entrenador real ingrese al Calendar, verá microciclos y partidos contra "Boca", "River", "Banfield" que no existen en su calendario real. Esto destroza la credibilidad inmediatamente.

### RIESGO 4 — ALTO: Physio no guarda tratamientos
Un médico registra tratamientos que nunca se persisten en DB. Silencioso y peligroso — especialmente en contexto de health data.

### RIESGO 5 — ALTO: Onboarding pierde datos
Al crear un club, solo se guarda el nombre. Categorías, ciudad, timezone y plan se pierden silenciosamente.

### RIESGO 6 — MEDIO: Planner no persiste cambios
Cualquier trabajo táctico creado en el Planner se pierde al recargar la página.

### RIESGO 7 — MEDIO: Filtros que no filtran
Los usuarios hacen click en "Mine" en tasks y no ven solo sus tareas. Esto genera confusión y desconfianza en la plataforma.

---

## PRIORIDAD ABSOLUTA DE REFACTOR

```
SEMANA 1:
  1. Fix Google OAuth (auth-callback.html + Supabase config)
  2. Fix registro email ("Database error" → debug trigger + RLS)
  3. Eliminar HTML demo de Calendar (ribbon, matches, upcoming)
  4. Eliminar HTML demo de Hub (activity, tasks)
  5. Implementar saveTreatment() en Physio
  6. Extender saveAndContinue() en Onboarding

SEMANA 2:
  7. Conectar season ribbon a datos de DB
  8. Implementar upcoming events desde training_sessions
  9. Conectar filtros en Sessions History
  10. Conectar filtros en Chat & Tasks
  11. Fix "+ Add task" en Hub (handler incorrecto)
  12. Conectar Admin org bar y clubs grid a DB real

SEMANA 3-4:
  13. Daily Planning: squad + exercises desde DB
  14. Admin module toggles con persistencia
  15. GPS Analysis: radar chart con datos reales
  16. Load Monitor: ACWR chart con datos reales
  17. Evaluations: tabs funcionales

SEMANA 5+:
  18. Planner: implementar Fabric.js para canvas editing
  19. Planner: save/load drill objects desde DB
  20. Chat: canales desde DB, drag-and-drop kanban
```

---

## ARQUITECTURA RECOMENDADA

### Mantener (es correcto)
- **Supabase** como backend — bien integrado, RLS correctamente pensado
- **HTML + Vanilla JS** — apropiado para este tipo de app sin framework overhead
- **Estructura modular** — cada módulo en su propio HTML es correcto para este scope
- **supabase-init.js como singleton** — buen patrón, mantener y no duplicar

### Mejorar inmediatamente
- **Eliminar HTML de demo** en todos los archivos — reemplazar por skeletons
- **Agregar error states** — si un fetch falla, mostrar mensaje en vez de loader infinito
- **Consolidar queries repetidas** — Hub hace múltiples queries individuales que se podrían consolidar

### Agregar
- **Fabric.js** para el Planner editor (no construir desde cero)
- **Chart.js** para todos los charts (actualmente SVG estático en 5+ módulos)
- **Manejo de errores global** — un handler que muestre toast de error en cualquier fetch que falle

### No hacer
- No migrar a React/Next.js — sería una reescritura completa sin beneficio claro para el scope
- No agregar más features hasta que las existentes funcionen realmente
- No usar más librerías externas que Fabric.js y Chart.js

---

## VIABILIDAD DE ESCALAR

### Positivo
- Supabase escala horizontalmente sin cambios de código
- RLS policies garantizan multi-tenancy correcto
- Arquitectura sin estado en el frontend es resiliente
- El diseño visual es profesional y consistente

### Negativo / Riesgos de escala
- Múltiples queries waterfall en Hub (cargar primero, luego cada KPI, luego activity) → riesgo de latencia visible en prod
- Sin paginación en tablas grandes (squad, sessions history) — hardcodeado "27 players"
- Sin caché de ningún tipo — cada navegación recarga todo desde Supabase
- Canvas del Planner no escalará sin librería dedicada

### Recomendación de viabilidad
**SÍ es viable escalar**, con estas precondiciones:
1. Auth funciona correctamente (Fase 1 del plan)
2. HTML demo eliminado (Fase 2)
3. Al menos 60% de features conectadas a DB real
4. Chart.js reemplaza todos los SVG hardcodeados

El proyecto puede pasar de prototipo avanzado a producto en producción en 6-8 semanas de trabajo enfocado siguiendo el PHASED_REFACTOR_PLAN.md.

---

## ARCHIVOS GENERADOS EN ESTA AUDITORÍA

| Archivo | Contenido |
|---------|-----------|
| `AUDIT_REPORT.md` | 152 issues detallados con archivo, línea, tipo, severidad y solución |
| `HARDCODED_DATA_REPORT.md` | 50 elementos hardcodeados clasificados por tier de impacto |
| `UI_FAKE_INTERACTIONS_REPORT.md` | 58 interacciones UI fake categorizadas |
| `DEAD_CODE_REPORT.md` | Archivos legacy, funciones vacías, HTML demo, código de demostración |
| `BACKEND_CONNECTION_REPORT.md` | Estado de conexión real por feature y tabla de Supabase |
| `PHASED_REFACTOR_PLAN.md` | Plan detallado con código de ejemplo, dependencias y estimación |
| `EXECUTIVE_SUMMARY.md` | Este documento |
