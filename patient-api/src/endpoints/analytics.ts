import { Router, Request, Response } from "express";
import TenantAnalyticsEvents from "../models/TenantAnalyticsEvents";
import TenantProduct from "../models/TenantProduct";
import Product from "../models/Product";
import FormAnalyticsDaily from "../models/FormAnalyticsDaily";
import TenantProductForm from "../models/TenantProductForm";
import GlobalFormStructure from "../models/GlobalFormStructure";
import { authenticateJWT, getCurrentUser } from "../config/jwt";
import { Op } from "sequelize";
import AnalyticsService from "../services/analytics.service";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import User from "../models/User";
import Like from "../models/Like";
import Clinic from "../models/Clinic";

const router = Router();

// Track analytics event (view, conversion, or dropoff)
router.post("/analytics/track", async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("📊 [Analytics API] Received tracking request");
    }

    const {
      userId,
      productId,
      formId,
      eventType,
      sessionId,
      dropOffStage,
      metadata,
      sourceType = 'brand', // Default to 'brand' if not specified
    } = req.body;

    // Capture IP address for anonymous user tracking
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || '';

    if (!userId || !productId || !formId || !eventType) {
      if (process.env.NODE_ENV === "development") {
        console.log("❌ [Analytics API] Missing required fields");
      }
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, productId, formId, eventType",
      });
    }

    if (!["view", "conversion", "dropoff"].includes(eventType)) {
      if (process.env.NODE_ENV === "development") {
        console.log("❌ [Analytics API] Invalid eventType");
      }
      return res.status(400).json({
        success: false,
        error: 'eventType must be either "view", "conversion", or "dropoff"',
      });
    }

    // Validate dropOffStage if eventType is 'dropoff'
    if (eventType === "dropoff" && !dropOffStage) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "❌ [Analytics API] Missing dropOffStage for dropoff event"
        );
      }
      return res.status(400).json({
        success: false,
        error: "dropOffStage is required for dropoff events",
      });
    }

    if (
      eventType === "dropoff" &&
      !["product", "payment", "account"].includes(dropOffStage)
    ) {
      if (process.env.NODE_ENV === "development") {
        console.log("❌ [Analytics API] Invalid dropOffStage");
      }
      return res.status(400).json({
        success: false,
        error: "dropOffStage must be one of: product, payment, account",
      });
    }

    // Validate sourceType
    if (sourceType && !["brand", "affiliate"].includes(sourceType)) {
      if (process.env.NODE_ENV === "development") {
        console.log("❌ [Analytics API] Invalid sourceType");
      }
      return res.status(400).json({
        success: false,
        error: "sourceType must be either 'brand' or 'affiliate'",
      });
    }

    console.log("📊 [Analytics API] Creating event with data:", {
      userId,
      productId,
      formId,
      eventType,
      sessionId,
      sourceType: sourceType || 'brand',
      metadata,
    });

    // If this is an affiliate event, find the affiliate user by slug
    let finalUserId = userId;
    if (sourceType === 'affiliate' && metadata?.affiliateSlug) {
      console.log("🔍 [Analytics API] Looking for affiliate user with slug:", metadata.affiliateSlug);
      
      const affiliateUser = await User.findOne({
        where: { website: metadata.affiliateSlug },
      });

      if (affiliateUser) {
        finalUserId = affiliateUser.id;
        console.log("✅ [Analytics API] Found affiliate user:", {
          affiliateSlug: metadata.affiliateSlug,
          affiliateUserId: finalUserId,
          originalUserId: userId,
        });
      } else {
        console.warn("⚠️ [Analytics API] Affiliate user not found for slug:", metadata.affiliateSlug);
      }
    }

    const analyticsEvent = await TenantAnalyticsEvents.create({
      userId: finalUserId,  // Use affiliate userId if found
      productId,
      formId,
      eventType,
      sessionId,
      dropOffStage: eventType === "dropoff" ? dropOffStage : null,
      sourceType: sourceType || 'brand',
      metadata: {
        ...metadata,
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : ipAddress,
        userAgent,
      },
    });

    console.log("✅ [Analytics API] Analytics event created successfully:", {
      id: analyticsEvent.id,
      eventType: analyticsEvent.eventType,
      sourceType: analyticsEvent.sourceType,
      userId: analyticsEvent.userId,
    });

    return res.json({
      success: true,
      data: analyticsEvent.toJSON(),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ [Analytics API] Error tracking analytics");
    }
    return res.status(500).json({
      success: false,
      error: "Failed to track analytics event",
    });
  }
});

