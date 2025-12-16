import { Express } from "express";
import { Op, QueryTypes } from "sequelize";
import User from "../models/User";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Product from "../models/Product";
import Clinic from "../models/Clinic";
import UserRoles from "../models/UserRoles";
import { MailsSender } from "../services/mailsSender";
import { sequelize } from "../config/database";

/**
 * Check if a product is medical (contains PHI) or non-medical
 * Medical products typically require prescriptions or are treatments
 * Non-medical products are supplements, wellness products, etc.
 */
function isMedicalProduct(product: Product): boolean {
  // Check if product categories indicate it's medical
  const categories = product.categories || [];
  const medicalCategories = ['prescription', 'treatment', 'medication', 'pharmacy'];
  
  // Check if any category matches medical categories
  if (Array.isArray(categories)) {
    return categories.some(cat => 
      medicalCategories.some(medCat => 
        cat?.toLowerCase().includes(medCat)
      )
    );
  }
  
  // Default: if no clear indication, assume non-medical for affiliate tracking
  // This is conservative - affiliates should only see non-medical revenue
  return false;
}

/**
 * Get de-identified analytics data for affiliates
 * Only returns data when there are more than 10 records (HIPAA compliance)
 */
export function registerAffiliateEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  // Get affiliate analytics (de-identified, only when >10 records)
  app.get("/affiliate/analytics", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Verify user is an affiliate
      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await user.getUserRoles();
      if (!user.userRoles?.hasRole("affiliate")) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Affiliate role required.",
        });
      }

      // Get affiliate's owner (brand) to filter orders
      if (!user.affiliateOwnerId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate owner not set",
        });
      }

      const affiliateOwner = await User.findByPk(user.affiliateOwnerId, {
        include: [{ model: Clinic, as: "clinic" }],
      });

      if (!affiliateOwner?.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate owner clinic not found",
        });
      }

      const clinicId = affiliateOwner.clinicId;

      // Get date range from query params (default to last 30 days)
      const startDateParam = req.query.startDate as string;
      const endDateParam = req.query.endDate as string;
      const category = req.query.category as string | undefined;

      const endDate = endDateParam ? new Date(endDateParam) : new Date();
      const startDate = startDateParam
        ? new Date(startDateParam)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Get orders for this affiliate (non-medical products only)
      const orders = await Order.findAll({
        where: {
          affiliateId: user.id,
          clinicId,
          status: "paid",
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
        },
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                required: true,
              },
            ],
          },
        ],
      });

      // Filter to only non-medical products
      const nonMedicalOrders = orders.filter((order) => {
        return order.orderItems?.some((item) => {
          const product = item.product;
          if (!product) return false;
          return !isMedicalProduct(product);
        });
      });

      // HIPAA Compliance: Only return data if there are more than 10 records
      if (nonMedicalOrders.length <= 10) {
        return res.status(200).json({
          success: true,
          data: {
            message: "Insufficient data for de-identified analytics. Minimum 10 records required.",
            recordCount: nonMedicalOrders.length,
            analytics: null,
          },
        });
      }

      // Calculate de-identified analytics
      const totalRevenue = nonMedicalOrders.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0
      );

      const orderCount = nonMedicalOrders.length;
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

      // Group by category (if category filter is provided)
      let categoryData: Record<string, any> = {};
      if (category) {
        const categoryOrders = nonMedicalOrders.filter((order) => {
          return order.orderItems?.some((item) => {
            const product = item.product;
            if (!product) return false;
            const categories = product.categories || [];
            return Array.isArray(categories)
              ? categories.some((cat) =>
                  cat?.toLowerCase().includes(category.toLowerCase())
                )
              : false;
          });
        });

        if (categoryOrders.length > 10) {
          const categoryRevenue = categoryOrders.reduce(
            (sum, order) => sum + Number(order.totalAmount || 0),
            0
          );
          categoryData = {
            category,
            orderCount: categoryOrders.length,
            revenue: categoryRevenue,
            avgOrderValue:
              categoryOrders.length > 0
                ? categoryRevenue / categoryOrders.length
                : 0,
          };
        }
      }

      // Revenue time series (de-identified)
      const revenueByDate: Record<string, { revenue: number; orders: number }> =
        {};
      nonMedicalOrders.forEach((order) => {
        const dateKey = order.createdAt.toISOString().split("T")[0];
        if (!revenueByDate[dateKey]) {
          revenueByDate[dateKey] = { revenue: 0, orders: 0 };
        }
        revenueByDate[dateKey].revenue += Number(order.totalAmount || 0);
        revenueByDate[dateKey].orders += 1;
      });

      const timeSeries = Object.entries(revenueByDate)
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          orders: data.orders,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.status(200).json({
        success: true,
        data: {
          recordCount: nonMedicalOrders.length,
          analytics: {
            totalRevenue,
            orderCount,
            avgOrderValue,
            timeRange: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            },
            categoryData: Object.keys(categoryData).length > 0 ? categoryData : null,
            timeSeries,
          },
        },
      });
    } catch (error) {
      console.error("❌ Error fetching affiliate analytics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch affiliate analytics",
      });
    }
  });

  // Get affiliate revenue summary
  app.get("/affiliate/revenue", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await user.getUserRoles();
      if (!user.userRoles?.hasRole("affiliate")) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Affiliate role required.",
        });
      }

      if (!user.affiliateOwnerId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate owner not set",
        });
      }

      const affiliateOwner = await User.findByPk(user.affiliateOwnerId, {
        include: [{ model: Clinic, as: "clinic" }],
      });

      if (!affiliateOwner?.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate owner clinic not found",
        });
      }

      const clinicId = affiliateOwner.clinicId;

      // Get all paid orders for this affiliate (non-medical only)
      const orders = await Order.findAll({
        where: {
          affiliateId: user.id,
          clinicId,
          status: "paid",
        },
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                required: true,
              },
            ],
          },
        ],
      });

      // Filter to only non-medical products
      const nonMedicalOrders = orders.filter((order) => {
        return order.orderItems?.some((item) => {
          const product = item.product;
          if (!product) return false;
          return !isMedicalProduct(product);
        });
      });

      const totalRevenue = nonMedicalOrders.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0
      );

      // Calculate affiliate's percentage (this would be configured by the brand)
      // For now, using a default percentage - this should be configurable
      const affiliatePercentage = 10; // 10% default - should be configurable per affiliate
      const affiliateEarnings = (totalRevenue * affiliatePercentage) / 100;

      res.status(200).json({
        success: true,
        data: {
          totalRevenue,
          orderCount: nonMedicalOrders.length,
          affiliatePercentage,
          affiliateEarnings,
          currency: "USD",
        },
      });
    } catch (error) {
      console.error("❌ Error fetching affiliate revenue:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch affiliate revenue",
      });
    }
  });

  // Get affiliate branding settings
  app.get("/affiliate/branding", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await user.getUserRoles();
      if (!user.userRoles?.hasRole("affiliate")) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Affiliate role required.",
        });
      }

      // Get affiliate branding (stored in user fields or separate table)
      // For now, using user fields - can be extended to a separate AffiliateBranding table
      // Return only firstName for affiliate name (no lastName concatenation)
      let affiliateName = "";
      if (user.firstName) {
        affiliateName = user.firstName.trim();
      } else {
        affiliateName = user.email;
      }

      console.log("📖 [Affiliate Branding] Fetching branding:", { 
        userId: user.id, 
        firstName: user.firstName, 
        lastName: user.lastName, 
        website: user.website,
        affiliateName 
      });

      res.status(200).json({
        success: true,
        data: {
          name: affiliateName,
          logo: null, // Can be added to User model or separate table
          website: user.website || null,
        },
      });
    } catch (error) {
      console.error("❌ Error fetching affiliate branding:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch affiliate branding",
      });
    }
  });

  // Update affiliate branding
  app.put("/affiliate/branding", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await user.getUserRoles();
      if (!user.userRoles?.hasRole("affiliate")) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Affiliate role required.",
        });
      }

      const { name, website } = req.body;

      console.log("📝 [Affiliate Branding] Updating branding:", { name, website, userId: user.id });

      // Update user fields
      if (name && typeof name === "string") {
        const nameParts = name.trim().split(" ").filter(part => part.length > 0);
        if (nameParts.length >= 2) {
          user.firstName = nameParts[0];
          user.lastName = nameParts.slice(1).join(" ");
        } else if (nameParts.length === 1) {
          // Single word name - set as firstName and clear lastName
          user.firstName = nameParts[0];
          user.lastName = "";
        }
        console.log("📝 [Affiliate Branding] Updated name:", { firstName: user.firstName, lastName: user.lastName });
      }

      if (website !== undefined) {
        user.website = website && website.trim() !== "" ? website.trim() : null;
        console.log("📝 [Affiliate Branding] Updated website:", user.website);
      }

      await user.save();
      console.log("✅ [Affiliate Branding] User saved successfully");

      // Return only firstName for affiliate name (no lastName concatenation)
      let affiliateName = "";
      if (user.firstName) {
        affiliateName = user.firstName.trim();
      } else {
        affiliateName = user.email;
      }

      res.status(200).json({
        success: true,
        message: "Branding updated successfully",
        data: {
          name: affiliateName,
          website: user.website || null,
        },
      });
    } catch (error) {
      console.error("❌ Error updating affiliate branding:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update affiliate branding",
      });
    }
  });

  // Assign orders to affiliate (for testing/manual assignment)
  app.post("/affiliate/assign-orders", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Only allow brand users or admins to assign orders
      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await user.getUserRoles();
      if (!user.userRoles?.hasAnyRole(["brand", "admin", "superAdmin"])) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only brand users and admins can assign orders.",
        });
      }

      const { orderIds, affiliateId } = req.body;

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "orderIds array is required",
        });
      }

      if (!affiliateId) {
        return res.status(400).json({
          success: false,
          message: "affiliateId is required",
        });
      }

      // Verify affiliate exists and is actually an affiliate
      const affiliate = await User.findByPk(affiliateId, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });

      if (!affiliate) {
        return res.status(404).json({
          success: false,
          message: "Affiliate not found",
        });
      }

      await affiliate.getUserRoles();
      if (!affiliate.userRoles?.hasRole("affiliate")) {
        return res.status(400).json({
          success: false,
          message: "User is not an affiliate",
        });
      }

      // Update orders
      const updated = await Order.update(
        { affiliateId },
        {
          where: {
            id: orderIds,
            status: "paid", // Only assign paid orders
          },
        }
      );

      res.status(200).json({
        success: true,
        message: `Assigned ${updated[0]} order(s) to affiliate`,
        data: {
          affiliateId,
          ordersAssigned: updated[0],
        },
      });
    } catch (error) {
      console.error("❌ Error assigning orders to affiliate:", error);
      res.status(500).json({
        success: false,
        message: "Failed to assign orders to affiliate",
      });
    }
  });

  // Invite affiliate by email
  app.post("/admin/affiliates/invite", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Only allow brand users or admins to invite affiliates
      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await user.getUserRoles();
      if (!user.userRoles?.hasAnyRole(["brand", "admin", "superAdmin"])) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only brand users and admins can invite affiliates.",
        });
      }

      const { email } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({
          success: false,
          message: "Valid email address is required",
        });
      }

      // Check current affiliate count for this brand (max 5)
      // Get all users assigned to this brand with affiliate role
      const brandAffiliates = await User.findAll({
        where: {
          affiliateOwnerId: user.id,
        },
        include: [
          {
            model: UserRoles,
            as: "userRoles",
            required: true,
          },
        ],
      });

      // Count only those with affiliate role
      let affiliateCount = 0;
      for (const brandUser of brandAffiliates) {
        await brandUser.getUserRoles();
        if (brandUser.userRoles?.hasRole("affiliate")) {
          affiliateCount++;
        }
      }

      if (affiliateCount >= 5) {
        return res.status(400).json({
          success: false,
          message: "Maximum of 5 affiliates per brand. Please remove an affiliate before inviting a new one.",
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email: email.toLowerCase().trim() } });
      if (existingUser) {
        await existingUser.getUserRoles();
        if (existingUser.userRoles?.hasRole("affiliate")) {
          return res.status(409).json({
            success: false,
            message: "An affiliate with this email already exists",
          });
        }
        // If user exists but is not an affiliate, we could convert them, but for now return error
        return res.status(409).json({
          success: false,
          message: "A user with this email already exists",
        });
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + "Aa1!";
      const tempPasswordHash = await User.hashPassword(tempPassword);

      // Create affiliate user with temporary password
      // We'll set the temporary password hash separately so they can login with it
      // Use a placeholder for lastName to satisfy validation, then clear it via raw SQL
      const emailPrefix = email.split("@")[0];
      const affiliateUser = await User.createUser({
        firstName: emailPrefix,
        lastName: "-", // Placeholder to satisfy validation (len >= 1), will be cleared via raw SQL
        email: email.toLowerCase().trim(),
        password: tempPassword, // This will be hashed and stored in passwordHash
        role: "affiliate",
        affiliateOwnerId: user.id, // Auto-assign to the inviting brand user
      });
      
      // Clear lastName after creation using raw SQL to bypass Sequelize validation
      await sequelize.query(
        `UPDATE users SET "lastName" = '' WHERE id = :userId`,
        {
          replacements: { userId: affiliateUser.id },
          type: QueryTypes.UPDATE,
        }
      );
      
      // Reload the user to get the updated lastName
      await affiliateUser.reload();

      // Also set as temporary password (so they can login with it until they change it)
      affiliateUser.temporaryPasswordHash = tempPasswordHash;
      
      // Auto-activate the account
      affiliateUser.activated = true;
      
      await affiliateUser.save();

      console.log("✅ [Affiliate Invite] Created affiliate user:", {
        id: affiliateUser.id,
        email: affiliateUser.email,
        affiliateOwnerId: affiliateUser.affiliateOwnerId,
      });

      // Get frontend origin for affiliate portal
      const frontendOrigin = req.get("origin") || req.get("referer")?.split("/").slice(0, 3).join("/") || "http://localhost:3005";
      const affiliatePortalUrl = process.env.NODE_ENV === "production" 
        ? "https://admin.limitless.health" 
        : frontendOrigin.includes("3005") 
          ? frontendOrigin 
          : "http://localhost:3005";

      // Send invitation email with credentials
      const emailSent = await MailsSender.sendEmail({
        to: affiliateUser.email,
        subject: "Welcome to Fuse Affiliate Portal",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Fuse Affiliate Portal!</h1>
            </div>
            
            <div style="padding: 40px 30px; background-color: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">You've been invited as an Affiliate</h2>
              
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                You have been invited to join the Fuse Affiliate Program. Use the credentials below to sign in to your affiliate dashboard:
              </p>
              
              <div style="background-color: #fff; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="margin: 10px 0; color: #333;"><strong>Email:</strong> ${affiliateUser.email}</p>
                <p style="margin: 10px 0; color: #333;"><strong>Temporary Password:</strong> <code style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${affiliatePortalUrl}/signin" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 30px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: bold; 
                          display: inline-block;">
                  Sign In to Affiliate Portal
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                <strong>Important:</strong> Please change your password after your first login for security.
              </p>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                If you have any questions, please contact your brand partner.
              </p>
            </div>
            
            <div style="background-color: #333; padding: 20px; text-align: center;">
              <p style="color: #ccc; margin: 0; font-size: 14px;">
                Best regards,<br>
                The Fuse Team
              </p>
            </div>
          </div>
        `,
        text: `Welcome to Fuse Affiliate Portal!

You've been invited as an Affiliate. Use the credentials below to sign in:

Email: ${affiliateUser.email}
Temporary Password: ${tempPassword}

Sign in at: ${affiliatePortalUrl}/signin

Important: Please change your password after your first login for security.

Best regards,
The Fuse Team`,
      });

      if (emailSent) {
        console.log("✅ [Affiliate Invite] Invitation email sent successfully");
      } else {
        console.log("⚠️ [Affiliate Invite] Failed to send invitation email, but affiliate was created");
      }

      res.status(201).json({
        success: true,
        message: "Affiliate invitation sent successfully",
        data: {
          affiliateId: affiliateUser.id,
          email: affiliateUser.email,
          emailSent: emailSent,
        },
      });
    } catch (error: any) {
      console.error("❌ Error inviting affiliate:", error);

      // Handle specific errors
      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({
          success: false,
          message: "An affiliate with this email already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to invite affiliate",
      });
    }
  });

  // Public endpoint: Get affiliate by slug (website)
  app.get("/public/affiliate/by-slug/:slug", async (req, res) => {
    try {
      const { slug } = req.params;

      if (!slug || typeof slug !== "string") {
        return res.status(400).json({
          success: false,
          message: "Affiliate slug is required",
        });
      }

      // Find affiliate by website (slug) field
      const affiliate = await User.findOne({
        where: {
          website: slug.trim(),
        },
        include: [
          {
            model: UserRoles,
            as: "userRoles",
            required: true,
          },
        ],
      });

      if (!affiliate) {
        return res.status(404).json({
          success: false,
          message: "Affiliate not found",
        });
      }

      await affiliate.getUserRoles();

      if (!affiliate.userRoles?.hasRole("affiliate")) {
        return res.status(404).json({
          success: false,
          message: "Affiliate not found",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          id: affiliate.id,
          firstName: affiliate.firstName,
          email: affiliate.email,
          website: affiliate.website,
        },
      });
    } catch (error) {
      console.error("❌ Error fetching affiliate by slug:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch affiliate",
      });
    }
  });
}


