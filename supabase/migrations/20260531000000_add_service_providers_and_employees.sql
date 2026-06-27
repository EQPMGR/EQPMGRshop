BEGIN;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS shop_name text,
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS services jsonb,
  ADD COLUMN IF NOT EXISTS geohash text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

CREATE TABLE IF NOT EXISTS public.service_providers (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  shop_name text,
  address text,
  street_address text,
  city text,
  state text,
  country text,
  postal_code text,
  phone text,
  services jsonb,
  geohash text,
  lat numeric,
  lng numeric,
  website text,
  logo_url text,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employees (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'Staff',
  shop_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_shop_id ON public.employees (shop_id);
CREATE INDEX IF NOT EXISTS idx_service_providers_owner_id ON public.service_providers (owner_id);

COMMIT;
