import { Request, Response } from "express";
import { getCurrentUser } from "@/config/jwt";
import Order from "@/models/Order";
import Payment from "@/models/Payment";
import Clinic from "@/models/Clinic";
import User from "@/models/User";
import RefundRequest, { RefundRequestStatus } from "@/models/RefundRequest";
import ClinicBalance from "@/models/ClinicBalance";
import { stripe } from "@/utils/useGetStripeClient";

/**
 * Create a refund request (called by brand admins)
 * This does NOT issue the refund immediately — it creates a pending request
 * that must be reviewed/approved by a tenant admin.
 */
export const createRefundRequest = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { orderId, reason } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // Get order with payment and clinic info
    const order = await Order.findByPk(orderId, {
      include: [
        { model: Payment, as: "payment", required: true },
        { model: Clinic, as: "clinic", required: false },
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

    if (order.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "This order has already been refunded",
      });
    }

    // Check if there's already a pending refund request for this order
    const existingRequest = await RefundRequest.findOne({
      where: {
        orderId: order.id,
        status: RefundRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "A refund request is already pending for this order",
      });
    }

    const refundAmount = order.totalAmount;

    // Brand absorbs the full refund since pharmacy/doctor payments can't be reversed
    const brandCoverageAmount = refundAmount;

    const refundRequest = await RefundRequest.create({
      orderId: order.id,
      clinicId: order.clinicId!,
      requestedById: currentUser.id,
      amount: refundAmount,
      brandCoverageAmount,
      reason: reason || null,
      status: RefundRequestStatus.PENDING,
    });

    console.log(
      `📋 Refund request created for order ${order.orderNumber}: $${refundAmount}`
    );

    return res.status(201).json({
      success: true,
      message: "Refund request submitted successfully. It will be reviewed before processing.",
      data: {
        refundRequest: {
          id: refundRequest.id,
          orderId: refundRequest.orderId,
          amount: refundRequest.amount,
          brandCoverageAmount: refundRequest.brandCoverageAmount,
          reason: refundRequest.reason,
          status: refundRequest.status,
          createdAt: refundRequest.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error creating refund request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create refund request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get refund requests for a clinic (brand admin view)
 */
export const getRefundRequests = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { clinicId } = req.params;
    const { status } = req.query;

    const where: any = {};
    // "all" means tenant admin wants all requests across all clinics
    if (clinicId && clinicId !== "all") {
      where.clinicId = clinicId;
    }
    if (status) {
      where.status = status;
    }

    const refundRequests = await RefundRequest.findAll({
      where,
      include: [
        {
          model: Order,
          as: "order",
          attributes: ["id", "orderNumber", "totalAmount", "brandAmount", "status"],
        },
        {
          model: Clinic,
          as: "clinic",
          attributes: ["id", "name", "slug"],
        },
        {
          model: User,
          as: "requestedBy",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: refundRequests,
    });
  } catch (error) {
    console.error("❌ Error fetching refund requests:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch refund requests",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get refund request status for a specific order (used by frontend to check state)
 */
export const getRefundRequestByOrder = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { orderId } = req.params;

    const refundRequest = await RefundRequest.findOne({
      where: { orderId },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "requestedBy",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: refundRequest || null,
    });
  } catch (error) {
    console.error("❌ Error fetching refund request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch refund request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Approve a refund request (called by tenant admins)
 * This actually processes the Stripe refund.
 */
export const approveRefundRequest = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { id } = req.params;
    const { reviewNotes } = req.body;

    const refundRequest = await RefundRequest.findByPk(id, {
      include: [
        {
          model: Order,
          as: "order",
          include: [
            { model: Payment, as: "payment", required: true },
            { model: Clinic, as: "clinic", required: false },
          ],
        },
      ],
    });

    if (!refundRequest) {
      return res.status(404).json({
        success: false,
        message: "Refund request not found",
      });
    }

    if (refundRequest.status !== RefundRequestStatus.PENDING) {
      return res.status(400).json({
        success: false,
        message: `Refund request has already been ${refundRequest.status}`,
      });
    }

    const order = (refundRequest as any).order;
    const payment = order?.payment;

    if (!payment || !payment.stripePaymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "No payment found for this order",
      });
    }

    // Process the actual Stripe refund
    const refundAmount = refundRequest.amount;

    console.log(
      `🔄 Processing approved refund for order ${order.orderNumber}: $${refundAmount}`
    );

    // Try with reverse_transfer first; if the charge has no associated transfer, fall back to a regular refund
    let refund: any;
    try {
      refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        reverse_transfer: true,
      });
      console.log(`✅ Refund created (with reverse_transfer): ${refund.id}`);
    } catch (stripeErr: any) {
      if (
        stripeErr?.type === "StripeInvalidRequestError" &&
        stripeErr?.message?.includes("does not have an associated transfer")
      ) {
        console.log(
          `⚠️ No associated transfer found, issuing regular refund for order ${order.orderNumber}`
        );
        refund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
        });
        console.log(`✅ Refund created (regular): ${refund.id}`);
      } else {
        throw stripeErr;
      }
    }

    // Calculate what FUSE covered
    const fuseCoverage = refundAmount - order.brandAmount;
    console.log(`💰 FUSE coverage: $${fuseCoverage.toFixed(2)}`);

    // Try to get additional payment from brand for FUSE coverage
    let additionalTransfer: any = null;
    let balanceRecord: ClinicBalance | null = null;

    if (fuseCoverage > 0 && order.clinic?.stripeAccountId) {
      try {
        additionalTransfer = await stripe.transfers.create(
          {
            amount: Math.round(fuseCoverage * 100),
            currency: "usd",
            destination:
              process.env.STRIPE_PLATFORM_ACCOUNT_ID ||
              "acct_1S56nzELzhgYQXTR",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              refundId: refund.id,
              refundRequestId: refundRequest.id,
              type: "refund_coverage",
            },
            description: `Refund coverage for order ${order.orderNumber}`,
          },
          {
            stripeAccount: order.clinic.stripeAccountId,
          }
        );

        console.log(
          `✅ Brand paid instantly via transfer: ${additionalTransfer.id}`
        );

        balanceRecord = await ClinicBalance.create({
          clinicId: order.clinicId!,
          orderId: order.id,
          amount: fuseCoverage,
          type: "refund_debt",
          status: "paid",
          stripeTransferId: additionalTransfer.id,
          stripeRefundId: refund.id,
          description: `Refund coverage for order ${order.orderNumber}`,
          paidAt: new Date(),
        });
      } catch (transferError: any) {
        console.log(
          `⚠️ Brand transfer failed, registering as pending debt:`,
          transferError.message
        );

        balanceRecord = await ClinicBalance.create({
          clinicId: order.clinicId!,
          orderId: order.id,
          amount: -fuseCoverage,
          type: "refund_debt",
          status: "pending",
          stripeRefundId: refund.id,
          description: `Pending refund coverage for order ${order.orderNumber}`,
          notes: `Transfer failed: ${transferError.message}`,
        });
      }
    }

    // Update payment status
    await payment.update({
      status: "refunded",
      refundedAmount: refundAmount,
      refundedAt: new Date(),
    });

    // Update order status
    await order.update({
      status: "refunded",
    });

    // Update refund request status
    await refundRequest.update({
      status: RefundRequestStatus.APPROVED,
      reviewedById: currentUser.id,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
    });

    console.log(
      `✅ Refund request ${refundRequest.id} approved for order ${order.orderNumber}`
    );

    return res.status(200).json({
      success: true,
      message: "Refund request approved and refund processed successfully",
      data: {
        refundRequest: {
          id: refundRequest.id,
          status: RefundRequestStatus.APPROVED,
          reviewedAt: refundRequest.reviewedAt,
        },
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
    console.error("❌ Error approving refund request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve refund request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Deny a refund request (called by tenant admins)
 */
export const denyRefundRequest = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { id } = req.params;
    const { reviewNotes } = req.body;

    const refundRequest = await RefundRequest.findByPk(id);

    if (!refundRequest) {
      return res.status(404).json({
        success: false,
        message: "Refund request not found",
      });
    }

    if (refundRequest.status !== RefundRequestStatus.PENDING) {
      return res.status(400).json({
        success: false,
        message: `Refund request has already been ${refundRequest.status}`,
      });
    }

    await refundRequest.update({
      status: RefundRequestStatus.DENIED,
      reviewedById: currentUser.id,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
    });

    console.log(`❌ Refund request ${refundRequest.id} denied`);

    return res.status(200).json({
      success: true,
      message: "Refund request denied",
      data: {
        refundRequest: {
          id: refundRequest.id,
          status: RefundRequestStatus.DENIED,
          reviewNotes: refundRequest.reviewNotes,
          reviewedAt: refundRequest.reviewedAt,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error denying refund request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to deny refund request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
