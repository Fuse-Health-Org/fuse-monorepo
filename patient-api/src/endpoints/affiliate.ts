import { Express } from "express";
import { Op, QueryTypes } from "sequelize";
import axios from "axios";
import multer from "multer";
import User from "../models/User";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Product from "../models/Product";
import Clinic from "../models/Clinic";
import CustomWebsite from "../models/CustomWebsite";
import UserRoles from "../models/UserRoles";
import AffiliateProductImage from "../models/AffiliateProductImage";
import TenantProduct from "../models/TenantProduct";
import { MailsSender } from "../services/mailsSender";
import { sequelize } from "../config/database";
import {
  uploadToS3,
  deleteFromS3,
  isValidImageFile,
  isValidFileSize,
} from "../config/s3";

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (isValidImageFile(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, WebP images are allowed."
        )
      );
    }
  },
});

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

      // Get affiliate's clinic and parent clinic
      if (!user.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate clinic not set. Please complete onboarding.",
        });
      }

      const affiliateClinic = await Clinic.findByPk(user.clinicId);
      if (!affiliateClinic?.affiliateOwnerClinicId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate parent clinic not found",
        });
      }

      const clinicId = affiliateClinic.affiliateOwnerClinicId;

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

      // HIPAA Compliance: Only return data if there are more than 10 records (production only)
      const isProduction = process.env.NODE_ENV === "production" && process.env.STAGING !== "true";
      if (isProduction && nonMedicalOrders.length <= 10) {
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

      // Get affiliate's clinic and parent clinic
      if (!user.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate clinic not set. Please complete onboarding.",
        });
      }

      const affiliateClinic = await Clinic.findByPk(user.clinicId);
      if (!affiliateClinic?.affiliateOwnerClinicId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate parent clinic not found",
        });
      }

      const clinicId = affiliateClinic.affiliateOwnerClinicId;

      console.log("🔍 [AFFILIATE REVENUE] Searching for orders with:", {
        affiliateId: user.id,
        affiliateEmail: user.email,
        clinicId,
        status: "paid",
      });

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

      console.log(`🔍 [AFFILIATE REVENUE] Found ${orders.length} orders:`, orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt,
      })));

      // Filter to only non-medical products
      const nonMedicalOrders = orders.filter((order) => {
        return order.orderItems?.some((item) => {
          const product = item.product;
          if (!product) return false;
          return !isMedicalProduct(product);
        });
      });

      console.log(`🔍 [AFFILIATE REVENUE] After filtering non-medical: ${nonMedicalOrders.length} orders`);

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

      // Get the brand user's clinic
      if (!user.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Brand user must have a clinic to invite affiliates",
        });
      }

      const parentClinic = await Clinic.findByPk(user.clinicId);
      if (!parentClinic) {
        return res.status(400).json({
          success: false,
          message: "Brand clinic not found",
        });
      }

      // Check current affiliate count for this brand (max 5)
      // Get all clinics that are affiliates of this parent clinic
      const affiliateClinics = await Clinic.findAll({
        where: {
          affiliateOwnerClinicId: parentClinic.id,
        },
      });

      if (affiliateClinics.length >= 5) {
        return res.status(400).json({
          success: false,
          message: "Maximum of 5 affiliates per brand. Please remove an affiliate before inviting a new one.",
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ 
        where: { email: email.toLowerCase().trim() },
        include: [
          { model: UserRoles, as: "userRoles", required: false },
          { model: Clinic, as: "clinic", required: false },
        ],
      });
      
      if (existingUser) {
        await existingUser.getUserRoles();
        
        // Check if it's an existing affiliate
        if (existingUser.userRoles?.hasRole("affiliate")) {
          // Check if this affiliate was previously removed (no parent clinic)
          if (existingUser.clinic && !existingUser.clinic.affiliateOwnerClinicId) {
            // Re-invite the removed affiliate: update parent clinic and resend email
            console.log("🔄 [Affiliate Invite] Re-inviting previously removed affiliate:", {
              userId: existingUser.id,
              email: existingUser.email,
            });

            // Update the affiliate's clinic to link to the new parent
            await existingUser.clinic.update({
              affiliateOwnerClinicId: parentClinic.id,
              isActive: true, // Reactivate the clinic
            });

            // Generate new temporary password
            const tempPassword = Math.random().toString(36).slice(-12) + "Aa1!";
            const tempPasswordHash = await User.hashPassword(tempPassword);
            
            // Update user with new temporary password
            await existingUser.update({
              temporaryPasswordHash: tempPasswordHash,
              activated: true,
            });

            // Get frontend origin for affiliate portal
            const frontendOrigin = req.get("origin") || req.get("referer")?.split("/").slice(0, 3).join("/") || "http://localhost:3005";

            // Determine the best affiliate portal URL
            let affiliatePortalUrl: string;

            // Determine base domain based on environment (staging or production)
            const isStaging = process.env.STAGING === "true" || 
                              process.env.NODE_ENV === "staging" ||
                              frontendOrigin?.includes("fusehealthstaging.xyz");
            const baseDomain = isStaging ? "fusehealthstaging.xyz" : "fusehealth.com";

            if (process.env.NODE_ENV === "production" || isStaging) {
              // Check if parent clinic has custom domain configured
              if (parentClinic.isCustomDomain && parentClinic.customDomain) {
                // Try the main admin URL: admin.{customDomain without 'app.' prefix}
                const mainAdminUrl = `https://admin.${parentClinic.customDomain.replace(/^app\./, '')}`;

                try {
                  // Check if the URL is accessible with a quick HEAD request (timeout 3 seconds)
                  await axios.head(mainAdminUrl, {
                    timeout: 3000,
                    validateStatus: () => true, // Accept any status code (even 404 means domain resolves)
                  });

                  // If we get any response (even 404 is fine, means domain resolves), use it
                  affiliatePortalUrl = mainAdminUrl;
                  console.log(`✅ [Affiliate Re-invite] Using main admin URL: ${mainAdminUrl}`);
                } catch (error: any) {
                  // If request fails (DNS not configured, timeout, etc.), use fallback
                  affiliatePortalUrl = `https://admin.${parentClinic.slug}.${baseDomain}`;
                  console.log(`⚠️ [Affiliate Re-invite] Main URL not accessible (${error.message}), using fallback: ${affiliatePortalUrl}`);
                }
              } else {
                // No custom domain, use fallback URL format
                affiliatePortalUrl = `https://admin.${parentClinic.slug}.${baseDomain}`;
                console.log(`ℹ️ [Affiliate Re-invite] No custom domain configured, using fallback: ${affiliatePortalUrl}`);
              }
            } else {
              // Development environment
              affiliatePortalUrl = frontendOrigin.includes("3005")
                ? frontendOrigin
                : "http://localhost:3005";
            }

            // Send re-invitation email with new credentials
            const emailSent = await MailsSender.sendEmail({
              to: existingUser.email,
              subject: "Welcome Back to Fuse Affiliate Portal",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome Back to Fuse Affiliate Portal!</h1>
                  </div>
                  
                  <div style="padding: 40px 30px; background-color: #f8f9fa;">
                    <h2 style="color: #333; margin-top: 0;">You've been re-invited as an Affiliate</h2>
                    
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                      You have been re-invited to join the Fuse Affiliate Program. Use the credentials below to sign in to your affiliate dashboard:
                    </p>
                    
                    <div style="background-color: #fff; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 30px 0;">
                      <p style="margin: 10px 0; color: #333;"><strong>Email:</strong> ${existingUser.email}</p>
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
              text: `Welcome Back to Fuse Affiliate Portal!

You've been re-invited as an Affiliate. Use the credentials below to sign in:

Email: ${existingUser.email}
Temporary Password: ${tempPassword}

Sign in at: ${affiliatePortalUrl}/signin

Important: Please change your password after your first login for security.

Best regards,
The Fuse Team`,
            });

            if (emailSent) {
              console.log("✅ [Affiliate Re-invite] Re-invitation email sent successfully");
            } else {
              console.log("⚠️ [Affiliate Re-invite] Failed to send re-invitation email, but affiliate was re-activated");
            }

            return res.status(200).json({
              success: true,
              message: "Affiliate re-invited successfully",
              data: {
                affiliateId: existingUser.id,
                email: existingUser.email,
                emailSent: emailSent,
                reInvited: true,
              },
            });
          }
          
          // Affiliate is still active with a parent clinic
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

      // Create a placeholder clinic for the affiliate (they'll customize it during onboarding)
      const emailPrefix = email.split("@")[0];
      const placeholderSlug = `affiliate-${emailPrefix}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      const affiliateClinic = await Clinic.create({
        name: `${emailPrefix}'s Clinic`, // Will be customized during onboarding
        slug: placeholderSlug, // Will be customized during onboarding
        logo: "", // Empty logo - affiliate can set their own, patient-frontend will show parent logo if empty
        isActive: false, // Not active until onboarding is complete
        affiliateOwnerClinicId: parentClinic.id, // Link to parent clinic
      });

      // Create affiliate user with temporary password linked to their new clinic
      // IMPORTANT: Set website to placeholderSlug for affiliate tracking
      const affiliateUser = await User.createUser({
        firstName: emailPrefix,
        lastName: "-", // Placeholder to satisfy validation (len >= 1), will be cleared via raw SQL
        email: email.toLowerCase().trim(),
        password: tempPassword, // This will be hashed and stored in passwordHash
        role: "affiliate",
        clinicId: affiliateClinic.id, // Link to affiliate's new clinic
        website: placeholderSlug, // Set website to match clinic slug for tracking
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

      console.log("✅ [Affiliate Invite] Created affiliate user and clinic:", {
        userId: affiliateUser.id,
        email: affiliateUser.email,
        clinicId: affiliateClinic.id,
        parentClinicId: parentClinic.id,
      });

      // Get frontend origin for affiliate portal
      const frontendOrigin = req.get("origin") || req.get("referer")?.split("/").slice(0, 3).join("/") || "http://localhost:3005";

      // Determine the best affiliate portal URL
      let affiliatePortalUrl: string;

      // Determine base domain based on environment (staging or production)
      const isStaging = process.env.STAGING === "true" || 
                        process.env.NODE_ENV === "staging" ||
                        frontendOrigin?.includes("fusehealthstaging.xyz");
      const baseDomain = isStaging ? "fusehealthstaging.xyz" : "fusehealth.com";

      if (process.env.NODE_ENV === "production" || isStaging) {
        // Check if parent clinic has custom domain configured
        if (parentClinic.isCustomDomain && parentClinic.customDomain) {
          // Try the main admin URL: admin.{customDomain without 'app.' prefix}
          const mainAdminUrl = `https://admin.${parentClinic.customDomain.replace(/^app\./, '')}`;

          try {
            // Check if the URL is accessible with a quick HEAD request (timeout 3 seconds)
            await axios.head(mainAdminUrl, {
              timeout: 3000,
              validateStatus: () => true, // Accept any status code (even 404 means domain resolves)
            });

            // If we get any response (even 404 is fine, means domain resolves), use it
            affiliatePortalUrl = mainAdminUrl;
            console.log(`✅ [Affiliate Invite] Using main admin URL: ${mainAdminUrl}`);
          } catch (error: any) {
            // If request fails (DNS not configured, timeout, etc.), use fallback
            affiliatePortalUrl = `https://admin.${parentClinic.slug}.${baseDomain}`;
            console.log(`⚠️ [Affiliate Invite] Main URL not accessible (${error.message}), using fallback: ${affiliatePortalUrl}`);
          }
        } else {
          // No custom domain, use fallback URL format
          affiliatePortalUrl = `https://admin.${parentClinic.slug}.${baseDomain}`;
          console.log(`ℹ️ [Affiliate Invite] No custom domain configured, using fallback: ${affiliatePortalUrl}`);
        }
      } else {
        // Development environment
        affiliatePortalUrl = frontendOrigin.includes("3005")
          ? frontendOrigin
          : "http://localhost:3005";
      }

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

  // Setup affiliate clinic (during onboarding)
  app.post("/affiliate/setup-clinic", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [
          { model: UserRoles, as: "userRoles", required: false },
          { model: Clinic, as: "clinic", required: false },
        ],
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

      const { firstName, lastName, website, clinicName, slug } = req.body;

      // Validate personal info
      if (!firstName || typeof firstName !== "string" || firstName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "First name is required (minimum 2 characters)",
        });
      }

      if (!lastName || typeof lastName !== "string" || lastName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Last name is required (minimum 2 characters)",
        });
      }

      if (!clinicName || typeof clinicName !== "string" || clinicName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Clinic name is required (minimum 2 characters)",
        });
      }

      if (!slug || typeof slug !== "string" || slug.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: "Slug is required (minimum 3 characters)",
        });
      }

      // Validate slug format
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(slug)) {
        return res.status(400).json({
          success: false,
          message: "Slug can only contain lowercase letters, numbers, and hyphens",
        });
      }

      // Check if slug is already taken by another clinic
      const existingClinic = await Clinic.findOne({
        where: { slug: slug.trim() },
      });

      if (existingClinic && existingClinic.id !== user.clinicId) {
        return res.status(409).json({
          success: false,
          message: "This slug is already taken. Please choose a different one.",
        });
      }

      // Update the user's personal info
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        website: website?.trim() || user.website,
      });

      console.log("✅ [Affiliate Setup] Updated user info:", {
        userId: user.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        website: website?.trim() || null,
      });

      // Update the affiliate's clinic
      if (user.clinic) {
        await user.clinic.update({
          name: clinicName.trim(),
          slug: slug.trim(),
          isActive: true, // Activate the clinic after setup
        });

        // IMPORTANT: Sync User.website with Clinic.slug for affiliate tracking
        // The order tracking system uses User.website to detect affiliate from URL
        await user.update({
          website: slug.trim(),
        });

        console.log("✅ [Affiliate Setup] Updated clinic and user:", {
          clinicId: user.clinic.id,
          name: clinicName.trim(),
          slug: slug.trim(),
          userWebsite: slug.trim(),
        });

        res.status(200).json({
          success: true,
          message: "Clinic setup completed successfully",
          data: {
            clinicId: user.clinic.id,
            name: user.clinic.name,
            slug: user.clinic.slug,
            affiliateOwnerClinicId: user.clinic.affiliateOwnerClinicId,
          },
        });
      } else {
        // This shouldn't happen if invite flow works correctly, but handle it
        return res.status(400).json({
          success: false,
          message: "Affiliate clinic not found. Please contact support.",
        });
      }
    } catch (error: any) {
      console.error("❌ Error setting up affiliate clinic:", error);

      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({
          success: false,
          message: "This slug is already taken. Please choose a different one.",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to setup affiliate clinic",
      });
    }
  });

  // Get affiliate clinic settings (for portal customization)
  app.get("/affiliate/clinic", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [
          { model: UserRoles, as: "userRoles", required: false },
          { model: Clinic, as: "clinic", required: false },
        ],
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

      if (!user.clinic) {
        return res.status(404).json({
          success: false,
          message: "Affiliate clinic not found",
        });
      }

      // Get clinic's custom website settings if any
      const customWebsite = await CustomWebsite.findOne({
        where: { clinicId: user.clinic.id },
      });

      res.status(200).json({
        success: true,
        data: {
          clinic: {
            id: user.clinic.id,
            name: user.clinic.name,
            slug: user.clinic.slug,
            logo: user.clinic.logo,
            isActive: user.clinic.isActive,
            affiliateOwnerClinicId: user.clinic.affiliateOwnerClinicId,
            defaultFormColor: user.clinic.defaultFormColor,
          },
          customWebsite: customWebsite ? {
            portalTitle: customWebsite.portalTitle,
            portalDescription: customWebsite.portalDescription,
            primaryColor: customWebsite.primaryColor,
            fontFamily: customWebsite.fontFamily,
            logo: customWebsite.logo,
            heroImageUrl: customWebsite.heroImageUrl,
            heroTitle: customWebsite.heroTitle,
            heroSubtitle: customWebsite.heroSubtitle,
            isActive: customWebsite.isActive,
          } : null,
        },
      });
    } catch (error) {
      console.error("❌ Error fetching affiliate clinic:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch affiliate clinic",
      });
    }
  });

  // Update affiliate clinic settings (portal customization)
  app.put("/affiliate/clinic", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [
          { model: UserRoles, as: "userRoles", required: false },
          { model: Clinic, as: "clinic", required: false },
        ],
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

      if (!user.clinic) {
        return res.status(404).json({
          success: false,
          message: "Affiliate clinic not found",
        });
      }

      const {
        // Clinic fields
        name,
        logo,
        defaultFormColor,
        // CustomWebsite fields
        portalTitle,
        portalDescription,
        primaryColor,
        fontFamily,
        heroImageUrl,
        heroTitle,
        heroSubtitle,
        isActive,
      } = req.body;

      // Update clinic fields
      if (name) user.clinic.name = name.trim();
      if (logo !== undefined) user.clinic.logo = logo;
      if (defaultFormColor !== undefined) user.clinic.defaultFormColor = defaultFormColor;

      await user.clinic.save();

      // IMPORTANT: Keep User.website in sync with Clinic.slug for affiliate tracking
      // The order tracking system uses User.website to detect affiliate from URL
      if (user.website !== user.clinic.slug) {
        await user.update({
          website: user.clinic.slug,
        });
        console.log("✅ [Affiliate Clinic] Synced User.website with Clinic.slug:", {
          userId: user.id,
          website: user.clinic.slug,
        });
      }

      // Update or create CustomWebsite
      let customWebsite = await CustomWebsite.findOne({
        where: { clinicId: user.clinic.id },
      });

      const customWebsiteData: any = {};
      if (portalTitle !== undefined) customWebsiteData.portalTitle = portalTitle;
      if (portalDescription !== undefined) customWebsiteData.portalDescription = portalDescription;
      if (primaryColor !== undefined) customWebsiteData.primaryColor = primaryColor;
      if (fontFamily !== undefined) customWebsiteData.fontFamily = fontFamily;
      if (logo !== undefined) customWebsiteData.logo = logo;
      if (heroImageUrl !== undefined) customWebsiteData.heroImageUrl = heroImageUrl;
      if (heroTitle !== undefined) customWebsiteData.heroTitle = heroTitle;
      if (heroSubtitle !== undefined) customWebsiteData.heroSubtitle = heroSubtitle;
      if (isActive !== undefined) customWebsiteData.isActive = isActive;

      if (customWebsite) {
        await customWebsite.update(customWebsiteData);
      } else if (Object.keys(customWebsiteData).length > 0) {
        customWebsite = await CustomWebsite.create({
          clinicId: user.clinic.id,
          ...customWebsiteData,
        });
      }

      console.log("✅ [Affiliate Clinic] Updated settings:", {
        clinicId: user.clinic.id,
        name: user.clinic.name,
      });

      res.status(200).json({
        success: true,
        message: "Clinic settings updated successfully",
        data: {
          clinic: {
            id: user.clinic.id,
            name: user.clinic.name,
            slug: user.clinic.slug,
            logo: user.clinic.logo,
            isActive: user.clinic.isActive,
            defaultFormColor: user.clinic.defaultFormColor,
          },
          customWebsite: customWebsite ? {
            portalTitle: customWebsite.portalTitle,
            portalDescription: customWebsite.portalDescription,
            primaryColor: customWebsite.primaryColor,
            fontFamily: customWebsite.fontFamily,
            logo: customWebsite.logo,
            heroImageUrl: customWebsite.heroImageUrl,
            heroTitle: customWebsite.heroTitle,
            heroSubtitle: customWebsite.heroSubtitle,
            isActive: customWebsite.isActive,
          } : null,
        },
      });
    } catch (error) {
      console.error("❌ Error updating affiliate clinic:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update affiliate clinic",
      });
    }
  });

  // Admin endpoint: Sync all affiliate User.website with their Clinic.slug
  app.post("/admin/affiliates/sync-websites", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Only allow brand users or admins to sync
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
          message: "Access denied. Only brand users and admins can sync affiliates.",
        });
      }

      // Get all affiliate users with their clinics
      const affiliates = await User.findAll({
        include: [
          { 
            model: UserRoles, 
            as: "userRoles", 
            required: true,
            where: {
              affiliate: true,
            },
          },
          {
            model: Clinic,
            as: "clinic",
            required: true,
          },
        ],
      });

      let syncedCount = 0;
      const syncedAffiliates: Array<{
        id: string;
        email: string;
        oldWebsite: string | null;
        newWebsite: string;
      }> = [];

      for (const affiliate of affiliates) {
        if (affiliate.clinic && affiliate.clinic.slug) {
          // Only update if website is different from clinic slug
          if (affiliate.website !== affiliate.clinic.slug) {
            await affiliate.update({
              website: affiliate.clinic.slug,
            });
            syncedCount++;
            syncedAffiliates.push({
              id: affiliate.id,
              email: affiliate.email,
              oldWebsite: affiliate.website || null,
              newWebsite: affiliate.clinic.slug,
            });
            console.log(`✅ Synced affiliate ${affiliate.email}: website = '${affiliate.clinic.slug}'`);
          }
        }
      }

      res.status(200).json({
        success: true,
        message: `Synced ${syncedCount} affiliate(s)`,
        data: {
          totalAffiliates: affiliates.length,
          syncedCount,
          syncedAffiliates,
        },
      });
    } catch (error) {
      console.error("❌ Error syncing affiliate websites:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync affiliate websites",
      });
    }
  });

  // Public endpoint: Validate affiliate + brand relationship
  // This prevents unauthorized access by validating that the affiliate belongs to the brand
  app.post("/public/affiliate/validate-access", async (req, res) => {
    try {
      const { affiliateSlug, brandSlug } = req.body;

      console.log("🔐 Validating affiliate access:", { affiliateSlug, brandSlug });

      if (!affiliateSlug || typeof affiliateSlug !== "string") {
        return res.status(400).json({
          success: false,
          message: "Affiliate slug is required",
        });
      }

      if (!brandSlug || typeof brandSlug !== "string") {
        return res.status(400).json({
          success: false,
          message: "Brand slug is required",
        });
      }

      // Step 1: Find the brand clinic first
      const brandClinic = await Clinic.findOne({
        where: { slug: brandSlug.trim() }
      });

      if (!brandClinic) {
        console.log("❌ Brand clinic not found:", brandSlug);
        return res.status(404).json({
          success: false,
          message: "Brand clinic not found",
        });
      }

      console.log("✅ Brand clinic found:", { id: brandClinic.id, slug: brandClinic.slug, name: brandClinic.name });

      // Step 2: Find the affiliate clinic that belongs to this brand
      const affiliateClinic = await Clinic.findOne({
        where: {
          slug: affiliateSlug.trim(),
          affiliateOwnerClinicId: brandClinic.id
        }
      });

      if (!affiliateClinic) {
        console.log("❌ Affiliate clinic not found or doesn't belong to brand:", { 
          affiliateSlug, 
          brandSlug,
          brandClinicId: brandClinic.id 
        });
        return res.status(403).json({
          success: false,
          message: "Invalid affiliate",
        });
      }

      console.log("✅ Affiliate clinic found:", { 
        id: affiliateClinic.id, 
        slug: affiliateClinic.slug, 
        name: affiliateClinic.name,
        parentId: affiliateClinic.affiliateOwnerClinicId 
      });

      // Step 3: Find the user who owns this affiliate clinic
      const affiliate = await User.findOne({
        where: {
          clinicId: affiliateClinic.id
        },
        include: [
          {
            model: UserRoles,
            as: "userRoles",
            required: true,
          }
        ],
      });

      if (!affiliate) {
        console.log("❌ Affiliate user not found for clinic:", affiliateClinic.id);
        return res.status(403).json({
          success: false,
          message: "Invalid affiliate",
        });
      }

      await affiliate.getUserRoles();

      if (!affiliate.userRoles?.hasRole("affiliate")) {
        console.log("❌ User is not an affiliate:", affiliateSlug);
        return res.status(403).json({
          success: false,
          message: "Invalid affiliate",
        });
      }

      // Step 4: All validations passed - return the parent clinic info
      console.log("✅ Affiliate access validated:", {
        affiliateSlug: affiliateClinic.slug,
        brandSlug: brandClinic.slug,
        affiliateId: affiliate.id,
        affiliateClinicId: affiliateClinic.id,
        parentClinicId: brandClinic.id,
      });

      res.status(200).json({
        success: true,
        data: {
          affiliateId: affiliate.id,
          affiliateSlug: affiliateClinic.slug,
          brandClinic: {
            id: brandClinic.id,
            slug: brandClinic.slug,
            name: brandClinic.name,
          },
        },
      });
    } catch (error) {
      console.error("❌ Error validating affiliate access:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate affiliate access",
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

  // Get affiliate products (with custom images if set)
  app.get("/affiliate/products", authenticateJWT, async (req, res) => {
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

      // Get affiliate's clinic and parent clinic
      if (!user.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate clinic not set. Please complete onboarding.",
        });
      }

      const affiliateClinic = await Clinic.findByPk(user.clinicId);
      if (!affiliateClinic?.affiliateOwnerClinicId) {
        return res.status(400).json({
          success: false,
          message: "Affiliate parent clinic not found",
        });
      }

      const parentClinicId = affiliateClinic.affiliateOwnerClinicId;

      // Get all products from the parent clinic
      const tenantProducts = await TenantProduct.findAll({
        where: {
          clinicId: parentClinicId,
          isActive: true,
        },
        include: [
          {
            model: Product,
            as: "product",
            required: true,
          },
        ],
      });

      // Get affiliate's custom images
      const customImages = await AffiliateProductImage.findAll({
        where: {
          affiliateId: user.id,
        },
      });

      // Create a map of custom images by productId
      const customImageMap = new Map();
      customImages.forEach((img) => {
        customImageMap.set(img.productId, {
          customImageUrl: img.customImageUrl,
          useCustomImage: img.useCustomImage,
        });
      });

      // Merge products with custom images
      const productsWithCustomImages = tenantProducts.map((tp) => {
        const product = tp.product;
        const customImg = customImageMap.get(product.id);

        return {
          id: product.id,
          name: product.name,
          price: tp.price || product.price,
          originalImageUrl: product.imageUrl,
          customImageUrl: customImg?.customImageUrl || null,
          useCustomImage: customImg?.useCustomImage || false,
          displayImageUrl: customImg?.useCustomImage && customImg?.customImageUrl
            ? customImg.customImageUrl
            : product.imageUrl,
          category: null,
          categories: [],
          active: tp.isActive,
        };
      });

      res.status(200).json({
        success: true,
        data: productsWithCustomImages,
      });
    } catch (error) {
      console.error("❌ Error fetching affiliate products:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch affiliate products",
      });
    }
  });

  // Upload affiliate product image
  app.post("/affiliate/products/:productId/upload-image", authenticateJWT, upload.single("image"), async (req, res) => {
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

      const { productId } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      // Validate file size
      if (!isValidFileSize(req.file.size)) {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 5MB.",
        });
      }

      // Verify product exists
      const product = await Product.findByPk(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      // Check if affiliate already has a custom image for this product
      const existingImage = await AffiliateProductImage.findOne({
        where: {
          affiliateId: user.id,
          productId,
        },
      });

      // Delete old image from S3 if it exists
      if (existingImage?.customImageUrl) {
        try {
          await deleteFromS3(existingImage.customImageUrl);
          console.log("🗑️ Old affiliate product image deleted from S3");
        } catch (error) {
          console.error("Warning: Failed to delete old affiliate product image from S3:", error);
        }
      }

      // Upload new image to S3
      const imageUrl = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        "affiliate-product-images"
      );

      // Upsert affiliate product image
      const [affiliateProductImage, created] = await AffiliateProductImage.upsert({
        affiliateId: user.id,
        productId,
        customImageUrl: imageUrl,
        useCustomImage: true,
      });

      console.log("✅ [Affiliate Product Image] Uploaded:", {
        affiliateId: user.id,
        productId,
        imageUrl,
        created,
      });

      res.status(200).json({
        success: true,
        message: created
          ? "Product image uploaded successfully"
          : "Product image updated successfully",
        data: {
          customImageUrl: affiliateProductImage.customImageUrl,
          useCustomImage: affiliateProductImage.useCustomImage,
        },
      });
    } catch (error) {
      console.error("❌ Error updating affiliate product image:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update product image",
      });
    }
  });

  // Toggle between custom and original image
  app.put("/affiliate/products/:productId/toggle-image", authenticateJWT, async (req, res) => {
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

      const { productId } = req.params;
      const { useCustomImage } = req.body;

      if (useCustomImage === undefined) {
        return res.status(400).json({
          success: false,
          message: "useCustomImage is required",
        });
      }

      // Find existing affiliate product image
      const affiliateProductImage = await AffiliateProductImage.findOne({
        where: {
          affiliateId: user.id,
          productId,
        },
      });

      if (!affiliateProductImage) {
        return res.status(404).json({
          success: false,
          message: "No custom image found for this product. Please upload one first.",
        });
      }

      // Update the toggle
      affiliateProductImage.useCustomImage = useCustomImage;
      await affiliateProductImage.save();

      console.log("✅ [Affiliate Product Image] Toggled:", {
        affiliateId: user.id,
        productId,
        useCustomImage,
      });

      res.status(200).json({
        success: true,
        message: `Now using ${useCustomImage ? "custom" : "original"} image`,
        data: {
          useCustomImage: affiliateProductImage.useCustomImage,
        },
      });
    } catch (error) {
      console.error("❌ Error toggling affiliate product image:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle product image",
      });
    }
  });
}


