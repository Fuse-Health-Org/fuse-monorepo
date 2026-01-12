import { Express } from 'express';
import Order from '../models/Order';
import Subscription from '../models/Subscription';
import { StripeService } from '@fuse/stripe';

export function registerOrderSubscriptionEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  // Get subscription status for an order from Stripe
  app.get("/orders/:id/subscription", authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Verify the order belongs to the user
      const order = await Order.findOne({
        where: { id, userId: currentUser.id },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Find the subscription for this order
      const subscription = await Subscription.findOne({
        where: { orderId: id },
      });

      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(200).json({
          success: true,
          data: null,
          message: "No subscription found for this order",
        });
      }

      // Fetch subscription status from Stripe
      const stripeService = new StripeService();
      try {
        const stripeSubscription = (await stripeService.getSubscription(
          subscription.stripeSubscriptionId
        )) as any;

        // Use billing_cycle_anchor as fallback for next charge date if current_period_end is not set
        // (Stripe doesn't populate current_period_end for subscriptions with future billing anchors)
        const nextChargeTimestamp = stripeSubscription.current_period_end || stripeSubscription.billing_cycle_anchor;

        return res.status(200).json({
          success: true,
          data: {
            id: subscription.id,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            localStatus: subscription.status,
            stripeStatus: stripeSubscription.status,
            currentPeriodStart: stripeSubscription.current_period_start
              ? new Date(stripeSubscription.current_period_start * 1000)
              : null,
            currentPeriodEnd: nextChargeTimestamp
              ? new Date(nextChargeTimestamp * 1000)
              : null,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            canceledAt: stripeSubscription.canceled_at
              ? new Date(stripeSubscription.canceled_at * 1000)
              : null,
          },
        });
      } catch (stripeError: any) {
        // Handle case where subscription was deleted in Stripe
        if (stripeError?.code === "resource_missing") {
          return res.status(200).json({
            success: true,
            data: {
              id: subscription.id,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              localStatus: subscription.status,
              stripeStatus: "deleted",
              currentPeriodStart: null,
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              canceledAt: null,
            },
          });
        }
        throw stripeError;
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching subscription status:", error);
      } else {
        console.error("❌ Error fetching subscription status");
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscription status",
      });
    }
  });

  // Cancel subscription for an order
  app.post("/orders/:id/subscription/cancel", authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Verify the order belongs to the user
      const order = await Order.findOne({
        where: { id, userId: currentUser.id },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Find the subscription for this order
      const subscription = await Subscription.findOne({
        where: { orderId: id },
      });

      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({
          success: false,
          message: "No subscription found for this order",
        });
      }

      // Cancel the subscription in Stripe
      const stripeService = new StripeService();
      try {
        await stripeService.cancelSubscription(subscription.stripeSubscriptionId);

        // Update local subscription status
        await subscription.markSubAsCanceled();

        console.log(
          `✅ Subscription ${subscription.stripeSubscriptionId} cancelled for order ${order.orderNumber}`
        );

        return res.status(200).json({
          success: true,
          message: "Subscription cancelled successfully",
          data: {
            id: subscription.id,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            status: "cancelled",
          },
        });
      } catch (stripeError: any) {
        if (stripeError?.code === "resource_missing") {
          // Subscription already deleted in Stripe, just update local status
          await subscription.markSubAsCanceled();
          return res.status(200).json({
            success: true,
            message: "Subscription was already cancelled",
            data: {
              id: subscription.id,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              status: "cancelled",
            },
          });
        }
        throw stripeError;
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error cancelling subscription:", error);
      } else {
        console.error("❌ Error cancelling subscription");
      }
      res.status(500).json({
        success: false,
        message: "Failed to cancel subscription",
      });
    }
  });
}
