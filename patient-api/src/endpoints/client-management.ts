import { Express } from "express";
import { Op } from "sequelize";
import User from "../models/User";
import BrandSubscription from "../models/BrandSubscription";
import BrandSubscriptionPlans from "../models/BrandSubscriptionPlans";
import TenantCustomFeatures from "../models/TenantCustomFeatures";
import UserRoles from "../models/UserRoles";
import Clinic, { PatientPortalDashboardFormat } from "../models/Clinic";
import Order from "../models/Order";
import Payment from "../models/Payment";
import Prescription from "../models/Prescription";
import { createJWTToken } from "../config/jwt";

export function registerClientManagementEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  // Get all available subscription plans
  app.get("/admin/subscription-plans", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const plans = await BrandSubscriptionPlans.findAll({
        attributes: [
          "id",
          "planType",
          "name",
          "description",
          "maxProducts",
          "monthlyPrice",
          "isActive",
        ],
        order: [
          ["sortOrder", "ASC"],
          ["name", "ASC"],
        ],
      });

      res.status(200).json({ success: true, data: plans });
    } catch (error) {
      console.error("❌ Error fetching subscription plans:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscription plans",
      });
    }
  });

  // Get all users with their BrandSubscriptions
  app.get("/admin/users", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      // Check user permissions
      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      await user.getUserRoles();
      const roleParam = req.query.role as string;

      // Allow admins/superAdmins full access
      // Allow brand users to access affiliates only
      if (!user.userRoles?.hasAnyRole(["admin", "superAdmin"])) {
        if (roleParam !== "affiliate" || !user.userRoles?.hasRole("brand")) {
          return res.status(403).json({
            success: false,
            message: "Forbidden. Only admins can access all users, or brand users can access affiliates only."
          });
        }
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || "";
      const role = roleParam;

      const offset = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {};

      if (search) {
        whereClause[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ];
      }

      // Build include clause for UserRoles with role filter
      const userRolesInclude: any = {
        model: UserRoles,
        as: "userRoles",
        required: false,
      };

      // If filtering by role, add where clause to UserRoles include
      if (role) {
        // Map role names to UserRoles boolean fields
        const roleFieldMap: Record<string, string> = {
          affiliate: "affiliate",
          patient: "patient",
          doctor: "doctor",
          admin: "admin",
          brand: "brand",
          superAdmin: "superAdmin",
        };

        const roleField = roleFieldMap[role];
        if (roleField) {
          // Filter by UserRoles field instead of deprecated role field
          userRolesInclude.where = { [roleField]: true };
          userRolesInclude.required = true; // Use INNER JOIN to filter
        } else {
          // Fallback to deprecated role field for backwards compatibility
          whereClause.role = role;
        }
      }

      const { rows: users, count } = await User.findAndCountAll({
        where: whereClause,
        attributes: [
          "id",
          "firstName",
          "lastName",
          "email",
          "role",
          "activated",
          "businessType",
          "createdAt",
          "updatedAt",
          "clinicId",
        ],
        include: [
          {
            model: BrandSubscription,
            as: "brandSubscriptions",
            required: false,
          },
          {
            model: TenantCustomFeatures,
            as: "tenantCustomFeatures",
            required: false,
          },
          {
            model: Clinic,
            as: "clinic",
            required: false,
            attributes: ["id", "name", "slug", "affiliateOwnerClinicId"],
          },
          userRolesInclude,
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      // Manually attach plan data to each subscription
      const usersWithPlans = await Promise.all(
        users.map(async (user) => {
          const userJson = user.toJSON();
          if (userJson.brandSubscriptions) {
            userJson.brandSubscriptions = await Promise.all(
              userJson.brandSubscriptions.map(async (subscription: any) => {
                if (subscription.planType) {
                  console.log(
                    `🔍 [Client Mgmt] Looking for plan with type: "${subscription.planType}"`
                  );
                  const plan = await BrandSubscriptionPlans.getPlanByType(
                    subscription.planType
                  );
                  if (plan) {
                    console.log(`✅ [Client Mgmt] Found plan:`, {
                      id: plan.id,
                      name: plan.name,
                      maxProducts: plan.maxProducts,
                    });
                    subscription.plan = plan.toJSON();
                  } else {
                    console.log(
                      `❌ [Client Mgmt] Plan not found for type: "${subscription.planType}"`
                    );
                    subscription.plan = null;
                  }
                }
                return subscription;
              })
            );
          }
          return userJson;
        })
      );

      res.status(200).json({
        success: true,
        data: {
          users: usersWithPlans,
          pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      console.error("❌ Error fetching users:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch users" });
    }
  });

  // Get a specific user with their BrandSubscription
  app.get("/admin/users/:userId", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("admin")) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const { userId } = req.params;

      const targetUser = await User.findByPk(userId, {
        attributes: [
          "id",
          "firstName",
          "lastName",
          "email",
          "role",
          "activated",
          "businessType",
          "phoneNumber",
          "createdAt",
          "updatedAt",
          "clinicId",
        ],
        include: [
          {
            model: BrandSubscription,
            as: "brandSubscriptions",
            required: false,
          },
          {
            model: TenantCustomFeatures,
            as: "tenantCustomFeatures",
            required: false,
          },
          {
            model: UserRoles,
            as: "userRoles",
            required: false,
          },
        ],
      });

      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Manually attach plan data to subscriptions
      const userJson = targetUser.toJSON();
      if (userJson.brandSubscriptions) {
        userJson.brandSubscriptions = await Promise.all(
          userJson.brandSubscriptions.map(async (subscription: any) => {
            if (subscription.planType) {
              console.log(
                `🔍 [Client Mgmt] Looking for plan with type: "${subscription.planType}" for user ${userId}`
              );
              const plan = await BrandSubscriptionPlans.getPlanByType(
                subscription.planType
              );
              if (plan) {
                console.log(`✅ [Client Mgmt] Found plan:`, {
                  id: plan.id,
                  name: plan.name,
                  maxProducts: plan.maxProducts,
                });
                subscription.plan = plan.toJSON();
              } else {
                console.log(
                  `❌ [Client Mgmt] Plan not found for type: "${subscription.planType}"`
                );
                subscription.plan = null;
              }
            }
            return subscription;
          })
        );
      }

      res.status(200).json({ success: true, data: userJson });
    } catch (error) {
      console.error("❌ Error fetching user:", error);
      res.status(500).json({ success: false, message: "Failed to fetch user" });
    }
  });

  // Update BrandSubscription settings
  app.patch(
    "/admin/users/:userId/brand-subscription",
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
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("admin")) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { userId } = req.params;
        const {
          productsChangedAmountOnCurrentCycle,
          retriedProductSelectionForCurrentCycle,
          tutorialFinished,
          customMaxProducts,
          planType,
        } = req.body;

        // Find the user's BrandSubscription
        const brandSubscription = await BrandSubscription.findOne({
          where: { userId },
        });

        if (!brandSubscription) {
          return res.status(404).json({
            success: false,
            message: "BrandSubscription not found for this user",
          });
        }

        // Update only the fields that are provided
        const updates: any = {};

        if (typeof productsChangedAmountOnCurrentCycle === "number") {
          updates.productsChangedAmountOnCurrentCycle =
            productsChangedAmountOnCurrentCycle;
        }

        if (typeof retriedProductSelectionForCurrentCycle === "boolean") {
          updates.retriedProductSelectionForCurrentCycle =
            retriedProductSelectionForCurrentCycle;
        }

        if (typeof tutorialFinished === "boolean") {
          updates.tutorialFinished = tutorialFinished;
        }

        // Allow setting customMaxProducts to null to use plan default
        if (customMaxProducts !== undefined) {
          updates.customMaxProducts =
            customMaxProducts === null || customMaxProducts === ""
              ? null
              : parseInt(customMaxProducts as string);
        }

        // Allow changing planType
        if (
          planType !== undefined &&
          typeof planType === "string" &&
          planType.trim() !== ""
        ) {
          // Verify the plan exists
          const planExists = await BrandSubscriptionPlans.findOne({
            where: { planType: planType },
          });

          if (planExists) {
            updates.planType = planType;
          } else {
            return res.status(400).json({
              success: false,
              message: `Plan type '${planType}' does not exist`,
            });
          }
        }

        console.log("💾 [Client Mgmt] Updating subscription with:", updates);
        await brandSubscription.update(updates);
        console.log("✅ [Client Mgmt] Updated subscription values:", {
          productsChangedAmountOnCurrentCycle:
            brandSubscription.productsChangedAmountOnCurrentCycle,
          retriedProductSelectionForCurrentCycle:
            brandSubscription.retriedProductSelectionForCurrentCycle,
          tutorialFinished: brandSubscription.tutorialFinished,
          customMaxProducts: brandSubscription.customMaxProducts,
          planType: brandSubscription.planType,
        });

        // Attach plan data for response
        const subscriptionJson = brandSubscription.toJSON();
        if (subscriptionJson.planType) {
          const plan = await BrandSubscriptionPlans.getPlanByType(
            subscriptionJson.planType
          );
          if (plan) {
            (subscriptionJson as any).plan = plan.toJSON();
          }
        }

        res.status(200).json({
          success: true,
          message: "BrandSubscription updated successfully",
          data: subscriptionJson,
        });
      } catch (error) {
        console.error("❌ Error updating BrandSubscription:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update BrandSubscription",
        });
      }
    }
  );

  // Update Custom Features
  app.patch(
    "/admin/users/:userId/custom-features",
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
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        // Allow both admin and brand roles to manage custom features
        if (!user || (!user.hasRoleSync("admin") && !user.hasRoleSync("brand"))) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { userId } = req.params;
        const { canAddCustomProducts, hasAccessToAnalytics, canUploadCustomProductImages, hasCustomPortal, hasPrograms, canCustomizeFormStructure } = req.body;

        // Find or create custom features for this user
        let customFeatures = await TenantCustomFeatures.findOne({
          where: { userId },
        });

        if (!customFeatures) {
          // Create new custom features record
          customFeatures = await TenantCustomFeatures.create({
            userId,
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
          });
          console.log(
            "✅ [Client Mgmt] Created custom features for user:",
            userId
          );
        } else {
          // Update existing record
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

          await customFeatures.update(updates);
          console.log(
            "✅ [Client Mgmt] Updated custom features for user:",
            userId,
            updates
          );
        }

        res.status(200).json({
          success: true,
          message: "Custom features updated successfully",
          data: customFeatures.toJSON(),
        });
      } catch (error) {
        console.error("❌ Error updating custom features:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update custom features",
        });
      }
    }
  );

  // Update user roles (multi-role support)
  app.patch("/admin/users/:userId/roles", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      // No role check - any authenticated user can update roles
      const { userId } = req.params;
      const { patient, doctor, admin, brand, superAdmin, affiliate } = req.body;

      // Validate at least one boolean was provided
      if (
        typeof patient !== "boolean" &&
        typeof doctor !== "boolean" &&
        typeof admin !== "boolean" &&
        typeof brand !== "boolean" &&
        typeof superAdmin !== "boolean" &&
        typeof affiliate !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "At least one role must be specified (patient, doctor, admin, brand, superAdmin, affiliate)",
        });
      }

      // Find the target user
      const targetUser = await User.findByPk(userId);
      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Get or create UserRoles
      let userRoles = await UserRoles.findOne({
        where: { userId }
      });

      if (!userRoles) {
        // Create new UserRoles record
        userRoles = await UserRoles.create({
          userId,
          patient: patient ?? false,
          doctor: doctor ?? false,
          admin: admin ?? false,
          brand: brand ?? false,
          superAdmin: superAdmin ?? false,
          affiliate: affiliate ?? false,
        });
        console.log(`✅ [Client Mgmt] Created UserRoles for user ${userId}`);
      } else {
        // Update existing roles
        const updates: any = {};
        if (typeof patient === "boolean") updates.patient = patient;
        if (typeof doctor === "boolean") updates.doctor = doctor;
        if (typeof admin === "boolean") updates.admin = admin;
        if (typeof brand === "boolean") updates.brand = brand;
        if (typeof superAdmin === "boolean") updates.superAdmin = superAdmin;
        if (typeof affiliate === "boolean") updates.affiliate = affiliate;

        await userRoles.update(updates);
        console.log(
          `✅ [Client Mgmt] Updated UserRoles for user ${userId}:`,
          updates
        );
      }

      // Also update the deprecated role field to the first active role for backwards compatibility
      const activeRoles = userRoles.getActiveRoles();
      if (activeRoles.length > 0) {
        await targetUser.update({ role: activeRoles[0] });
      }

      res.status(200).json({
        success: true,
        message: "User roles updated successfully",
        data: {
          id: targetUser.id,
          roles: userRoles.getActiveRoles(),
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          // Include individual role flags
          patient: userRoles.patient,
          doctor: userRoles.doctor,
          admin: userRoles.admin,
          brand: userRoles.brand,
          superAdmin: userRoles.superAdmin,
          affiliate: userRoles.affiliate,
        },
      });
    } catch (error) {
      console.error("❌ Error updating user roles:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update user roles" });
    }
  });

  // Legacy endpoint for backwards compatibility - updates single role via deprecated field
  // @deprecated Use PATCH /admin/users/:userId/roles instead
  app.patch("/admin/users/:userId/role", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      // No role check - any authenticated user can update roles
      const { userId } = req.params;
      const { role } = req.body;

      // Validate role
      const validRoles = ["patient", "doctor", "admin", "brand"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
        });
      }

      // Find the target user
      const targetUser = await User.findByPk(userId);
      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Update UserRoles table - set only the specified role to true, others to false
      let userRoles = await UserRoles.findOne({
        where: { userId }
      });

      if (!userRoles) {
        userRoles = await UserRoles.create({
          userId,
          patient: role === "patient",
          doctor: role === "doctor",
          admin: role === "admin",
          brand: role === "brand",
          affiliate: role === "affiliate",
        });
      } else {
        await userRoles.update({
          patient: role === "patient",
          doctor: role === "doctor",
          admin: role === "admin",
          brand: role === "brand",
          affiliate: role === "affiliate",
        });
      }

      // Update the deprecated role field for backwards compatibility
      await targetUser.update({ role });

      console.log(
        `✅ [Client Mgmt] Updated user ${userId} role to ${role} (legacy endpoint)`
      );

      res.status(200).json({
        success: true,
        message: "User role updated successfully",
        data: {
          id: targetUser.id,
          role: targetUser.role,
          roles: userRoles.getActiveRoles(),
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
        },
      });
    } catch (error) {
      console.error("❌ Error updating user role:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update user role" });
    }
  });

  // Impersonate user (generate token for preview)
  app.post(
    "/admin/users/:userId/impersonate",
    authenticateJWT,
    async (req, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const adminUser = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!adminUser || !adminUser.hasRoleSync("admin")) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { userId } = req.params;

        // Find the user to impersonate
        const targetUser = await User.findByPk(userId);
        if (!targetUser) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }

        // Generate a JWT token for the target user
        const impersonationToken = createJWTToken(targetUser);

        console.log(
          `👤 [Impersonation] Admin impersonating user ID: ${targetUser.id}`
        );

        res.status(200).json({
          success: true,
          message: "Impersonation token generated successfully",
          token: impersonationToken,
          user: targetUser.toSafeJSON(),
        });
      } catch (error) {
        console.error("❌ Error generating impersonation token:", error);
        res.status(500).json({
          success: false,
          message: "Failed to generate impersonation token",
        });
      }
    }
  );

  // Update affiliate parent clinic (assign affiliate to brand's clinic)
  app.patch(
    "/admin/users/:userId/affiliate-owner",
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
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        await user.getUserRoles();
        // Allow brand users and admins to assign affiliate parent clinics
        if (!user.userRoles?.hasAnyRole(["brand", "admin", "superAdmin"])) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Only brand users and admins can assign affiliate parent clinics.",
          });
        }

        const { userId } = req.params;
        const { parentClinicId } = req.body;

        // Find the target user (affiliate)
        const targetUser = await User.findByPk(userId, {
          include: [
            { model: UserRoles, as: "userRoles", required: false },
            { model: Clinic, as: "clinic", required: false },
          ],
        });

        if (!targetUser) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }

        await targetUser.getUserRoles();
        // Verify the target user is an affiliate
        if (!targetUser.userRoles?.hasRole("affiliate")) {
          return res.status(400).json({
            success: false,
            message: "User is not an affiliate",
          });
        }

        // Verify affiliate has a clinic
        if (!targetUser.clinicId || !targetUser.clinic) {
          return res.status(400).json({
            success: false,
            message: "Affiliate does not have a clinic configured",
          });
        }

        // If parentClinicId is provided, verify it's a valid clinic
        if (parentClinicId) {
          const parentClinic = await Clinic.findByPk(parentClinicId);
          if (!parentClinic) {
            return res.status(404).json({
              success: false,
              message: "Parent clinic not found",
            });
          }

          // If current user is a brand user, ensure they can only assign their own clinic
          if (user.userRoles?.hasRole("brand") && user.clinicId !== parentClinicId) {
            return res.status(403).json({
              success: false,
              message: "Brand users can only assign their own clinic as parent",
            });
          }
        }

        // Update the affiliate's clinic's affiliateOwnerClinicId
        await targetUser.clinic.update({
          affiliateOwnerClinicId: parentClinicId || null,
        });

        console.log(
          `✅ [Client Mgmt] Updated affiliate parent clinic for user ${userId} to ${parentClinicId || "null"}`
        );

        res.status(200).json({
          success: true,
          message: "Affiliate parent clinic updated successfully",
          data: {
            id: targetUser.id,
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            clinicId: targetUser.clinicId,
            affiliateOwnerClinicId: targetUser.clinic.affiliateOwnerClinicId,
          },
        });
      } catch (error) {
        console.error("❌ Error updating affiliate parent clinic:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update affiliate parent clinic",
        });
      }
    }
  );

  // Get clinic with patientPortalDashboardFormat for a user
  app.get(
    "/admin/users/:userId/clinic",
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
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("admin")) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { userId } = req.params;
        const targetUser = await User.findByPk(userId);

        if (!targetUser || !targetUser.clinicId) {
          return res.status(404).json({
            success: false,
            message: "User not found or does not have a clinic",
          });
        }

        const clinic = await Clinic.findByPk(targetUser.clinicId, {
          attributes: ["id", "name", "slug", "patientPortalDashboardFormat", "mainDoctorId"],
          include: [
            {
              model: User,
              as: "mainDoctor",
              required: false,
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
        });

        if (!clinic) {
          return res.status(404).json({
            success: false,
            message: "Clinic not found",
          });
        }

        res.status(200).json({
          success: true,
          data: clinic.toJSON(),
        });
      } catch (error) {
        console.error("❌ Error fetching clinic:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch clinic",
        });
      }
    }
  );

  // Check if clinic has existing Orders, Payments, or Prescriptions
  app.get(
    "/admin/users/:userId/clinic/data-check",
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
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("admin")) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { userId } = req.params;
        const targetUser = await User.findByPk(userId);

        if (!targetUser || !targetUser.clinicId) {
          return res.status(404).json({
            success: false,
            message: "User not found or does not have a clinic",
          });
        }

        const clinicId = targetUser.clinicId;

        // Count orders for this clinic (Order has clinicId directly)
        const ordersCount = await Order.count({
          where: { clinicId },
        });

        // Count payments - Payment has orderId, get orderIds from clinic and count payments
        const clinicOrders = await Order.findAll({
          where: { clinicId },
          attributes: ['id'],
        });
        const clinicOrderIds = clinicOrders.map(o => o.id);
        
        const paymentsCount = clinicOrderIds.length > 0
          ? await Payment.count({
              where: { orderId: { [Op.in]: clinicOrderIds } },
            })
          : 0;

        // Count prescriptions - Prescription has patientId, count through Users
        const clinicUsers = await User.findAll({
          where: { clinicId },
          attributes: ['id'],
        });
        const clinicUserIds = clinicUsers.map(u => u.id);
        
        const prescriptionsCount = clinicUserIds.length > 0
          ? await Prescription.count({
              where: { patientId: { [Op.in]: clinicUserIds } },
            })
          : 0;

        const hasData = ordersCount > 0 || paymentsCount > 0 || prescriptionsCount > 0;

        res.status(200).json({
          success: true,
          data: {
            hasData,
            ordersCount,
            paymentsCount,
            prescriptionsCount,
          },
        });
      } catch (error) {
        console.error("❌ Error checking clinic data:", error);
        res.status(500).json({
          success: false,
          message: "Failed to check clinic data",
        });
      }
    }
  );

  // Update patientPortalDashboardFormat for a clinic
  app.patch(
    "/admin/users/:userId/clinic/patient-portal-dashboard-format",
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
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("admin")) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { userId } = req.params;
        const { patientPortalDashboardFormat, forceUpdate } = req.body;

        // Validate patientPortalDashboardFormat
        if (!patientPortalDashboardFormat || !['fuse', 'md-integrations'].includes(patientPortalDashboardFormat)) {
          return res.status(400).json({
            success: false,
            message: "Invalid patientPortalDashboardFormat. Must be 'fuse' or 'md-integrations'",
          });
        }

        const targetUser = await User.findByPk(userId);

        if (!targetUser || !targetUser.clinicId) {
          return res.status(404).json({
            success: false,
            message: "User not found or does not have a clinic",
          });
        }

        const clinic = await Clinic.findByPk(targetUser.clinicId);

        if (!clinic) {
          return res.status(404).json({
            success: false,
            message: "Clinic not found",
          });
        }

        // Check if format is changing
        const currentFormat = clinic.patientPortalDashboardFormat;
        const newFormat = patientPortalDashboardFormat === 'md-integrations' 
          ? PatientPortalDashboardFormat.MD_INTEGRATIONS 
          : PatientPortalDashboardFormat.FUSE;

        if (currentFormat === newFormat) {
          return res.status(200).json({
            success: true,
            message: "Format is already set to the requested value",
            data: clinic.toJSON(),
          });
        }

        // If forceUpdate is not true, check for existing data
        if (!forceUpdate) {
          // Count orders for this clinic (Order has clinicId directly)
          const ordersCount = await Order.count({
            where: { clinicId: clinic.id },
          });

          // Count payments - Payment has orderId, get orderIds from clinic and count payments
          const clinicOrders = await Order.findAll({
            where: { clinicId: clinic.id },
            attributes: ['id'],
          });
          const clinicOrderIds = clinicOrders.map(o => o.id);
          
          const paymentsCount = clinicOrderIds.length > 0
            ? await Payment.count({
                where: { orderId: { [Op.in]: clinicOrderIds } },
              })
            : 0;

          // Count prescriptions - Prescription has patientId, count through Users
          const clinicUsers = await User.findAll({
            where: { clinicId: clinic.id },
            attributes: ['id'],
          });
          const clinicUserIds = clinicUsers.map(u => u.id);
          
          const prescriptionsCount = clinicUserIds.length > 0
            ? await Prescription.count({
                where: { patientId: { [Op.in]: clinicUserIds } },
              })
            : 0;

          if (ordersCount > 0 || paymentsCount > 0 || prescriptionsCount > 0) {
            return res.status(400).json({
              success: false,
              message: "Cannot change patientPortalDashboardFormat when there are existing Orders, Payments, or Prescriptions",
              data: {
                ordersCount,
                paymentsCount,
                prescriptionsCount,
              },
            });
          }
        }

        // Update the clinic
        await clinic.update({
          patientPortalDashboardFormat: newFormat,
        });

        console.log(
          `✅ [Client Mgmt] Updated patientPortalDashboardFormat for clinic ${clinic.id} from ${currentFormat} to ${newFormat}`
        );

        res.status(200).json({
          success: true,
          message: "patientPortalDashboardFormat updated successfully",
          data: clinic.toJSON(),
        });
      } catch (error) {
        console.error("❌ Error updating patientPortalDashboardFormat:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update patientPortalDashboardFormat",
        });
      }
    }
  );

  // Update mainDoctorId for a clinic (only if patientPortalDashboardFormat is FUSE)
  app.patch(
    "/admin/users/:userId/clinic/main-doctor",
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
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("admin")) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { userId } = req.params;
        const { mainDoctorId } = req.body;

        const targetUser = await User.findByPk(userId);

        if (!targetUser || !targetUser.clinicId) {
          return res.status(404).json({
            success: false,
            message: "User not found or does not have a clinic",
          });
        }

        const clinic = await Clinic.findByPk(targetUser.clinicId);

        if (!clinic) {
          return res.status(404).json({
            success: false,
            message: "Clinic not found",
          });
        }

        // Validate that patientPortalDashboardFormat is FUSE
        if (clinic.patientPortalDashboardFormat !== PatientPortalDashboardFormat.FUSE) {
          return res.status(400).json({
            success: false,
            message: "Cannot change main doctor. This feature is only available when patientPortalDashboardFormat is 'fuse'",
          });
        }

        // If mainDoctorId is provided, validate it exists and has doctor role
        if (mainDoctorId) {
          const doctor = await User.findByPk(mainDoctorId, {
            include: [{ model: UserRoles, as: "userRoles", required: false }],
          });

          if (!doctor) {
            return res.status(404).json({
              success: false,
              message: "Doctor not found",
            });
          }

          await doctor.getUserRoles();
          if (!doctor.userRoles?.hasRole("doctor")) {
            return res.status(400).json({
              success: false,
              message: "User is not a doctor",
            });
          }
        }

        // Update the clinic
        await clinic.update({
          mainDoctorId: mainDoctorId || null,
        });

        // Reload clinic with mainDoctor association
        await clinic.reload({
          include: [
            {
              model: User,
              as: "mainDoctor",
              required: false,
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
        });

        console.log(
          `✅ [Client Mgmt] Updated mainDoctorId for clinic ${clinic.id} to ${mainDoctorId || "null"}`
        );

        res.status(200).json({
          success: true,
          message: "Main doctor updated successfully",
          data: clinic.toJSON(),
        });
      } catch (error) {
        console.error("❌ Error updating mainDoctorId:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update main doctor",
        });
      }
    }
  );
}
