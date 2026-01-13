import { Express } from "express";
import User from "../models/User";
import UserRoles from "../models/UserRoles";
import Pharmacy from "../models/Pharmacy";
import PharmacyProduct from "../models/PharmacyProduct";
import PharmacyCoverage from "../models/PharmacyCoverage";
import Product from "../models/Product";
import { PharmacyIntegrationService } from "../services/pharmacyIntegration";
import { IronSailService } from "../services/pharmacyIntegration/ironsail.service";

// Helper function to check if user has any of the required roles using UserRoles table
async function userHasAnyRole(userId: string, roles: Array<'patient' | 'doctor' | 'admin' | 'brand' | 'superAdmin' | 'affiliate'>): Promise<boolean> {
  const userRoles = await UserRoles.findOne({ where: { userId } });
  if (!userRoles) return false;
  return userRoles.hasAnyRole(roles);
}

export function registerPharmacyEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  // ============= PHARMACY MANAGEMENT ENDPOINTS =============

  // Get products from a pharmacy's external API
  app.get(
    "/pharmacies/:pharmacySlug/products",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Check if user has admin or brand role using UserRoles table
        const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { pharmacySlug } = req.params;
        const { state, states } = req.query;

        const pharmacyService = new PharmacyIntegrationService();

        // If multiple states are provided, fetch for all of them
        if (states && typeof states === "string") {
          const stateArray = states.split(",").map((s) => s.trim());
          const products = await pharmacyService.getProductsByPharmacyAndStates(
            pharmacySlug,
            stateArray
          );
          return res.json({ success: true, data: products });
        }

        // Single state
        if (state && typeof state === "string") {
          const products = await pharmacyService.getProductsByPharmacy(
            pharmacySlug,
            state
          );
          return res.json({ success: true, data: products });
        }

        return res.status(400).json({
          success: false,
          message: "Either 'state' or 'states' query parameter is required",
        });
      } catch (error: any) {
        console.error(
          "Error fetching pharmacy products:",
          error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({
          success: false,
          message: error.message || "Failed to fetch pharmacy products",
        });
      }
    }
  );

  // Delete an entire pharmacy coverage (and all of its assignments)
  app.delete(
    "/pharmacy-coverage/:coverageId",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Check if user has admin or brand role using UserRoles table
        const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { coverageId } = req.params;

        const coverage = await PharmacyCoverage.findByPk(coverageId);
        if (!coverage) {
          return res
            .status(404)
            .json({ success: false, message: "Pharmacy coverage not found" });
        }

        const deletedAssignments = await PharmacyProduct.destroy({
          where: { pharmacyCoverageId: coverageId },
        });

        await coverage.destroy();

        res.json({
          success: true,
          message: `Deleted pharmacy coverage ${coverageId} and ${deletedAssignments} assignment(s)`,
          deletedAssignments,
        });
      } catch (error) {
        console.error(
          "Error deleting pharmacy coverage:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({
            success: false,
            message: "Failed to delete pharmacy coverage",
          });
      }
    }
  );

  // Update coverage metadata (name / SIG)
  app.patch(
    "/pharmacy-coverage/:coverageId",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Check if user has admin or brand role using UserRoles table
        const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { coverageId } = req.params;
        const { customName, customSig } = req.body ?? {};

        const coverage = await PharmacyCoverage.findByPk(coverageId);

        if (!coverage) {
          return res
            .status(404)
            .json({ success: false, message: "Pharmacy coverage not found" });
        }

        const updates: Partial<PharmacyCoverage> = {};

        if (typeof customName === "string") {
          updates.customName = customName.trim();
        }

        if (typeof customSig === "string") {
          updates.customSig = customSig.trim();
        }

        if (Object.keys(updates).length === 0) {
          return res
            .status(400)
            .json({ success: false, message: "No valid fields provided" });
        }

        await coverage.update(updates);

        res.json({ success: true, data: coverage });
      } catch (error) {
        console.error(
          "Error updating pharmacy coverage:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({
            success: false,
            message: "Failed to update pharmacy coverage",
          });
      }
    }
  );

  // List all pharmacies
  app.get("/pharmacies", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Check if user has admin or brand role using UserRoles table
      const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const pharmacies = await Pharmacy.findAll({
        where: { isActive: true },
        order: [["name", "ASC"]],
      });

      res.json({ success: true, data: pharmacies });
    } catch (error) {
      console.error(
        "Error fetching pharmacies:",
        error instanceof Error ? error.message : String(error)
      );
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch pharmacies" });
    }
  });

  // Get pharmacy assignments for a product
  app.get(
    "/products/:productId/pharmacy-assignments",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Check if user has admin or brand role using UserRoles table
        const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { productId } = req.params;

        const assignments = await PharmacyProduct.findAll({
          where: { productId },
          include: [
            { model: Pharmacy, as: "pharmacy" },
            { model: PharmacyCoverage, as: "pharmacyCoverage" },
          ],
          order: [["state", "ASC"]],
        });

        if (assignments.length > 0) {
          console.log("📋 Returning assignments, first assignment:", {
            pharmacyProductId: assignments[0].pharmacyProductId,
            pharmacyProductName: assignments[0].pharmacyProductName,
            sig: assignments[0].sig,
            form: assignments[0].form,
            rxId: assignments[0].rxId,
            wholesaleCost: assignments[0].pharmacyWholesaleCost,
          });
        }

        res.json({ success: true, data: assignments });
      } catch (error) {
        console.error(
          "Error fetching pharmacy assignments:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({
            success: false,
            message: "Failed to fetch pharmacy assignments",
          });
      }
    }
  );

  // Assign pharmacy to states for a product
  app.post(
    "/products/:productId/pharmacy-assignments",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Check if user has admin or brand role using UserRoles table
        const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { productId } = req.params;
        const {
          pharmacyId,
          states,
          customName,
          customSig,
          pharmacyProductId,
          pharmacyProductName,
          pharmacyWholesaleCost,
          form,
          rxId,
          coverageId,
        } = req.body;

        console.log("📋 Creating pharmacy assignment with data:", {
          pharmacyId,
          states,
          pharmacyProductId,
          pharmacyProductName,
          pharmacyWholesaleCost,
          customName,
          customSig,
          form,
          rxId,
          coverageId,
        });

        if (!pharmacyId) {
          return res.status(400).json({
            success: false,
            message: "pharmacyId is required",
          });
        }

        const stateArray = Array.isArray(states) ? states : [];

        const trimmedCustomName =
          typeof customName === "string" ? customName.trim() : "";
        const trimmedCustomSig =
          typeof customSig === "string" ? customSig.trim() : "";

        let coverage: PharmacyCoverage | null = null;

        if (coverageId) {
          coverage = await PharmacyCoverage.findByPk(coverageId);

          if (!coverage) {
            return res.status(404).json({
              success: false,
              message: "Pharmacy coverage not found",
            });
          }

          if (coverage.productId !== productId) {
            return res.status(400).json({
              success: false,
              message: "Coverage does not belong to the specified product",
            });
          }

          if (coverage.pharmacyId && coverage.pharmacyId !== pharmacyId) {
            console.log(
              `ℹ️  Adding assignment from pharmacy ${pharmacyId} to coverage ${coverage.id} currently associated with pharmacy ${coverage.pharmacyId}.`
            );
          }

          const updates: Partial<PharmacyCoverage> = {};

          if (trimmedCustomName && trimmedCustomName !== coverage.customName) {
            updates.customName = trimmedCustomName;
          }

          if (trimmedCustomSig && trimmedCustomSig !== coverage.customSig) {
            updates.customSig = trimmedCustomSig;
          }

          if (Object.keys(updates).length > 0) {
            await coverage.update(updates);
          }

          if (stateArray.length === 0) {
            return res.status(200).json({
              success: true,
              data: {
                coverage,
                assignments: [],
              },
            });
          }
        } else {
          if (stateArray.length === 0) {
            return res.status(400).json({
              success: false,
              message: "states array is required when creating a new coverage",
            });
          }

          if (!trimmedCustomName || !trimmedCustomSig) {
            return res.status(400).json({
              success: false,
              message: "customName and customSig are required",
            });
          }

          coverage = await PharmacyCoverage.create({
            productId,
            pharmacyId,
            customName: trimmedCustomName,
            customSig: trimmedCustomSig,
          });
        }

        // HACK: For AbsoluteRX, try to find the price from existing Product model
        let wholesaleCost = pharmacyWholesaleCost;
        if (pharmacyProductId && !wholesaleCost) {
          const pharmacy = await Pharmacy.findByPk(pharmacyId);
          if (pharmacy && pharmacy.slug === "absoluterx") {
            console.log(
              "🔍 AbsoluteRX detected - looking up price for SKU:",
              pharmacyProductId
            );
            const existingProduct = await Product.findOne({
              where: { pharmacyProductId: pharmacyProductId.toString() },
            });
            if (existingProduct) {
              wholesaleCost = existingProduct.price;
              console.log(
                "✅ Found price from existing product:",
                wholesaleCost
              );
            } else {
              console.log(
                "⚠️ No existing product found with SKU:",
                pharmacyProductId
              );
            }
          }
        }

        // Create assignments for each state
        const assignments = await Promise.all(
          stateArray.map((state) =>
            PharmacyProduct.create({
              productId,
              pharmacyId,
              pharmacyCoverageId: coverage!.id,
              state,
              pharmacyProductId,
              pharmacyProductName,
              pharmacyWholesaleCost: wholesaleCost,
              sig: trimmedCustomSig || coverage!.customSig,
              form,
              rxId,
            })
          )
        );

        console.log("✅ Created pharmacy coverage with assignments:", {
          coverageId: coverage!.id,
          customName: coverage!.customName,
          statesCount: assignments.length,
          exampleAssignment: assignments[0]
            ? {
              state: assignments[0].state,
              pharmacyProductId: assignments[0].pharmacyProductId,
              pharmacyProductName: assignments[0].pharmacyProductName,
              wholesaleCost: assignments[0].pharmacyWholesaleCost,
            }
            : null,
        });

        res.status(201).json({
          success: true,
          data: {
            coverage,
            assignments,
          },
        });
      } catch (error: any) {
        console.error(
          "Error creating pharmacy assignments:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({
            success: false,
            message: error.message || "Failed to create pharmacy assignments",
          });
      }
    }
  );

  // Update pharmacy assignment
  app.put("/pharmacy-assignments/:id", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Check if user has admin or brand role using UserRoles table
      const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const { id } = req.params;
      const { pharmacyProductId, pharmacyProductName, pharmacyWholesaleCost } =
        req.body;

      const assignment = await PharmacyProduct.findByPk(id);

      if (!assignment) {
        return res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
      }

      await assignment.update({
        pharmacyProductId,
        pharmacyProductName,
        pharmacyWholesaleCost,
      });

      res.json({ success: true, data: assignment });
    } catch (error) {
      console.error(
        "Error updating pharmacy assignment:",
        error instanceof Error ? error.message : String(error)
      );
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to update pharmacy assignment",
        });
    }
  });

  // Delete pharmacy assignment
  app.delete("/pharmacy-assignments/:id", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Check if user has admin or brand role using UserRoles table
      const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const { id } = req.params;

      const assignment = await PharmacyProduct.findByPk(id);
      if (!assignment) {
        return res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
      }

      const coverageId = (assignment as any).pharmacyCoverageId as
        | string
        | undefined;

      await assignment.destroy();

      if (coverageId) {
        const remainingAssignments = await PharmacyProduct.count({
          where: { pharmacyCoverageId: coverageId },
        });

        if (remainingAssignments === 0) {
          await PharmacyCoverage.destroy({
            where: { id: coverageId },
          });
          console.log(
            `🗑️ Removed empty pharmacy coverage ${coverageId} after deleting last assignment.`
          );
        }
      }

      res.json({ success: true, message: "Pharmacy assignment deleted" });
    } catch (error) {
      console.error(
        "Error deleting pharmacy assignment:",
        error instanceof Error ? error.message : String(error)
      );
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to delete pharmacy assignment",
        });
    }
  });

  // Delete all pharmacy assignments for a product and pharmacy
  app.delete(
    "/products/:productId/pharmacies/:pharmacyId/assignments",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Check if user has admin or brand role using UserRoles table
        const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { productId, pharmacyId } = req.params;

        const coverageIds = await PharmacyCoverage.findAll({
          where: { productId, pharmacyId },
          attributes: ["id"],
        });

        const deletedCount = await PharmacyProduct.destroy({
          where: {
            productId,
            pharmacyId,
          },
        });

        if (coverageIds.length > 0) {
          await PharmacyCoverage.destroy({
            where: {
              id: coverageIds.map((c) => c.id),
            },
          });
        }

        res.json({
          success: true,
          message: `Deleted ${deletedCount} pharmacy assignment(s)`,
          deletedCount,
        });
      } catch (error) {
        console.error(
          "Error deleting pharmacy assignments:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({
            success: false,
            message: "Failed to delete pharmacy assignments",
          });
      }
    }
  );

  // Delete all auto-imported products from IronSail
  app.delete(
    "/pharmacies/ironsail/delete-all-imported",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Check if user has admin or brand role using UserRoles table
        const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        console.log(
          "🗑️ Starting deletion of all auto-imported IronSail products..."
        );

        // Find all products with isAutoImported flag OR [Auto-Imported] name prefix (for backwards compatibility)
        const autoImportedProducts = await Product.findAll({
          where: {
            [require("sequelize").Op.or]: [
              { isAutoImported: true },
              { name: { [require("sequelize").Op.like]: "[Auto-Imported]%" } },
            ],
          },
        });

        console.log(
          `📋 Found ${autoImportedProducts.length} auto-imported products to delete`
        );

        if (autoImportedProducts.length === 0) {
          return res.json({
            success: true,
            message: "No auto-imported products found to delete",
            data: {
              deleted: 0,
              productIds: [],
            },
          });
        }

        const productIds = autoImportedProducts.map((p) => p.id);
        const productNames = autoImportedProducts.map((p) => p.name);

        // Delete all pharmacy assignments and coverage records for these products
        const deletedAssignmentsCount = await PharmacyProduct.destroy({
          where: {
            productId: productIds,
          },
        });

        const deletedCoverageRows = await PharmacyCoverage.destroy({
          where: {
            productId: productIds,
          },
        });

        console.log(
          `✅ Deleted ${deletedAssignmentsCount} pharmacy assignment records and ${deletedCoverageRows} coverage rows`
        );

        // Delete all products
        const deletedProductCount = await Product.destroy({
          where: {
            id: productIds,
          },
          force: true, // Hard delete
        });

        console.log(`✅ Deleted ${deletedProductCount} products`);

        res.json({
          success: true,
          message: `Deleted ${deletedProductCount} auto-imported products`,
          data: {
            deleted: deletedProductCount,
            deletedCoverage: deletedAssignmentsCount,
            productIds: productIds,
            productNames: productNames,
          },
        });
      } catch (error: any) {
        console.error(
          "❌ Error deleting auto-imported products:",
          error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({
          success: false,
          message: error.message || "Failed to delete products",
        });
      }
    }
  );

  // Import products from IronSail spreadsheet
  app.post(
    "/pharmacies/ironsail/import-products",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Check if user has admin or brand role using UserRoles table
        const hasAccess = await userHasAnyRole(user.id, ['admin', 'brand']);
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        console.log("📦 Starting IronSail product import...");

        // Find IronSail pharmacy
        const ironsailPharmacy = await Pharmacy.findOne({
          where: { slug: "ironsail" },
        });

        if (!ironsailPharmacy) {
          return res.status(404).json({
            success: false,
            message: "IronSail pharmacy not found. Please create it first.",
          });
        }

        // Fetch products from spreadsheet
        const ironSailService = new IronSailService();
        const spreadsheetProducts = await ironSailService.getProducts();

        console.log(
          `📋 Found ${spreadsheetProducts.length} products in spreadsheet`
        );

        const imported: Array<{
          id: string;
          name: string;
          states: number;
          wholesalePrice?: number;
          rxId?: string;
        }> = [];
        const skipped: Array<{ name: string; reason: string }> = [];
        const errors: Array<{ name: string; error: string }> = [];

        // Process each product
        for (const sheetProduct of spreadsheetProducts) {
          try {
            // Skip if no medication name
            if (!sheetProduct.medicationName) {
              skipped.push({
                name: sheetProduct.name || "Unknown",
                reason: "No medication name",
              });
              continue;
            }

            // Check if product already exists (by pharmacy product ID or medication name)
            const existingProduct = await Product.findOne({
              where: {
                name: sheetProduct.medicationName,
                isAutoImported: true,
              },
            });

            if (existingProduct) {
              skipped.push({
                name: sheetProduct.medicationName,
                reason: "Product already exists",
              });
              continue;
            }

            // Determine category based on display name
            let category = "wellness"; // Default category
            const displayNameLower = (
              sheetProduct.displayName || ""
            ).toLowerCase();

            if (
              displayNameLower.includes("semaglutide") ||
              displayNameLower.includes("tirzepatide") ||
              displayNameLower.includes("retatrutide")
            ) {
              category = "weight_loss";
            } else if (
              displayNameLower.includes("nad") ||
              displayNameLower.includes("glutathione") ||
              displayNameLower.includes("sermorelin") ||
              displayNameLower.includes("bpc")
            ) {
              category = "performance";
            }

            // Create the product
            const product = await Product.create({
              name: sheetProduct.medicationName,
              description: `${sheetProduct.medicationName} - ${sheetProduct.form || "Injectable"}`,
              price: sheetProduct.wholesalePrice || sheetProduct.price || 0,
              activeIngredients: [
                sheetProduct.displayName || sheetProduct.medicationName,
              ],
              placeholderSig:
                sheetProduct.sig ||
                "Take as directed by your healthcare provider",
              pharmacyProductId: sheetProduct.rxId,
              pharmacyWholesaleCost: sheetProduct.wholesalePrice,
              pharmacyProvider: 'ironsail',
              isAutoImported: true,
              isActive: true,
              categories: [category],
            });

            console.log(
              `✅ Created product: ${product.name} (ID: ${product.id})`
            );

            // Parse states and create pharmacy coverage
            const states = sheetProduct.states || [];

            if (states.length > 0) {
              const coverageRecords = await Promise.all(
                states.map((state) =>
                  PharmacyProduct.create({
                    productId: product.id,
                    pharmacyId: ironsailPharmacy.id,
                    state: state,
                    pharmacyProductId: sheetProduct.rxId,
                    pharmacyProductName: sheetProduct.medicationName,
                    pharmacyWholesaleCost: sheetProduct.wholesalePrice,
                    sig: sheetProduct.sig,
                    form: sheetProduct.form,
                    rxId: sheetProduct.rxId,
                  })
                )
              );

              console.log(
                `✅ Created ${coverageRecords.length} pharmacy coverage records for ${states.length} states`
              );
            }

            imported.push({
              id: product.id,
              name: product.name,
              states: states.length,
              wholesalePrice: sheetProduct.wholesalePrice,
              rxId: sheetProduct.rxId,
            });
          } catch (error: any) {
            console.error(
              `❌ Error importing product ${sheetProduct.medicationName}:`,
              error instanceof Error ? error.message : String(error)
            );
            errors.push({
              name: sheetProduct.medicationName || "Unknown",
              error: error.message,
            });
          }
        }

        console.log(`\n📊 Import Summary:`);
        console.log(`  ✅ Imported: ${imported.length}`);
        console.log(`  ⏭️  Skipped: ${skipped.length}`);
        console.log(`  ❌ Errors: ${errors.length}`);

        res.json({
          success: true,
          message: `Imported ${imported.length} products, skipped ${skipped.length}, encountered ${errors.length} error(s).`,
          data: {
            imported,
            skipped,
            errors,
          },
        });
      } catch (error: any) {
        console.error(
          "❌ Error deleting auto-imported products:",
          error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({
          success: false,
          message: error.message || "Failed to delete products",
        });
      }
    }
  );
}
