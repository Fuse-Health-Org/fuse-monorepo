import { Request, Response } from 'express';
import { clinicUpdateSchema } from '@fuse/validators';
import Clinic from '../../../models/Clinic';
import User from '../../../models/User';
import { getCurrentUser } from '../../../config/jwt';
import { uploadToS3, deleteFromS3, isValidFileSize } from '../../../config/s3';
import { generateUniqueSlug } from '../utils/slug.utils';

/**
 * GET /clinic/by-slug/:slug
 * Public endpoint to get clinic by slug (for subdomain routing)
 */
export const getClinicBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const clinic = await Clinic.findOne({
      where: { slug },
      attributes: ["id", "name", "slug", "logo", "defaultFormColor"],
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Find the brand owner of this clinic for analytics tracking
    const brandOwner = await User.findOne({
      where: {
        clinicId: clinic.id,
        role: "brand",
      },
      attributes: ["id"],
    });

    const clinicData = clinic.toJSON();

    res.json({
      success: true,
      data: {
        ...clinicData,
        userId: brandOwner?.id || null,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching clinic by slug:", error);
    } else {
      console.error("❌ Error fetching clinic by slug");
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /clinic/allow-custom-domain
 * Public endpoint for TLS certificate validation
 * Note: There are two versions of this endpoint - one simple, one with domain validation
 */
export const allowCustomDomain = async (req: Request, res: Response) => {
  try {
    const domainParam = (req.query as any).domain as string | undefined;
    
    // If no domain parameter, allow unconditionally (for testing/tools)
    if (!domainParam) {
      return res.status(200).send("ok");
    }

    // Normalize to hostname
    let baseDomain = domainParam;
    try {
      const url = new URL(
        domainParam.startsWith("http") ? domainParam : `https://${domainParam}`
      );
      baseDomain = url.hostname;
    } catch {
      baseDomain = domainParam.split("/")[0].split("?")[0];
    }

    const clinic = await Clinic.findOne({
      where: { customDomain: baseDomain, isCustomDomain: true },
      attributes: ["id"],
    });

    if (!clinic) {
      return res.status(404).send("not allowed");
    }

    return res.status(200).send("ok");
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error in /clinic/allow-custom-domain:", error);
    } else {
      console.error("❌ Error in /clinic/allow-custom-domain");
    }
    return res.status(500).send("error");
  }
};

/**
 * POST /clinic/by-custom-domain
 * Get clinic slug by custom domain
 */
export const getClinicByCustomDomain = async (req: Request, res: Response) => {
  try {
    const { domain } = req.body;
    console.log("clinic/by-custom-domain Edu", domain);
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: "Domain is required",
      });
    }

    // Extract base URL (remove path, query params, etc)
    let baseDomain = domain;
    try {
      const url = new URL(
        domain.startsWith("http") ? domain : `https://${domain}`
      );
      baseDomain = url.hostname;
    } catch (e) {
      baseDomain = domain.split("/")[0].split("?")[0];
    }

    console.log(`🔍 Looking for clinic with custom domain: ${baseDomain}`);

    // Search for clinic with matching customDomain
    const clinic = await Clinic.findOne({
      where: {
        customDomain: baseDomain,
        isCustomDomain: true,
      },
      attributes: ["id", "slug", "name", "logo", "customDomain"],
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "No clinic found with this custom domain",
        domain: baseDomain,
      });
    }

    console.log(`✅ Found clinic: ${clinic.name} with slug: ${clinic.slug}`);

    res.json({
      success: true,
      slug: clinic.slug,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
        customDomain: clinic.customDomain,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error finding clinic by custom domain:", error);
    } else {
      console.error("❌ Error finding clinic by custom domain");
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /clinic/:id
 * Get clinic by ID (protected, user must belong to the clinic)
 */
export const getClinic = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow users to access their own clinic data
    if (user.clinicId !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const clinic = await Clinic.findByPk(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
        customDomain: (clinic as any).customDomain,
        isCustomDomain: (clinic as any).isCustomDomain,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching clinic data:", error);
    } else {
      console.error("❌ Error fetching clinic data");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic data",
    });
  }
};

/**
 * PUT /clinic/:id
 * Update clinic information
 */
export const updateClinic = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body
    const validation = clinicUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { name, logo } = validation.data;

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow doctors and brand users to update clinic data
    if (!user.hasAnyRoleSync(["doctor", "brand"]) || user.clinicId !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Clinic name is required",
      });
    }

    const clinic = await Clinic.findByPk(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Generate new slug if name changed
    let newSlug = clinic.slug;
    if (name.trim() !== clinic.name) {
      newSlug = await generateUniqueSlug(name.trim(), clinic.id);
      if (process.env.NODE_ENV === "development") {
        console.log("🏷️ Generated new slug:", newSlug);
      }
    }

    // Update clinic data
    await clinic.update({
      name: name.trim(),
      slug: newSlug,
      logo: logo?.trim() || "",
    });

    if (process.env.NODE_ENV === "development") {
      console.log("🏥 Clinic updated:", {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
      });
    }

    res.status(200).json({
      success: true,
      message: "Clinic updated successfully",
      data: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating clinic data:", error);
    } else {
      console.error("❌ Error updating clinic data");
    }
    res.status(500).json({
      success: false,
      message: "Failed to update clinic data",
    });
  }
};

/**
 * POST /clinic/:id/upload-logo
 * Upload clinic logo to S3
 */
export const uploadLogo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow doctors and brand users to upload logos for their own clinic
    if (!user.hasAnyRoleSync(["doctor", "brand"]) || user.clinicId !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check if file was uploaded
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

    const clinic = await Clinic.findByPk(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Delete old logo from S3 if it exists
    if (clinic.logo && clinic.logo.trim() !== "") {
      try {
        await deleteFromS3(clinic.logo);
        console.log("🗑️ Old logo deleted from S3");
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Warning: Failed to delete old logo from S3:", error);
        } else {
          console.error("❌ Warning: Failed to delete old logo from S3");
        }
        // Don't fail the entire request if deletion fails
      }
    }

    // Upload new logo to S3
    const logoUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Update clinic with new logo URL
    await clinic.update({ logo: logoUrl });

    console.log("🏥 Logo uploaded for clinic:", { id: clinic.id, logoUrl });

    res.status(200).json({
      success: true,
      message: "Logo uploaded successfully",
      data: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error uploading logo:", error);
    } else {
      console.error("❌ Error uploading logo");
    }
    res.status(500).json({
      success: false,
      message: "Failed to upload logo",
    });
  }
};

