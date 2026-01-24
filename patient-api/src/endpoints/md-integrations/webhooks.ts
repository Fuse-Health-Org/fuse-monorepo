import { Express } from "express";
import express from "express";

// ============= MD INTEGRATIONS WEBHOOKS =============
// Webhook handlers for MD Integrations callbacks

export function registerMDIntegrationsWebhooks(app: Express) {
  // MD Integrations Webhook (raw body required for signature verification)
  // Accept any content-type as raw so signature can be computed on exact bytes
  app.post(
    "/md/webhooks",
    express.raw({ type: () => true }),
    async (req, res) => {
      const requestId =
        (req.headers["x-request-id"] as string) ||
        Math.random().toString(36).slice(2);
      try {
        // Lazy import to avoid circular deps at module init
        const { default: MDWebhookService } = await import(
          "../../services/mdIntegration/MDWebhook.service"
        );

        const signatureHeaderName =
          process.env.MD_INTEGRATIONS_WEBHOOK_SIGNATURE_HEADER ||
          "x-md-signature";
        const providedSignature =
          (req.headers[signatureHeaderName] as string) ||
          (req.headers["signature"] as string) ||
          "";
        const authorization = (req.headers["authorization"] as string) || "";

        // Grab raw body bytes and content-type for logging and signature
        const rawBuf: Buffer | undefined =
          (req as any).body instanceof Buffer ? (req as any).body : undefined;
        const rawBody = rawBuf ? rawBuf.toString("utf8") : "";
        const contentType =
          (req.headers["content-type"] as string) || "unknown";

        // Parse JSON or form if possible (without affecting signature calc)
        let payload: any = undefined;
        try {
          if (contentType.includes("application/json")) {
            payload = rawBody ? JSON.parse(rawBody) : {};
          } else if (
            contentType.includes("application/x-www-form-urlencoded")
          ) {
            // Basic URL-encoded parse
            payload = Object.fromEntries(new URLSearchParams(rawBody));
          } else {
            // Attempt JSON parse as a best-effort
            payload = rawBody ? JSON.parse(rawBody) : {};
          }
        } catch (e) {
          console.warn(
            `[MD-WH] reqId=${requestId} body parse failed; continuing with raw string`
          );
          payload = {};
        }

        // SECURITY: MD Integrations webhook secret (optional but recommended)
        const secret = process.env.MD_INTEGRATIONS_WEBHOOK_SECRET;
        let signatureValid = true;

        if (secret) {
          // Verify signature if secret is configured
          signatureValid = MDWebhookService.verifyWebhookSignature(
            providedSignature,
            rawBody,
            secret
          );
        } else {
          // No secret configured - skip signature verification (for sandbox/development)
          console.log(`[MD-WH] reqId=${requestId} ⚠️ No webhook secret configured - skipping signature verification`);
        }

        // SECURITY: Minimal logging - no PHI in logs
        console.log(`[MD-WH] reqId=${requestId} received`, {
          event_type: payload?.event_type,
          signature_valid: signatureValid,
          has_secret: !!secret,
          content_type: contentType,
          // REMOVED: case_id, patient_id, body_preview (may contain PHI)
        });

        if (!signatureValid) {
          console.warn(
            `[MD-WH] reqId=${requestId} signature validation failed`
          );
          return res
            .status(401)
            .json({ success: false, message: "Invalid signature" });
        }

        await MDWebhookService.processMDWebhook(payload);

        console.log(`[MD-WH] reqId=${requestId} processed`, {
          event_type: payload?.event_type,
        });
        return res.status(200).json({ received: true });
      } catch (error: any) {
        if (process.env.NODE_ENV === "development") {
          console.error(`[MD-WH] reqId=${requestId} error`, error);
        } else {
          console.error(`[MD-WH] reqId=${requestId} error`);
        }
        return res
          .status(500)
          .json({ success: false, message: "Webhook processing failed" });
      }
    }
  );

  console.log("✅ MD Integrations webhooks registered");
}
