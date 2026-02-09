import { getCurrentUser } from "@/config/jwt";
import BrandSubscription, { BrandSubscriptionStatus } from "@/models/BrandSubscription";
import Product from "@/models/Product";
import Questionnaire from "@/models/Questionnaire";
import TenantProduct from "@/models/TenantProduct";
import User from "@/models/User";
import ClinicService from "@/services/clinic.service";
import TenantProductService from "@/services/tenantProduct.service";
import { Request, Response } from "express";

export const getTenants = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }
    
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
    
        const result = await new ClinicService().listTenants({ page, limit });
    
        if (result.success) {
          res.status(200).json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error fetching tenants:", error);
        } else {
          console.error("❌ Error fetching tenants");
        }
    
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
}

export const getTenantById = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }
    
        const { id } = req.params;
        const result = await new ClinicService().getTenantById(id);
    
        if (result.success) {
          res.status(200).json(result);
        } else {
          res.status(404).json(result);
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error fetching tenant:", error);
        } else {
          console.error("❌ Error fetching tenant");
        }
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
}

export const retryProductSelection = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }
  
        const user = await User.findByPk(currentUser.id);
        if (!user || !user.clinicId) {
          return res
            .status(400)
            .json({ success: false, message: "User clinic not found" });
        }
  
        const subscription = await BrandSubscription.findOne({
          where: {
            userId: currentUser.id,
            status: BrandSubscriptionStatus.ACTIVE,
          },
          order: [["createdAt", "DESC"]],
        });
        if (!subscription) {
          return res
            .status(400)
            .json({ success: false, message: "No active subscription found" });
        }
  
        const periodStart = subscription.currentPeriodStart
          ? new Date(subscription.currentPeriodStart)
          : null;
        const periodEnd = subscription.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd)
          : null;
        if (
          (subscription as any).retriedProductSelectionForCurrentCycle &&
          periodStart &&
          periodEnd &&
          new Date() >= periodStart &&
          new Date() < periodEnd
        ) {
          return res
            .status(400)
            .json({
              success: false,
              message: "You already retried once for this billing cycle.",
            });
        }
  
        // Hard delete all mappings for this clinic
        await (
          await import("@/models/TenantProduct")
        ).default.destroy({
          where: { clinicId: user.clinicId } as any,
          force: true,
        } as any);
        await (
          await import("@/models/TenantProductForm")
        ).default.destroy({
          where: { clinicId: user.clinicId } as any,
          force: true,
        } as any);
  
        await subscription.update({
          productsChangedAmountOnCurrentCycle: 0,
          retriedProductSelectionForCurrentCycle: true,
          lastProductChangeAt: new Date(),
        } as any);
  
        res
          .status(200)
          .json({
            success: true,
            message: "Selections cleared. You can choose products again.",
          });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error retrying product selection:", error);
        } else {
          console.error("❌ Error retrying product selection");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to retry product selection" });
      }
}

export const getTenantProductById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
    
        console.log("🏢 [PUBLIC] Fetching tenant product:", id);
    
        const tenantProduct = await TenantProduct.findByPk(id, {
          include: [
            { model: Product, as: "product" },
            { model: Questionnaire, as: "questionnaire" },
          ],
        });
    
        if (!tenantProduct) {
          return res.status(404).json({
            success: false,
            message: "Tenant product not found",
          });
        }
    
        console.log(
          "🏢 [PUBLIC] Found tenant product, productId:",
          tenantProduct.productId
        );
    
        res.json({
          success: true,
          data: {
            id: tenantProduct.id,
            productId: tenantProduct.productId,
            clinicId: tenantProduct.clinicId,
            questionnaireId: tenantProduct.questionnaireId,
            price: tenantProduct.price,
            stripeProductId: tenantProduct.stripeProductId,
            stripePriceId: tenantProduct.stripePriceId,
            product: tenantProduct.product,
            questionnaire: tenantProduct.questionnaire,
          },
        });
      } catch (error: any) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ [PUBLIC] Error fetching tenant product:", error);
        } else {
          console.error("❌ [PUBLIC] Error fetching tenant product");
        }
        res.status(500).json({
          success: false,
          message: error.message || "Failed to fetch tenant product",
        });
      }
}

