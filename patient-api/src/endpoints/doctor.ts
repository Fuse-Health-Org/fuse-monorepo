import { Express, Request, Response } from "express";
import { Op } from "sequelize";
import User from "../models/User";
import UserRoles from "../models/UserRoles";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Clinic from "../models/Clinic";
import TenantProduct from "../models/TenantProduct";
import Product from "../models/Product";
import Treatment from "../models/Treatment";
import ShippingAddress from "../models/ShippingAddress";
import OrderService from "../services/order.service";
import PharmacyProduct from "../models/PharmacyProduct";
import PharmacyCoverage from "../models/PharmacyCoverage";
import Pharmacy from "../models/Pharmacy";
import Program from "../models/Program";
import IronSailOrderService from "../services/pharmacy/ironsail-order";
import {
  AuditService,
  AuditAction,
  AuditResourceType,
} from "../services/audit.service";

export function registerDoctorEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  // ============= DOCTOR PORTAL ENDPOINTS =============

  // Get all clinics for filters
  app.get("/doctor/clinics", authenticateJWT, async (req: any, res: any) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      // Fetch all clinics
      const clinics = await Clinic.findAll({
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      });

      res.json({
        success: true,
        data: clinics,
      });
    } catch (error) {
      console.error(
        "❌ Error fetching clinics:",
        error instanceof Error ? error.message : String(error)
      );
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch clinics" });
    }
  });

  // Get tenant products for filters
  app.get(
    "/doctor/tenant-products",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res
            .status(403)
            .json({ success: false, message: "User not found" });
        }

        // Build where clause
        const whereClause: any = {};

        // If user has a clinicId, filter by that clinic
        if (user.clinicId) {
          whereClause.clinicId = user.clinicId;
        }

        // Fetch tenant products
        const tenantProducts = await TenantProduct.findAll({
          where: whereClause,
          include: [
            {
              model: Product,
              as: "product",
              attributes: [
                "id",
                "name",
                "description",
                "placeholderSig",
                "categories",
              ],
            },
          ],
          order: [["createdAt", "DESC"]],
        });

        res.json({
          success: true,
          data: tenantProducts.map((tp) => ({
            id: tp.id,
            name: tp.product?.name || "Product",
            description: tp.product?.description,
            placeholderSig: tp.product?.placeholderSig,
            category: Array.isArray((tp.product as any)?.categories)
              ? ((tp.product as any).categories[0] ?? null)
              : null,
            categories: Array.isArray((tp.product as any)?.categories)
              ? (tp.product as any).categories
              : [],
            isActive: tp.isActive,
          })),
        });
      } catch (error) {
        console.error(
          "❌ Error fetching tenant products:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch tenant products" });
      }
    }
  );

  // Get pending orders for doctor's clinic
  app.get(
    "/doctor/orders/pending",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }

        // Fetch full user data to get clinicId and roles
        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: 'userRoles' }]
        });
        if (!user) {
          return res
            .status(403)
            .json({ success: false, message: "User not found" });
        }

        if (!user.hasAnyRoleSync(['doctor', 'admin'])) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Doctor or admin role required.",
          });
        }

        // Parse filters from query params
        const {
          status,
          tenantProductId,
          clinicId,
          patientId,
          patientSearch,
          dateFrom,
          dateTo,
          patientAge,
          patientGender,
          limit = "50",
          offset = "0",
        } = req.query as any;

        // Build where clause - show orders ready for doctor review
        const whereClause: any = {
          // Show orders with tenantProductId OR programId (product or program orders)
          [Op.or]: [
            { tenantProductId: { [Op.ne]: null } },
            { programId: { [Op.ne]: null } },
          ],
          // Show: amount_capturable_updated (authorized payment awaiting approval), paid orders, and beyond
          status: status || {
            [Op.in]: [
              "amount_capturable_updated",
              "paid",
              "processing",
              "shipped",
              "delivered",
            ],
          },
        };

        // Optional clinic filter
        if (clinicId) {
          whereClause.clinicId = clinicId;
        }

        if (tenantProductId) {
          whereClause.tenantProductId = tenantProductId;
        }

        // Optional patient filter
        if (patientId) {
          whereClause.userId = patientId;
        }

        if (dateFrom || dateTo) {
          whereClause.createdAt = {};
          if (dateFrom) whereClause.createdAt[Op.gte] = new Date(dateFrom);
          if (dateTo) whereClause.createdAt[Op.lte] = new Date(dateTo);
        }

        // Build user include with optional search filter
        const userInclude: any = {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "phoneNumber",
            "dob",
            "gender",
            "address",
            "city",
            "state",
            "zipCode",
          ],
        };

        // Add patient search filter if provided
        if (patientSearch) {
          userInclude.where = {
            [Op.or]: [
              { firstName: { [Op.iLike]: `%${patientSearch}%` } },
              { lastName: { [Op.iLike]: `%${patientSearch}%` } },
              { email: { [Op.iLike]: `%${patientSearch}%` } },
            ],
          };
        }

        // Fetch orders with TenantProduct
        const orders = await Order.findAll({
          where: whereClause,
          include: [
            userInclude,
            {
              model: Treatment,
              as: "treatment",
              attributes: ["id", "name", "category"],
            },
            {
              model: ShippingAddress,
              as: "shippingAddress",
            },
            {
              model: TenantProduct,
              as: "tenantProduct",
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: [
                    "id",
                    "name",
                    "description",
                    "placeholderSig",
                    "categories",
                  ],
                },
              ],
            },
            {
              model: Clinic,
              as: "clinic",
              attributes: ["id", "name"],
            },
            {
              model: Program,
              as: "program",
              attributes: [
                "id",
                "name",
                "description",
                "hasPatientPortal",
                "patientPortalPrice",
                "hasBmiCalculator",
                "bmiCalculatorPrice",
                "hasProteinIntakeCalculator",
                "proteinIntakeCalculatorPrice",
                "hasCalorieDeficitCalculator",
                "calorieDeficitCalculatorPrice",
                "hasEasyShopping",
                "easyShoppingPrice",
              ],
              required: false,
            },
            {
              model: OrderItem,
              as: "orderItems",
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["id", "name", "imageUrl", "placeholderSig"],
                },
              ],
              required: false,
            },
          ],
          order: [["createdAt", "DESC"]],
          limit: Math.min(parseInt(limit), 200),
          offset: parseInt(offset),
        });

        // Note: Demographics filtering removed as fields don't exist on User model
        // Age and gender can be added when User model is updated
        const filteredOrders = orders;

        // HIPAA Audit: Log bulk PHI access (doctor viewing pending orders with patient info)
        await AuditService.logFromRequest(req, {
          action: AuditAction.VIEW,
          resourceType: AuditResourceType.ORDER,
          details: {
            bulkAccess: true,
            orderCount: filteredOrders.length,
            filters: { status, clinicId, patientSearch },
          },
        });

        res.json({
          success: true,
          data: filteredOrders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            totalAmount: order.totalAmount,
            approvedByDoctor: order.approvedByDoctor,
            autoApprovedByDoctor: order.autoApprovedByDoctor,
            autoApprovalReason: order.autoApprovalReason,
            doctorNotes: order.doctorNotes,
            patient: order.user
              ? {
                  id: order.user.id,
                  firstName: order.user.firstName,
                  lastName: order.user.lastName,
                  email: order.user.email,
                  phoneNumber: order.user.phoneNumber,
                  dateOfBirth: order.user.dob,
                  gender: order.user.gender,
                  address: order.user.address,
                  city: order.user.city,
                  state: order.user.state,
                  zipCode: order.user.zipCode,
                }
              : null,
            treatment: order.treatment,
            tenantProduct: order.tenantProduct
              ? {
                  id: order.tenantProduct.id,
                  name: order.tenantProduct.product?.name || "Product",
                  description: order.tenantProduct.product?.description,
                  placeholderSig: order.tenantProduct.product?.placeholderSig,
                  category: Array.isArray(
                    (order.tenantProduct.product as any)?.categories
                  )
                    ? ((order.tenantProduct.product as any).categories[0] ??
                      null)
                    : null,
                  categories: Array.isArray(
                    (order.tenantProduct.product as any)?.categories
                  )
                    ? (order.tenantProduct.product as any).categories
                    : [],
                }
              : null,
            clinic: order.clinic
              ? {
                  id: order.clinic.id,
                  name: order.clinic.name,
                }
              : null,
            // Program data for program-based orders
            programId: order.programId,
            program: order.program
              ? {
                  id: order.program.id,
                  name: order.program.name,
                  description: order.program.description,
                  hasPatientPortal: order.program.hasPatientPortal,
                  patientPortalPrice: order.program.patientPortalPrice,
                  hasBmiCalculator: order.program.hasBmiCalculator,
                  bmiCalculatorPrice: order.program.bmiCalculatorPrice,
                  hasProteinIntakeCalculator: order.program.hasProteinIntakeCalculator,
                  proteinIntakeCalculatorPrice: order.program.proteinIntakeCalculatorPrice,
                  hasCalorieDeficitCalculator: order.program.hasCalorieDeficitCalculator,
                  calorieDeficitCalculatorPrice: order.program.calorieDeficitCalculatorPrice,
                  hasEasyShopping: order.program.hasEasyShopping,
                  easyShoppingPrice: order.program.easyShoppingPrice,
                }
              : null,
            // Order items for multi-product orders (programs)
            orderItems: order.orderItems?.map((item: any) => ({
              id: item.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              placeholderSig: item.placeholderSig,
              product: item.product
                ? {
                    id: item.product.id,
                    name: item.product.name,
                    imageUrl: item.product.imageUrl,
                    placeholderSig: item.product.placeholderSig,
                  }
                : null,
            })) || [],
            shippingAddress: order.shippingAddress,
            questionnaireAnswers: order.questionnaireAnswers,
            mdCaseId: order.mdCaseId,
            mdPrescriptions: order.mdPrescriptions,
            mdOfferings: order.mdOfferings,
          })),
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: filteredOrders.length,
          },
        });
      } catch (error) {
        console.error(
          "❌ Error fetching pending orders for doctor:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch pending orders" });
      }
    }
  );

  // Bulk approve orders
  app.post(
    "/doctor/orders/bulk-approve",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: 'userRoles' }]
        });
        if (!user) {
          return res
            .status(401)
            .json({ success: false, message: "User not found" });
        }

        if (!user.hasAnyRoleSync(['doctor', 'admin'])) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Doctor or admin role required.",
          });
        }

        const { orderIds } = req.body;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: "orderIds array is required" });
        }

        console.log("✅ Bulk approve request received", {
          orderCount: orderIds.length,
        });

        // Fetch all orders - doctors and admins can approve any order
        const orders = await Order.findAll({
          where: {
            id: { [Op.in]: orderIds },
          },
        });

        if (orders.length !== orderIds.length) {
          console.log("⚠️ Some orders not found:", {
            requested: orderIds.length,
            found: orders.length,
          });
          return res.status(404).json({
            success: false,
            message: "Some orders do not exist.",
          });
        }

        // Approve each order
        const orderService = new OrderService();
        const results: any[] = [];

        for (const order of orders) {
          try {
            const result = await orderService.approveOrder(order.id);
            results.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              ...result,
            });
          } catch (error) {
            results.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              success: false,
              message: "Failed to approve order",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        const successCount = results.filter((r: any) => r.success).length;
        const failCount = results.length - successCount;

        // HIPAA Audit: Log bulk order approval (doctor approving patient treatments)
        await AuditService.logFromRequest(req, {
          action: AuditAction.UPDATE,
          resourceType: AuditResourceType.ORDER,
          details: {
            bulkApproval: true,
            orderIds,
            successCount,
            failCount,
          },
        });

        res.json({
          success: true,
          message: `Bulk approval completed: ${successCount} succeeded, ${failCount} failed`,
          data: {
            results,
            summary: {
              total: results.length,
              succeeded: successCount,
              failed: failCount,
            },
          },
        });
      } catch (error) {
        console.error(
          "❌ Error bulk approving orders:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({ success: false, message: "Failed to bulk approve orders" });
      }
    }
  );

  // Cancel an order
  app.post(
    "/doctor/orders/:orderId/cancel",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: 'userRoles' }]
        });
        if (!user) {
          return res
            .status(401)
            .json({ success: false, message: "User not found" });
        }

        if (!user.hasAnyRoleSync(['doctor', 'admin'])) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Doctor or admin role required.",
          });
        }

        const { orderId } = req.params;

        // Find the order
        const order = await Order.findByPk(orderId);
        if (!order) {
          return res.status(404).json({
            success: false,
            message: "Order not found",
          });
        }

        // Check if order is already cancelled
        if (order.status === 'cancelled') {
          return res.status(400).json({
            success: false,
            message: "Order is already cancelled",
          });
        }

        // Check if order can be cancelled (not already shipped/delivered)
        if (['shipped', 'delivered'].includes(order.status)) {
          return res.status(400).json({
            success: false,
            message: `Cannot cancel order with status: ${order.status}`,
          });
        }

        // Update order status to cancelled
        await order.update({ status: 'cancelled' });

        // Log the audit
        await AuditService.log({
          userId: currentUser.id,
          action: AuditAction.UPDATE,
          resourceType: AuditResourceType.ORDER,
          resourceId: order.id,
          details: {
            previousStatus: order.status,
            newStatus: 'cancelled',
            cancelledBy: currentUser.id,
          },
          success: true,
        });

        console.log(`✅ Order ${order.orderNumber} cancelled by doctor ${currentUser.id}`);

        res.json({
          success: true,
          message: `Order ${order.orderNumber} has been cancelled`,
        });
      } catch (error) {
        console.error(
          "❌ Error cancelling order:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({ success: false, message: "Failed to cancel order" });
      }
    }
  );

  // Get pharmacy coverage for an order (returns ALL coverages for the product)
  app.get(
    "/doctor/orders/:orderId/pharmacy-coverage",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: 'userRoles' }]
        });
        if (!user || !user.hasAnyRoleSync(['doctor', 'admin'])) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Doctor or admin role required.",
          });
        }

        const { orderId } = req.params;

        // Fetch order with product and patient state (including program order items)
        const order = await Order.findOne({
          where: { id: orderId },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "state"],
            },
            {
              model: ShippingAddress,
              as: "shippingAddress",
              attributes: ["state"],
            },
            {
              model: TenantProduct,
              as: "tenantProduct",
              required: false,
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["id", "name", "placeholderSig"],
                },
              ],
            },
            {
              model: OrderItem,
              as: "orderItems",
              required: false,
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["id", "name", "placeholderSig"],
                },
              ],
            },
            {
              model: Program,
              as: "program",
              required: false,
              attributes: ["id", "name"],
            },
          ],
        });

        if (!order) {
          return res
            .status(404)
            .json({ success: false, message: "Order not found" });
        }

        // Determine patient's state (prefer shipping address)
        const patientState = order.shippingAddress?.state || order.user?.state;
        
        // Check if this is a program order (has orderItems) or regular product order
        const isProgramOrder = order.programId && order.orderItems && order.orderItems.length > 0;

        if (!patientState) {
          return res.json({
            success: false,
            hasCoverage: false,
            error: "Patient state not found",
          });
        }

        // For program orders, get all product IDs from order items
        // For regular orders, get product ID from tenantProduct
        let productIds: string[] = [];
        
        if (isProgramOrder) {
          productIds = order.orderItems
            .filter((item: any) => item.product?.id)
            .map((item: any) => item.product.id);
        } else if (order.tenantProduct?.product?.id) {
          productIds = [order.tenantProduct.product.id];
        }

        if (productIds.length === 0) {
          return res.json({
            success: false,
            hasCoverage: false,
            error: "No products found for order",
          });
        }

        // Find ALL pharmacy coverages for all products in the patient's state
        const coverages = await PharmacyProduct.findAll({
          where: {
            productId: { [Op.in]: productIds },
            state: patientState,
          },
          include: [
            {
              model: Pharmacy,
              as: "pharmacy",
              attributes: ["id", "name", "slug", "isActive"],
            },
            {
              model: PharmacyCoverage,
              as: "pharmacyCoverage",
            },
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "placeholderSig"],
            },
          ],
        });

        // Filter out inactive pharmacies
        const activeCoverages = coverages.filter((c) => c.pharmacy?.isActive);

        if (activeCoverages.length === 0) {
          const productNames = isProgramOrder
            ? order.orderItems.map((item: any) => item.product?.name).filter(Boolean).join(", ")
            : order.tenantProduct?.product?.name || "this product";
          
          return res.json({
            success: false,
            hasCoverage: false,
            error: `No active pharmacy coverage for ${productNames} in ${patientState}`,
            data: {
              productIds,
              state: patientState,
              isProgramOrder,
            },
          });
        }

        // Map all coverages to response format
        const coverageData = activeCoverages.map((coverage) => {
          // For program orders, find the matching order item to get the SIG
          let productSig: string | null | undefined = null;
          if (isProgramOrder) {
            const matchingItem = order.orderItems.find(
              (item: any) => item.product?.id === coverage.productId
            );
            productSig = matchingItem?.product?.placeholderSig || matchingItem?.placeholderSig || null;
          } else {
            productSig = order.tenantProduct?.product?.placeholderSig || null;
          }

          // Use SIG from product placeholder first, then pharmacy coverage, then fallback
          const sig =
            productSig ||
            coverage.pharmacyCoverage?.customSig ||
            coverage.sig ||
            order.doctorNotes ||
            (order as any).notes ||
            "Take as directed by your healthcare provider";

          return {
            id: coverage.id,
            pharmacyCoverageId: coverage.pharmacyCoverageId,
            productId: coverage.productId,
            productName: (coverage as any).product?.name,
            pharmacy: {
              id: coverage.pharmacy.id,
              name: coverage.pharmacy.name,
              slug: coverage.pharmacy.slug,
            },
            coverage: {
              state: patientState,
              pharmacyProductId: coverage.pharmacyProductId,
              pharmacyProductName: coverage.pharmacyProductName,
              pharmacyWholesaleCost: coverage.pharmacyWholesaleCost,
              sig: sig,
              customName: coverage.pharmacyCoverage?.customName,
              customSig: coverage.pharmacyCoverage?.customSig,
              form: coverage.form,
              rxId: coverage.rxId,
            },
          };
        });

        console.log(
          `📋 Found ${coverageData.length} pharmacy coverage record(s) for ${isProgramOrder ? 'program' : 'product'} order`
        );

        // HIPAA Audit: Log PHI access (viewing patient pharmacy coverage)
        await AuditService.logFromRequest(req, {
          action: AuditAction.VIEW,
          resourceType: AuditResourceType.ORDER,
          resourceId: orderId,
          details: { pharmacyCoverage: true, patientState },
        });

        res.json({
          success: true,
          hasCoverage: true,
          data: {
            coverages: coverageData,
            productIds,
            isProgramOrder,
            patientState,
          },
        });
      } catch (error) {
        console.error(
          "❌ Error checking pharmacy coverage:",
          error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({
          success: false,
          message: "Failed to check pharmacy coverage",
        });
      }
    }
  );

  // Add doctor notes to order
  app.post(
    "/doctor/orders/:orderId/notes",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
          return res
            .status(401)
            .json({ success: false, message: "User not found" });
        }

        if (user.role !== "doctor" && user.role !== "admin") {
          return res.status(403).json({
            success: false,
            message: "Access denied. Doctor or admin role required.",
          });
        }

        const { orderId } = req.params;
        const { note } = req.body;

        if (!note || typeof note !== "string") {
          return res
            .status(400)
            .json({ success: false, message: "note is required" });
        }

        // Validate order exists (authorized user can add notes)
        const order = await Order.findByPk(orderId);

        if (!order) {
          return res
            .status(404)
            .json({ success: false, message: "Order not found" });
        }

        // Add notes using order service
        const orderService = new OrderService();
        const result = await orderService.addDoctorNotes(
          orderId,
          user.id,
          note
        );

        // HIPAA Audit: Log PHI modification (adding notes to patient order)
        await AuditService.logFromRequest(req, {
          action: AuditAction.UPDATE,
          resourceType: AuditResourceType.ORDER,
          resourceId: orderId,
          details: { addedDoctorNotes: true },
        });

        res.json(result);
      } catch (error) {
        console.error(
          "❌ Error adding doctor notes:",
          error instanceof Error ? error.message : String(error)
        );
        res
          .status(500)
          .json({ success: false, message: "Failed to add doctor notes" });
      }
    }
  );

  // Get order statistics for doctor's clinic
  app.get(
    "/doctor/orders/stats",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user || user.role !== "doctor") {
          return res.status(403).json({
            success: false,
            message: "Access denied. Doctor role required.",
          });
        }

        if (!user.clinicId) {
          return res.status(400).json({
            success: false,
            message: "No clinic associated with this doctor",
          });
        }

        // Get counts for different statuses
        const totalPending = await Order.count({
          where: {
            clinicId: user.clinicId,
            status: "paid",
          },
        });

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const approvedToday = await Order.count({
          where: {
            clinicId: user.clinicId,
            status: "processing",
            updatedAt: {
              [Op.gte]: startOfToday,
            },
          },
        });

        const autoApprovedCount = await Order.count({
          where: {
            clinicId: user.clinicId,
            autoApprovedByDoctor: true,
          },
        });

        res.json({
          success: true,
          data: {
            totalPending,
            approvedToday,
            autoApprovedCount,
            requiresAction: totalPending,
          },
        });
      } catch (error) {
        console.error(
          "❌ Error fetching doctor order stats:",
          error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({
          success: false,
          message: "Failed to fetch order statistics",
        });
      }
    }
  );

  // Retry email send for IronSail order
  app.post(
    "/doctor/orders/:orderId/retry-email",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user || (user.role !== "doctor" && user.role !== "admin")) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Doctor or admin role required.",
          });
        }

        const { orderId } = req.params;

        console.log("📧 [Retry Email] Request received");

        // Fetch order with related data
        const order = await Order.findOne({
          where: { id: orderId },
          include: [
            {
              model: User,
              as: "user",
              attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "phoneNumber",
                "gender",
                "dob",
                "state",
              ],
            },
            {
              model: ShippingAddress,
              as: "shippingAddress",
              attributes: [
                "state",
                "address",
                "apartment",
                "city",
                "zipCode",
                "country",
              ],
            },
            {
              model: TenantProduct,
              as: "tenantProduct",
              required: false,
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["id", "name", "placeholderSig"],
                },
              ],
            },
          ],
        });

        if (!order) {
          return res
            .status(404)
            .json({ success: false, message: "Order not found" });
        }

        // Get pharmacy coverage to verify it's IronSail
        const patientState = order.shippingAddress?.state || order.user?.state;
        const productId = order.tenantProduct?.product?.id;

        if (!patientState || !productId) {
          return res.status(400).json({
            success: false,
            message: "Cannot determine patient state or product for order",
          });
        }

        // Find ALL IronSail coverages for this order
        const coverages = await PharmacyProduct.findAll({
          where: {
            productId,
            state: patientState,
          },
          include: [
            {
              model: Pharmacy,
              as: "pharmacy",
              attributes: ["id", "name", "slug", "isActive"],
            },
            {
              model: PharmacyCoverage,
              as: "pharmacyCoverage",
            },
          ],
        });

        const ironSailCoverages = coverages.filter(
          (c) => c.pharmacy?.slug === "ironsail" && c.pharmacy?.isActive
        );

        if (ironSailCoverages.length === 0) {
          return res.status(400).json({
            success: false,
            message: "No IronSail pharmacy coverage found for this order",
          });
        }

        console.log(
          `✅ [Retry Email] Found ${ironSailCoverages.length} IronSail coverage(s), proceeding with email retry`
        );

        // Retry email send for ALL IronSail coverages
        const ironSailService = new IronSailOrderService();
        const results: any[] = [];

        for (const coverage of ironSailCoverages) {
          const result = await ironSailService.retrySendEmail(order, coverage);
          results.push({
            coverageName: coverage.pharmacyCoverage?.customName || "Product",
            ...result,
          });
        }

        const allSucceeded = results.every((r: any) => r.success);

        // HIPAA Audit: Log email retry (sending patient documents)
        await AuditService.logFromRequest(req, {
          action: AuditAction.EMAIL_SENT,
          resourceType: AuditResourceType.ORDER,
          resourceId: orderId,
          details: {
            retryEmail: true,
            coverageCount: results.length,
            success: allSucceeded,
          },
        });

        res.json({
          success: allSucceeded,
          message: allSucceeded
            ? `Email sent successfully for ${results.length} coverage(s)`
            : `Some emails failed to send`,
          results,
        });
      } catch (error) {
        console.error(
          "❌ [Retry Email] Error:",
          error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({
          success: false,
          message: "Failed to retry email send",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Retry spreadsheet write for IronSail order
  app.post(
    "/doctor/orders/:orderId/retry-spreadsheet",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user || (user.role !== "doctor" && user.role !== "admin")) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Doctor or admin role required.",
          });
        }

        const { orderId } = req.params;

        console.log("📊 [Retry Spreadsheet] Request received");

        // Fetch order with related data
        const order = await Order.findOne({
          where: { id: orderId },
          include: [
            {
              model: User,
              as: "user",
              attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "phoneNumber",
                "gender",
                "dob",
                "state",
              ],
            },
            {
              model: ShippingAddress,
              as: "shippingAddress",
              attributes: [
                "state",
                "address",
                "apartment",
                "city",
                "zipCode",
                "country",
              ],
            },
            {
              model: TenantProduct,
              as: "tenantProduct",
              required: false,
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["id", "name", "placeholderSig"],
                },
              ],
            },
          ],
        });

        if (!order) {
          return res
            .status(404)
            .json({ success: false, message: "Order not found" });
        }

        // Get pharmacy coverage to verify it's IronSail
        const patientState = order.shippingAddress?.state || order.user?.state;
        const productId = order.tenantProduct?.product?.id;

        if (!patientState || !productId) {
          return res.status(400).json({
            success: false,
            message: "Cannot determine patient state or product for order",
          });
        }

        // Find ALL IronSail coverages for this order
        const coverages = await PharmacyProduct.findAll({
          where: {
            productId,
            state: patientState,
          },
          include: [
            {
              model: Pharmacy,
              as: "pharmacy",
              attributes: ["id", "name", "slug", "isActive"],
            },
            {
              model: PharmacyCoverage,
              as: "pharmacyCoverage",
            },
          ],
        });

        const ironSailCoverages = coverages.filter(
          (c) => c.pharmacy?.slug === "ironsail" && c.pharmacy?.isActive
        );

        if (ironSailCoverages.length === 0) {
          return res.status(400).json({
            success: false,
            message: "No IronSail pharmacy coverage found for this order",
          });
        }

        console.log(
          `✅ [Retry Spreadsheet] Found ${ironSailCoverages.length} IronSail coverage(s), proceeding with spreadsheet retry`
        );

        // Retry spreadsheet write for ALL IronSail coverages
        const ironSailService = new IronSailOrderService();
        const results: any[] = [];

        for (const coverage of ironSailCoverages) {
          const result = await ironSailService.retryWriteToSpreadsheet(
            order,
            coverage
          );
          results.push({
            coverageName: coverage.pharmacyCoverage?.customName || "Product",
            ...result,
          });
        }

        const allSucceeded = results.every((r: any) => r.success);

        // HIPAA Audit: Log spreadsheet update (patient records)
        await AuditService.logFromRequest(req, {
          action: AuditAction.EXPORT,
          resourceType: AuditResourceType.ORDER,
          resourceId: orderId,
          details: {
            retrySpreadsheet: true,
            coverageCount: results.length,
            success: allSucceeded,
          },
        });

        res.json({
          success: allSucceeded,
          message: allSucceeded
            ? `Spreadsheet updated successfully for ${results.length} coverage(s)`
            : `Some spreadsheet updates failed`,
          results,
        });
      } catch (error) {
        console.error(
          "❌ [Retry Spreadsheet] Error:",
          error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({
          success: false,
          message: "Failed to retry spreadsheet write",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );
}
