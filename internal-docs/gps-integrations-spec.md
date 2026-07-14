# GPS Integrations — spec (API-ready)

## 1. Objetivo
Dejar ClavaMetrics preparado para ingestar datos de GPS vía API (Catapult / StatSports)
cuando el club lo autorice, para que se automatice la sincronización. La conexión es
**club-authorized**: el club es dueño de sus datos y autoriza el acceso; NO requiere que
ClavaMetrics firme un partnership con el proveedor.

## 2. Cómo accede cada proveedor
- **Catapult (OpenField):** API documentada (Connect / OpenField Cloud API). El club
  habilita el módulo "API Token Admin" (vía soporte Catapult), genera un token con scopes
  en OpenField Cloud → Settings → API Tokens, y lo pega en ClavaMetrics. Modelo PULL
  (ClavaMetrics tira los datos con el token). También soporta webhooks (push).
- **StatSports (Sonra):** En la plataforma de equipos, Share Data → Third-Party API: se
  agrega la integración de una lista y se genera una Key. Para aparecer en esa lista,
  ClavaMetrics debe ser dado de alta como tercero por el account manager del club. Modelo
  PUSH (el club comparte/envía sesiones). Sonra Cloud lo hace automático.

## 3. Honestidad de marketing
- Ofrecer "conectá tu cuenta" es legítimo SIN partnership (la relación es club↔proveedor).
- Usar las marcas "Catapult"/"StatSports" o "integración oficial" en marketing puede
  requerir su OK aparte. Construir/ofrecer = libre; ponerse la medalla de "oficial" = chequear.
- (Reemplaza la vieja regla "Catapult = no anunciar": el acceso técnico es club-authorized,
  documentado y abierto.)

## 4. Schema (migraciones 071 + 073)
- `gps_integrations` — 1 conexión por (club_id, provider). Metadata NO secreta (status,
  external_account_id, config jsonb, last_sync_at, last_error). RLS: el club gestiona la suya.
- `gps_integration_secrets` — la credencial (token/key), AISLADA. Sin acceso de cliente;
  solo service-role + las funciones SECURITY DEFINER. El token = contraseña.
- Funciones: `set_gps_credential(integration_id, credential)` (guarda + marca 'configured'),
  `clear_gps_credential(integration_id)` (borra secreto + marca 'disabled'). El cliente
  setea pero NUNCA lee la credencial de vuelta.

## 5. Mapeo de atletas
Reusa `players.external_gps_id` (ya existe, migración 028). El ID del jugador en el sistema
del proveedor. No se duplica nada. (Multi-proveedor simultáneo por club = extensión futura.)

## 6. Sin conflicto CSV ↔ API (deduplicación)
La base YA impide duplicar; NO hay que anular ninguna fuente:
- `gps_reports` tiene UNIQUE (player_id, session_id) → un jugador no puede tener dos filas
  en la misma sesión.
- `training_sessions` tiene UNIQUE (club_id, session_date, session_label, is_historical) →
  no hay dos sesiones iguales.
Regla para el handler de ingesta (futuro): **find-or-create** la sesión por su clave natural
y **upsert** del reporte por (player_id, session_id). CSV y API convergen en la misma fila.
⚠️ Ser CONSISTENTE con `is_historical` entre CSV y API (si difiere, serían sesiones distintas).
(Opcional futuro: columna `gps_reports.source` para trazabilidad de origen.)

## 7. Estados de la conexión
pending → configured (credencial guardada) → connected (validada por un handler real contra
la API) | error | disabled. "configured" ≠ "connected": connected solo cuando un handler
confirma que el token funciona.

## 8. Hecho vs pendiente
- HECHO: capa de conexión (tablas + funciones, mig 071/073) + panel "Integrations" en
  Admin.html (elegir proveedor, pegar token, ver estado, desconectar).
- PENDIENTE: handlers de ingesta reales (pull Catapult / endpoint StatSports), validación
  del token (configured → connected), sync automático, columna source. Se construyen cuando
  un club real quiera conectar (se necesita su token real para probar).

## 9. UI
Admin.html → tab "Integrations" (admin-only). Cards por proveedor con estado y conectar/desconectar.
