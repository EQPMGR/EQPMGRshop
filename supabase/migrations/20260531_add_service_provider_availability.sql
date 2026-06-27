BEGIN;

ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS availability text DEFAULT 'Today',
  ADD COLUMN IF NOT EXISTS drop_off boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS valet_service boolean DEFAULT false;

COMMIT;
