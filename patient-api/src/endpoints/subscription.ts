import { Express } from 'express';
import BrandSubscription, { BrandSubscriptionStatus } from '../models/BrandSubscription';
import BrandSubscriptionPlans from '../models/BrandSubscriptionPlans';
import TenantCustomFeatures from '../models/TenantCustomFeatures';
import TierConfiguration from '../models/TierConfiguration';

export function registerSubscriptionEndpoints(app: Express, authenticateJWT: any, getCurrentUser: any) {
  
  // Get current subscription
  app.get("/subscriptions/current", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      console.log('🔍 [Subscription] Fetching for user:', currentUser.id);

    const subscription = await BrandSubscription.findOne({
      where: { userId: currentUser.id, status: BrandSubscriptionStatus.ACTIVE },
      order: [['createdAt', 'DESC']]
    });

    // Get custom features (always fetch, even without active subscription)
    const customFeatures = await TenantCustomFeatures.findOne({
      where: { userId: currentUser.id }
    });
    
    console.log('🎨 [Subscription] Custom features:', customFeatures ? customFeatures.toJSON() : null);

    if (!subscription) {
      console.log('⚠️ [Subscription] No active subscription found');
      // Still return custom features even without active subscription
      if (customFeatures) {
        return res.json({
          id: null,
          status: null,
          plan: null,
          customFeatures: customFeatures.toJSON(),
          tierConfig: null
        });
      }
      return res.json(null);
    }

      console.log('📋 [Subscription] Found subscription:', {
        id: subscription.id,
        planType: subscription.planType,
        customMaxProducts: subscription.customMaxProducts,
        productsChanged: subscription.productsChangedAmountOnCurrentCycle
      });

      // Get plan details separately
      const plan = await BrandSubscriptionPlans.findOne({
        where: { planType: subscription.planType }
      });

      // Get tier configuration if plan exists
      let tierConfig: TierConfiguration | null = null;
      if (plan) {
        tierConfig = await TierConfiguration.findOne({
          where: { brandSubscriptionPlanId: plan.id }
        });
        console.log('🎯 [Subscription] Tier config:', tierConfig ? tierConfig.toJSON() : null);
      }

      if (!plan) {
        console.log('❌ [Subscription] No plan found with planType:', subscription.planType);
        // List all available plans for debugging
        const allPlans = await BrandSubscriptionPlans.findAll({
          attributes: ['id', 'planType', 'name', 'maxProducts', 'isActive']
        });
        console.log('📚 [Subscription] Available plans:', allPlans.map(p => ({
          planType: p.planType,
          name: p.name,
          maxProducts: p.maxProducts,
          isActive: p.isActive
        })));
      } else {
        console.log('📦 [Subscription] Found plan:', {
          id: plan.id,
          name: plan.name,
          planType: plan.planType,
          maxProducts: plan.maxProducts
        });
      }

      // Determine effective maxProducts (customMaxProducts overrides plan maxProducts)
      let effectiveMaxProducts = -1; // default to unlimited
      if (subscription.customMaxProducts !== null && subscription.customMaxProducts !== undefined) {
        effectiveMaxProducts = subscription.customMaxProducts;
        console.log('✅ [Subscription] Using customMaxProducts:', effectiveMaxProducts);
      } else if (plan && typeof plan.maxProducts === 'number') {
        effectiveMaxProducts = plan.maxProducts;
        console.log('✅ [Subscription] Using plan maxProducts:', effectiveMaxProducts);
      } else {
        console.log('⚠️ [Subscription] No max products found, defaulting to unlimited (-1)');
      }

      console.log('🎯 [Subscription] Effective maxProducts:', effectiveMaxProducts);

      // Resolve merchant service fee: per-brand override > tier default > 2 (system default)
      const resolvedMerchantServiceFeePercent =
        subscription.customMerchantServiceFeePercent != null
          ? Number(subscription.customMerchantServiceFeePercent)
          : tierConfig?.merchantServiceFeePercent != null
          ? Number(tierConfig.merchantServiceFeePercent)
          : 2;

      const responseData = {
      id: subscription.id,
      planId: plan?.id || null,
      status: subscription.status,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripePriceId: subscription.stripePriceId,
      plan: plan ? {
        name: plan.name,
        price: Number(plan.monthlyPrice),
        type: plan.planType,
        maxProducts: effectiveMaxProducts
      } : subscription.stripePriceId ? {
        name: subscription.planType,
        price: subscription.monthlyPrice ? Number(subscription.monthlyPrice) : 0,
        type: subscription.planType,
        priceId: subscription.stripePriceId,
        maxProducts: effectiveMaxProducts
      } : null,
      nextBillingDate: subscription.currentPeriodEnd || null,
      lastProductChangeAt: subscription.lastProductChangeAt || null,
      productsChangedAmountOnCurrentCycle: subscription.productsChangedAmountOnCurrentCycle || 0,
      retriedProductSelectionForCurrentCycle: !!(subscription as any).retriedProductSelectionForCurrentCycle,
      customMaxProducts: subscription.customMaxProducts,
      customMerchantServiceFeePercent: subscription.customMerchantServiceFeePercent ?? null,
      merchantServiceFeePercent: resolvedMerchantServiceFeePercent,
      customFeatures: customFeatures ? customFeatures.toJSON() : null,
      tierConfig: tierConfig ? tierConfig.toJSON() : null
    };

    console.log('📤 [Subscription] Sending response:', {
      productsChangedAmountOnCurrentCycle: responseData.productsChangedAmountOnCurrentCycle,
      retriedProductSelectionForCurrentCycle: responseData.retriedProductSelectionForCurrentCycle,
      maxProducts: responseData.plan?.maxProducts
    });

    res.json(responseData);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
}

