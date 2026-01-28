import { Express } from "express";
import User from "../models/User";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Product from "../models/Product";
import Subscription from "../models/Subscription";
import { Op } from "sequelize";
import {
  AuditService,
  AuditAction,
  AuditResourceType,
} from "../services/audit.service";

export function registerUsersEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  // Get customers/users for a clinic
  app.get("/users/by-clinic/:clinicId", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const { clinicId } = req.params;

      // Verify user has access to this clinic
      const user = await User.findByPk(currentUser.id);
      if (!user || user.clinicId !== clinicId) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this clinic",
        });
      }

      // Fetch all users who have placed orders with this clinic
      const orders = await Order.findAll({
        where: { clinicId },
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
              "createdAt",
              "updatedAt",
            ],
          },
        ],
        attributes: ["userId"],
        group: ["userId", "user.id"],
      });

      // Get unique users and count their orders
      const userIds = new Set<string>();
      orders.forEach((order) => userIds.add(order.userId));

      const customers = await Promise.all(
        Array.from(userIds).map(async (userId) => {
          const customer = await User.findByPk(userId, {
            attributes: [
              "id",
              "firstName",
              "lastName",
              "email",
              "phoneNumber",
              "createdAt",
              "updatedAt",
            ],
          });

          if (!customer) return null;

          // Get all orders for this customer with products
          const customerOrders = await Order.findAll({
            where: { userId, clinicId, status: "paid" },
            include: [
              {
                model: OrderItem,
                as: "orderItems",
                include: [
                  {
                    model: Product,
                    as: "product",
                    attributes: ["id", "categories"],
                  },
                ],
              },
            ],
          });

          // Calculate total revenue
          const totalRevenue = customerOrders.reduce(
            (sum, order) => sum + (order.totalAmount || 0),
            0
          );

          // Get unique product categories this customer has ordered
          const categories = new Set<string>();
          customerOrders.forEach((order) => {
            order.orderItems?.forEach((item) => {
              if (Array.isArray((item.product as any)?.categories)) {
                (item.product as any).categories.forEach(
                  (category: string | null | undefined) => {
                    if (category) {
                      categories.add(category);
                    }
                  }
                );
              }
            });
          });

          // Check for active subscription
          // Subscription has orderId, not userId, so we need to check through orders
          // An active subscription is one that is "paid" or "processing"
          const orderIds = customerOrders.map((order) => order.id);
          let hasActiveSubscription = false;

          if (orderIds.length > 0) {
            const subscription = await Subscription.findOne({
              where: {
                orderId: {
                  [Op.in]: orderIds,
                },
                status: {
                  [Op.in]: ["paid", "processing"],
                },
              },
            });
            hasActiveSubscription = !!subscription;
          }

          return {
            ...customer.toJSON(),
            orderCount: customerOrders.length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            categories: Array.from(categories),
            hasActiveSubscription,
          };
        })
      );

      const validCustomers = customers.filter((c) => c !== null);

      // HIPAA Audit: Log bulk PHI access (viewing all patients in a clinic)
      await AuditService.logFromRequest(req, {
        action: AuditAction.VIEW,
        resourceType: AuditResourceType.PATIENT,
        details: {
          bulkAccess: true,
          clinicId,
          patientCount: validCustomers.length,
        },
      });

      res.status(200).json({
        success: true,
        data: validCustomers,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching customers:", error);
      } else {
        console.error("❌ Error fetching customers");
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch customers",
      });
    }
  });

  // Update user profile
  app.put("/users/profile", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { firstName, lastName, phone, currentPassword, newPassword } =
        req.body;

      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // If password change requested, verify current password
      if (newPassword) {
        if (!currentPassword) {
          return res
            .status(400)
            .json({ success: false, message: "Current password is required" });
        }

        // Validate either permanent or temporary password
        const isValidPassword = await user.validateAnyPassword(currentPassword);
        if (!isValidPassword) {
          return res
            .status(400)
            .json({ success: false, message: "Current password is incorrect" });
        }

        const bcrypt = require("bcrypt");
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update password and clear temporary password if it exists
        await user.update({
          passwordHash: hashedPassword,
          temporaryPasswordHash: null, // Clear temporary password after change
        });
      }

      // Update other fields
      await user.update({
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        phoneNumber: phone || user.phoneNumber,
      });

      res.json({ success: true, message: "Profile updated successfully" });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error uploading profile:", error);
      } else {
        console.error("❌ Error uploading profile");
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });
}
