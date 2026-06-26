-- ============================================================
-- 042 — GPS Builder: RBAC para dashboards
--
-- Reglas:
--   VIEW    → cualquier miembro del club
--   INSERT  → cualquier miembro del club
--   UPDATE  → creador del dashboard  O  admin/coach
--   DELETE  → creador del dashboard  O  admin/coach
--
-- Los dashboards "is_shared = true" (los 5 por defecto)
-- tienen created_by = null, así que solo admin/coach los puede borrar.
-- ============================================================

-- Reemplazar la policy única "FOR ALL" por policies granulares

DROP POLICY IF EXISTS "club members manage dashboards" ON dashboards;

CREATE POLICY "club members view dashboards"
  ON dashboards FOR SELECT TO authenticated
  USING (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "club members create dashboards"
  ON dashboards FOR INSERT TO authenticated
  WITH CHECK (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "creator or staff update dashboards"
  ON dashboards FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'coach')
  )
  WITH CHECK (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "creator or staff delete dashboards"
  ON dashboards FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'coach')
  );

-- dashboard_cards: cualquier miembro puede gestionar (la
-- restricción de "quién puede editar" se ejerce a nivel de dashboard)
DROP POLICY IF EXISTS "club members manage dashboard cards" ON dashboard_cards;

CREATE POLICY "club members manage dashboard cards"
  ON dashboard_cards FOR ALL TO authenticated
  USING (
    dashboard_id IN (
      SELECT id FROM dashboards
      WHERE club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );
