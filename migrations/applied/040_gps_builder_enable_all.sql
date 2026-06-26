-- ============================================================
-- 040 — GPS Builder: habilitar para todos los clubes
-- Cambia el default a true y activa los clubes existentes.
-- Rollback por club: UPDATE club_gps_settings
--   SET gps_builder_enabled = false WHERE club_id = '<id>';
-- ============================================================

-- 1. Cambiar el default para clubs nuevos
ALTER TABLE club_gps_settings
  ALTER COLUMN gps_builder_enabled SET DEFAULT true;

-- 2. Activar en todos los clubs que ya tienen fila
UPDATE club_gps_settings
  SET gps_builder_enabled = true;

-- 3. Insertar fila para clubs que aún no tienen settings
INSERT INTO club_gps_settings (club_id, gps_builder_enabled)
SELECT id, true
FROM clubs
WHERE id NOT IN (SELECT club_id FROM club_gps_settings)
ON CONFLICT (club_id) DO NOTHING;