// Get analytics for a specific product
router.get(
  "/analytics/products/:productId",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const timeRange = (req.query.timeRange as string) || "30d";
      const currentUser = getCurrentUser(req);
      const userId = currentUser?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      // Ensure yesterday's data is aggregated
      await AnalyticsService.ensureDataAggregated();

      // Verify the tenant product belongs to the user
      const tenantProduct = await TenantProduct.findOne({
        where: {
          id: productId,
        },
        include: [
          {
            model: Product,
            required: true,
          },
        ],
      });

      if (!tenantProduct) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      // Calculate the date range
      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case "1d":
          startDate.setDate(endDate.getDate() - 1);
          break;
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(endDate.getDate() - 90);
          break;
        case "180d":
          startDate.setDate(endDate.getDate() - 180);
          break;
        case "365d":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Get analytics data for the product
      const analytics = await TenantAnalyticsEvents.findAll({
        where: {
          userId,
          productId,
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate,
          },
        },
        order: [["createdAt", "ASC"]],
      });

      // Get unique form IDs
      const formIds = [...new Set(analytics.map((event) => event.formId))];

      // Fetch all form details in one query
      const forms = await TenantProductForm.findAll({
        where: {
          id: {
            [Op.in]: formIds,
          },
        },
        include: [
          {
            model: GlobalFormStructure,
            as: "globalFormStructure",
            attributes: ["structureId", "name"],
          },
        ],
      });

      // Create a map of formId -> form details
      const formDetailsMap = new Map(
        forms.map((form) => [
          form.id,
          {
            structureName:
              form.globalFormStructure?.name || "Unknown Structure",
            structureId: form.globalFormStructureId || "unknown",
          },
        ])
      );

      // Group analytics by form and event type
      const formAnalytics: Record<
        string,
        {
          views: number;
          conversions: number;
          productDropOffs: number;
          paymentDropOffs: number;
          accountDropOffs: number;
          formUrl: string;
        }
      > = {};

      // Process analytics events
      analytics.forEach((event) => {
        const eventData = event.toJSON();
        const formId = eventData.formId;

        if (!formAnalytics[formId]) {
          const formDetails = formDetailsMap.get(formId);
          const productName = eventData.metadata?.productName || "";

          const formLabel = formDetails
            ? `${productName} - ${formDetails.structureName}`
            : productName
              ? `${productName} Form (${formId.slice(0, 8)}...)`
              : `Form ${formId.slice(0, 8)}...`;

          formAnalytics[formId] = {
            views: 0,
            conversions: 0,
            productDropOffs: 0,
            paymentDropOffs: 0,
            accountDropOffs: 0,
            formUrl: formLabel,
          };
        }

        if (eventData.eventType === "view") {
          formAnalytics[formId].views++;
        } else if (eventData.eventType === "conversion") {
          formAnalytics[formId].conversions++;
        } else if (eventData.eventType === "dropoff") {
          if (eventData.dropOffStage === "product") {
            formAnalytics[formId].productDropOffs++;
          } else if (eventData.dropOffStage === "payment") {
            formAnalytics[formId].paymentDropOffs++;
          } else if (eventData.dropOffStage === "account") {
            formAnalytics[formId].accountDropOffs++;
          }
        }
      });

      const formAnalyticsWithRates = Object.entries(formAnalytics).map(
        ([formId, data]) => {
          const totalDropOffs =
            data.productDropOffs + data.paymentDropOffs + data.accountDropOffs;

          return {
            formId,
            views: data.views,
            conversions: data.conversions,
            conversionRate:
              data.views > 0 ? (data.conversions / data.views) * 100 : 0,
            formUrl: data.formUrl,
            dropOffs: {
              product: data.productDropOffs,
              payment: data.paymentDropOffs,
              account: data.accountDropOffs,
              total: totalDropOffs,
            },
            dropOffRates: {
              product:
                data.views > 0 ? (data.productDropOffs / data.views) * 100 : 0,
              payment:
                data.views > 0 ? (data.paymentDropOffs / data.views) * 100 : 0,
              account:
                data.views > 0 ? (data.accountDropOffs / data.views) * 100 : 0,
            },
          };
        }
      );

      const totalViews = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.views,
        0
      );
      const totalConversions = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.conversions,
        0
      );
      const totalProductDropOffs = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.productDropOffs,
        0
      );
      const totalPaymentDropOffs = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.paymentDropOffs,
        0
      );
      const totalAccountDropOffs = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.accountDropOffs,
        0
      );
      const overallConversionRate =
        totalViews > 0 ? (totalConversions / totalViews) * 100 : 0;

      return res.json({
        success: true,
        data: {
          productId,
          tenantProductId: productId, // This is actually the tenant product ID
          timeRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          summary: {
            totalViews,
            totalConversions,
            overallConversionRate,
            dropOffs: {
              product: totalProductDropOffs,
              payment: totalPaymentDropOffs,
              account: totalAccountDropOffs,
              total:
                totalProductDropOffs +
                totalPaymentDropOffs +
                totalAccountDropOffs,
            },
            dropOffRates: {
              product:
                totalViews > 0 ? (totalProductDropOffs / totalViews) * 100 : 0,
              payment:
                totalViews > 0 ? (totalPaymentDropOffs / totalViews) * 100 : 0,
              account:
                totalViews > 0 ? (totalAccountDropOffs / totalViews) * 100 : 0,
            },
          },
          forms: formAnalyticsWithRates,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error fetching product analytics");
      }
      return res.status(500).json({
        success: false,
        error: "Failed to fetch product analytics",
      });
    }
  }
);

