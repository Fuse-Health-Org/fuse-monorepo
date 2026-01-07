import BrandSubscription, {
  BrandSubscriptionStatus,
} from "../models/BrandSubscription";
import BrandSubscriptionPlans from "../models/BrandSubscriptionPlans";
import User from "../models/User";
import Payment from "../models/Payment";
import { BillingInterval, StripeService } from "@fuse/stripe";
import UserService from "./user.service";
import { UpdateBrandSubscriptionFeaturesInput } from "@fuse/validators";

interface CreateFromPaymentParams {
  paymentId: string;
  brandSubscriptionId: string;
}

interface CreateFromPaymentResult {
  success: boolean;
  message?: string;
  data?: {
    subscription: BrandSubscription;
  };
  error?: string;
}

interface UpgradeSubscriptionResult {
  success: boolean;
  message?: string;
  data?: {
    subscription: BrandSubscription;
    newPlan: BrandSubscriptionPlans;
    scheduleUpdated?: boolean;
    immediateUpgrade?: boolean;
  };
  error?: string;
}

class BrandSubscriptionService {
  private stripeService: StripeService;
  private userService: UserService;

  constructor() {
    this.stripeService = new StripeService();
    this.userService = new UserService();
  }

  /**
   * Create BrandSubscription from Payment record (called by webhook)
   * This method provisions the subscription schedule if not already done,
   * then creates the BrandSubscription record
   */
  async createFromPayment(
    params: CreateFromPaymentParams
  ): Promise<CreateFromPaymentResult> {
    const { paymentId, brandSubscriptionId } = params;

    try {
      console.log(
        "🚀 SERVICE: Creating BrandSubscription from payment:",
        paymentId
      );

      // 1. Find payment record
      const payment = await Payment.findByPk(paymentId);
      if (!payment) {
        return {
          success: false,
          error: "Payment not found",
        };
      }

      const brandSubscription =
        await BrandSubscription.findByPk(brandSubscriptionId);
      if (!brandSubscription) {
        return {
          success: false,
          error: "Brand subscription not found",
        };
      }

      const { userId } = brandSubscription;

      const metadata = payment.stripeMetadata;

      if (!metadata) {
        return {
          success: false,
          error: "Payment metadata incomplete",
        };
      }
      // 3. Verify user
      const user = await User.findByPk(userId);
      if (!user) {
        return {
          success: false,
          error: "Invalid user or user is not a brand",
        };
      }

      console.log(
        "⚠️ No subscription schedule ID in metadata, creating new schedule"
      );

      const { brandSubscriptionPlanId } = metadata;

      // Get plan details
      const brandSubPlan = await BrandSubscriptionPlans.findByPk(
        brandSubscriptionPlanId
      );
      if (!brandSubPlan) {
        return {
          success: false,
          error: "Subscription plan not found",
        };
      }
      // Get or create Stripe customer
      const stripeCustomerId =
        await this.userService.getOrCreateCustomerId(user);

      const subscription =
        await this.stripeService.createSubscriptionAfterPayment({
          customerId: stripeCustomerId,
          priceId: brandSubPlan.stripePriceId,
          paymentMethodId: metadata.paymentMethodId,
          billingInterval: BillingInterval.MONTHLY,
          metadata: {
            brandSubscriptionPlanId: brandSubscriptionPlanId,
            userId: userId,
          },
        });

      if (!subscription) {
        return {
          success: false,
          error: "Subscription not found",
        };
      }

      // 8. Build features object
      const planFeatures = brandSubPlan.getFeatures();

      const subItem = subscription.items.data[0];

      // Derive current period timestamps if available
      const currentPeriodStartUnix = subItem?.current_period_start;
      const currentPeriodEndUnix = subItem?.current_period_end;
      const currentPeriodStartDate = currentPeriodStartUnix
        ? new Date(currentPeriodStartUnix * 1000)
        : null;
      const currentPeriodEndDate = currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000)
        : null;

      // 9. Create BrandSubscription
      brandSubscription.update({
        userId: user.id,
        status: BrandSubscriptionStatus.ACTIVE,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: user.stripeCustomerId,
        currentPeriodStart: currentPeriodStartDate,
        currentPeriodEnd: currentPeriodEndDate,
        features: planFeatures,
        planType: brandSubPlan.planType,
      });

      console.log(
        "✅ SERVICE: BrandSubscription created and linked:",
        brandSubscription.id
      );

      return {
        success: true,
        message: "Brand subscription created successfully",
        data: {
          subscription: brandSubscription,
        },
      };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ SERVICE: Error creating BrandSubscription:", error);
      } else {
        console.error("❌ SERVICE: Error creating BrandSubscription");
      }
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Upgrade a brand subscription to a new plan
   */
  async upgradeSubscription(
    userId: string,
    newPlanId: string
  ): Promise<UpgradeSubscriptionResult> {
    try {
      // Find the user's current brand subscription
      const currentSubscription = await BrandSubscription.findOne({
        where: {
          userId: userId,
          status: BrandSubscriptionStatus.ACTIVE,
        },
      });

      if (!currentSubscription) {
        return {
          success: false,
          error: "No active brand subscription found for user",
        };
      }

      console.log(
        "currentSubscription ",
        JSON.stringify(currentSubscription.features)
      );

      // Find the new plan by ID
      const newPlan = await BrandSubscriptionPlans.findByPk(newPlanId);

      if (!newPlan) {
        return {
          success: false,
          error: "New subscription plan not found",
        };
      }

      // Check if user is trying to "upgrade" to the same plan
      if (currentSubscription.planType === newPlan.planType) {
        return {
          success: false,
          error: "User is already on the selected plan",
        };
      }

      const subscriptionSchedule =
        currentSubscription?.features?.subscriptionSchedule;
      const stripeService = new StripeService();

      // If subscription has a schedule, check its status
      if (subscriptionSchedule?.id) {
        const subSchedule = await stripeService.getSubscriptionSchedule(
          subscriptionSchedule.id
        );
        console.log("subscriptionSchedule status:", subSchedule.status);

        if (subSchedule.status === "active") {
          // Schedule is active - update the following phase
          console.log(
            "📅 Subscription schedule is active - updating future phase"
          );

          const phases = subSchedule.phases.map((phase, index, arr) => {
            // Update the last phase (future/ongoing plan) to use the new plan
            if (index === arr.length - 1) {
              return {
                items: [
                  {
                    price: newPlan.stripePriceId,
                    quantity: 1,
                  },
                ],
                start_date: phase.start_date,
                ...(phase.end_date && { end_date: phase.end_date }),
              };
            }
            // Keep other phases unchanged - only include essential fields
            return {
              items: phase.items,
              start_date: phase.start_date,
              ...(phase.end_date && { end_date: phase.end_date }),
            };
          }) as any;

          await stripeService.updateSubscriptionSchedule(
            subscriptionSchedule.id,
            {
              phases,
              proration_behavior: "none",
            }
          );

          // Update local subscription with new plan details
          await currentSubscription.update({
            planType: newPlan.planType,
            stripePriceId: newPlan.stripePriceId,
            monthlyPrice: newPlan.monthlyPrice,
            status: BrandSubscriptionStatus.PROCESSING,
          });

          console.log(
            "✅ Subscription schedule updated for future billing cycle"
          );

          return {
            success: true,
            message: `Successfully scheduled upgrade to ${newPlan.name} for next billing cycle`,
            data: {
              subscription: currentSubscription,
              newPlan: newPlan,
              scheduleUpdated: true,
            },
          };
        } else {
          console.log(
            "📋 Subscription schedule is completed - performing direct subscription update"
          );
        }
      }

      // Schedule is completed or doesn't exist - perform direct subscription update
      if (!currentSubscription.stripeSubscriptionId) {
        return {
          success: false,
          error: "Subscription is not connected to Stripe",
        };
      }

      // Get the current Stripe subscription to find the item ID
      const stripeSubscription = await this.stripeService.getSubscription(
        currentSubscription.stripeSubscriptionId
      );

      if (!stripeSubscription || !stripeSubscription.items.data.length) {
        return {
          success: false,
          error: "Unable to find Stripe subscription details",
        };
      }

      // Find the subscription item that doesn't match the new price ID (the one to replace)
      const itemToReplace = stripeSubscription.items.data.find(
        (item: any) => item.price.id !== newPlan.stripePriceId
      );

      if (!itemToReplace) {
        throw new Error(
          "No subscription item found to replace - subscription may already be using the target price"
        );
      }

      const stripeItemId = itemToReplace.id;

      // Upgrade subscription in Stripe immediately
      await this.stripeService.upgradeSubscriptionStripe({
        stripeSubscriptionId: currentSubscription.stripeSubscriptionId,
        stripeItemId,
        stripePriceId: newPlan.stripePriceId,
      });

      // Update the subscription with new plan details
      await currentSubscription.update({
        planType: newPlan.planType,
        stripePriceId: newPlan.stripePriceId,
        monthlyPrice: newPlan.monthlyPrice,
        status: BrandSubscriptionStatus.PROCESSING,
      });

      console.log("✅ Brand subscription upgraded immediately:", {
        userId: userId,
        subscriptionId: currentSubscription.id,
        oldPlan: currentSubscription.planType,
        newPlan: newPlan.planType,
      });

      return {
        success: true,
        message: `Successfully upgraded subscription to ${newPlan.name}`,
        data: {
          subscription: currentSubscription,
          newPlan: newPlan,
          immediateUpgrade: true,
        },
      };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error upgrading brand subscription:", error);
      } else {
        console.error("❌ Error upgrading brand subscription");
      }
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Get user's current brand subscription
   */
  async getCurrentSubscription(
    userId: string
  ): Promise<BrandSubscription | null> {
    try {
      return await BrandSubscription.findOne({
        where: { userId: userId },
        include: [{ model: User, as: "user" }],
        order: [["createdAt", "DESC"]],
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error getting current subscription:", error);
      } else {
        console.error("❌ Error getting current subscription");
      }
      return null;
    }
  }

  /**
   * Get all available brand subscription plans
   */
  async getAvailablePlans(): Promise<BrandSubscriptionPlans[]> {
    try {
      return await BrandSubscriptionPlans.findAll({
        order: [["monthlyPrice", "ASC"]],
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error getting available plans:", error);
      } else {
        console.error("❌ Error getting available plans");
      }
      return [];
    }
  }

  /**
   * Get basic subscription info (status, tutorialFinished, tutorialStep, stripeCustomerId)
   */
  async getBasicSubscriptionInfo(userId: string): Promise<{
    status: string;
    tutorialFinished: boolean;
    tutorialStep: number;
    stripeCustomerId: string | null;
  } | null> {
    try {
      const subscription = await BrandSubscription.findOne({
        where: { userId },
        attributes: ["status", "tutorialFinished", "tutorialStep", "stripeCustomerId"],
      });

      if (!subscription) {
        return null;
      }

      return {
        status: subscription.status,
        tutorialFinished: subscription.tutorialFinished,
        tutorialStep: subscription.tutorialStep || 0,
        stripeCustomerId: subscription.stripeCustomerId || null,
      };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error getting basic subscription info:", error);
      } else {
        console.error("❌ Error getting basic subscription info");
      }
      return null;
    }
  }

  /**
   * Mark tutorial as finished for user's brand subscription
   */
  async markTutorialFinished(userId: string, step?: number): Promise<boolean> {
    try {
      const subscription = await BrandSubscription.findOne({
        where: { userId },
      });

      if (!subscription) {
        return false;
      }

      const updateData: { tutorialFinished: boolean; tutorialStep?: number } = {
        tutorialFinished: true,
      };

      // If step is provided, update it as well
      if (step !== undefined) {
        updateData.tutorialStep = step;
      }

      await subscription.update(updateData);

      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error marking tutorial as finished:", error);
      } else {
        console.error("❌ Error marking tutorial as finished");
      }
      return false;
    }
  }

  /**
   * Update tutorial step for user's brand subscription
   */
  async updateTutorialStep(userId: string, step: number): Promise<boolean> {
    try {
      const subscription = await BrandSubscription.findOne({
        where: { userId },
      });

      if (!subscription) {
        return false;
      }

      await subscription.update({
        tutorialStep: step,
      });

      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating tutorial step:", error);
      } else {
        console.error("❌ Error updating tutorial step");
      }
      return false;
    }
  }

