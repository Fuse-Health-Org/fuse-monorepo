import { Express } from "express";
import TenantProductService from "../services/tenantProduct.service";

export function registerTenantProductsEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  // Update product selection for a clinic
  app.post(
    "/tenant-products/update-selection",
    authenticateJWT,
    async (req, res) => {
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
  );

  // Update tenant product price
  app.post("/tenant-products/update", authenticateJWT, async (req, res) => {
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
  });

  // Get all tenant products for a clinic
  app.get("/tenant-products", authenticateJWT, async (req, res) => {
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
  });

  // Delete a tenant product
  app.delete("/tenant-products/:id", authenticateJWT, async (req, res) => {
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
  });
}