// Get analytics for all products of a user
router.get(
  "/analytics/overview",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const timeRange = (req.query.timeRange as string) || "30d";
      const currentUser = getCurrentUser(req);
      const userId = currentUser?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      await AnalyticsService.ensureDataAggregated();

      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case "1d":
          startDate.setDate(endDate.getDate() - 1);
          break;
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(endDate.getDate() - 90);
          break;
        case "180d":
          startDate.setDate(endDate.getDate() - 180);
          break;
        case "365d":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Get user's clinic ID
      const user = await User.findByPk(userId, {
        attributes: ['clinicId'],
      });

      if (!user || !user.clinicId) {
        return res.status(404).json({
          success: false,
          error: "User clinic not found",
        });
      }

      const clinicId = user.clinicId;

      // Get analytics events
      const analytics = await TenantAnalyticsEvents.findAll({
        where: {
          userId,
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate,
          },
        },
        include: [
          {
            model: TenantProduct,
            as: "tenantProduct",
            attributes: ["id"],
            include: [
              {
                model: Product,
                attributes: ["id", "name"],
              },
            ],
          },
        ],
        order: [["createdAt", "ASC"]],
      });

      // Get all tenant products owned by this clinic
      const allUserProducts = await TenantProduct.findAll({
        where: { clinicId },
        include: [
          {
            model: Product,
            attributes: ["id", "name"],
          },
        ],
        attributes: ["id"],
      });

      // Get products with likes (to include them even if no analytics events)
      const productsWithLikes = await Like.findAll({
        where: {
          liked: true,
          tenantProductId: {
            [Op.in]: allUserProducts.map(p => p.id),
          },
        },
        attributes: ["tenantProductId"],
        group: ["tenantProductId"],
      });

      const productAnalytics: Record<
        string,
        {
          productName: string;
          views: number;
          conversions: number;
        }
      > = {};

      // Initialize all user products in the map
      allUserProducts.forEach((tp) => {
        const tenantProduct = tp.toJSON() as any;
        productAnalytics[tp.id] = {
          productName: tenantProduct.product?.name || "Unknown Product",
          views: 0,
          conversions: 0,
        };
      });

      // Process analytics events
      analytics.forEach((event) => {
        const eventData = event.toJSON() as any;
        const productId = eventData.productId;
        const productName =
          eventData.tenantProduct?.product?.name || "Unknown Product";

        if (!productAnalytics[productId]) {
          productAnalytics[productId] = {
            productName,
            views: 0,
            conversions: 0,
          };
        }

        if (eventData.eventType === "view") {
          productAnalytics[productId].views++;
        } else if (eventData.eventType === "conversion") {
          productAnalytics[productId].conversions++;
        }
      });

      // Ensure products with likes are included
      productsWithLikes.forEach((like) => {
        const productId = like.tenantProductId;
        
        // Product should already be in the map from allUserProducts
        // This just ensures it's there in case of any edge cases
        if (!productAnalytics[productId]) {
          const product = allUserProducts.find(p => p.id === productId);
          if (product) {
            const productData = product.toJSON() as any;
            productAnalytics[productId] = {
              productName: productData.product?.name || "Unknown Product",
              views: 0,
              conversions: 0,
            };
          }
        }
      });

      const productAnalyticsWithRates = Object.entries(productAnalytics).map(
        ([productId, data]) => ({
          productId,
          tenantProductId: productId, // This is actually the tenant product ID
          productName: data.productName,
          views: data.views,
          conversions: data.conversions,
          conversionRate:
            data.views > 0 ? (data.conversions / data.views) * 100 : 0,
        })
      );

      const totalViews = Object.values(productAnalytics).reduce(
        (sum, data) => sum + data.views,
        0
      );
      const totalConversions = Object.values(productAnalytics).reduce(
        (sum, data) => sum + data.conversions,
        0
      );
      const overallConversionRate =
        totalViews > 0 ? (totalConversions / totalViews) * 100 : 0;

      return res.json({
        success: true,
        data: {
          timeRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          summary: {
            totalViews,
            totalConversions,
            overallConversionRate,
          },
          products: productAnalyticsWithRates,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "❌ [Analytics Overview] Error fetching overview analytics:",
          error
        );
      }
      return res.status(500).json({
        success: false,
        error: "Failed to fetch overview analytics",
      });
    }
  }
);

// ============= ADMIN ENDPOINTS FOR ANALYTICS MAINTENANCE =============

// Manually trigger daily aggregation
router.post(
  "/admin/analytics/aggregate",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Admin access required",
        });
      }

      const { date } = req.body;

      await AnalyticsService.aggregateDailyAnalytics(date);

      return res.json({
        success: true,
        message: `Daily aggregation completed for ${date || "yesterday"}`,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error triggering aggregation");
      }
      return res.status(500).json({
        success: false,
        error: "Failed to trigger aggregation",
      });
    }
  }
);