  /**
   * Update brand subscription features and/or price (admin only)
   */
  async updateFeatures(
    adminUserId: string,
    updates: UpdateBrandSubscriptionFeaturesInput
  ) {
    try {
      // Validate admin user
      const adminUser = await User.findByPk(adminUserId);
      if (!adminUser || adminUser.role !== "admin") {
        return {
          success: false,
          message: "Access denied",
          error: "Only admin users can update subscription features",
        };
      }

      const targetUserId = updates.userId;

      // Find the target user's subscription
      const subscription = await BrandSubscription.findOne({
        where: { userId: targetUserId, status: "active" },
        order: [["createdAt", "DESC"]],
      });

      if (!subscription) {
        return {
          success: false,
          message: "Subscription not found",
          error: "No subscription found for the specified user",
        };
      }

      const updateData: any = {};

      // Update features if provided
      if (updates.features) {
        const updatedFeatures = {
          ...subscription.features,
          ...updates.features,
        };
        updateData.features = updatedFeatures;
      }

      // Update price if provided and different from current
      if (
        updates.monthlyPrice !== undefined &&
        updates.monthlyPrice !== subscription.monthlyPrice
      ) {
        updateData.monthlyPrice = updates.monthlyPrice;

        // Look up a plan that matches the new price to get the stripePriceId
        let matchingPlan = await BrandSubscriptionPlans.findOne({
          where: {
            monthlyPrice: updates.monthlyPrice,
            planType: subscription.planType,
          },
        });

        let stripePriceId: string;

        if (matchingPlan?.stripePriceId) {
          stripePriceId = matchingPlan.stripePriceId;
          console.log("✅ Found matching plan for price update:", {
            planId: matchingPlan.id,
            planType: matchingPlan.planType,
            stripePriceId,
          });
        } else {
          // No matching plan found - create a custom price in Stripe and database
          console.log(
            "⚠️ No matching plan found for new price, creating custom price"
          );

          try {
            // Get or create a Stripe product for brand subscriptions
            const stripeProductId =
              process.env.STRIPE_BRAND_SUBSCRIPTION_PRODUCT_ID;

            if (!stripeProductId) {
              console.error(
                "❌ STRIPE_BRAND_SUBSCRIPTION_PRODUCT_ID not configured"
              );
              return {
                success: false,
                message: "Stripe product configuration missing",
                error:
                  "STRIPE_BRAND_SUBSCRIPTION_PRODUCT_ID environment variable not set",
              };
            }

            // Create new Stripe price
            const stripePrice = await this.stripeService.createPrice({
              product: stripeProductId,
              unit_amount: Math.round(updates.monthlyPrice * 100), // Convert to cents
              currency: "usd",
              recurring: {
                interval: "month",
                interval_count: 1,
              },
              metadata: {
                customPrice: "true",
                planType: "custom",
                createdBy: "admin",
              },
            });

            stripePriceId = stripePrice.id;

            // Create a custom plan record in the database (inactive by default)
            const customPlan = await BrandSubscriptionPlans.create({
              planType: "custom",
              name: `Custom Plan`,
              description: `Custom pricing plan`,
              monthlyPrice: updates.monthlyPrice,
              stripePriceId: stripePriceId,
              maxProducts: subscription.features?.maxProducts || -1,
              maxCampaigns: subscription.features?.maxCampaigns || -1,
              analyticsAccess: subscription.features?.analyticsAccess || true,
              customerSupport:
                subscription.features?.customerSupport || "email",
              customBranding: subscription.features?.customBranding || false,
              apiAccess: subscription.features?.apiAccess || false,
              whiteLabel: subscription.features?.whiteLabel || false,
              customIntegrations:
                subscription.features?.customIntegrations || false,
              isActive: false, // Inactive by default
              sortOrder: 999,
            });

            console.log("✅ Created custom price plan:", {
              planId: customPlan.id,
              stripePriceId,
              monthlyPrice: updates.monthlyPrice,
              isActive: false,
            });
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              console.error("❌ Error creating custom price:", error);
            } else {
              console.error("❌ Error creating custom price");
            }
            return {
              success: false,
              message: "Failed to create custom price",
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }

        // If subscription has a Stripe subscription ID, update the price in Stripe
        if (subscription.stripeSubscriptionId) {
          try {
            // Get the subscription from Stripe to find the current subscription item
            const stripeSubscription = await this.stripeService.getSubscription(
              subscription.stripeSubscriptionId,
              { expand: ["items"] }
            );

            if (stripeSubscription.items.data.length > 0) {
              const currentItem = stripeSubscription.items.data[0];

              // Update the subscription with the new price
              await this.stripeService.upgradeSubscriptionStripe({
                stripeSubscriptionId: subscription.stripeSubscriptionId,
                stripeItemId: currentItem.id,
                stripePriceId: stripePriceId,
              });

              updateData.stripePriceId = stripePriceId;

              console.log("✅ Updated Stripe subscription price:", {
                subscriptionId: subscription.stripeSubscriptionId,
                oldPrice: subscription.monthlyPrice,
                newPrice: updates.monthlyPrice,
                newPriceId: stripePriceId,
              });
            }
          } catch (stripeError) {
            if (process.env.NODE_ENV === "development") {
              console.error(
                "❌ Error updating Stripe subscription price:",
                stripeError
              );
            } else {
              console.error("❌ Error updating Stripe subscription price");
            }
            return {
              success: false,
              message: "Failed to update price in Stripe",
              error:
                stripeError instanceof Error
                  ? stripeError.message
                  : "Unknown Stripe error",
            };
          }
        } else {
          // Just update the price ID if no active Stripe subscription
          updateData.stripePriceId = stripePriceId;
        }
      }

      // Apply all updates
      if (Object.keys(updateData).length > 0) {
        await subscription.update(updateData);
      }

      return {
        success: true,
        message: "Subscription updated successfully",
        data: {
          subscription: await subscription.reload(),
        },
      };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating subscription:", error);
      } else {
        console.error("❌ Error updating subscription");
      }
      return {
        success: false,
        message: "Failed to update subscription",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export default BrandSubscriptionService;
