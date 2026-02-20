-- Update platform fees and merchant service fees per tier
-- Merchant fee: 2% across all tiers
-- Platform (Fuse) fee: 80% for Starter Trial (entry), 30% for Growth (standard)
-- Safe to run multiple times

BEGIN;

-- Ensure merchantServiceFeePercent column exists (Sequelize sync may not have run yet)
ALTER TABLE public."TierConfiguration"
  ADD COLUMN IF NOT EXISTS "merchantServiceFeePercent" NUMERIC(5,2) DEFAULT NULL;

UPDATE public."TierConfiguration" tc
SET
  "merchantServiceFeePercent" = 2,
  "fuseFeePercent" = CASE
    WHEN bsp."planType" = 'entry'    THEN 80   -- Starter Trial
    WHEN bsp."planType" = 'standard' THEN 30   -- Growth
    ELSE tc."fuseFeePercent"
  END,
  "updatedAt" = NOW()
FROM public."BrandSubscriptionPlans" bsp
WHERE tc."brandSubscriptionPlanId" = bsp."id"
  AND bsp."planType" IN ('entry', 'standard');

COMMIT;

-- Verify
SELECT
  bsp."planType",
  bsp."name",
  tc."fuseFeePercent",
  tc."merchantServiceFeePercent"
FROM public."TierConfiguration" tc
JOIN public."BrandSubscriptionPlans" bsp ON bsp."id" = tc."brandSubscriptionPlanId"
WHERE bsp."planType" IN ('entry', 'standard')
ORDER BY bsp."sortOrder";
