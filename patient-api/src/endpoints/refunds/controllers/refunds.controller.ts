import { Request, Response } from "express";
import { getCurrentUser } from "@/config/jwt";
import Order from "@/models/Order";
import Payment from "@/models/Payment";
import Clinic from "@/models/Clinic";
import ClinicBalance from "@/models/ClinicBalance";
import { stripe } from "@fuse/stripe";

export const createRefund = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { orderId, amount, reason } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // Get order with payment and clinic info
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Payment,
          as: "payment",
          required: true,
        },
        {
          model: Clinic,
          as: "clinic",
          required: false,
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const payment = (order as any).payment;
    if (!payment || !payment.stripePaymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "No payment found for this order",
      });
    }

    // Calculate refund amount
    const refundAmount = amount || order.totalAmount;
    
    console.log(`🔄 Processing refund for order ${order.orderNumber}:`, {
      totalAmount: order.totalAmount,
      brandAmount: order.brandAmount,
      refundAmount,
    });

    // Step 1: Create refund with reverse_transfer
    const refundParams: any = {
      payment_intent: payment.stripePaymentIntentId,
      reverse_transfer: true,
    };

    if (amount) {
      refundParams.amount = Math.round(refundAmount * 100);
    }

    const refund = await stripe.refunds.create(refundParams);

    console.log(`✅ Refund created: ${refund.id}`);

    // Step 2: Calculate what FUSE covered
    const fuseCoverage = refundAmount - order.brandAmount;

    console.log(`💰 FUSE coverage: $${fuseCoverage.toFixed(2)}`);

    // Step 3: Try to get additional payment from brand for FUSE coverage
    let additionalTransfer: any = null;
    let balanceRecord: ClinicBalance | null = null;

    if (fuseCoverage > 0 && (order as any).clinic?.stripeAccountId) {
      try {
        // Attempt instant transfer from brand to FUSE
        additionalTransfer = await stripe.transfers.create({
          amount: Math.round(fuseCoverage * 100),
          currency: 'usd',
          destination: process.env.STRIPE_PLATFORM_ACCOUNT_ID || 'acct_1S56nzELzhgYQXTR', // FUSE account
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            refundId: refund.id,
            type: 'refund_coverage',
          },
          description: `Refund coverage for order ${order.orderNumber}`,
        }, {
          stripeAccount: (order as any).clinic.stripeAccountId,
        });

        console.log(`✅ Brand paid instantly via transfer: ${additionalTransfer.id}`);

        // Record successful payment
        balanceRecord = await ClinicBalance.create({
          clinicId: order.clinicId!,
          orderId: order.id,
          amount: fuseCoverage,
          type: 'refund_debt',
          status: 'paid',
          stripeTransferId: additionalTransfer.id,
          stripeRefundId: refund.id,
          description: `Refund coverage for order ${order.orderNumber}`,
          paidAt: new Date(),
        });

      } catch (transferError: any) {
        console.log(`⚠️ Brand transfer failed, registering as pending debt:`, transferError.message);

        // Record as pending debt if transfer fails
        balanceRecord = await ClinicBalance.create({
          clinicId: order.clinicId!,
          orderId: order.id,
          amount: -fuseCoverage, // Negative = brand owes money
          type: 'refund_debt',
          status: 'pending',
          stripeRefundId: refund.id,
          description: `Pending refund coverage for order ${order.orderNumber}`,
          notes: `Transfer failed: ${transferError.message}`,
        });
      }
    }

    // Update payment status
    await payment.update({
      status: 'refunded',
      refundedAmount: refundAmount,
      refundedAt: new Date(),
    });

    // Update order status
    await order.update({
      status: 'refunded',
    });

    return res.status(200).json({
      success: true,
      message: "Refund processed successfully",
      data: {
        refund: {
          id: refund.id,
          amount: refundAmount,
          status: refund.status,
        },
        brandCoverage: {
          amount: fuseCoverage,
          paid: !!additionalTransfer,
          transferId: additionalTransfer?.id || null,
          balanceRecordId: balanceRecord?.id || null,
        },
      },
    });

  } catch (error) {
    console.error("❌ Error processing refund:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process refund",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
