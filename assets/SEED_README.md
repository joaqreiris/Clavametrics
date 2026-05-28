# GPS Seed — ClavaMetrics

Genera 8 microciclos de datos GPS ficticios adaptados a los jugadores reales del club.

## Requisitos

- Node 18+
- Mínimo 10 jugadores activos en la DB
- `service_role_key` de Supabase (**nunca al repo**)

## Cómo correrlo

```bash
cd "Clava Metrics"
export SUPABASE_URL="https://xesrumijvdmqjrufgeka.supabase.co"
export SUPABASE_SERVICE_KEY="<service_role_key>"
node assets/gps-seed.mjs
```

La `service_role_key` está en: Supabase Dashboard → Project Settings → API → service_role.

## Qué inserta

- 8 microciclos retroactivos × 6 sesiones/MC = 48 `training_sessions` marcadas con `[SEED]`
- ~1 `gps_report` por jugador activo × sesión (perfiles de carga por posición + ruido gaussiano ±15%)
- 2 anomalías deliberadas para testear el dashboard (ACWR >1.5 y caída pre-injury)

## Revertir todo

```bash
node assets/gps-seed.mjs --rollback
```

O directo en SQL (Supabase Dashboard → SQL Editor):

```sql
DELETE FROM gps_reports
  WHERE session_id IN (SELECT id FROM training_sessions WHERE notes LIKE '[SEED]%');
DELETE FROM training_sessions WHERE notes LIKE '[SEED]%';
```
