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

    // Get all products from the program's template with their tenant pricing
    const formProducts = (program.medicalTemplate as any)?.formProducts || [];
    const productsWithPricing: any[] = [];

    for (const fp of formProducts) {
      if (!fp.product) continue;
      
      const product = fp.product;
      let tenantProductInfo: { id: string; price: number; isActive: boolean } | null = null;

      // Get TenantProduct for this product and clinic
      if (program.clinicId) {
        const tenantProduct = await TenantProduct.findOne({
          where: {
            productId: product.id,
            clinicId: program.clinicId,
          },
          attributes: ['id', 'productId', 'isActive', 'price'],
        });

        if (tenantProduct) {
          tenantProductInfo = {
            id: tenantProduct.id,
            price: Number(tenantProduct.price) || 0,
            isActive: tenantProduct.isActive,
          };
        }
      }

      const displayPrice = tenantProductInfo ? tenantProductInfo.price : (product.price || 0);

      productsWithPricing.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        imageUrl: product.imageUrl,
        basePrice: product.price,
        categories: product.categories,
        tenantProduct: tenantProductInfo,
        displayPrice,
      });
    }

    // Build non-medical services info from program
    const nonMedicalServices = {
      patientPortal: {
        enabled: program.hasPatientPortal,
        price: parseFloat(String(program.patientPortalPrice)) || 0,
      },
      bmiCalculator: {
        enabled: program.hasBmiCalculator,
        price: parseFloat(String(program.bmiCalculatorPrice)) || 0,
      },
      proteinIntakeCalculator: {
        enabled: program.hasProteinIntakeCalculator,
        price: parseFloat(String(program.proteinIntakeCalculatorPrice)) || 0,
      },
      calorieDeficitCalculator: {
        enabled: program.hasCalorieDeficitCalculator,
        price: parseFloat(String(program.calorieDeficitCalculatorPrice)) || 0,
      },
      easyShopping: {
        enabled: program.hasEasyShopping,
        price: parseFloat(String(program.easyShoppingPrice)) || 0,
      },
    };

    // Calculate total non-medical services fee
    const nonMedicalServicesFee = Object.values(nonMedicalServices)
      .filter((s: any) => s.enabled)
      .reduce((sum: number, s: any) => sum + s.price, 0);

    // Build response
    const responseData = {
      id: program.id,
      name: program.name,
      description: program.description,
      clinicId: program.clinicId,
      medicalTemplateId: program.medicalTemplateId,
      medicalTemplate: program.medicalTemplate ? {
        id: (program.medicalTemplate as any).id,
        title: (program.medicalTemplate as any).title,
        description: (program.medicalTemplate as any).description,
      } : null,
      isActive: program.isActive,
      // All products with pricing
      products: productsWithPricing,
      // Non-medical services
      nonMedicalServices,
      nonMedicalServicesFee,
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
 * Body: { name, description?, medicalTemplateId?, isActive?, hasPatientPortal?, patientPortalPrice?, ... }
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

    const { 
      name, 
      description, 
      medicalTemplateId, 
      isActive,
      // Non-medical services
      hasPatientPortal,
      patientPortalPrice,
      hasBmiCalculator,
      bmiCalculatorPrice,
      hasProteinIntakeCalculator,
      proteinIntakeCalculatorPrice,
      hasCalorieDeficitCalculator,
      calorieDeficitCalculatorPrice,
      hasEasyShopping,
      easyShoppingPrice,
    } = req.body;

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
      // Non-medical services
      hasPatientPortal: hasPatientPortal || false,
      patientPortalPrice: patientPortalPrice || 0,
      hasBmiCalculator: hasBmiCalculator || false,
      bmiCalculatorPrice: bmiCalculatorPrice || 0,
      hasProteinIntakeCalculator: hasProteinIntakeCalculator || false,
      proteinIntakeCalculatorPrice: proteinIntakeCalculatorPrice || 0,
      hasCalorieDeficitCalculator: hasCalorieDeficitCalculator || false,
      calorieDeficitCalculatorPrice: calorieDeficitCalculatorPrice || 0,
      hasEasyShopping: hasEasyShopping || false,
      easyShoppingPrice: easyShoppingPrice || 0,
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
    const { 
      name, 
      description, 
      medicalTemplateId, 
      isActive,
      // Non-medical services
      hasPatientPortal,
      patientPortalPrice,
      hasBmiCalculator,
      bmiCalculatorPrice,
      hasProteinIntakeCalculator,
      proteinIntakeCalculatorPrice,
      hasCalorieDeficitCalculator,
      calorieDeficitCalculatorPrice,
      hasEasyShopping,
      easyShoppingPrice,
    } = req.body;

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

    // Update non-medical services
    if (hasPatientPortal !== undefined) program.hasPatientPortal = hasPatientPortal;
    if (patientPortalPrice !== undefined) program.patientPortalPrice = patientPortalPrice;
    if (hasBmiCalculator !== undefined) program.hasBmiCalculator = hasBmiCalculator;
    if (bmiCalculatorPrice !== undefined) program.bmiCalculatorPrice = bmiCalculatorPrice;
    if (hasProteinIntakeCalculator !== undefined) program.hasProteinIntakeCalculator = hasProteinIntakeCalculator;
    if (proteinIntakeCalculatorPrice !== undefined) program.proteinIntakeCalculatorPrice = proteinIntakeCalculatorPrice;
    if (hasCalorieDeficitCalculator !== undefined) program.hasCalorieDeficitCalculator = hasCalorieDeficitCalculator;
    if (calorieDeficitCalculatorPrice !== undefined) program.calorieDeficitCalculatorPrice = calorieDeficitCalculatorPrice;
    if (hasEasyShopping !== undefined) program.hasEasyShopping = hasEasyShopping;
    if (easyShoppingPrice !== undefined) program.easyShoppingPrice = easyShoppingPrice;

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
