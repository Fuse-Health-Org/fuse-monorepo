import { Express } from "express";
import express from "express";
import ShippingOrder, { OrderShippingStatus } from "../../models/ShippingOrder";

// Olympia Pharmacy webhook payload structure
interface OlympiaTrackingWebhook {
  vendor_order_id: string;
  status: string;
  tracking_number?: string;
  carrier?: string;
}

// Status mapping from Olympia to our internal status
const statusMapping: Record<string, OrderShippingStatus> = {
  'pending': OrderShippingStatus.PENDING,
  'processing': OrderShippingStatus.PROCESSING,
  'shipped': OrderShippingStatus.SHIPPED,
  'delivered': OrderShippingStatus.DELIVERED,
  'cancelled': OrderShippingStatus.CANCELLED,
  'rejected': OrderShippingStatus.REJECTED,
  'problem': OrderShippingStatus.PROBLEM,
};

class OlympiaPharmacyWebhookService {
  /**
   * Handle tracking update from Olympia Pharmacy
   */
  async handleTrackingUpdate(data: OlympiaTrackingWebhook): Promise<void> {
    console.log('📦 Olympia Pharmacy tracking update:', data.vendor_order_id, 'status:', data.status);

    try {
      // Find ShippingOrder by vendor_order_id (stored as pharmacyOrderId)
      const shippingOrder = await ShippingOrder.findOne({
        where: { pharmacyOrderId: data.vendor_order_id },
      });

      if (!shippingOrder) {
        console.log('⚠️ ShippingOrder not found for vendor_order_id:', data.vendor_order_id);
        return;
      }

      // Map Olympia status to internal status
      const internalStatus = statusMapping[data.status.toLowerCase()] || OrderShippingStatus.PROCESSING;

      // Prepare update data
      const updateData: any = {
        status: internalStatus,
      };

      // Add tracking information if provided
      if (data.tracking_number) {
        updateData.trackingNumber = data.tracking_number;
      }

      // Generate tracking URL based on carrier
      if (data.carrier && data.tracking_number) {
        updateData.trackingUrl = this.generateTrackingUrl(data.carrier, data.tracking_number);
      }

      // Set timestamps based on status
      if (internalStatus === OrderShippingStatus.SHIPPED && !shippingOrder.shippedAt) {
        updateData.shippedAt = new Date();
      }

      if (internalStatus === OrderShippingStatus.DELIVERED && !shippingOrder.deliveredAt) {
        updateData.deliveredAt = new Date();
      }

      // Update the shipping order
      await shippingOrder.update(updateData);

      console.log('✅ ShippingOrder updated:', {
        orderId: shippingOrder.orderId,
        status: internalStatus,
        trackingNumber: data.tracking_number,
        carrier: data.carrier,
      });

    } catch (error) {
      console.error('❌ Error processing Olympia tracking update:', error);
      throw error;
    }
  }

  /**
   * Generate tracking URL based on carrier
   */
  private generateTrackingUrl(carrier: string, trackingNumber: string): string {
    const carrierLower = carrier.toLowerCase();

    const trackingUrls: Record<string, string> = {
      'ups': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'usps': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'dhl': `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`,
    };

    return trackingUrls[carrierLower] || '';
  }

  /**
   * Process Olympia Pharmacy webhook
   */
  async processOlympiaWebhook(data: OlympiaTrackingWebhook): Promise<void> {
    console.log('📫 Processing Olympia Pharmacy webhook for vendor_order_id:', data.vendor_order_id);

    // Handle tracking update
    await this.handleTrackingUpdate(data);
  }
}

export const olympiaPharmacyWebhookService = new OlympiaPharmacyWebhookService();

/**
 * Register Olympia Pharmacy webhook endpoint
 */
export function registerOlympiaPharmacyWebhooks(
  app: Express,
  webhookLimiter: any
) {
  app.post(
    "/webhook/olympia-pharmacy",
    webhookLimiter,
    express.json(),
    async (req, res) => {
      try {
        // Validate Authorization header with Bearer token
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          return res.status(401).json({
            success: false,
            message: "Authorization header required",
          });
        }

        if (!process.env.OLYMPIA_PHARMACY_WEBHOOK_SECRET) {
          console.error("OLYMPIA_PHARMACY_WEBHOOK_SECRET environment variable is not set");
          return res.status(500).json({
            success: false,
            message: "Server configuration error",
          });
        }

        // Verify Bearer token
        const expectedToken = `Bearer ${process.env.OLYMPIA_PHARMACY_WEBHOOK_SECRET}`;
        if (authHeader !== expectedToken) {
          console.warn('⚠️ Invalid Olympia Pharmacy webhook token');
          return res.status(403).json({
            success: false,
            message: "Invalid authorization token",
          });
        }

        // Validate payload structure
        const { vendor_order_id, status, tracking_number, carrier } = req.body;

        if (!vendor_order_id || !status) {
          return res.status(400).json({
            success: false,
            message: "Missing required fields: vendor_order_id and status are required",
          });
        }

        // Process the webhook
        await olympiaPharmacyWebhookService.processOlympiaWebhook(req.body);

        res.json({
          success: true,
          message: "Webhook processed successfully",
        });

      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error processing Olympia Pharmacy webhook:", error);
        } else {
          console.error("❌ Error processing Olympia Pharmacy webhook");
        }
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );

  console.log("✅ Olympia Pharmacy webhooks registered at /webhook/olympia-pharmacy");
}
