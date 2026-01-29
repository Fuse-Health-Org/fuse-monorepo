import { Request, Response } from 'express';
import MessageTemplate from '../../../models/MessageTemplate';
import { getCurrentUser } from '../../../config/jwt';
import { uploadToS3, isValidFileSize } from '../../../config/s3';
import { detectUnmaskedPHI } from '../../../utils/hipaa-masking';

/**
 * GET /message-templates
 * List all message templates for the current user's clinic
 */
export const listTemplates = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    if (!currentUser.clinicId) {
      return res.status(400).json({
        success: false,
        message: "User does not belong to a clinic"
      });
    }

    const { type } = req.query; // Optional filter by type: 'email' or 'sms'

    const whereClause: any = {
      clinicId: currentUser.clinicId
    };

    if (type && (type === 'email' || type === 'sms')) {
      whereClause.type = type;
    }

    const templates = await MessageTemplate.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('❌ Error fetching message templates:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch message templates"
    });
  }
};

/**
 * GET /message-templates/:id
 * Get a single message template by ID
 */
export const getTemplate = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;

    const template = await MessageTemplate.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Message template not found"
      });
    }

    res.status(200).json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('❌ Error fetching message template:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch message template"
    });
  }
};

/**
 * POST /message-templates
 * Create a new message template
 */
export const createTemplate = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    if (!currentUser.clinicId) {
      return res.status(400).json({
        success: false,
        message: "User does not belong to a clinic"
      });
    }

    const { name, description, type, subject, body, category, mergeFields } = req.body;

    // Basic validation
    if (!name || !type || !body) {
      return res.status(400).json({
        success: false,
        message: "Name, type, and body are required"
      });
    }

    if (type !== 'email' && type !== 'sms') {
      return res.status(400).json({
        success: false,
        message: "Type must be 'email' or 'sms'"
      });
    }

    // Auto-extract merge fields from body if not provided
    let extractedMergeFields = mergeFields || [];
    if (!mergeFields || mergeFields.length === 0) {
      const regex = /\{\{([^}]+)\}\}/g;
      const fields = new Set<string>();
      let match;
      while ((match = regex.exec(body)) !== null) {
        fields.add(match[1].trim());
      }
      if (subject) {
        while ((match = regex.exec(subject)) !== null) {
          fields.add(match[1].trim());
        }
      }
      extractedMergeFields = Array.from(fields);
    }

    // 🔒 HIPAA COMPLIANCE: Detect unmasked PHI in template
    const phiWarnings = detectUnmaskedPHI(body + (subject || ''));
    if (phiWarnings.length > 0) {
      console.warn('⚠️ Template contains unmasked PHI:', phiWarnings);
    }

    const template = await MessageTemplate.create({
      clinicId: currentUser.clinicId,
      name,
      description,
      type,
      subject,
      body,
      category,
      mergeFields: extractedMergeFields,
      createdBy: currentUser.id,
      isActive: true,
      version: 1
    });

    console.log('✅ Message template created:', {
      templateId: template.id,
      name: template.name,
      type: template.type,
      phiWarnings: phiWarnings.length > 0 ? phiWarnings : undefined
    });

    res.status(201).json({
      success: true,
      data: template,
      warnings: phiWarnings.length > 0 ? phiWarnings : undefined
    });

  } catch (error) {
    console.error('❌ Error creating message template:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create message template"
    });
  }
};

/**
 * PUT /message-templates/:id
 * Update a message template
 */
