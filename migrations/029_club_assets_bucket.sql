-- Migration 028: club-assets Storage bucket
-- Used by: Calendar (opponent crests), Lineup (opponent crests)
-- Path convention: opponent-crests/{club_id}/{slug}.{ext}
-- Idempotent.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-assets',
  'club-assets',
  true,
  2097152, -- 2 MB
  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated staff can upload files only under their own club_id folder
DROP POLICY IF EXISTS "Club members upload club assets" ON storage.objects;
CREATE POLICY "Club members upload club assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-assets'
    AND (storage.foldername(name))[2] = (
      SELECT club_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Authenticated staff can overwrite files in their club folder
DROP POLICY IF EXISTS "Club members update club assets" ON storage.objects;
CREATE POLICY "Club members update club assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-assets'
    AND (storage.foldername(name))[2] = (
      SELECT club_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Public read (bucket is public — crests shown on shared views and lineup posters)
DROP POLICY IF EXISTS "Public read club assets" ON storage.objects;
CREATE POLICY "Public read club assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'club-assets');
