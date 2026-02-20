-- Rename tier display names: entry→Trial, standard→Growth, premium→Pro
-- The planType column (internal identifier) is NOT changed.
-- The name column (display name shown in all UIs) is updated.
-- Safe to run multiple times.

BEGIN;

UPDATE public."BrandSubscriptionPlans"
SET
  "name" = CASE
    WHEN "planType" = 'entry'    THEN 'Trial'
    WHEN "planType" = 'standard' THEN 'Growth'
    WHEN "planType" = 'premium'  THEN 'Pro'
    ELSE "name"
  END,
  "updatedAt" = NOW()
WHERE "planType" IN ('entry', 'standard', 'premium');

COMMIT;

-- Verify
SELECT "planType", "name", "isActive", "sortOrder"
FROM public."BrandSubscriptionPlans"
WHERE "planType" IN ('entry', 'standard', 'premium')
ORDER BY "sortOrder";
