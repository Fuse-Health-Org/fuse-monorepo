-- Align BrandSubscriptionPlans + TierConfiguration with the "image 1" pricing card design
-- Safe to run multiple times

BEGIN;

-- 1) Core plan card content (name/description/pricing cadence)
UPDATE public."BrandSubscriptionPlans"
SET
  "name" = CASE
    WHEN "planType" = 'entry' THEN 'Starter'
    WHEN "planType" = 'standard' THEN 'Growth'
    WHEN "planType" = 'premium' THEN 'Pro'
    ELSE "name"
  END,
  "description" = CASE
    WHEN "planType" = 'entry' THEN 'Get started with the essentials to launch and test the platform with no upfront cost.'
    WHEN "planType" = 'standard' THEN 'Get started with the essentials to launch and test the platform with no upfront cost.'
    WHEN "planType" = 'premium' THEN 'Get started with the essentials to launch and test the platform with no upfront cost.'
    ELSE "description"
  END,
  -- monthlyPrice is your regular monthly price (used as "strikethrough" when intro exists)
  "monthlyPrice" = CASE
    WHEN "planType" = 'entry' THEN 100
    WHEN "planType" = 'standard' THEN 700
    WHEN "planType" = 'premium' THEN 3000
    ELSE "monthlyPrice"
  END,
  -- Intro pricing (used by modal and checkout flow)
  "introMonthlyPrice" = CASE
    WHEN "planType" = 'entry' THEN 0
    WHEN "planType" = 'standard' THEN 275
    WHEN "planType" = 'premium' THEN NULL
    ELSE "introMonthlyPrice"
  END,
  "introMonthlyPriceDurationMonths" = CASE
    WHEN "planType" = 'entry' THEN 2
    WHEN "planType" = 'standard' THEN 2
    WHEN "planType" = 'premium' THEN NULL
    ELSE "introMonthlyPriceDurationMonths"
  END,
  "sortOrder" = CASE
    WHEN "planType" = 'entry' THEN 1
    WHEN "planType" = 'standard' THEN 2
    WHEN "planType" = 'premium' THEN 3
    ELSE "sortOrder"
  END,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "planType" IN ('entry', 'standard', 'premium');

-- 2) Ensure TierConfiguration rows exist for each visible plan
INSERT INTO public."TierConfiguration" (
  "brandSubscriptionPlanId",
  "canAddCustomProducts",
  "hasAccessToAnalytics",
  "canUploadCustomProductImages",
  "hasCustomPortal",
  "hasPrograms",
  "canCustomizeFormStructure",
  "customTierCardText",
  "isCustomTierCardTextActive",
  "fuseFeePercent",
  "createdAt",
  "updatedAt"
)
SELECT
  bsp."id",
  false,
  false,
  false,
  false,
  false,
  false,
  '[]'::jsonb,
  true,
  CASE
    WHEN bsp."planType" = 'entry' THEN 40
    WHEN bsp."planType" = 'standard' THEN 17
    WHEN bsp."planType" = 'premium' THEN 5
    ELSE NULL
  END,
  NOW(),
  NOW()
FROM public."BrandSubscriptionPlans" bsp
LEFT JOIN public."TierConfiguration" tc
  ON tc."brandSubscriptionPlanId" = bsp."id"
 AND tc."deletedAt" IS NULL
WHERE bsp."planType" IN ('entry', 'standard', 'premium')
  AND tc."id" IS NULL;

-- 3) Update custom bullet lists + transaction fee so cards match image 1
UPDATE public."TierConfiguration" tc
SET
  "customTierCardText" = CASE
    WHEN bsp."planType" = 'entry' THEN to_jsonb(ARRAY[
      'Sell peptides legally across all 50 states',
      'Instant branded website & patient portal',
      'HIPAA-compliant intake & checkout',
      'Wholesale peptide pricing access',
      'Clinician async & sync consultations',
      'Built-in recurring revenue model'
    ])
    WHEN bsp."planType" = 'standard' THEN to_jsonb(ARRAY[
      'Everything in Free',
      'Fully branded patient experience',
      'Wholesale peptide pricing access',
      'Predictable monthly revenue setup',
      'Faster go-to-market for clinics'
    ])
    WHEN bsp."planType" = 'premium' THEN to_jsonb(ARRAY[
      'Everything in Starter',
      'Custom peptide protocol requests',
      'Affiliate portals (+$100 per affiliate)',
      'Remove Fuse Health watermark',
      'Designed for scale & multi-provider teams'
    ])
    ELSE tc."customTierCardText"
  END,
  "isCustomTierCardTextActive" = true,
  "fuseFeePercent" = CASE
    WHEN bsp."planType" = 'entry' THEN 40
    WHEN bsp."planType" = 'standard' THEN 17
    WHEN bsp."planType" = 'premium' THEN 5
    ELSE tc."fuseFeePercent"
  END,
  "updatedAt" = NOW()
FROM public."BrandSubscriptionPlans" bsp
WHERE tc."brandSubscriptionPlanId" = bsp."id"
  AND bsp."planType" IN ('entry', 'standard', 'premium');

COMMIT;

-- Optional verification
-- SELECT "planType","name","monthlyPrice","introMonthlyPrice","introMonthlyPriceDurationMonths","introMonthlyPriceStripeId","sortOrder"
-- FROM public."BrandSubscriptionPlans"
-- WHERE "planType" IN ('entry','standard','premium')
-- ORDER BY "sortOrder";
--
-- SELECT bsp."planType", tc."fuseFeePercent", tc."isCustomTierCardTextActive", tc."customTierCardText"
-- FROM public."TierConfiguration" tc
-- JOIN public."BrandSubscriptionPlans" bsp ON bsp."id" = tc."brandSubscriptionPlanId"
-- WHERE bsp."planType" IN ('entry','standard','premium')
-- ORDER BY bsp."sortOrder";
