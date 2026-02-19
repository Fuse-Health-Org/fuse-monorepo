-- Add backgroundColor column to CustomWebsite table
-- Allows brands to set a custom page background color for their patient portal.
-- Safe to run multiple times (uses IF NOT EXISTS).

BEGIN;

ALTER TABLE public."CustomWebsite"
  ADD COLUMN IF NOT EXISTS "backgroundColor" VARCHAR(255) DEFAULT '#FFFFFF';

COMMENT ON COLUMN public."CustomWebsite"."backgroundColor"
  IS 'Hex color code for the portal page background (e.g. #FFFFFF). Defaults to white.';

COMMIT;

-- Verify
SELECT id, "clinicId", "primaryColor", "backgroundColor"
FROM public."CustomWebsite"
LIMIT 5;
