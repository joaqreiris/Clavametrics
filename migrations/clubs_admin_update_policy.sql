-- Allow club admins and owners to update their own club record
DROP POLICY IF EXISTS "admin can update own club" ON clubs;
CREATE POLICY "admin can update own club"
  ON clubs FOR UPDATE
  USING (
    id IN (
      SELECT club_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );
