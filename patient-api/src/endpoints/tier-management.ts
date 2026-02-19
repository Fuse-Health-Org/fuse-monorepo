import { Express } from "express";
import User from "../models/User";
import UserRoles from "../models/UserRoles";
import BrandSubscriptionPlans from "../models/BrandSubscriptionPlans";
import TierConfiguration from "../models/TierConfiguration";

export function registerTierManagementEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  // Update a subscription plan (e.g., maxProducts)
  app.patch("/admin/plans/:planId", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: 'userRoles' }]
      });
      if (!user || !user.hasAnyRoleSync(['admin', 'superAdmin'])) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const { planId } = req.params;
      const { maxProducts, name, monthlyPrice, introMonthlyPrice, introMonthlyPriceDurationMonths, stripePriceId, introMonthlyPriceStripeId } = req.body;

      console.log(`🔍 [Plan PATCH] planId=${planId} body=`, req.body);

      const plan = await BrandSubscriptionPlans.findByPk(planId);
      if (!plan) {
        console.warn(`⚠️ [Plan PATCH] Plan not found: ${planId}`);
        return res.status(404).json({ success: false, message: "Plan not found" });
      }

      const updates: any = {};

      if (typeof maxProducts === "number") {
        updates.maxProducts = maxProducts;
      }

      if (typeof name === "string" && name.trim() !== "") {
        updates.name = name.trim();
      }

      // monthlyPrice: allow setting a valid positive number (including 0)
      if (monthlyPrice !== undefined && monthlyPrice !== null) {
        const parsed = parseFloat(String(monthlyPrice));
        if (!isNaN(parsed) && parsed >= 0) {
          updates.monthlyPrice = parsed;
        } else {
          console.warn(`⚠️ [Plan PATCH] Invalid monthlyPrice value: ${monthlyPrice}`);
        }
      }

      // introMonthlyPrice: allow setting a number or null to clear
      if (introMonthlyPrice !== undefined) {
        updates.introMonthlyPrice = introMonthlyPrice === null ? null : parseFloat(introMonthlyPrice);
      }

      // introMonthlyPriceDurationMonths: allow setting a number or null to clear
      if (introMonthlyPriceDurationMonths !== undefined) {
        updates.introMonthlyPriceDurationMonths = introMonthlyPriceDurationMonths === null ? null : parseInt(introMonthlyPriceDurationMonths);
      }

      // stripePriceId: allow setting a string or clearing
      if (typeof stripePriceId === "string" && stripePriceId.trim() !== "") {
        updates.stripePriceId = stripePriceId.trim();
      }

      // introMonthlyPriceStripeId: allow setting a string or null to clear
      if (introMonthlyPriceStripeId !== undefined) {
        updates.introMonthlyPriceStripeId = typeof introMonthlyPriceStripeId === "string" && introMonthlyPriceStripeId.trim() !== "" 
          ? introMonthlyPriceStripeId.trim() 
          : null;
      }

      if (Object.keys(updates).length === 0) {
        console.warn(`⚠️ [Plan PATCH] No valid fields to update for planId=${planId}`);
        return res.status(400).json({ success: false, message: "No valid fields to update" });
      }

      console.log(`📝 [Plan PATCH] Applying updates to ${plan.name}:`, updates);
      await plan.update(updates, { validate: false });
      console.log(`✅ [Plan PATCH] Updated plan ${plan.name}:`, updates);

      res.status(200).json({
        success: true,
        message: "Plan updated successfully",
        data: plan.toJSON(),
      });
    } catch (error) {
      console.error("❌ [Plan PATCH] Error updating plan:", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message: `Failed to update plan: ${message}` });
    }
  });

  // Get all tiers with their configurations
  app.get("/admin/tiers", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: 'userRoles' }]
      });
      if (!user || !user.hasAnyRoleSync(['admin', 'superAdmin'])) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      console.log("🔍 [Tier Management] GET /admin/tiers called");

      const plans = await BrandSubscriptionPlans.findAll({
        where: { isActive: true },
        order: [
          ["sortOrder", "ASC"],
          ["name", "ASC"],
        ],
      });

      console.log("🔍 [Tier Management] Found active plans:", plans.length);

      // Fetch tier configurations for each plan
      const tiersWithConfig = await Promise.all(
        plans.map(async (plan) => {
          const config = await TierConfiguration.findOne({
            where: { brandSubscriptionPlanId: plan.id },
          });

          console.log(
            `📋 [Tier Management] Plan: ${plan.name}, Config:`,
            config ? "Found" : "Not found"
          );

          return {
            plan: plan.toJSON(),
            config: config ? config.toJSON() : null,
          };
        })
      );

      console.log(
        "📤 [Tier Management] Sending response with",
        tiersWithConfig.length,
        "tiers"
      );
      res.status(200).json({ success: true, data: tiersWithConfig });
    } catch (error) {
      console.error(
        "❌ Error fetching tiers:",
        error instanceof Error ? error.message : String(error)
      );
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch tiers" });
    }
  });

  // Update tier configuration
  app.patch(
    "/admin/tiers/:planId/config",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: 'userRoles' }]
        });
        if (!user || !user.hasAnyRoleSync(['admin', 'superAdmin'])) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        console.log(
          "🔍 [Tier Management] PATCH /admin/tiers/:planId/config called"
        );

        const { planId } = req.params;
        const {
          canAddCustomProducts,
          hasAccessToAnalytics,
          canUploadCustomProductImages,
          hasCustomPortal,
          hasPrograms,
          canCustomizeFormStructure,
          customTierCardText,
          isCustomTierCardTextActive,
          fuseFeePercent,
          merchantServiceFeePercent,
        } = req.body;

        // Check if plan exists
        const plan = await BrandSubscriptionPlans.findByPk(planId);
        if (!plan) {
          return res
            .status(404)
            .json({ success: false, message: "Plan not found" });
        }

        // Find or create tier configuration
        let config = await TierConfiguration.findOne({
          where: { brandSubscriptionPlanId: planId },
        });

        if (!config) {
          config = await TierConfiguration.create({
            brandSubscriptionPlanId: planId,
            canAddCustomProducts:
              typeof canAddCustomProducts === "boolean"
                ? canAddCustomProducts
                : false,
            hasAccessToAnalytics:
              typeof hasAccessToAnalytics === "boolean"
                ? hasAccessToAnalytics
                : false,
            canUploadCustomProductImages:
              typeof canUploadCustomProductImages === "boolean"
                ? canUploadCustomProductImages
                : false,
            hasCustomPortal:
              typeof hasCustomPortal === "boolean"
                ? hasCustomPortal
                : false,
            hasPrograms:
              typeof hasPrograms === "boolean"
                ? hasPrograms
                : false,
            canCustomizeFormStructure:
              typeof canCustomizeFormStructure === "boolean"
                ? canCustomizeFormStructure
                : false,
            customTierCardText:
              Array.isArray(customTierCardText)
                ? customTierCardText
                : null,
            isCustomTierCardTextActive:
              typeof isCustomTierCardTextActive === "boolean"
                ? isCustomTierCardTextActive
                : false,
            fuseFeePercent:
              typeof fuseFeePercent === "number"
                ? fuseFeePercent
                : null,
            merchantServiceFeePercent:
              typeof merchantServiceFeePercent === "number"
                ? merchantServiceFeePercent
                : null,
          });
          console.log(`✅ Created TierConfiguration for plan: ${plan.name}`);
        } else {
          const updates: any = {};

          if (typeof canAddCustomProducts === "boolean") {
            updates.canAddCustomProducts = canAddCustomProducts;
          }

          if (typeof hasAccessToAnalytics === "boolean") {
            updates.hasAccessToAnalytics = hasAccessToAnalytics;
          }

          if (typeof canUploadCustomProductImages === "boolean") {
            updates.canUploadCustomProductImages = canUploadCustomProductImages;
          }

          if (typeof hasCustomPortal === "boolean") {
            updates.hasCustomPortal = hasCustomPortal;
          }

          if (typeof hasPrograms === "boolean") {
            updates.hasPrograms = hasPrograms;
          }

          if (typeof canCustomizeFormStructure === "boolean") {
            updates.canCustomizeFormStructure = canCustomizeFormStructure;
          }

          if (customTierCardText !== undefined) {
            updates.customTierCardText = Array.isArray(customTierCardText)
              ? customTierCardText
              : null;
          }

          if (typeof isCustomTierCardTextActive === "boolean") {
            updates.isCustomTierCardTextActive = isCustomTierCardTextActive;
          }

          if (fuseFeePercent !== undefined) {
            updates.fuseFeePercent = typeof fuseFeePercent === "number" ? fuseFeePercent : null;
          }

          if (merchantServiceFeePercent !== undefined) {
            updates.merchantServiceFeePercent = typeof merchantServiceFeePercent === "number" ? merchantServiceFeePercent : null;
          }

          await config.update(updates);
          console.log(
            `✅ Updated TierConfiguration for plan: ${plan.name}`,
            updates
          );
        }

        res.status(200).json({
          success: true,
          message: "Tier configuration updated successfully",
          data: config.toJSON(),
        });
      } catch (error) {
        console.error(
          "❌ Error updating tier configuration:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({
            success: false,
            message: "Failed to update tier configuration",
          });
      }
    }
  );
}
