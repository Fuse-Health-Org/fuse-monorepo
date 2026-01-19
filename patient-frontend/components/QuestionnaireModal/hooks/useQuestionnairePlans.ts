import { useMemo, useEffect, useState } from "react";
import { PlanOption, QuestionnaireData } from "../types";

export function useQuestionnairePlans(
  questionnaire: QuestionnaireData | null,
  productPrice: number | undefined,
  productStripePriceId: string | undefined,
  productName: string | undefined,
  tenantProductId: string | undefined
) {
  const [selectedPlan, setSelectedPlan] = useState("monthly");

  // Build plans: prefer treatmentPlans; fallback to product (tenantProduct) pricing
  const plans = useMemo(() => {
    console.log('🎯 [PLANS] Building plans with:', {
      hasTreatmentPlans: !!(questionnaire as any)?.treatment?.treatmentPlans,
      treatmentPlansCount: (questionnaire as any)?.treatment?.treatmentPlans?.length || 0,
      productPrice,
      productStripePriceId,
      productName,
      tenantProductId
    });

    const fromTreatmentPlans = (questionnaire as any)?.treatment?.treatmentPlans as any[] | undefined;
    if (Array.isArray(fromTreatmentPlans) && fromTreatmentPlans.length > 0) {
      console.log('🎯 [PLANS] Using treatment plans');
      return fromTreatmentPlans
        .filter((plan: any) => plan.active)
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
        .map((plan: any) => ({
          id: plan.billingInterval,
          uuid: plan.id,
          name: plan.name,
          description: plan.description || `Billed ${plan.billingInterval}`,
          price: plan.price,
          badge: plan.popular ? "Most Popular" : undefined,
          badgeColor: plan.popular ? "success" as const : "primary" as const,
          stripePriceId: plan.stripePriceId,
          billingInterval: plan.billingInterval,
          features: [
            "Prescription medications included",
            "Expedited shipping",
            "HSA + FSA eligible",
            "Home delivery included"
          ]
        }));
    }

    // Fallback to single monthly plan using product price (stripePriceId is optional, backend will create if needed)
    if (typeof productPrice === 'number' && productPrice > 0) {
      console.log('🎯 [PLANS] Creating fallback product plan:', {
        price: productPrice,
        stripePriceId: productStripePriceId || 'will be created by backend',
        productName
      });
      return [{
        id: 'monthly',
        name: productName ? `${productName} Plan` : 'Monthly Plan',
        description: 'Billed monthly',
        price: productPrice,
        stripePriceId: productStripePriceId || undefined, // undefined is ok, backend will create
        billingInterval: 'monthly',
        features: [
          "Prescription medications included",
          "Expedited shipping",
          "HSA + FSA eligible",
          "Home delivery included"
        ]
      } as PlanOption];
    }

    console.log('⚠️ [PLANS] No plans available - no treatment plans and no valid product price');
    return [] as PlanOption[];
  }, [questionnaire?.treatment?.treatmentPlans, productPrice, productStripePriceId, productName, tenantProductId]);

  // Set default selected plan to first available plan
  useEffect(() => {
    console.log('🎯 Plan selection useEffect:', {
      plansLength: plans.length,
      selectedPlan,
      firstPlanId: plans[0]?.id,
      allPlans: plans.map(p => ({ id: p.id, name: p.name }))
    });

    if (plans.length > 0 && !selectedPlan) {
      console.log('🎯 Setting selectedPlan to first plan:', plans[0].id);
      setSelectedPlan(plans[0].id);
    }
  }, [plans, selectedPlan]);

  return { plans, selectedPlan, setSelectedPlan };
}

