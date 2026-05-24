# PLAN DE MIGRACIÓN CLAVAMETRICS - RESUMEN EJECUTIVO

**Fecha**: 19 de mayo de 2026  
**Versión**: 1.0  
**Estado**: Listo para revisión

---

## 🎯 Objetivo

Migrar esquema de base de datos de Clavametrics desde arquitectura antigua (multi-tabla, sin consolidación) hacia nueva arquitectura más simple y eficiente.

**Resultado esperado**: 
- ✅ Datos intactos y validados
- ✅ Schema nuevo funcional 100%
- ✅ Rollback plan listo para emergencias
- ✅ Sin pérdida de datos críticos

---

## 📊 Estadísticas de Impacto

| Métrica | Valor |
|---------|-------|
| Tablas que se mantienen | 8 (con cambios) |
| Tablas nuevas a crear | 2 |
| Tablas a deprecar | 15 |
| Columnas a renombrar | 4 |
| Columnas a agregar | 6 |
| Duración estimada | 4-6 horas |
| Riesgo general | 🔴 ALTO |
| Requiere downtime | ✅ SÍ (2-4 horas) |

---

## 🚨 Hallazgos Críticos

### ⚠️ 3 Decisiones Críticas Requeridas ANTES de Migración

#### 1️⃣ **Consolidación de Nutrición** (Destructiva)
- **Impacto**: 3 tablas complejas → 1 tabla simple
- **Pérdida**: goals, meal plans, body fat tracking, histórico
- **Decisión**: ¿Continuar o revisar schema nuevo?
- **Plazo**: 48 horas para decisión

#### 2️⃣ **Eliminación de Módulo Gym** (Sin Reemplazo)
- **Impacto**: gym_plans, gym_exercises, gym_groups desaparecen
- **Pérdida**: Funcionalidad de planificación de gimnasio
- **Decisión**: ¿Mantener tablas o realmente descontinuar?
- **Plazo**: 48 horas para decisión

#### 3️⃣ **Migración de GPS/Analytics** (Complejidad Alta)
- **Impacto**: Datos JSONB desorganizados → tabla estructurada
- **Riesgo**: 10-30% de registros pueden no matchear
- **Decisión**: ¿Aceptar pérdida de algunos registros?
- **Plazo**: Aceptar riesgos documentados en MIGRATION_RISKS.md

---

## 📁 Documentación Generada

| Documento | Propósito | Audiencia |
|-----------|-----------|-----------|
| [SCHEMA_COMPARISON.md](./SCHEMA_COMPARISON.md) | Análisis detallado de diferencias | Technical Architects |
| [MIGRATION_FORWARD.sql](./MIGRATION_FORWARD.sql) | Scripts de migración | DBAs |
| [MIGRATION_ROLLBACK.sql](./MIGRATION_ROLLBACK.sql) | Plan de reversión | DBAs |
| [MIGRATION_RISKS.md](./MIGRATION_RISKS.md) | Riesgos potenciales y mitigación | Leads técnicos |
| [ORDEN_MIGRACION.md](./ORDEN_MIGRACION.md) | Secuencia paso a paso | Ops team |
| **PLAN_MIGRACION_EJECUTIVO.md** | Este archivo | Stakeholders |

---

## 🔄 Flujo de Ejecución

```
┌─────────────────────────────────────────────────┐
│ PRE-MIGRACIÓN (Día anterior)                   │
├─────────────────────────────────────────────────┤
│ ✓ Backup completo de BD                        │
│ ✓ Validación de integridad                     │
│ ✓ Backups de tablas críticas (CSV)             │
│ ✓ Notificación a equipo + clubs               │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ FASE 1: Validación Pre-Flight (5 min)          │
├─────────────────────────────────────────────────┤
│ ✓ Conexión a BD verificada                     │
│ ✓ Estadísticas pre-migración obtenidas         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ FASE 2: Preparación (15 min)                   │
├─────────────────────────────────────────────────┤
│ • ALTER TABLE: Agregar columnas nuevas         │
│ • CREATE TABLE: rpe, gps_reports, nutrition   │
│ • CREATE INDEXES: Optimización                 │
│ • CREATE POLICIES: RLS                         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ FASE 3: Migración de Datos (90-120 min) 🔴     │
├─────────────────────────────────────────────────┤
│ 3.1: availability → players.status (1 min)    │
│ 3.2: rpe_sessions → rpe (5 min)               │
│ 3.3: athlete_sessions → gps_reports (80 min)  │  ← MÁS LENTO
│ 3.4: evaluations normalize (5 min)            │
│ 3.5: nutrition backup (5 min)                 │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ FASE 4: Validación Post-Migración (20 min)    │
├─────────────────────────────────────────────────┤
│ ✓ Integridad referencial                      │
│ ✓ Conteos de registros                        │
│ ✓ Performance de queries                      │
│ ✓ RLS funcionando correctamente               │
│ ✓ VACUUM + ANALYZE                            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ FASE 5: Deprecación (Día siguiente)           │
├─────────────────────────────────────────────────┤
│ ✓ Rename tablas antiguas a _deprecated        │
│ ✓ Monitoreo 24h                               │
│ ✓ Confirmación de aplicación funcionando      │
│ ✓ DROP tablas antiguas (DESPUÉS de testing)  │
└─────────────────────────────────────────────────┘
```

---

## 📋 Checklist CRÍTICO Antes de Ejecutar

**Responder "SÍ" a todas antes de proceder**:

### Datos y Backups
- [ ] ¿Se hizo backup completo de BD vía Supabase?
- [ ] ¿Se exportaron CSV de todas las tablas críticas?
- [ ] ¿Se verificó integridad referencial (sin orphan records)?