// Manually trigger retention policy
router.post(
  "/admin/analytics/retention",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Admin access required",
        });
      }

      const { retentionDays = 365 } = req.body;

      const deletedCount =
        await AnalyticsService.applyRetentionPolicy(retentionDays);

      return res.json({
        success: true,
        message: `Deleted ${deletedCount} events older than ${retentionDays} days`,
        deletedCount,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error applying retention policy");
      }
      return res.status(500).json({
        success: false,
        error: "Failed to apply retention policy",
      });
    }
  }
);

// Run full daily maintenance (aggregate + retention)
router.post(
  "/admin/analytics/maintenance",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Admin access required",
        });
      }

      await AnalyticsService.runDailyMaintenance();

      return res.json({
        success: true,
        message: "Daily maintenance completed successfully",
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error running maintenance");
      }
      return res.status(500).json({
        success: false,
        error: "Failed to run maintenance",
      });
    }
  }
);

// Backfill aggregations for a date range
router.post(
  "/admin/analytics/backfill",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Admin access required",
        });
      }

      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: "startDate and endDate are required",
        });
      }

      await AnalyticsService.backfillDailyAggregations(startDate, endDate);

      return res.json({
        success: true,
        message: `Backfill completed for ${startDate} to ${endDate}`,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error running backfill");
      }
      return res.status(500).json({
        success: false,
        error: "Failed to run backfill",
      });
    }
  }
);

