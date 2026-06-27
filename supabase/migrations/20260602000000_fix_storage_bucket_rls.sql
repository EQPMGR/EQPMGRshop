BEGIN;

-- Refresh storage RLS for the uploads bucket with a stricter path match.
ALTER TABLE IF EXISTS storage.objects
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to insert and update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to select their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own uploads" ON storage.objects;

CREATE POLICY IF NOT EXISTS "Allow authenticated users to insert and update their own uploads"
  ON storage.objects
  FOR INSERT, UPDATE
  WITH CHECK (
    bucket_id = 'uploads' AND
    auth.role() = 'authenticated' AND
    auth.uid() IS NOT NULL AND
    path LIKE concat('logos/', auth.uid(), '/%')
  );

CREATE POLICY IF NOT EXISTS "Allow authenticated users to select their own uploads"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'uploads' AND
    auth.role() = 'authenticated' AND
    auth.uid() IS NOT NULL AND
    path LIKE concat('logos/', auth.uid(), '/%')
  );

CREATE POLICY IF NOT EXISTS "Allow authenticated users to delete their own uploads"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'uploads' AND
    auth.role() = 'authenticated' AND
    auth.uid() IS NOT NULL AND
    path LIKE concat('logos/', auth.uid(), '/%')
  );

COMMIT;
