-- Add customMerchantServiceFeePercent column to BrandSubscription table
-- This column allows a per-brand negotiated merchant service fee override
-- that takes precedence over the tier-level merchantServiceFeePercent.
-- Safe to run multiple times (uses IF NOT EXISTS).

BEGIN;

ALTER TABLE public."BrandSubscription"
  ADD COLUMN IF NOT EXISTS "customMerchantServiceFeePercent" NUMERIC(5,2) DEFAULT NULL;

COMMENT ON COLUMN public."BrandSubscription"."customMerchantServiceFeePercent"
  IS 'Per-brand negotiated merchant service fee percent override (e.g. 1.5 = 1.5%). Overrides tier-level merchantServiceFeePercent when set.';

COMMIT;

-- Verify
SELECT
  id,
  "userId",
  "planType",
  "customMerchantServiceFeePercent"
FROM public."BrandSubscription"
LIMIT 5;