// Check aggregation status
router.get(
  "/admin/analytics/status",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Admin access required",
        });
      }

      const latestAggregation = await FormAnalyticsDaily.findOne({
        order: [["date", "DESC"]],
        attributes: ["date"],
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      return res.json({
        success: true,
        data: {
          mode: "on-demand",
          latestAggregationDate: latestAggregation?.date || null,
          yesterdayDate: yesterdayStr,
          isUpToDate: latestAggregation?.date === yesterdayStr,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error checking aggregation status");
      }
      return res.status(500).json({
        success: false,
        error: "Failed to check aggregation status",
      });
    }
  }
);

// ============= AFFILIATE ANALYTICS ENDPOINTS =============

// Get analytics overview for affiliate portal - shows Orders with affiliateId
router.get(
  "/analytics/affiliate/overview",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const timeRange = (req.query.timeRange as string) || "30d";
      const currentUser = getCurrentUser(req);
      const userId = currentUser?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      // Get user's clinicId for affiliate analytics
      const affiliateUser = await User.findByPk(userId);
      const affiliateClinicId = affiliateUser?.clinicId;

      if (!affiliateClinicId) {
        return res.status(400).json({
          success: false,
          error: "Affiliate clinic ID not found",
        });
      }

      console.log("🔍 [AFFILIATE ANALYTICS] User info:", {
        userId,
        affiliateClinicId,
      });

      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case "1d":
          startDate.setDate(endDate.getDate() - 1);
          break;
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(endDate.getDate() - 90);
          break;
        case "180d":
          startDate.setDate(endDate.getDate() - 180);
          break;
        case "365d":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      console.log("🔍 [AFFILIATE ANALYTICS] Searching for analytics and orders with:", {
        affiliateId: userId,
        startDate,
        endDate,
      });

      // Get analytics events (views and conversions)
      const analyticsEvents = await TenantAnalyticsEvents.findAll({
        where: {
          userId,
          sourceType: 'affiliate',
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate,
          },
        },
      });

      // Calculate views and conversions
      const totalViews = analyticsEvents.filter(e => e.eventType === 'view').length;
      const totalConversions = analyticsEvents.filter(e => e.eventType === 'conversion').length;
      const conversionRate = totalViews > 0 ? (totalConversions / totalViews) * 100 : 0;

      console.log("📊 [AFFILIATE ANALYTICS] Analytics stats:", {
        totalViews,
        totalConversions,
        conversionRate: `${conversionRate.toFixed(2)}%`,
      });

      // Get all orders where affiliateId matches the current user  
      const orders = await Order.findAll({
        where: {
          affiliateId: userId,
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate,
          },
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "email", "firstName", "lastName"],
          },
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                attributes: ["id", "name"],
              },
            ],
          },
          {
            model: TenantProduct,
            as: "tenantProduct",
            attributes: ["id", "clinicId"],
            include: [
              {
                model: Product,
                attributes: ["id", "name"],
              },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      console.log(`✅ [AFFILIATE ANALYTICS] Found ${orders.length} orders:`, orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        customerEmail: o.user?.email,
        tenantProductId: o.tenantProductId,
        clinicId: (o as any).tenantProduct?.clinicId,
      })));

      console.log("📊 [AFFILIATE ANALYTICS] Order status breakdown:", {
        total: orders.length,
        paid: orders.filter(o => o.status === "paid").length,
        pending: orders.filter(o => o.status === "pending").length,
        amount_capturable: orders.filter(o => o.status === "amount_capturable_updated").length,
        other: orders.filter(o => !["paid", "pending", "amount_capturable_updated"].includes(o.status)).length,
      });

      // Get unique clinicIds from orders to find all brand products
      const orderClinicIds = [...new Set(
        orders
          .map(o => (o as any).tenantProduct?.clinicId)
          .filter((id): id is string => !!id)
      )];

      console.log(`🏥 [AFFILIATE ANALYTICS] Found ${orderClinicIds.length} unique clinic(s) from orders:`, orderClinicIds);

      // Get all tenant products from those clinics
      const allBrandProducts = orderClinicIds.length > 0 
        ? await TenantProduct.findAll({
            where: { clinicId: { [Op.in]: orderClinicIds } },
            include: [
              {
                model: Product,
                attributes: ["id", "name"],
              },
            ],
            attributes: ["id", "clinicId"],
          })
        : [];

      console.log(`📦 [AFFILIATE ANALYTICS] Found ${allBrandProducts.length} products from brand(s):`, 
        allBrandProducts.map(p => ({
          id: p.id,
          clinicId: p.clinicId,
          productName: (p as any).product?.name,
        }))
      );

      // Format orders for the response
      const formattedOrders = orders.map((order) => {
        const orderData = order.toJSON() as any;
        const productName = 
          orderData.tenantProduct?.product?.name || 
          orderData.orderItems?.[0]?.product?.name || 
          "Unknown Product";

        return {
          orderId: orderData.id,
          orderNumber: orderData.orderNumber,
          status: orderData.status,
          totalAmount: orderData.totalAmount,
          productName,
          productId: orderData.tenantProductId || null, // Include tenantProductId for product details
          customerEmail: orderData.user?.email || "N/A",
          customerName: orderData.user?.firstName && orderData.user?.lastName 
            ? `${orderData.user.firstName} ${orderData.user.lastName}` 
            : "N/A",
          createdAt: orderData.createdAt,
        };
      });

      // Calculate summary stats
      const totalOrders = orders.length;
      const paidOrders = orders.filter(o => o.status === "paid");
      const totalSales = paidOrders.reduce((sum, o) => {
        const amount = Number(o.totalAmount) || 0;
        return sum + amount;
      }, 0);
      
      console.log("💰 [AFFILIATE ANALYTICS] Paid orders for revenue calculation:", 
        paidOrders.map(o => ({
          orderNumber: o.orderNumber,
          status: o.status,
          totalAmount: o.totalAmount,
          totalAmountType: typeof o.totalAmount,
        }))
      );
      
      // Calculate affiliate revenue as percentage of total sales
      const affiliateRevenuePercentage = parseFloat(process.env.AFFILIATE_REVENUE_PERCENTAGE || "1") / 100;
      const totalRevenue = totalSales * affiliateRevenuePercentage;

      console.log("💰 [AFFILIATE ANALYTICS] Revenue calculation:", {
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        totalSales: `$${Number(totalSales).toFixed(2)}`,
        totalSalesType: typeof totalSales,
        affiliatePercentage: `${(affiliateRevenuePercentage * 100).toFixed(2)}%`,
        affiliateRevenue: `$${Number(totalRevenue).toFixed(2)}`,
      });

      // Build products array with analytics (views, conversions, orders, and likes)
      const productsWithAnalytics = await Promise.all(
        allBrandProducts.map(async (tp) => {
          const tenantProductId = tp.id;
          const productData = tp.toJSON() as any;

          // Get analytics for this product (views, conversions) from affiliate
          // Note: TenantAnalyticsEvents uses 'productId' to store the TenantProduct ID
          const productEvents = analyticsEvents.filter(
            e => e.productId === tenantProductId
          );
          const productViews = productEvents.filter(e => e.eventType === 'view').length;
          const productConversions = productEvents.filter(e => e.eventType === 'conversion').length;
          const productConversionRate = productViews > 0 ? (productConversions / productViews) * 100 : 0;

          // Get orders for this product by this affiliate
          const productOrders = orders.filter(
            o => o.tenantProductId === tenantProductId
          );
          const productPaidOrders = productOrders.filter(o => o.status === "paid");
          const productRevenue = productPaidOrders.reduce((sum, o) => {
            const amount = Number(o.totalAmount) || 0;
            return sum + amount;
          }, 0) * affiliateRevenuePercentage;

          // Get likes for this product from this affiliate only (by clinicId, not userId)
          const productLikes = await Like.count({
            where: { 
              tenantProductId,
              liked: true,
              sourceType: 'affiliate',
              affiliateId: affiliateClinicId,
            },
          });

          return {
            id: tenantProductId,
            name: productData.product?.name || "Unknown Product",
            views: productViews,
            conversions: productConversions,
            conversionRate: productConversionRate,
            orders: productOrders.length,
            revenue: productRevenue,
            likes: productLikes,
          };
        })
      );

      console.log(`📦 [AFFILIATE ANALYTICS] Products with analytics:`, 
        productsWithAnalytics.map(p => ({
          name: p.name,
          views: p.views,
          conversions: p.conversions,
          orders: p.orders,
          likes: p.likes,
        }))
      );

      return res.json({
        success: true,
        data: {
          timeRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          summary: {
            totalViews,
            totalConversions,
            conversionRate,
            totalOrders,
            paidOrders: paidOrders.length,
            totalRevenue,
          },
          products: productsWithAnalytics,
          orders: formattedOrders,
        },
      });
    } catch (error) {
      console.error("❌ [Affiliate Analytics] Error fetching orders:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch affiliate analytics",
      });
    }
  }
);

