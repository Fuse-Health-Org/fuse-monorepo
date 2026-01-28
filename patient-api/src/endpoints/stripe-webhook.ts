import { Express } from "express";
import Stripe from "stripe";
import { processStripeWebhook } from "../services/stripe/webhook";

// Webhook deduplication cache (in production, use Redis or database)
const processedWebhooks = new Set<string>();

export function registerStripeWebhookEndpoint(
  app: Express,
  stripe: Stripe
) {
  // Stripe webhook endpoint
  app.post(
    "/webhook/stripe",
    require("express").raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      // HIPAA: Do not log webhook body or secrets in production
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 Webhook received - Body length:", req.body?.length);
      }

      // Extract timestamp from signature for deduplication
      const sigString = Array.isArray(sig) ? sig[0] : sig;
      const timestampMatch = sigString?.match(/t=(\d+)/);
      const webhookTimestamp = timestampMatch ? timestampMatch[1] : null;
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 Webhook timestamp:", webhookTimestamp);
      }

      if (!endpointSecret) {
        console.error("❌ STRIPE_WEBHOOK_SECRET not configured");
        return res.status(400).send("Webhook secret not configured");
      }

      let event;

      try {
        const signature = Array.isArray(sig) ? sig[0] : sig;
        if (!signature) {
          throw new Error("No signature provided");
        }
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          endpointSecret
        );
      } catch (err: any) {
        // SECURITY: Generic error message - don't reveal internal details
        console.error("❌ Webhook signature verification failed");
        // SECURITY: Log details internally but don't expose to caller
        if (process.env.NODE_ENV === "development") {
          console.error("Debug - Error:", err.message);
        }
        return res.status(400).send("Invalid request");
      }

      // Check for duplicate webhook events
      const eventId = event.id;
      if (processedWebhooks.has(eventId)) {
        console.log("⚠️ Duplicate webhook event detected, skipping:", eventId);
        return res.status(200).json({ received: true, duplicate: true });
      }

      // Add to processed webhooks (keep only last 1000 to prevent memory leaks)
      processedWebhooks.add(eventId);
      if (processedWebhooks.size > 1000) {
        const firstEvent = processedWebhooks.values().next().value;
        if (firstEvent) {
          processedWebhooks.delete(firstEvent);
        }
      }

      console.log(
        "🎣 Stripe webhook event received:",
        event.type,
        "ID:",
        eventId
      );

      try {
        // Process the event using the webhook service
        await processStripeWebhook(event);

        // Return a 200 response to acknowledge receipt of the event
        res.status(200).json({ received: true });
      } catch (error) {
        // HIPAA: Do not log detailed errors in production
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error processing webhook:", error);
        } else {
          console.error("❌ Error processing webhook");
        }
        res.status(500).json({ error: "Webhook processing failed" });
      }
    }
  );
}
