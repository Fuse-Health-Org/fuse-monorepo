import { Express } from "express";
import Stripe from "stripe";
import BrandSubscription, {
  BrandSubscriptionStatus,
} from "../models/BrandSubscription";
import BrandSubscriptionPlans from "../models/BrandSubscriptionPlans";
import TierConfiguration from "../models/TierConfiguration";
import User from "../models/User";
import UserRoles from "../models/UserRoles";
import Payment from "../models/Payment";
import BrandSubscriptionService from "../services/brandSubscription.service";
import UserService from "../services/user.service";
import {
  brandPaymentIntentSchema,
  updateBrandSubscriptionFeaturesSchema,
} from "@fuse/validators";

export function registerBrandSubscriptionsEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any,
  stripe: Stripe
) {
  const brandSubscriptionService = new BrandSubscriptionService();
  const userService = new UserService();

  // Get available subscription plans
  app.get("/brand-subscriptions/plans", async (req, res) => {
    try {
      const plans = await BrandSubscriptionPlans.getActivePlans();

      // Fetch tier configurations for all plans
      const formattedPlans = await Promise.all(
        plans.map(async (plan) => {
          const tierConfig = await TierConfiguration.findOne({
            where: { brandSubscriptionPlanId: plan.id },
          });

          return {
            id: plan.id,
            name: plan.name,
            description: plan.description || "",
            monthlyPrice: Number(plan.monthlyPrice),
            planType: plan.planType,
            stripePriceId: plan.stripePriceId,
            features: plan.getFeatures(),
            tierConfig: tierConfig ? tierConfig.toJSON() : null,
          };
        })
      );

      res.json({ success: true, plans: formattedPlans });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching subscription plans:", error);
      } else {
        console.error("❌ Error fetching subscription plans");
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscription plans",
      });
    }
  });

  // Get current user's brand subscription
  app.get("/brand-subscriptions/current", authenticateJWT, async (req, res) => {
    try {
      // Return successful response with no subscription (empty)
      return res.status(200).json({
        success: true,
        subscription: null,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching brand subscription:", error);
      } else {
        console.error("❌ Error fetching brand subscription");
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscription",
      });
    }
  });

  // Get basic subscription info (status, tutorialFinished, stripeCustomerId)
  app.get(
    "/brand-subscriptions/basic-info",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized",
          });
        }

        const subscriptionInfo =
          await brandSubscriptionService.getBasicSubscriptionInfo(currentUser.id);

        if (!subscriptionInfo) {
          return res.status(404).json({
            success: false,
            message: "No subscription found",
          });
        }

        return res.status(200).json({
          success: true,
          data: subscriptionInfo,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error getting basic subscription info:", error);
        } else {
          console.error("❌ Error getting basic subscription info");
        }
        return res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );

  // Mark tutorial as finished
  app.post(
    "/brand-subscriptions/mark-tutorial-finished",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized",
          });
        }

        const { step } = req.body;
        // step is optional, so only pass it if it's defined
        const success = await brandSubscriptionService.markTutorialFinished(
          currentUser.id,
          step !== undefined ? step : undefined
        );

        if (!success) {
          return res.status(404).json({
            success: false,
            message: "No subscription found",
          });
        }

        return res.status(200).json({
          success: true,
          message: "Tutorial marked as finished",
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error marking tutorial as finished:", error);
        } else {
          console.error("❌ Error marking tutorial as finished");
        }
        return res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );

  // Update tutorial step
  app.put(
    "/brand-subscriptions/tutorial-step",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized",
          });
        }

        const { step } = req.body;

        if (step === undefined || step === null) {
          return res.status(400).json({
            success: false,
            message: "Step is required",
          });
        }

        // Ensure step is a number
        const stepNumber =
          typeof step === "number" ? step : parseInt(String(step), 10);
        const success = await brandSubscriptionService.updateTutorialStep(
          currentUser.id,
          stepNumber
        );

        if (!success) {
          return res.status(404).json({
            success: false,
            message: "No subscription found",
          });
        }

        return res.status(200).json({
          success: true,
          message: "Tutorial step updated",
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error updating tutorial step:", error);
        } else {
          console.error("❌ Error updating tutorial step");
        }
        return res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );

  // Update brand subscription features (admin only)
  app.put("/brand-subscriptions/features", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Validate request body using updateBrandSubscriptionFeaturesSchema
      const validation = updateBrandSubscriptionFeaturesSchema.safeParse(
        req.body
      );
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const result = await brandSubscriptionService.updateFeatures(
        currentUser.id,
        validation.data
      );

      if (!result.success) {
        const statusCode =
          result.message === "Access denied"
            ? 403
            : result.message === "Subscription not found"
              ? 404
              : 400;
        return res.status(statusCode).json({
          success: false,
          message: result.message,
          error: result.error,
        });
      }

      res.status(200).json(result);
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating subscription features:", error);
      } else {
        console.error("❌ Error updating subscription features");
      }
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update subscription features",
      });
    }
  });

  // Create payment intent for direct card processing
  app.post(
    "/brand-subscriptions/create-payment-intent",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Not authenticated",
          });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("brand")) {
          console.error("❌ BACKEND CREATE: Access denied - not brand role");
          return res.status(403).json({
            success: false,
            message: "Access denied. Brand role required.",
          });
        }

        // Validate request body using brandPaymentIntentSchema
        const validation = brandPaymentIntentSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }

        const { brandSubscriptionPlanId } = validation.data;

        const selectedPlan = await BrandSubscriptionPlans.findByPk(
          brandSubscriptionPlanId
        );

        if (!selectedPlan) {
          return res.status(404).json({
            success: false,
            message: "Plan not found",
          });
        }

        // Create or retrieve Stripe customer
        let stripeCustomerId = await userService.getOrCreateCustomerId(user, {
          userId: user.id,
          role: user.role,
          brandSubscriptionPlanId,
        });

        const amount = selectedPlan.monthlyPrice;

        // Create Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: "usd",
          customer: stripeCustomerId,
          metadata: {
            userId: currentUser.id,
            brandSubscriptionPlanId,
            amount: amount.toString(),
          },
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
          setup_future_usage: "off_session",
          receipt_email: user.email || undefined,
          description: `${selectedPlan.name}`,
        });

        const brandSubscription = await BrandSubscription.create({
          userId: user.id,
          status: BrandSubscriptionStatus.PENDING,
          stripeCustomerId: user.stripeCustomerId,
          stripePriceId: selectedPlan.stripePriceId,
          monthlyPrice: selectedPlan.monthlyPrice,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          planType: selectedPlan.planType,
        });

        // Create payment record
        await Payment.create({
          stripePaymentIntentId: paymentIntent.id,
          status: "pending",
          paymentMethod: "card",
          amount: amount,
          currency: "usd",
          stripeMetadata: {
            userId: currentUser.id,
            brandSubscriptionPlanId: brandSubscriptionPlanId,
            stripePriceId: selectedPlan.stripePriceId,
            amount: amount.toString(),
          },
          brandSubscriptionId: brandSubscription.id,
        });

        res.status(200).json({
          success: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error creating payment intent:", error);
        } else {
          console.error("❌ Error creating payment intent");
        }
        res.status(500).json({
          success: false,
          message: "Failed to create payment intent",
        });
      }
    }
  );

  // Confirm payment intent with payment method
  app.post("/confirm-payment-intent", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("brand")) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Brand role required.",
        });
      }

      // Return success - webhook will handle subscription creation
      res.status(200).json({
        success: true,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error confirming payment intent:", error);
      } else {
        console.error("❌ Error confirming payment intent");
      }
      res.status(500).json({
        success: false,
        message: "Failed to confirm payment intent",
      });
    }
  });

  // Cancel brand subscription
  app.post("/brand-subscriptions/cancel", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("brand")) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Brand role required.",
        });
      }

      const subscription = await BrandSubscription.findOne({
        where: {
          userId: currentUser.id,
          status: ["active", "processing", "past_due"],
        },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "No active subscription found",
        });
      }

      // Cancel subscription in Stripe
      if (subscription.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        } catch (stripeError) {
          if (process.env.NODE_ENV === "development") {
            console.error("❌ Error canceling Stripe subscription:", stripeError);
          } else {
            console.error("❌ Error canceling Stripe subscription");
          }
          // Continue with local cancellation even if Stripe fails
        }
      }

      // Cancel subscription in database
      await subscription.cancel();

      res.status(200).json({
        success: true,
        message: "Subscription canceled successfully",
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error canceling subscription:", error);
      } else {
        console.error("❌ Error canceling subscription");
      }
      res.status(500).json({
        success: false,
        message: "Failed to cancel subscription",
      });
    }
  });

  // Change brand subscription plan
  app.post("/brand-subscriptions/change", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const { newPlanId } = req.body;

      if (!newPlanId) {
        return res.status(400).json({
          success: false,
          message: "New plan ID is required",
        });
      }

      // Upgrade the subscription
      const result = await brandSubscriptionService.upgradeSubscription(
        currentUser.id,
        newPlanId
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error changing brand subscription:", error);
      } else {
        console.error("❌ Error changing brand subscription");
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });
}
