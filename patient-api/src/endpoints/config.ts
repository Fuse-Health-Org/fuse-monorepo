import { Router } from "express";
import { authenticateJWT } from "../config/jwt";
import { GlobalFees } from "../models/GlobalFees";
import User from "../models/User";
import UserRoles from "../models/UserRoles";

const router = Router();

/**
 * GET /config/fees
 * Returns the platform fee configuration from the database
 * @auth Required (admin only)
 */
router.get("/fees", authenticateJWT, async (req, res) => {
  try {
    console.log("[GET /config/fees] Request received");
    const currentUser = (req as any).user;
    if (!currentUser) {
      console.log("[GET /config/fees] No current user - returning 401");
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }
    console.log("[GET /config/fees] User ID:", currentUser.userId);

    const user = await User.findByPk(currentUser.userId, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });

    if (!user || !user.hasRoleSync("admin")) {
      console.log("[GET /config/fees] User not admin - returning 403");
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    console.log("[GET /config/fees] User is admin, fetching global fees...");

    let globalFees = await GlobalFees.findOne();
    console.log("[GET /config/fees] GlobalFees row found:", !!globalFees);

    if (!globalFees) {
      console.log("[GET /config/fees] Creating default GlobalFees row...");
      globalFees = await GlobalFees.create({
        fuseTransactionFeePercent: 0,
        stripeTransactionFeePercent: 0,
        fuseTransactionDoctorFeeUsd: 0,
        refundProcessingDelayDays: 0,
      });
      console.log("[GET /config/fees] Default row created with ID:", globalFees.id);
    }

    const data = {
      platformFeePercent: Number(globalFees.fuseTransactionFeePercent),
      stripeFeePercent: Number(globalFees.stripeTransactionFeePercent),
      doctorFlatFeeUsd: Number(globalFees.fuseTransactionDoctorFeeUsd),
      refundProcessingDelayDays: Number(globalFees.refundProcessingDelayDays),
    };
    console.log("[GET /config/fees] Returning data:", data);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[GET /config/fees] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch fee configuration",
    });
  }
});

/**
 * PUT /config/fees
 * Updates the platform fee configuration
 * @auth Required (admin only)
 */
router.put("/fees", authenticateJWT, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findByPk(currentUser.userId, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });

    if (!user || !user.hasRoleSync("admin")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { platformFeePercent, stripeFeePercent, doctorFlatFeeUsd, refundProcessingDelayDays } = req.body;

    if (
      (platformFeePercent !== undefined &&
        typeof platformFeePercent !== "number") ||
      (stripeFeePercent !== undefined &&
        typeof stripeFeePercent !== "number") ||
      (doctorFlatFeeUsd !== undefined && typeof doctorFlatFeeUsd !== "number") ||
      (refundProcessingDelayDays !== undefined && typeof refundProcessingDelayDays !== "number")
    ) {
      return res.status(400).json({
        success: false,
        message: "Fee values must be numeric",
      });
    }

    if (
      refundProcessingDelayDays !== undefined &&
      (!Number.isInteger(refundProcessingDelayDays) || refundProcessingDelayDays < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Refund processing delay must be a non-negative integer",
      });
    }

    let globalFees = await GlobalFees.findOne();

    if (!globalFees) {
      globalFees = await GlobalFees.create({
        fuseTransactionFeePercent: platformFeePercent ?? 0,
        stripeTransactionFeePercent: stripeFeePercent ?? 0,
        fuseTransactionDoctorFeeUsd: doctorFlatFeeUsd ?? 0,
        refundProcessingDelayDays: refundProcessingDelayDays ?? 0,
      });
    } else {
      if (platformFeePercent !== undefined) {
        globalFees.fuseTransactionFeePercent = platformFeePercent;
      }
      if (stripeFeePercent !== undefined) {
        globalFees.stripeTransactionFeePercent = stripeFeePercent;
      }
      if (doctorFlatFeeUsd !== undefined) {
        globalFees.fuseTransactionDoctorFeeUsd = doctorFlatFeeUsd;
      }
      if (refundProcessingDelayDays !== undefined) {
        globalFees.refundProcessingDelayDays = refundProcessingDelayDays;
      }
      await globalFees.save();
    }

    return res.status(200).json({
      success: true,
      message: "Fee configuration updated successfully",
      data: {
        platformFeePercent: Number(globalFees.fuseTransactionFeePercent),
        stripeFeePercent: Number(globalFees.stripeTransactionFeePercent),
        doctorFlatFeeUsd: Number(globalFees.fuseTransactionDoctorFeeUsd),
        refundProcessingDelayDays: Number(globalFees.refundProcessingDelayDays),
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to update fee configuration",
    });
  }
});

export default router;
