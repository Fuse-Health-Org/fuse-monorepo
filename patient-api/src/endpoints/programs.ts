import { Router, Request, Response } from 'express';
import Program from '../models/Program';
import Questionnaire from '../models/Questionnaire';
import FormProducts from '../models/FormProducts';
import Product from '../models/Product';
import TenantProduct from '../models/TenantProduct';
import TenantProductForm from '../models/TenantProductForm';
import { authenticateJWT, getCurrentUser } from '../config/jwt';

const router = Router();

/**
 * PUBLIC: Get a program by ID with its medical template details
 * Used by patient frontend to resolve program URLs
 * GET /public/programs/:id
 */
router.get('/public/programs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const program = await Program.findOne({
      where: { id, isActive: true },
      include: [
        {
          model: Questionnaire,
          as: 'medicalTemplate',
          attributes: ['id', 'title', 'description', 'formTemplateType'],
          include: [
            {
              model: FormProducts,
              as: 'formProducts',
              attributes: ['id', 'productId'],
              required: false,
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['id', 'name', 'slug', 'imageUrl', 'price', 'categories'],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        error: 'Program not found',
      });
    }

    // Get the first product from the program's template
    const formProducts = (program.medicalTemplate as any)?.formProducts || [];
    const firstFormProduct = formProducts.find((fp: any) => fp.product);
    const firstProduct = firstFormProduct?.product;

    // If we have a first product, get its tenant product info for pricing
    let tenantProductInfo: any = null;
    let tenantProductFormInfo: any = null;

    if (firstProduct?.id && program.clinicId) {
      // Find TenantProduct for this product and clinic
      const tenantProduct = await TenantProduct.findOne({
        where: {
          productId: firstProduct.id,
          clinicId: program.clinicId,
        },
        attributes: ['id', 'productId', 'clinicId', 'isActive', 'stripeProductId', 'stripePriceId', 'price'],
      });

      if (tenantProduct) {
        tenantProductInfo = {
          id: tenantProduct.id,
          productId: tenantProduct.productId,
          isActive: tenantProduct.isActive,
          stripeProductId: tenantProduct.stripeProductId,
          stripePriceId: tenantProduct.stripePriceId,
          price: tenantProduct.price,
        };

        // Also get the default tenant product form (for the form ID)
        const tenantProductForm = await TenantProductForm.findOne({
          where: {
            productId: firstProduct.id,
            clinicId: program.clinicId,
          },
          attributes: ['id', 'productId', 'globalFormStructureId'],
          order: [['createdAt', 'ASC']], // Get first/oldest form
        });

        if (tenantProductForm) {
          tenantProductFormInfo = {
            id: tenantProductForm.id,
            productId: tenantProductForm.productId,
            globalFormStructureId: tenantProductForm.globalFormStructureId,
          };
        }
      }
    }

    // Build response with tenant product info
    const responseData = {
      ...(program.toJSON ? program.toJSON() : program),
      tenantProduct: tenantProductInfo,
      tenantProductForm: tenantProductFormInfo,
      firstProductCategory: firstProduct?.categories?.[0] || null,
    };

    return res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('❌ Error getting public program:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get program',
    });
  }
});

/**
 * Get all programs for the current clinic
 * GET /programs
 */
router.get('/programs', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with a clinic',
      });
    }

    const programs = await Program.findAll({
      where: { clinicId },
      include: [
        {
          model: Questionnaire,
          as: 'medicalTemplate',
          attributes: ['id', 'title', 'description', 'formTemplateType'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: programs,
    });
  } catch (error) {
    console.error('❌ Error getting programs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get programs',
    });
  }
});

/**
 * Get a single program by ID
 * GET /programs/:id
 */
router.get('/programs/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    const { id } = req.params;

    const program = await Program.findOne({
      where: { id, clinicId },
      include: [
        {
          model: Questionnaire,
          as: 'medicalTemplate',
          attributes: ['id', 'title', 'description', 'formTemplateType'],
        },
      ],
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        error: 'Program not found',
      });
    }

    return res.json({
      success: true,
      data: program,
    });
  } catch (error) {
    console.error('❌ Error getting program:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get program',
    });
  }
});

/**
 * Create a new program
 * POST /programs
 * Body: { name, description?, medicalTemplateId?, isActive? }
 */
router.post('/programs', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with a clinic',
      });
    }

    const { name, description, medicalTemplateId, isActive } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Program name is required',
      });
    }

    // Verify medical template exists if provided
    if (medicalTemplateId) {
      const template = await Questionnaire.findByPk(medicalTemplateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Medical template not found',
        });
      }
    }

    const program = await Program.create({
      name,
      description,
      clinicId,
      medicalTemplateId: medicalTemplateId || null,
      isActive: isActive !== undefined ? isActive : true,
    });

    // Fetch with relationships
    const programWithRelations = await Program.findByPk(program.id, {
      include: [
        {
          model: Questionnaire,
          as: 'medicalTemplate',
          attributes: ['id', 'title', 'description', 'formTemplateType'],
        },
      ],
    });

    return res.json({
      success: true,
      data: programWithRelations,
    });
  } catch (error) {
    console.error('❌ Error creating program:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create program',
    });
  }
});

/**
 * Update a program
 * PUT /programs/:id
 * Body: { name?, description?, medicalTemplateId?, isActive? }
 */
router.put('/programs/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    const { id } = req.params;
    const { name, description, medicalTemplateId, isActive } = req.body;

    const program = await Program.findOne({
      where: { id, clinicId },
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        error: 'Program not found',
      });
    }

    // Verify medical template exists if provided
    if (medicalTemplateId) {
      const template = await Questionnaire.findByPk(medicalTemplateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Medical template not found',
        });
      }
    }

    // Update fields
    if (name !== undefined) program.name = name;
    if (description !== undefined) program.description = description;
    if (medicalTemplateId !== undefined) program.medicalTemplateId = medicalTemplateId;
    if (isActive !== undefined) program.isActive = isActive;

    await program.save();

    // Fetch with relationships
    const programWithRelations = await Program.findByPk(program.id, {
      include: [
        {
          model: Questionnaire,
          as: 'medicalTemplate',
          attributes: ['id', 'title', 'description', 'formTemplateType'],
        },
      ],
    });

    return res.json({
      success: true,
      data: programWithRelations,
    });
  } catch (error) {
    console.error('❌ Error updating program:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update program',
    });
  }
});

/**
 * Delete a program
 * DELETE /programs/:id
 */
router.delete('/programs/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    const { id } = req.params;

    const program = await Program.findOne({
      where: { id, clinicId },
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        error: 'Program not found',
      });
    }

    await program.destroy();

    return res.json({
      success: true,
      message: 'Program deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting program:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete program',
    });
  }
});

export default router;