// Get analytics for a specific product (filtered by sourceType='affiliate')
router.get(
  "/analytics/affiliate/products/:productId",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const timeRange = (req.query.timeRange as string) || "30d";
      const currentUser = getCurrentUser(req);
      const userId = currentUser?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      await AnalyticsService.ensureDataAggregated();

      // Verify the tenant product belongs to the user
      const tenantProduct = await TenantProduct.findOne({
        where: {
          id: productId,
        },
        include: [
          {
            model: Product,
            required: true,
          },
        ],
      });

      if (!tenantProduct) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case "1d":
          startDate.setDate(endDate.getDate() - 1);
          break;
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(endDate.getDate() - 90);
          break;
        case "180d":
          startDate.setDate(endDate.getDate() - 180);
          break;
        case "365d":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Filter by sourceType='affiliate'
      const analytics = await TenantAnalyticsEvents.findAll({
        where: {
          userId,
          productId,
          sourceType: 'affiliate',
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate,
          },
        },
        order: [["createdAt", "ASC"]],
      });

      // Get unique form IDs
      const formIds = [...new Set(analytics.map((event) => event.formId))];

      // Fetch all form details in one query
      const forms = await TenantProductForm.findAll({
        where: {
          id: {
            [Op.in]: formIds,
          },
        },
        include: [
          {
            model: GlobalFormStructure,
            as: "globalFormStructure",
            attributes: ["structureId", "name"],
          },
        ],
      });

      // Create a map of formId -> form details
      const formDetailsMap = new Map(
        forms.map((form) => [
          form.id,
          {
            structureName:
              form.globalFormStructure?.name || "Unknown Structure",
            structureId: form.globalFormStructureId || "unknown",
          },
        ])
      );

      // Group analytics by form and event type
      const formAnalytics: Record<
        string,
        {
          views: number;
          conversions: number;
          productDropOffs: number;
          paymentDropOffs: number;
          accountDropOffs: number;
          formUrl: string;
        }
      > = {};

      // Process analytics events
      analytics.forEach((event) => {
        const eventData = event.toJSON();
        const formId = eventData.formId;

        if (!formAnalytics[formId]) {
          const formDetails = formDetailsMap.get(formId);
          const productName = eventData.metadata?.productName || "";

          const formLabel = formDetails
            ? `${productName} - ${formDetails.structureName} (Affiliate)`
            : productName
              ? `${productName} Form (${formId.slice(0, 8)}...) (Affiliate)`
              : `Affiliate Form ${formId.slice(0, 8)}...`;

          formAnalytics[formId] = {
            views: 0,
            conversions: 0,
            productDropOffs: 0,
            paymentDropOffs: 0,
            accountDropOffs: 0,
            formUrl: formLabel,
          };
        }

        if (eventData.eventType === "view") {
          formAnalytics[formId].views++;
        } else if (eventData.eventType === "conversion") {
          formAnalytics[formId].conversions++;
        } else if (eventData.eventType === "dropoff") {
          if (eventData.dropOffStage === "product") {
            formAnalytics[formId].productDropOffs++;
          } else if (eventData.dropOffStage === "payment") {
            formAnalytics[formId].paymentDropOffs++;
          } else if (eventData.dropOffStage === "account") {
            formAnalytics[formId].accountDropOffs++;
          }
        }
      });

      const formAnalyticsWithRates = Object.entries(formAnalytics).map(
        ([formId, data]) => {
          const totalDropOffs =
            data.productDropOffs + data.paymentDropOffs + data.accountDropOffs;

          return {
            formId,
            views: data.views,
            conversions: data.conversions,
            conversionRate:
              data.views > 0 ? (data.conversions / data.views) * 100 : 0,
            formUrl: data.formUrl,
            dropOffs: {
              product: data.productDropOffs,
              payment: data.paymentDropOffs,
              account: data.accountDropOffs,
              total: totalDropOffs,
            },
            dropOffRates: {
              product:
                data.views > 0 ? (data.productDropOffs / data.views) * 100 : 0,
              payment:
                data.views > 0 ? (data.paymentDropOffs / data.views) * 100 : 0,
              account:
                data.views > 0 ? (data.accountDropOffs / data.views) * 100 : 0,
            },
          };
        }
      );

      const totalViews = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.views,
        0
      );
      const totalConversions = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.conversions,
        0
      );
      const totalProductDropOffs = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.productDropOffs,
        0
      );
      const totalPaymentDropOffs = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.paymentDropOffs,
        0
      );
      const totalAccountDropOffs = Object.values(formAnalytics).reduce(
        (sum, data) => sum + data.accountDropOffs,
        0
      );
      const overallConversionRate =
        totalViews > 0 ? (totalConversions / totalViews) * 100 : 0;

      return res.json({
        success: true,
        data: {
          productId,
          tenantProductId: productId, // This is actually the tenant product ID
          timeRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          summary: {
            totalViews,
            totalConversions,
            overallConversionRate,
            dropOffs: {
              product: totalProductDropOffs,
              payment: totalPaymentDropOffs,
              account: totalAccountDropOffs,
              total:
                totalProductDropOffs +
                totalPaymentDropOffs +
                totalAccountDropOffs,
            },
            dropOffRates: {
              product:
                totalViews > 0 ? (totalProductDropOffs / totalViews) * 100 : 0,
              payment:
                totalViews > 0 ? (totalPaymentDropOffs / totalViews) * 100 : 0,
              account:
                totalViews > 0 ? (totalAccountDropOffs / totalViews) * 100 : 0,
            },
          },
          forms: formAnalyticsWithRates,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error fetching affiliate product analytics");
      }
      return res.status(500).json({
        success: false,
        error: "Failed to fetch affiliate product analytics",
      });
    }
  }
);