export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;
    const { name, description, type, subject, body, category, mergeFields, isActive } = req.body;

    const template = await MessageTemplate.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Message template not found"
      });
    }

    // Handle merge fields
    // If mergeFields is explicitly provided, use it as-is (supports name|dbField format)
    // Otherwise, auto-extract from body/subject for backward compatibility
    let extractedMergeFields = mergeFields;
    
    if (mergeFields === undefined && body && body !== template.body) {
      // Only auto-extract if mergeFields not provided
      const regex = /\{\{([^}]+)\}\}/g;
      const fields = new Set<string>();
      let match;
      
      // Check if body is JSON (blocks structure)
      try {
        const parsed = JSON.parse(body);
        if (Array.isArray(parsed)) {
          // Extract merge fields from block contents
          parsed.forEach((block: any) => {
            if (block.content) {
              while ((match = regex.exec(block.content)) !== null) {
                fields.add(match[1].trim());
              }
            }
          });
        } else {
          // Plain text - use original logic
          while ((match = regex.exec(body)) !== null) {
            fields.add(match[1].trim());
          }
        }
      } catch {
        // Not JSON, treat as plain text
        while ((match = regex.exec(body)) !== null) {
          fields.add(match[1].trim());
        }
      }
      
      // Also check subject
      if (subject) {
        while ((match = regex.exec(subject)) !== null) {
          fields.add(match[1].trim());
        }
      }
      extractedMergeFields = Array.from(fields);
    }

    // Update fields
    if (name !== undefined) template.name = name;
    if (description !== undefined) template.description = description;
    if (type !== undefined) template.type = type;
    if (subject !== undefined) template.subject = subject;
    if (body !== undefined) template.body = body;
    if (category !== undefined) template.category = category;
    if (extractedMergeFields !== undefined) template.mergeFields = extractedMergeFields;
    if (isActive !== undefined) template.isActive = isActive;

    // 🔒 HIPAA COMPLIANCE: Detect unmasked PHI in updated template
    const phiWarnings = detectUnmaskedPHI(template.body + (template.subject || ''));
    if (phiWarnings.length > 0) {
      console.warn('⚠️ Template contains unmasked PHI:', phiWarnings);
    }

    // Increment version
    template.version += 1;

    await template.save();

    console.log('✅ Message template updated:', {
      templateId: template.id,
      version: template.version,
      phiWarnings: phiWarnings.length > 0 ? phiWarnings : undefined
    });

    res.status(200).json({
      success: true,
      data: template,
      warnings: phiWarnings.length > 0 ? phiWarnings : undefined
    });

  } catch (error) {
    console.error('❌ Error updating message template:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update message template"
    });
  }
};

/**
 * POST /message-templates/:id/duplicate
 * Duplicate a message template
 */
export const duplicateTemplate = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;

    const originalTemplate = await MessageTemplate.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        message: "Message template not found"
      });
    }

    // Create duplicate with " (Copy)" appended to name
    const duplicateTemplate = await MessageTemplate.create({
      clinicId: originalTemplate.clinicId,
      name: `${originalTemplate.name} (Copy)`,
      description: originalTemplate.description,
      type: originalTemplate.type,
      subject: originalTemplate.subject,
      body: originalTemplate.body,
      category: originalTemplate.category,
      mergeFields: originalTemplate.mergeFields,
      createdBy: currentUser.id,
      isActive: true,
      version: 1
    });

    console.log('✅ Message template duplicated:', {
      originalId: id,
      duplicateId: duplicateTemplate.id,
      name: duplicateTemplate.name
    });

    res.status(201).json({
      success: true,
      data: duplicateTemplate
    });

  } catch (error) {
    console.error('❌ Error duplicating message template:', error);
    res.status(500).json({
      success: false,
      message: "Failed to duplicate message template"
    });
  }
};

/**
 * DELETE /message-templates/:id
 * Delete a message template (soft delete)
 */
export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;

    const template = await MessageTemplate.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Message template not found"
      });
    }

    await template.destroy(); // Soft delete (paranoid mode)

    console.log('✅ Message template soft deleted:', {
      templateId: id
    });

    res.status(200).json({
      success: true,
      message: "Message template deleted successfully"
    });

  } catch (error) {
    console.error('❌ Error deleting message template:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete message template"
    });
  }
};

/**
 * POST /message-templates/upload-image
 * Upload an image for message template
 */
export const uploadTemplateImage = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    if (!currentUser.clinicId) {
      return res.status(400).json({
        success: false,
        message: "User does not belong to a clinic"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided"
      });
    }

    // Validate file type (only images, no PDFs)
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedImageTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPEG, PNG, and WEBP images are allowed"
      });
    }

    // Validate file size
    if (!isValidFileSize(req.file.size)) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB"
      });
    }

    // Upload to S3
    const imageUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'template-images',  // folder in S3
      currentUser.clinicId // prefix with clinic ID
    );

    console.log('✅ Template image uploaded:', imageUrl);

    res.status(200).json({
      success: true,
      data: {
        url: imageUrl,
        filename: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype
      }
    });

  } catch (error) {
    console.error('❌ Error uploading template image:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to upload image"
    });
  }
};

