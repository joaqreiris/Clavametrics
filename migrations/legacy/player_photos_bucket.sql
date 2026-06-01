-- Create player-photos storage bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-photos',
  'player-photos',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow club members to upload photos only under their own club_id folder
DROP POLICY IF EXISTS "Club members can upload player photos" ON storage.objects;
CREATE POLICY "Club members can upload player photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = (
      SELECT club_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow club members to update (overwrite) photos in their folder
DROP POLICY IF EXISTS "Club members can update player photos" ON storage.objects;
CREATE POLICY "Club members can update player photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = (
      SELECT club_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Public read for everyone (bucket is public)
DROP POLICY IF EXISTS "Public read player photos" ON storage.objects;
CREATE POLICY "Public read player photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'player-photos');