// Get list of forms for a clinic
router.get("/analytics/forms", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Get user's clinic
    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res.status(400).json({
        success: false,
        message: "No clinic associated with user",
      });
    }

    // Fetch all forms for the clinic
    const forms = await TenantProductForm.findAll({
      where: {
        clinicId: user.clinicId,
      },
      include: [
        {
          model: Product,
          as: "product",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const formList = forms.map((form: any) => ({
      id: form.id,
      name: form.product?.name || `Form ${form.id.substring(0, 8)}`,
      productName: form.product?.name,
      publishedUrl: form.publishedUrl,
      createdAt: form.createdAt,
    }));

    return res.json({
      success: true,
      data: formList,
    });
  } catch (error) {
    console.error("Error fetching forms list:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch forms",
    });
  }
});

// Get detailed session analytics for a specific form with dynamic stage tracking
router.get("/analytics/forms/:formId/sessions", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { formId } = req.params;

    // Get user's clinic
    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res.status(400).json({
        success: false,
        message: "No clinic associated with user",
      });
    }

    // Verify form belongs to this clinic and get form structure
    const form = await TenantProductForm.findOne({
      where: {
        id: formId,
        clinicId: user.clinicId,
      },
      include: [
        {
          model: Product,
          as: "product",
        },
        {
          model: GlobalFormStructure,
          as: "globalFormStructure",
        },
      ],
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Get form steps from GlobalFormStructure
    const formStructure = (form as any).globalFormStructure;
    const formSteps = Array.isArray(formStructure?.steps)
      ? formStructure.steps
          .filter((step: any) => step?.enabled !== false)
          .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
      : [];
    
    // If no structure, use default stages
    const defaultStages = [
      { stepNumber: 1, questionText: "Medical Questions", questionId: "product", questionType: "product_questions" },
      { stepNumber: 2, questionText: "Create Account", questionId: "account", questionType: "account_creation" },
      { stepNumber: 3, questionText: "Product Selection", questionId: "productSelection", questionType: "product_selection" },
      { stepNumber: 4, questionText: "Payment & Checkout", questionId: "checkout", questionType: "checkout" },
    ];

    const stages = formSteps.length > 0
      ? formSteps.map((step: any, index: number) => ({
          stepNumber: index + 1,
          questionText: step.question || step.label || `Step ${index + 1}`,
          questionId: step.id || `step-${index + 1}`,
          questionType: step.type || 'question'
        }))
      : defaultStages;

    // Get all analytics events for this form
    const events = await TenantAnalyticsEvents.findAll({
      where: {
        formId: formId,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "phoneNumber"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Group events by sessionId
    const sessionMap = new Map<string, any>();
    
    events.forEach((event: any) => {
      const sessionId = event.sessionId || event.userId;
      
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          sessionId,
          userId: event.userId,
          firstName: event.user?.firstName || "Unknown",
          lastName: event.user?.lastName || "User",
          email: event.user?.email || "",
          phoneNumber: event.user?.phoneNumber || null,
          converted: false,
          firstView: event.createdAt,
          lastView: event.createdAt,
          lastStepReached: 0,
          stagesCompleted: [],
          metadata: event.metadata || {},
        });
      }

      const session = sessionMap.get(sessionId);

      if (event.eventType === "view") {
        if (new Date(event.createdAt) < new Date(session.firstView)) {
          session.firstView = event.createdAt;
        }
        if (new Date(event.createdAt) > new Date(session.lastView)) {
          session.lastView = event.createdAt;
        }
        
        // Track step progress from metadata
        if (event.metadata?.stepNumber) {
          session.lastStepReached = Math.max(session.lastStepReached, event.metadata.stepNumber);
        }
      }

      if (event.eventType === "conversion") {
        session.converted = true;
        session.lastStepReached = stages.length;
      }

      if (event.eventType === "dropoff") {
        if (event.metadata?.stepNumber) {
          session.lastStepReached = event.metadata.stepNumber;
        }
      }
    });

    // Calculate stage metrics
    const stageMetrics = stages.map((stage: any) => {
      const reached = Array.from(sessionMap.values()).filter(
        (s) => s.lastStepReached >= stage.stepNumber
      ).length;
      
      const completed = Array.from(sessionMap.values()).filter(
        (s) => s.lastStepReached > stage.stepNumber || (s.lastStepReached === stage.stepNumber && s.converted && stage.stepNumber === stages.length)
      ).length;
      
      const dropoffs = reached - completed;
      const dropoffRate = reached > 0 ? Math.round((dropoffs / reached) * 100) : 0;

      return {
        stepNumber: stage.stepNumber,
        questionText: stage.questionText,
        reached,
        completed,
        dropoffs,
        dropoffRate,
      };
    });

    // Calculate session details (limit to last 10 sessions for table display)
    const allSessions = Array.from(sessionMap.values()).map((session) => {
      const duration = Math.max(
        0,
        Math.floor(
          (new Date(session.lastView).getTime() - new Date(session.firstView).getTime()) / 1000
        )
      );

      const completionRate = session.lastStepReached > 0
        ? Math.round((session.lastStepReached / stages.length) * 100)
        : 0;

      const currentStageIndex = Math.min(session.lastStepReached, stages.length - 1);
      const currentStage = session.converted 
        ? 'Completed' 
        : (stages[currentStageIndex]?.questionText || 'Not Started');

      // Handle anonymous users (no firstName/lastName yet)
      const isAnonymous = !session.firstName || session.firstName === 'Unknown';
      const ipAddress = session.metadata?.ipAddress || 'Unknown IP';
      const location = session.metadata?.location || 'Unknown Location';

      return {
        sessionId: session.sessionId,
        userId: session.userId,
        firstName: isAnonymous ? 'Anonymous' : session.firstName,
        lastName: isAnonymous ? 'User' : session.lastName,
        email: isAnonymous ? `${ipAddress} • ${location}` : session.email,
        phoneNumber: session.phoneNumber,
        viewDuration: duration,
        currentStage,
        lastStepReached: session.lastStepReached,
        totalSteps: stages.length,
        completionRate,
        lastViewed: session.lastView,
        converted: session.converted,
      };
    });

    // Sort by lastViewed (most recent first) and take top 10 for sessions array
    const sessions = allSessions
      .sort((a, b) => new Date(b.lastViewed).getTime() - new Date(a.lastViewed).getTime())
      .slice(0, 10);

    // Calculate summary metrics
    const totalSessions = sessions.length;
    const conversions = sessions.filter((s) => s.converted).length;
    const completionRate = totalSessions > 0 ? Math.round((conversions / totalSessions) * 100) : 0;
    const averageDuration = totalSessions > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.viewDuration, 0) / totalSessions)
      : 0;

    // Calculate daily stats for chart (last 14 days)
    const dailyStats: Array<{ date: string; started: number; completed: number }> = [];

    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const dayStarted = events.filter((event: any) => {
        const eventDate = new Date(event.createdAt).toISOString().split("T")[0];
        return eventDate === dateStr && event.eventType === "view";
      }).length;

      const dayCompleted = events.filter((event: any) => {
        const eventDate = new Date(event.createdAt).toISOString().split("T")[0];
        return eventDate === dateStr && event.eventType === "conversion";
      }).length;

      dailyStats.push({
        date: `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`,
        started: dayStarted,
        completed: dayCompleted,
      });
    }

    const formName = (form as any).product?.name || "Intake Form";

    return res.json({
      success: true,
      data: {
        formId,
        formName,
        totalSessions,
        completionRate,
        averageDuration,
        formSteps: stages,
        stageMetrics,
        sessions,
        dailyStats,
      },
    });
  } catch (error) {
    console.error("Error fetching form sessions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch form session analytics",
    });
  }
});

