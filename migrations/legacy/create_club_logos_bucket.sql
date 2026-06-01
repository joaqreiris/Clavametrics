-- Create public Supabase Storage bucket for club logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-logos',
  'club-logos',
  true,
  2097152,  -- 2 MB max
  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload/replace their club logo
DROP POLICY IF EXISTS "Club admins upload logos" ON storage.objects;
CREATE POLICY "Club admins upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-logos');

DROP POLICY IF EXISTS "Club admins replace logos" ON storage.objects;
CREATE POLICY "Club admins replace logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'club-logos');

-- Public can read logos (sidebar, mobile app, etc.)
DROP POLICY IF EXISTS "Public logo read" ON storage.objects;
CREATE POLICY "Public logo read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'club-logos');
