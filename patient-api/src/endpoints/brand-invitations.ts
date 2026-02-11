import { Express } from "express";
import User from "../models/User";
import Clinic from "../models/Clinic";
import { MedicalCompanySlug } from "@fuse/enums";
import BrandInvitation, { InvitationType } from "../models/BrandInvitation";
import UserRoles from "../models/UserRoles";

export function registerBrandInvitationEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  // Generate invitation link for doctor or MDI
  app.post("/brand-invitations/create", authenticateJWT, async (req, res) => {
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

      const { invitationType, invitationSlug, expiresAt } = req.body;

      // Validate invitation type
      if (!invitationType || !Object.values(InvitationType).includes(invitationType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid invitation type. Must be 'doctor' or 'mdi'",
        });
      }

      // For doctor invitations, verify user is a doctor
      if (invitationType === InvitationType.DOCTOR) {
        if (!user.userRoles?.hasRole("doctor")) {
          return res.status(403).json({
            success: false,
            message: "Only doctors can create doctor invitations",
          });
        }

        // Verify doctor has a clinic
        if (!user.clinicId) {
          return res.status(400).json({
            success: false,
            message: "Doctor must have a clinic to create invitations",
          });
        }
      }

      // For MDI invitations, verify user is admin or superAdmin
      if (invitationType === InvitationType.MDI) {
        if (!user.userRoles?.hasAnyRole(["admin", "superAdmin"])) {
          return res.status(403).json({
            success: false,
            message: "Only admins can create MDI invitations",
          });
        }

        // For MDI invitations, verify user has a clinic (brand) to track who referred
        if (!user.clinicId) {
          return res.status(400).json({
            success: false,
            message: "Admin must have a brand (clinic) associated to create MDI invitations",
          });
        }
      }

      // Generate slug if not provided
      let finalSlug = invitationSlug;
      if (!finalSlug) {
        if (invitationType === InvitationType.DOCTOR) {
          // Use "fuse" as the default slug for doctor invitations
          finalSlug = "fuse";
        } else {
          finalSlug = "mdi";
        }
      }

      // Check if slug already exists
      const existingInvitation = await BrandInvitation.findOne({
        where: { invitationSlug: finalSlug },
      });

      if (existingInvitation) {
        return res.status(409).json({
          success: false,
          message: "Invitation slug already exists. Please use a different slug.",
        });
      }

      // Determine patient portal dashboard format
      let dashboardFormat: string = MedicalCompanySlug.FUSE;
      if (invitationType === InvitationType.MDI) {
        dashboardFormat = MedicalCompanySlug.MD_INTEGRATIONS;
      } else if (invitationType === InvitationType.DOCTOR) {
        const clinic = await Clinic.findByPk(user.clinicId!);
        if (clinic) {
          dashboardFormat = clinic.patientPortalDashboardFormat;
        }
      }

      // Create invitation
      const invitation = await BrandInvitation.create({
        invitationSlug: finalSlug,
        invitationType,
        doctorId: invitationType === InvitationType.DOCTOR ? user.id : undefined,
        doctorClinicId: invitationType === InvitationType.DOCTOR ? user.clinicId : undefined,
        referrerBrandId: invitationType === InvitationType.MDI ? user.clinicId : undefined,
        patientPortalDashboardFormat: dashboardFormat,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      // Get admin frontend URL from environment or use default (admin portal is where brands sign up)
      const adminFrontendUrl = process.env.ADMIN_FRONTEND_URL || "http://localhost:3002";
      const invitationUrl = `${adminFrontendUrl}/signup?invitation=${finalSlug}`;

      res.status(201).json({
        success: true,
        data: {
          invitation: {
            id: invitation.id,
            invitationSlug: invitation.invitationSlug,
            invitationType: invitation.invitationType,
            invitationUrl,
            patientPortalDashboardFormat: invitation.patientPortalDashboardFormat,
            isActive: invitation.isActive,
            usageCount: invitation.usageCount,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
          },
        },
      });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error creating brand invitation:", error);
      } else {
        console.error("❌ Error creating brand invitation");
      }
      res.status(500).json({
        success: false,
        message: "Failed to create invitation",
      });
    }
  });

  // Get invitation information (public endpoint, no auth required)
  app.get("/brand-invitations/:slug", async (req, res) => {
    try {
      const { slug } = req.params;

      const invitation = await BrandInvitation.findOne({
        where: { invitationSlug: slug },
        include: [
          {
            model: User,
            as: "doctor",
            attributes: ["id", "firstName", "lastName", "email"],
            required: false,
          },
          {
            model: Clinic,
            as: "doctorClinic",
            attributes: ["id", "name", "slug", "logo"],
            required: false,
          },
          {
            model: Clinic,
            as: "referrerBrand",
            attributes: ["id", "name", "slug", "logo"],
            required: false,
          },
        ],
      });

      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: "Invitation not found",
        });
      }

      // Check if invitation is active
      if (!invitation.isActive) {
        return res.status(410).json({
          success: false,
          message: "Invitation is no longer active",
        });
      }

      // Check if invitation has expired
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return res.status(410).json({
          success: false,
          message: "Invitation has expired",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          invitation: {
            id: invitation.id,
            invitationSlug: invitation.invitationSlug,
            invitationType: invitation.invitationType,
            patientPortalDashboardFormat: invitation.patientPortalDashboardFormat,
            doctor: invitation.doctor
              ? {
                  id: invitation.doctor.id,
                  firstName: invitation.doctor.firstName,
                  lastName: invitation.doctor.lastName,
                }
              : null,
            clinic: invitation.doctorClinic
              ? {
                  id: invitation.doctorClinic.id,
                  name: invitation.doctorClinic.name,
                  slug: invitation.doctorClinic.slug,
                  logo: invitation.doctorClinic.logo,
                }
              : null,
            referrerBrand: invitation.referrerBrand
              ? {
                  id: invitation.referrerBrand.id,
                  name: invitation.referrerBrand.name,
                  slug: invitation.referrerBrand.slug,
                  logo: invitation.referrerBrand.logo,
                }
              : null,
          },
        },
      });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching brand invitation:", error);
      } else {
        console.error("❌ Error fetching brand invitation");
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch invitation",
      });
    }
  });

  // List invitations for current user (doctor or admin)
  app.get("/brand-invitations", authenticateJWT, async (req, res) => {
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

      // Build where clause based on user role
      const whereClause: any = {};

      if (user.userRoles?.hasRole("doctor")) {
        whereClause.doctorId = user.id;
      } else if (!user.userRoles?.hasAnyRole(["admin", "superAdmin"])) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const invitations = await BrandInvitation.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "doctor",
            attributes: ["id", "firstName", "lastName", "email"],
            required: false,
          },
          {
            model: Clinic,
            as: "doctorClinic",
            attributes: ["id", "name", "slug", "logo"],
            required: false,
          },
          {
            model: Clinic,
            as: "referrerBrand",
            attributes: ["id", "name", "slug", "logo"],
            required: false,
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      const adminFrontendUrl = process.env.ADMIN_FRONTEND_URL || "http://localhost:3002";

      res.status(200).json({
        success: true,
        data: {
          invitations: invitations.map((invitation) => ({
            id: invitation.id,
            invitationSlug: invitation.invitationSlug,
            invitationType: invitation.invitationType,
            invitationUrl: `${adminFrontendUrl}/signup?invitation=${invitation.invitationSlug}`,
            patientPortalDashboardFormat: invitation.patientPortalDashboardFormat,
            isActive: invitation.isActive,
            usageCount: invitation.usageCount,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
            doctor: invitation.doctor
              ? {
                  id: invitation.doctor.id,
                  firstName: invitation.doctor.firstName,
                  lastName: invitation.doctor.lastName,
                }
              : null,
            clinic: invitation.doctorClinic
              ? {
                  id: invitation.doctorClinic.id,
                  name: invitation.doctorClinic.name,
                  slug: invitation.doctorClinic.slug,
                  logo: invitation.doctorClinic.logo,
                }
              : null,
            referrerBrand: invitation.referrerBrand
              ? {
                  id: invitation.referrerBrand.id,
                  name: invitation.referrerBrand.name,
                  slug: invitation.referrerBrand.slug,
                  logo: invitation.referrerBrand.logo,
                }
              : null,
          })),
        },
      });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching brand invitations:", error);
      } else {
        console.error("❌ Error fetching brand invitations");
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch invitations",
      });
    }
  });

  // Update invitation (activate/deactivate)
  app.patch("/brand-invitations/:id", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const { id } = req.params;
      const { isActive, expiresAt } = req.body;

      const invitation = await BrandInvitation.findByPk(id, {
        include: [
          {
            model: User,
            as: "doctor",
            required: false,
          },
        ],
      });

      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: "Invitation not found",
        });
      }

      // Check permissions
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

      // Only allow doctor to update their own invitations, or admin to update any
      if (invitation.doctorId && invitation.doctorId !== user.id) {
        if (!user.userRoles?.hasAnyRole(["admin", "superAdmin"])) {
          return res.status(403).json({
            success: false,
            message: "Access denied",
          });
        }
      }

      // Update invitation
      if (typeof isActive === "boolean") {
        invitation.isActive = isActive;
      }
      if (expiresAt !== undefined) {
        invitation.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
      }

      await invitation.save();

      res.status(200).json({
        success: true,
        data: {
          invitation: {
            id: invitation.id,
            invitationSlug: invitation.invitationSlug,
            isActive: invitation.isActive,
            expiresAt: invitation.expiresAt,
          },
        },
      });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating brand invitation:", error);
      } else {
        console.error("❌ Error updating brand invitation");
      }
      res.status(500).json({
        success: false,
        message: "Failed to update invitation",
      });
    }
  });
}
