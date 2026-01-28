import { Express } from "express";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Product from "../models/Product";
import Payment from "../models/Payment";
import ShippingAddress from "../models/ShippingAddress";
import Treatment from "../models/Treatment";
import ShippingOrder from "../models/ShippingOrder";
import User from "../models/User";
import UserRoles from "../models/UserRoles";
import PharmacyCoverage from "../models/PharmacyCoverage";
import Prescription from "../models/Prescription";
import PrescriptionProducts from "../models/PrescriptionProducts";
import PrescriptionExtension from "../models/PrescriptionExtension";
import { Op } from "sequelize";
import OrderService from "../services/order.service";
import {
  AuditService,
  AuditAction,
  AuditResourceType,
} from "../services/audit.service";

export function registerOrdersEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  const orderService = new OrderService();

  // Get orders for a user
  app.get("/orders", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const orders = await Order.findAll({
        where: { userId: currentUser.id },
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                include: [
                  {
                    model: PharmacyCoverage,
                    as: "pharmacyCoverages",
                    required: false,
                  },
                ],
              },
            ],
          },
          {
            model: Payment,
            as: "payment",
          },
          {
            model: ShippingAddress,
            as: "shippingAddress",
          },
          {
            model: Treatment,
            as: "treatment",
          },
          {
            model: ShippingOrder,
            as: "shippingOrders",
            required: false, // Left join - orders may not have shipping orders yet
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      // HIPAA Audit: Log PHI access (patient viewing their orders)
      await AuditService.logFromRequest(req, {
        action: AuditAction.VIEW,
        resourceType: AuditResourceType.ORDER,
        details: { orderCount: orders.length, selfAccess: true },
      });

      res.status(200).json({
        success: true,
        data: orders,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching orders:", error);
      } else {
        console.error("❌ Error processing orders");
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch orders",
      });
    }
  });

  // Get single order
  app.get("/orders/:id", authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = getCurrentUser(req);
      // HIPAA: Wrap all order logging in development check
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 [ORDERS/:ID] Request received");
        console.log("🔍 [ORDERS/:ID] Order ID:", id);
      }

      if (!currentUser) {
        console.log("❌ [ORDERS/:ID] No current user found");
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Fetch full user data from database to get clinicId
      console.log("🔍 [ORDERS/:ID] Fetching user from database...");
      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });

      if (!user) {
        console.log("❌ [ORDERS/:ID] User not found in database");
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // SECURITY: Never log PHI (email is PHI under HIPAA)
      console.log("🔍 [ORDERS/:ID] User found:", {
        id: user.id,
        role: user.role,
        clinicId: user.clinicId,
        // email removed - PHI must not be logged
      });

      let whereClause: any = { id };
      let accessType = "unknown";

      // If user is a patient, only allow access to their own orders
      if (user.hasRoleSync("patient")) {
        whereClause.userId = currentUser.id;
        accessType = "patient_own_orders";
        console.log("🔍 [ORDERS/:ID] Patient access - restricting to own orders");
      } else if (user.hasAnyRoleSync(["doctor", "brand"])) {
        const activeRoles = user.userRoles?.getActiveRoles() || [user.role];
        accessType = "clinic_access";
        console.log(
          `🔍 [ORDERS/:ID] ${activeRoles.join("/").toUpperCase()} access - checking order belongs to clinic`
        );

        // For doctors and brand users, find the order and check if it belongs to their clinic
        console.log("🔍 [ORDERS/:ID] Finding order by ID...");
        const order = await Order.findByPk(id);

        if (!order) {
          console.log("❌ [ORDERS/:ID] Order not found by ID:", id);
          return res.status(404).json({
            success: false,
            message: "Order not found",
          });
        }

        console.log("🔍 [ORDERS/:ID] Order found:", {
          id: order.id,
          userId: order.userId,
          treatmentId: order.treatmentId,
          status: order.status,
        });

        // Get the treatment to find the clinic
        console.log("🔍 [ORDERS/:ID] Finding treatment for order...");
        const treatment = await Treatment.findByPk(order.treatmentId);

        if (!treatment) {
          console.log(
            "❌ [ORDERS/:ID] Treatment not found for order:",
            order.treatmentId
          );
          return res.status(404).json({
            success: false,
            message: "Treatment not found",
          });
        }

        console.log("🔍 [ORDERS/:ID] Treatment found:", {
          id: treatment.id,
          name: treatment.name,
          clinicId: treatment.clinicId,
        });

        // Check if the treatment belongs to the user's clinic
        console.log("🔍 [ORDERS/:ID] Checking clinic access...");
        console.log("🔍 [ORDERS/:ID] User clinicId:", user.clinicId);
        console.log("🔍 [ORDERS/:ID] Treatment clinicId:", treatment.clinicId);

        if (treatment.clinicId !== user.clinicId) {
          console.log("❌ [ORDERS/:ID] Access denied - clinic mismatch");
          return res.status(403).json({
            success: false,
            message: "Access denied",
          });
        }

        console.log(
          `✅ [ORDERS/:ID] ${user.role.toUpperCase()} clinic access granted`
        );
      } else {
        console.log(`❌ [ORDERS/:ID] Unsupported role: ${user.role}`);
        return res.status(403).json({
          success: false,
          message: `Access denied for role: ${user.role}. Only patients, doctors, and brands can access orders.`,
        });
      }

      console.log(
        "🔍 [ORDERS/:ID] Executing final query with whereClause:",
        whereClause
      );
      console.log("🔍 [ORDERS/:ID] Access type:", accessType);

      const order = await Order.findOne({
        where: whereClause,
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [{ model: Product, as: "product" }],
          },
          {
            model: Payment,
            as: "payment",
          },
          {
            model: ShippingAddress,
            as: "shippingAddress",
          },
          {
            model: Treatment,
            as: "treatment",
          },
          {
            model: ShippingOrder,
            as: "shippingOrders",
          },
          {
            model: User,
            as: "user",
          },
        ],
      });

      if (!order) {
        console.log("❌ [ORDERS/:ID] Order not found after final query");
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Log order clinicId for redirect debugging
      if (process.env.NODE_ENV === "development") {
        const orderJson = order.toJSON();
        console.log("[ORDERS/:ID] Order retrieved for redirect:", {
          orderId: order.id,
          orderNumber: (order as any).orderNumber,
          clinicId: (order as any).clinicId || orderJson.clinicId,
          userId: order.userId,
        });
      }

      // Fetch prescriptions for this order (created around the same time)
      const prescriptions = await Prescription.findAll({
        where: {
          patientId: order.userId,
          name: {
            [Op.like]: `%${order.orderNumber}%`,
          },
        },
        include: [
          {
            model: PrescriptionProducts,
            as: "prescriptionProducts",
            include: [
              {
                model: Product,
                as: "product",
              },
            ],
          },
          {
            model: User,
            as: "doctor",
            attributes: ["id", "firstName", "lastName"],
          },
          {
            model: PrescriptionExtension,
            as: "extensions",
            required: false,
          },
        ],
      });

      // HIPAA Audit: Log PHI access (order contains patient name, address, medications)
      await AuditService.logOrderView(req, order.id);

      console.log("✅ [ORDERS/:ID] Order successfully retrieved and returned");
      res.status(200).json({
        success: true,
        data: {
          ...order.toJSON(),
          prescriptions,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ [ORDERS/:ID] Exception occurred:", error);
        console.error(
          "❌ [ORDERS/:ID] Error type:",
          error instanceof Error ? error.constructor.name : "Unknown"
        );
        console.error(
          "❌ [ORDERS/:ID] Error message:",
          error instanceof Error ? error.message : String(error)
        );
        console.error(
          "❌ [ORDERS/:ID] Error stack:",
          error instanceof Error ? error.stack : "No stack trace"
        );
      } else {
        console.error("❌ [ORDERS/:ID] Exception occurred:");
        console.error("❌ [ORDERS/:ID] Error type:");
        console.error("❌ [ORDERS/:ID] Error message:");
        console.error("❌ [ORDERS/:ID] Error stack:");
      }

      res.status(500).json({
        success: false,
        message: "Failed to fetch order",
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
      });
    }
  });

  // Order endpoints
  app.get("/orders/by-clinic/:clinicId", authenticateJWT, async (req, res) => {
    try {
      const { clinicId } = req.params;
      const { page, limit } = req.query;
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const paginationParams = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      };

      const result = await orderService.listOrdersByClinic(
        clinicId,
        currentUser.id,
        paginationParams
      );

      if (result.success) {
        // HIPAA Audit: Log bulk PHI access (viewing all orders for a clinic)
        await AuditService.logFromRequest(req, {
          action: AuditAction.VIEW,
          resourceType: AuditResourceType.ORDER,
          details: { bulkAccess: true, clinicId },
        });
        res.status(200).json(result);
      } else {
        if (result.message === "Forbidden") {
          res.status(403).json(result);
        } else {
          res.status(400).json(result);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error listing orders by clinic:", error);
      } else {
        console.error("❌ Error listing orders by clinic");
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });
}
