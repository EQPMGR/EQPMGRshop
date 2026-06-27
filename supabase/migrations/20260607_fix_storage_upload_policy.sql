BEGIN;

-- Refresh storage RLS policies for the uploads bucket.
ALTER TABLE IF EXISTS storage.objects
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own uploads" ON storage.objects;

CREATE POLICY "Allow authenticated users to insert their own uploads"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads' AND
    auth.role() = 'authenticated' AND
    auth.uid() IS NOT NULL AND
    path LIKE concat('logos/', auth.uid(), '%')
  );

CREATE POLICY "Allow authenticated users to update their own uploads"
  ON storage.objects
  FOR UPDATE
  WITH CHECK (
    bucket_id = 'uploads' AND
    auth.role() = 'authenticated' AND
    auth.uid() IS NOT NULL AND
    path LIKE concat('logos/', auth.uid(), '%')
  );

CREATE POLICY "Allow authenticated users to select their own uploads"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'uploads' AND
    auth.role() = 'authenticated' AND
    auth.uid() IS NOT NULL AND
    path LIKE concat('logos/', auth.uid(), '%')
  );

CREATE POLICY "Allow authenticated users to delete their own uploads"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'uploads' AND
    auth.role() = 'authenticated' AND
    auth.uid() IS NOT NULL AND
    path LIKE concat('logos/', auth.uid(), '%')
  );

COMMIT;
