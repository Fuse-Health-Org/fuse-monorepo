import { Request, Response } from 'express';
import CustomWebsite from '../../../models/CustomWebsite';
import Clinic from '../../../models/Clinic';
import User from '../../../models/User';
import { getCurrentUser } from '../../../config/jwt';
import { uploadToS3, deleteFromS3, isValidFileSize } from '../../../config/s3';

/**
 * GET /custom-website
 * Get custom website settings for the authenticated user's clinic
 */
export const get = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    let customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (!customWebsite) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: customWebsite
    });
  } catch (error) {
    console.error('Error fetching custom website:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch custom website settings"
    });
  }
};

/**
 * POST /custom-website
 * Create or update custom website settings
 */
export const createOrUpdate = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    if (!user.hasAnyRoleSync(['brand', 'doctor'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const {
      portalTitle,
      portalDescription,
      primaryColor,
      fontFamily,
      logo,
      heroImageUrl,
      heroTitle,
      heroSubtitle
    } = req.body;

    let customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (customWebsite) {
      await customWebsite.update({
        portalTitle,
        portalDescription,
        primaryColor,
        fontFamily,
        logo,
        heroImageUrl,
        heroTitle,
        heroSubtitle
      });
    } else {
      customWebsite = await CustomWebsite.create({
        clinicId: user.clinicId,
        portalTitle,
        portalDescription,
        primaryColor,
        fontFamily,
        logo,
        heroImageUrl,
        heroTitle,
        heroSubtitle,
        isActive: true
      });
    }

    console.log('🌐 Custom website settings saved for clinic:', user.clinicId);

    res.status(200).json({
      success: true,
      message: "Portal settings saved successfully",
      data: customWebsite
    });
  } catch (error) {
    console.error('Error saving custom website:', error);
    res.status(500).json({
      success: false,
      message: "Failed to save portal settings"
    });
  }
};

/**
 * POST /custom-website/toggle-active
 * Toggle custom website active status
 */
export const toggleActive = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    if (!user.hasAnyRoleSync(['brand', 'doctor'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean"
      });
    }

    let customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (customWebsite) {
      await customWebsite.update({ isActive });
    } else {
      customWebsite = await CustomWebsite.create({
        clinicId: user.clinicId,
        isActive
      });
    }

    console.log(`🌐 Custom website ${isActive ? 'activated' : 'deactivated'} for clinic:`, user.clinicId);

    res.status(200).json({
      success: true,
      message: `Portal ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: customWebsite
    });
  } catch (error) {
    console.error('Error toggling custom website status:', error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle portal status"
    });
  }
};

/**
 * POST /custom-website/upload-logo
 * Upload portal logo to S3
 */
export const uploadLogo = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    if (!user.hasAnyRoleSync(['brand', 'doctor'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    if (!isValidFileSize(req.file.size)) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB."
      });
    }

    const customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (customWebsite?.logo) {
      try {
        await deleteFromS3(customWebsite.logo);
        console.log('🗑️ Old portal logo deleted from S3');
      } catch (error) {
        console.error('Warning: Failed to delete old portal logo from S3:', error);
      }
    }

    const logoUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'portal-logos'
    );

    console.log('🌐 Portal logo uploaded for clinic:', { clinicId: user.clinicId, logoUrl });

    res.status(200).json({
      success: true,
      message: "Portal logo uploaded successfully",
      data: { logoUrl }
    });
  } catch (error) {
    console.error('Error uploading portal logo:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload portal logo"
    });
  }
};

/**
 * POST /custom-website/upload-hero
 * Upload portal hero image to S3
 */
export const uploadHero = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    if (!user.hasAnyRoleSync(['brand', 'doctor'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    if (!isValidFileSize(req.file.size)) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB."
      });
    }

    const customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (customWebsite?.heroImageUrl) {
      try {
        await deleteFromS3(customWebsite.heroImageUrl);
        console.log('🗑️ Old portal hero image deleted from S3');
      } catch (error) {
        console.error('Warning: Failed to delete old portal hero image from S3:', error);
      }
    }

    const heroImageUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'portal-hero-images'
    );

    console.log('🌐 Portal hero image uploaded for clinic:', { clinicId: user.clinicId, heroImageUrl });

    res.status(200).json({
      success: true,
      message: "Portal hero image uploaded successfully",
      data: { heroImageUrl }
    });
  } catch (error) {
    console.error('Error uploading portal hero image:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload portal hero image"
    });
  }
};

/**
 * GET /custom-website/default
 * Public endpoint to get first custom website (for localhost testing)
 */
export const getDefault = async (req: Request, res: Response) => {
  try {
    const customWebsite = await CustomWebsite.findOne({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    if (!customWebsite) {
      return res.status(404).json({
        success: false,
        message: "No custom website found"
      });
    }

    res.status(200).json({
      success: true,
      data: customWebsite
    });
  } catch (error) {
    console.error('Error fetching default custom website:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch custom website"
    });
  }
};

/**
 * GET /custom-website/by-slug/:slug
 * Public endpoint to get custom website by clinic slug
 */
export const getBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const clinic = await Clinic.findOne({
      where: { slug }
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found"
      });
    }

    const customWebsite = await CustomWebsite.findOne({
      where: { clinicId: clinic.id }
    });

    res.status(200).json({
      success: true,
      data: customWebsite || null,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo
      }
    });
  } catch (error) {
    console.error('Error fetching custom website by slug:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch portal settings"
    });
  }
};