### Decisiones de Negocio
- [ ] ¿Se decidió si consolidar nutrition?
- [ ] ¿Se decidió si mantener o eliminar gym tables?
- [ ] ¿Se documentó riesgos de GPS/analytics unmatched?

### Actualización de Código
- [ ] ¿Se actualizó aplicación para nuevos nombres de columnas?
- [ ] ¿Se actualizó queries que referenciaban tablas eliminadas?
- [ ] ¿Se crearon vistas de compatibilidad (si es necesario)?

### Comunicación
- [ ] ¿Se notificó a equipo dev?
- [ ] ¿Se notificó a equipo ops?
- [ ] ¿Se notificó a clubs sobre downtime?
- [ ] ¿Se actualizó status page?

### Testing
- [ ] ¿Se verificó scripts en ambiente de staging?
- [ ] ¿Se verificó rollback scripts en staging?
- [ ] ¿Se hizo smoke tests de queries críticas?

---

## ⏰ Ventana Recomendada para Migración

**MEJOR**: 
- Fin de semana (viernes 22:00 - domingo 06:00)
- Fuera de temporada activa de clubs
- Cuando máximo de clubs están en break

**EVITAR**:
- Lunes-viernes durante 06:00-22:00 (horario activo)
- Semana de matches importantes
- Período de competiciones

**Duración**: 4-6 horas de downtime total

---

## 🎓 Capacitación Requerida

### Para DBAs
- [ ] Leer MIGRATION_FORWARD.sql
- [ ] Leer MIGRATION_ROLLBACK.sql
- [ ] Practicar en ambiente de staging
- [ ] Entender cada fase de ORDEN_MIGRACION.md

### Para Ops Team
- [ ] Leer ORDEN_MIGRACION.md
- [ ] Entender monitoreo durante migración
- [ ] Saber ejecutar rollback inmediato si hay issue
- [ ] Plan de comunicación con usuarios

### Para Dev Team
- [ ] Leer SCHEMA_COMPARISON.md (sección cambios de columnas)
- [ ] Actualizar queries que referenciaban nombres antiguos
- [ ] Actualizar código para nuevas tablas (rpe, gps_reports, nutrition)
- [ ] Verificar RLS policies en aplicación

---

## 🚀 Go/No-Go Decision

### Go si:
✅ Todas las decisiones críticas tomadas  
✅ Backups completados  
✅ Código actualizado  
✅ Testing completado  
✅ Equipo listo  

### No-Go si:
❌ Decisiones pendientes  
❌ Falta backup  
❌ Código no actualizado  
❌ Descubrieron orphan records  
❌ Issues en staging  

---

## 📞 Plan de Escalamiento

### Si migración falla:
1. **Inmediato** (0-5 min): STOP - Ejecutar rollback SQL
2. **5-10 min**: Validar que rollback fue exitoso
3. **10-15 min**: Notificar stakeholders
4. **15-30 min**: Analizar qué salió mal
5. **+30 min**: Agendar próximo intento (después de investigación)

### Escalamiento:
- DBA ON-CALL: [Nombre]
- Tech Lead: [Nombre]
- Product Owner: [Nombre]

---

## 💾 Tablas Críticas por Prioridad

### TIER 1 (Pérdida = Crítica)
- `players` - Base de toda la aplicación
- `wellness` - Datos diarios esenciales
- `training_sessions` - Core de plataforma

### TIER 2 (Pérdida = Alta)
- `injuries` - Tracking médico
- `rpe` - Monitoreo de carga
- `gps_reports` - Analytics de performance

### TIER 3 (Pérdida = Media)
- `evaluations` - Tests periódicos
- `nutrition` - Guidance nutricional

### TIER 4 (Descontinuada = OK)
- `gym_*` - Módulo descontinuado
- `messages` - Chat descontinuado
- `tasks` - Tasks descontinuado

---

## 📊 Métricas de Éxito Post-Migración

| Métrica | Target | Validación |
|---------|--------|-----------|
| Uptime de aplicación | 99.9% | Monitoreo 48h |
| Query latency | <500ms (p95) | EXPLAIN ANALYZE |
| Recordcount consistency | 100% | Comparación pre/post |
| Orphan records | 0 | Validación referencial |
| RLS funcionando | ✓ | Test de queries por club |
| No errors en logs | ✓ | Scan de logs |

---

## 🔗 Referencias

**Documentación Técnica**:
- [Análisis Detallado](./SCHEMA_COMPARISON.md)
- [Scripts SQL](./MIGRATION_FORWARD.sql)
- [Rollback Plan](./MIGRATION_ROLLBACK.sql)
- [Riesgos y Mitigación](./MIGRATION_RISKS.md)
- [Secuencia Paso a Paso](./ORDEN_MIGRACION.md)

**Archivos de Respaldo**:
- Backups en: `/backups/pre_migration_*.csv`
- Agente especializado: `./.agent.md`

---

## ✅ Próximos Pasos

1. **Revisar** este documento (1 día)
2. **Tomar decisiones** críticas (2 días)
3. **Comunicar** a equipo (1 día)
4. **Testing en staging** (2-3 días)
5. **Agendar migración** (confirmar ventana)
6. **Ejecutar migración** (4-6 horas downtime)
7. **Monitoreo post** (48 horas intensivo)

---

## 📝 Firma y Aprobación

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| Tech Lead | | | |
| DBA Lead | | | |
| Product Owner | | | |
| CTO/Director | | | |

---

**Versión**: 1.0  
**Última actualización**: 19 de mayo de 2026  
**Próxima revisión**: [Después de testing en staging]

