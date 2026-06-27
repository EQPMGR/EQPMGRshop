BEGIN;

-- Enable row-level security for Supabase storage objects.
ALTER TABLE IF EXISTS storage.objects
  ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upload or update only files in their own logos folder.
CREATE POLICY IF NOT EXISTS "Allow users to insert and update their own uploads"
  ON storage.objects
  FOR INSERT, UPDATE
  WITH CHECK (
    bucket_id = 'uploads' AND
    auth.uid() = split_part(path, '/', 2)
  );

-- Allow authenticated users to read their own uploads.
CREATE POLICY IF NOT EXISTS "Allow users to select their own uploads"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'uploads' AND
    auth.uid() = split_part(path, '/', 2)
  );

-- Allow authenticated users to delete their own uploads.
CREATE POLICY IF NOT EXISTS "Allow users to delete their own uploads"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'uploads' AND
    auth.uid() = split_part(path, '/', 2)
  );

COMMIT;