export const updateProductSelection = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
  
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Not authenticated",
          });
        }
  
        // Validate request body using a relaxed schema that allows missing questionnaireId
        const { z } = require("zod");
        const relaxedItemSchema = z.object({
          productId: z.string().uuid("Invalid product ID"),
          questionnaireId: z.string().uuid("Invalid questionnaire ID").optional(),
        });
        const relaxedSchema = z.object({
          products: z.array(relaxedItemSchema).min(1).max(100),
        });
  
        // Sanitize incoming to drop null questionnaireId values
        const sanitized = {
          products: Array.isArray(req.body?.products)
            ? req.body.products.map((p: any) => {
              const obj: any = { productId: p?.productId };
              if (
                typeof p?.questionnaireId === "string" &&
                p.questionnaireId.length > 0
              ) {
                obj.questionnaireId = p.questionnaireId;
              }
              return obj;
            })
            : [],
        };
  
        const validation = relaxedSchema.safeParse(sanitized);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }
  
        // Create tenant product service instance
        const tenantProductService = new TenantProductService();
  
        // Update product selection
        const tenantProducts = await tenantProductService.updateSelection(
          validation.data,
          currentUser.id
        );
  
        console.log("✅ Tenant products updated:", {
          count: tenantProducts.length,
          userId: currentUser.id,
          // clinicId: currentUser.clinicId
        });
  
        res.status(200).json({
          success: true,
          message: `Successfully updated ${tenantProducts.length} product(s)`,
          data: tenantProducts,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error updating tenant product selection:", error);
        } else {
          console.error("❌ Error updating tenant product selection");
        }
  
        if (error instanceof Error) {
          // Handle specific error types
          if (error.message.includes("not found")) {
            return res.status(404).json({
              success: false,
              message: error.message,
            });
          }
  
          if (
            error.message.includes("Unauthorized") ||
            error.message.includes("does not belong to")
          ) {
            return res.status(403).json({
              success: false,
              message: error.message,
            });
          }
  
          if (error.message.includes("Duplicate")) {
            return res.status(400).json({
              success: false,
              message: error.message,
            });
          }
  
          if (error.message.includes("Product limit exceeded")) {
            return res.status(400).json({
              success: false,
              message: error.message,
            });
          }
  
          if (
            error.message.includes("only change products once per billing cycle")
          ) {
            return res.status(400).json({
              success: false,
              message: error.message,
            });
          }
        }
  
        res.status(500).json({
          success: false,
          message: "Failed to update tenant product selection",
        });
      }
}

export const updateTenantProductPrice = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
    
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Not authenticated",
          });
        }
    
        // Basic validation (schema removed): expect tenantProductId (uuid) and positive price
        const { tenantProductId, price } = req.body || {};
        if (
          typeof tenantProductId !== "string" ||
          tenantProductId.trim().length === 0
        ) {
          return res
            .status(400)
            .json({ success: false, message: "tenantProductId is required" });
        }
        if (typeof price !== "number" || !(price > 0)) {
          return res
            .status(400)
            .json({ success: false, message: "price must be a positive number" });
        }
    
        // Create tenant product service instance
        const tenantProductService = new TenantProductService();
    
        // Update tenant product price
        const result = await tenantProductService.updatePrice({
          tenantProductId,
          price,
          userId: currentUser.id,
        });
    
        if (!result.success) {
          // Handle specific error types
          if (result.error?.includes("not found")) {
            return res.status(404).json({
              success: false,
              message: result.error,
            });
          }
    
          if (result.error?.includes("does not belong to")) {
            return res.status(403).json({
              success: false,
              message: result.error,
            });
          }
    
          return res.status(400).json({
            success: false,
            message: result.error || "Failed to update price",
          });
        }
    
        console.log("✅ Tenant product price updated:", {
          tenantProductId,
          price,
          stripeProductId: result.stripeProductId,
          stripePriceId: result.stripePriceId,
          userId: currentUser.id,
        });
    
        res.status(200).json({
          success: true,
          message: result.message || "Price updated successfully",
          data: {
            tenantProduct: result.tenantProduct,
            stripeProductId: result.stripeProductId,
            stripePriceId: result.stripePriceId,
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error updating tenant product price:", error);
        } else {
          console.error("❌ Error updating tenant product price");
        }
    
        res.status(500).json({
          success: false,
          message: "Failed to update tenant product price",
        });
      }
}

export const getTenantProducts = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
    
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Not authenticated",
          });
        }
    
        const tenantProductService = new TenantProductService();
        const tenantProducts = await tenantProductService.listByClinic(
          currentUser.id
        );
    
        res.status(200).json({
          success: true,
          message: `Retrieved ${tenantProducts.length} tenant product(s)`,
          data: tenantProducts,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error fetching tenant products:", error);
        } else {
          console.error("❌ Error fetching tenant products");
        }
    
        if (error instanceof Error) {
          if (error.message.includes("Unauthorized")) {
            return res.status(403).json({
              success: false,
              message: error.message,
            });
          }
        }
    
        res.status(500).json({
          success: false,
          message: "Failed to fetch tenant products",
        });
      }
}

export const deleteTenantProductById = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
    
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Not authenticated",
          });
        }
    
        const { id } = req.params;
    
        if (!id) {
          return res.status(400).json({
            success: false,
            message: "Tenant product ID is required",
          });
        }
    
        const tenantProductService = new TenantProductService();
        const result = await tenantProductService.delete(id, currentUser.id);
    
        console.log("✅ Tenant product deleted:", {
          tenantProductId: id,
          userId: currentUser.id,
        });
    
        res.status(200).json({
          success: true,
          message: "Tenant product deleted successfully",
          data: result,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error deleting tenant product:", error);
        } else {
          console.error("❌ Error deleting tenant product");
        }
    
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            return res.status(404).json({
              success: false,
              message: error.message,
            });
          }
    
          if (
            error.message.includes("Unauthorized") ||
            error.message.includes("does not belong to")
          ) {
            return res.status(403).json({
              success: false,
              message: error.message,
            });
          }
        }
    
        res.status(500).json({
          success: false,
          message: "Failed to delete tenant product",
        });
      }
}