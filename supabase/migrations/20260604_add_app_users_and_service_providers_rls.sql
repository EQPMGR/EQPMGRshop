BEGIN;

-- Enable row-level security for app_users and service_providers.
ALTER TABLE IF EXISTS public.app_users
  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_users'
      AND policyname = 'Allow authenticated users to manage their own app_users record'
  ) THEN
    CREATE POLICY "Allow authenticated users to manage their own app_users record"
      ON public.app_users
      FOR ALL
      USING (auth.uid()::text = id::text)
      WITH CHECK (auth.uid()::text = id::text);
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.service_providers
  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_providers'
      AND policyname = 'Allow authenticated users to manage their own service_providers record'
  ) THEN
    CREATE POLICY "Allow authenticated users to manage their own service_providers record"
      ON public.service_providers
      FOR ALL
      USING (auth.uid()::text = id::text OR auth.uid()::text = owner_id::text)
      WITH CHECK (auth.uid()::text = id::text OR auth.uid()::text = owner_id::text);
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.employees
  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employees'
      AND policyname = 'Allow authenticated users to manage employees for their own shop'
  ) THEN
    CREATE POLICY "Allow authenticated users to manage employees for their own shop"
      ON public.employees
      FOR ALL
      USING (auth.uid()::text = shop_id::text)
      WITH CHECK (auth.uid()::text = shop_id::text);
  END IF;
END
$$;

COMMIT;