// Track patient contact information for abandoned cart detection
router.post("/analytics/track-contact", async (req: Request, res: Response) => {
  try {
    const { sessionId, contactInfo, productId, formId, timestamp } = req.body;

    if (!sessionId || !contactInfo || !productId || !formId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, contactInfo, productId, formId',
      });
    }

    const viewEvent = await TenantAnalyticsEvents.findOne({
      where: {
        sessionId,
        eventType: 'view',
      },
      order: [['createdAt', 'DESC']],
    });

    if (viewEvent) {
      const updatedMetadata = {
        ...viewEvent.metadata,
        contactInfo: {
          firstName: contactInfo.firstName || viewEvent.metadata?.contactInfo?.firstName,
          lastName: contactInfo.lastName || viewEvent.metadata?.contactInfo?.lastName,
          email: contactInfo.email || viewEvent.metadata?.contactInfo?.email,
          phoneNumber: contactInfo.phoneNumber || viewEvent.metadata?.contactInfo?.phoneNumber,
          lastUpdated: timestamp || new Date().toISOString(),
        },
      };

      await viewEvent.update({ metadata: updatedMetadata });

      console.log('[Contact Tracking] Updated contact info for session:', sessionId);
    } else {
      console.warn('[Contact Tracking] No view event found for session:', sessionId);
    }

    return res.json({
      success: true,
      message: 'Contact information tracked successfully',
    });
  } catch (error: any) {
    console.error('[Contact Tracking] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
