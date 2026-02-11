import { Router, Request, Response } from 'express';
import Program from '../models/Program';
import Questionnaire from '../models/Questionnaire';
import FormProducts from '../models/FormProducts';
import Product from '../models/Product';
import TenantProduct from '../models/TenantProduct';
import TenantProductForm from '../models/TenantProductForm';
import Clinic from '../models/Clinic';
import MedicalCompany from '../models/MedicalCompany';
import { authenticateJWT, getCurrentUser } from '../config/jwt';

const router = Router();

/**
 * PUBLIC: Get all active programs for a clinic by slug
 * Used by patient frontend to display programs on all-products page
 * For affiliates, it returns the parent clinic's programs
 * GET /public/programs/by-clinic/:clinicSlug
 */
router.get('/public/programs/by-clinic/:clinicSlug', async (req: Request, res: Response) => {
  try {
    const { clinicSlug } = req.params;
    const { affiliateSlug } = req.query;

    // Find the clinic by slug
    let clinic = await Clinic.findOne({
      where: { slug: clinicSlug }
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: 'Clinic not found',
      });
    }

    // If this is an affiliate clinic or if affiliateSlug is provided, 
    // we need to get programs from the parent clinic
    let programClinicId = clinic.id;
    let isAffiliate = false;

    if (affiliateSlug && typeof affiliateSlug === 'string') {
      // An affiliate slug is provided - find the affiliate clinic
      const affiliateClinic = await Clinic.findOne({
        where: {
          slug: affiliateSlug,
          affiliateOwnerClinicId: clinic.id
        }
      });

      if (affiliateClinic) {
        isAffiliate = true;
        // Programs come from the parent clinic (the one found by clinicSlug)
        programClinicId = clinic.id;
      }
    } else if (clinic.affiliateOwnerClinicId) {
      // The clinic itself is an affiliate, get programs from parent
      isAffiliate = true;
      programClinicId = clinic.affiliateOwnerClinicId;
    }

    // Fetch active programs for the clinic
    const programs = await Program.findAll({
      where: {
        clinicId: programClinicId,
        isActive: true
      },
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
                  attributes: ['id', 'name', 'price'],
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: Product,
          as: 'frontendDisplayProduct',
          attributes: ['id', 'name', 'imageUrl', 'slug'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Build simplified response for frontend with cheapest product price
    // Only include programs that have at least one activated product (TenantProduct with isActive=true)
    const programsData = await Promise.all(programs.map(async (program) => {
      let cheapestPrice: number | null = null;
      let hasActivatedProduct = false;

      // Get products from the program's medical template
      const medicalTemplate = program.medicalTemplate as any;
      if (medicalTemplate && medicalTemplate.formProducts) {
        const formProducts = medicalTemplate.formProducts as any[];
        
        // Calculate cheapest price from ACTIVATED tenant products only
        for (const fp of formProducts) {
          if (!fp.product) continue;
          
          // Only consider products that have an ACTIVE TenantProduct for this clinic
          const tenantProduct = await TenantProduct.findOne({
            where: {
              productId: fp.product.id,
              clinicId: programClinicId,
              isActive: true, // Must be explicitly activated
            },
            attributes: ['price', 'isActive'],
          });

          // Only count this product if it has an active TenantProduct
          if (tenantProduct && tenantProduct.isActive) {
            hasActivatedProduct = true;
            const productPrice = Number(tenantProduct.price) || Number(fp.product.price) || 0;

            if (productPrice > 0 && (cheapestPrice === null || productPrice < cheapestPrice)) {
              cheapestPrice = productPrice;
            }
          }
        }
      }

      return {
        id: program.id,
        name: program.name,
        description: program.description,
        medicalTemplateId: program.medicalTemplateId,
        medicalTemplate: program.medicalTemplate ? {
          id: medicalTemplate.id,
          title: medicalTemplate.title,
          description: medicalTemplate.description,
        } : null,
        isActive: program.isActive,
        // Frontend display product - used for showing product image on program cards
        frontendDisplayProductId: program.frontendDisplayProductId,
        frontendDisplayProduct: program.frontendDisplayProduct ? {
          id: (program.frontendDisplayProduct as any).id,
          name: (program.frontendDisplayProduct as any).name,
          imageUrl: (program.frontendDisplayProduct as any).imageUrl,
          slug: (program.frontendDisplayProduct as any).slug,
        } : null,
        // Cheapest product price from the program (null if no activated products)
        fromPrice: cheapestPrice,
        // Flag to indicate if program has any activated products
        hasActivatedProducts: hasActivatedProduct,
      };
    }));

    // Filter out programs that have no activated products
    const filteredPrograms = programsData.filter(p => p.hasActivatedProducts);

    return res.json({
      success: true,
      data: filteredPrograms,
      isAffiliate,
    });
  } catch (error) {
    console.error('❌ Error getting programs by clinic slug:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get programs',
    });
  }
});

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
          attributes: ['id', 'title', 'description', 'formTemplateType', 'productOfferType'],
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

    // Fetch child programs (per-product programs) for this parent program
    const childPrograms = await Program.findAll({
      where: {
        parentProgramId: program.id,
        isActive: true,
      },
      attributes: [
        'id', 'name', 'individualProductId',
        'hasPatientPortal', 'patientPortalPrice',
        'hasBmiCalculator', 'bmiCalculatorPrice',
        'hasProteinIntakeCalculator', 'proteinIntakeCalculatorPrice',
        'hasCalorieDeficitCalculator', 'calorieDeficitCalculatorPrice',
        'hasEasyShopping', 'easyShoppingPrice',
      ],
    });

    // Build a map of productId -> child program's non-medical services
    const perProductPrograms: Record<string, any> = {};
    for (const childProg of childPrograms) {
      if (childProg.individualProductId) {
        const childNonMedicalServices = {
          patientPortal: {
            enabled: childProg.hasPatientPortal,
            price: parseFloat(String(childProg.patientPortalPrice)) || 0,
          },
          bmiCalculator: {
            enabled: childProg.hasBmiCalculator,
            price: parseFloat(String(childProg.bmiCalculatorPrice)) || 0,
          },
          proteinIntakeCalculator: {
            enabled: childProg.hasProteinIntakeCalculator,
            price: parseFloat(String(childProg.proteinIntakeCalculatorPrice)) || 0,
          },
          calorieDeficitCalculator: {
            enabled: childProg.hasCalorieDeficitCalculator,
            price: parseFloat(String(childProg.calorieDeficitCalculatorPrice)) || 0,
          },
          easyShopping: {
            enabled: childProg.hasEasyShopping,
            price: parseFloat(String(childProg.easyShoppingPrice)) || 0,
          },
        };
        
        const childNonMedicalServicesFee = Object.values(childNonMedicalServices)
          .filter((s: any) => s.enabled)
          .reduce((sum: number, s: any) => sum + s.price, 0);
        
        perProductPrograms[childProg.individualProductId] = {
          programId: childProg.id,
          programName: childProg.name,
          nonMedicalServices: childNonMedicalServices,
          nonMedicalServicesFee: childNonMedicalServicesFee,
        };
      }
    }

    // Determine if this is a per-product pricing program
    const hasPerProductPricing = Object.keys(perProductPrograms).length > 0;

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

      // Get per-product program info if available
      const perProductProgram = perProductPrograms[product.id] || null;

      productsWithPricing.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        imageUrl: product.imageUrl,
        basePrice: product.price,
        categories: product.categories,
        tenantProduct: tenantProductInfo,
        displayPrice,
        // Include per-product program's non-medical services if available
        perProductProgram,
      });
    }

    // Build non-medical services info from parent program (used for unified pricing)
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

    // Calculate total non-medical services fee for unified pricing
    const nonMedicalServicesFee = Object.values(nonMedicalServices)
      .filter((s: any) => s.enabled)
      .reduce((sum: number, s: any) => sum + s.price, 0);

    // Get productOfferType from the medical template
    const productOfferType = (program.medicalTemplate as any)?.productOfferType || 'single_choice';

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
        productOfferType: (program.medicalTemplate as any).productOfferType,
      } : null,
      isActive: program.isActive,
      // All products with pricing (includes per-product program info if available)
      products: productsWithPricing,
      // Non-medical services (parent program - used for unified pricing)
      nonMedicalServices,
      nonMedicalServicesFee,
      // Product offer type (single_choice or multiple_choice)
      productOfferType,
      // Whether this program has per-product pricing
      hasPerProductPricing,
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
 * Get all program templates (for tenant managers)
 * These are programs with isTemplate=true
 * GET /program-templates
 */
router.get('/program-templates', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Only get templates (isTemplate=true)
    const whereClause: any = { 
      isTemplate: true,
      parentProgramId: null, // Only parent templates
    };

    const templates = await Program.findAll({
      where: whereClause,
      include: [
        {
          model: Questionnaire,
          as: 'medicalTemplate',
          attributes: ['id', 'title', 'description', 'formTemplateType', 'medicalCompanySource'],
        },
        {
          model: Product,
          as: 'individualProduct',
          attributes: ['id', 'name', 'slug', 'imageUrl'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('❌ Error getting program templates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get program templates',
    });
  }
});

/**
 * Create a program template (for tenant managers)
 * POST /program-templates
 */
router.post('/program-templates', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
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
        error: 'Program template name is required',
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
      clinicId: null, // Templates are not clinic-specific
      medicalTemplateId: medicalTemplateId || null,
      isActive: isActive !== undefined ? isActive : true,
      isTemplate: true, // Mark as template
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
    console.error('❌ Error creating program template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create program template',
    });
  }
});

/**
 * Update a program template (for tenant managers)
 * PUT /program-templates/:id
 */
router.put('/program-templates/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { id } = req.params;
    const {
      name,
      description,
      medicalTemplateId,
      isActive,
      frontendDisplayProductId,
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
      where: { id, isTemplate: true },
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        error: 'Program template not found',
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
    if (frontendDisplayProductId !== undefined) program.frontendDisplayProductId = frontendDisplayProductId || null;

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
    console.error('❌ Error updating program template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update program template',
    });
  }
});

/**
 * Delete a program template (for tenant managers)
 * DELETE /program-templates/:id
 */
router.delete('/program-templates/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { id } = req.params;

    const program = await Program.findOne({
      where: { id, isTemplate: true },
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        error: 'Program template not found',
      });
    }

    await program.destroy();

    return res.json({
      success: true,
      message: 'Program template deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting program template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete program template',
    });
  }
});

/**
 * Get all programs for the current clinic
 * GET /programs
 * Query params:
 *   - medicalTemplateId: Filter by medical template ID (to get individual product programs)
 *   - parentProgramId: Filter by parent program ID (to get child programs)
 *   - includeChildren: If 'true', include child programs; otherwise only parent programs are returned
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

    const { medicalTemplateId, parentProgramId, includeChildren } = req.query;
    
    // Only get non-template programs for the clinic
    const whereClause: any = { clinicId, isTemplate: false };
    
    // Filter by medical template if provided
    if (medicalTemplateId && typeof medicalTemplateId === 'string') {
      whereClause.medicalTemplateId = medicalTemplateId;
    }
    
    // Filter by parent program if provided
    if (parentProgramId && typeof parentProgramId === 'string') {
      whereClause.parentProgramId = parentProgramId;
    } else if (includeChildren !== 'true') {
      // By default, only return parent programs (those without parentProgramId)
      whereClause.parentProgramId = null;
    }

    const programs = await Program.findAll({
      where: whereClause,
      include: [
        {
          model: Questionnaire,
          as: 'medicalTemplate',
          attributes: ['id', 'title', 'description', 'formTemplateType', 'medicalCompanySource'],
        },
        {
          model: Product,
          as: 'individualProduct',
          attributes: ['id', 'name', 'slug', 'imageUrl'],
          required: false,
        },
        {
          model: Program,
          as: 'template',
          attributes: ['id', 'name', 'description'],
          required: false,
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
 * Get a single program template by ID (for tenant managers)
 * GET /program-templates/:id
 */
router.get('/program-templates/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { id } = req.params;

    const program = await Program.findOne({
      where: { id, isTemplate: true },
      include: [
        {
          model: Questionnaire,
          as: 'medicalTemplate',
          attributes: ['id', 'title', 'description', 'formTemplateType', 'medicalCompanySource'],
        },
      ],
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        error: 'Program template not found',
      });
    }

    return res.json({
      success: true,
      data: program,
    });
  } catch (error) {
    console.error('❌ Error getting program template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get program template',
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
          attributes: ['id', 'title', 'description', 'formTemplateType', 'medicalCompanySource'],
        },
        {
          model: Program,
          as: 'template',
          attributes: ['id', 'name', 'description'],
          required: false,
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
 * Body: { name, description?, medicalTemplateId?, individualProductId?, templateId?, isActive?, hasPatientPortal?, patientPortalPrice?, ... }
 * 
 * individualProductId: When set, this program is specific to one product from the form.
 * This allows different pricing/services for different products within the same medical template.
 * 
 * templateId: When set, this program is created from a template. The template values are
 * used as defaults but can be customized by the brand.
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
      individualProductId,
      parentProgramId,
      templateId, // Reference to the program template
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

    // If creating from template, get template defaults
    let templateDefaults: any = {};
    if (templateId) {
      const templateProgram = await Program.findOne({
        where: { id: templateId, isTemplate: true },
      });
      if (!templateProgram) {
        return res.status(404).json({
          success: false,
          error: 'Program template not found',
        });
      }
      templateDefaults = {
        name: templateProgram.name,
        description: templateProgram.description,
        medicalTemplateId: templateProgram.medicalTemplateId,
        hasPatientPortal: templateProgram.hasPatientPortal,
        patientPortalPrice: templateProgram.patientPortalPrice,
        hasBmiCalculator: templateProgram.hasBmiCalculator,
        bmiCalculatorPrice: templateProgram.bmiCalculatorPrice,
        hasProteinIntakeCalculator: templateProgram.hasProteinIntakeCalculator,
        proteinIntakeCalculatorPrice: templateProgram.proteinIntakeCalculatorPrice,
        hasCalorieDeficitCalculator: templateProgram.hasCalorieDeficitCalculator,
        calorieDeficitCalculatorPrice: templateProgram.calorieDeficitCalculatorPrice,
        hasEasyShopping: templateProgram.hasEasyShopping,
        easyShoppingPrice: templateProgram.easyShoppingPrice,
      };
    }

    // Use provided values or template defaults
    const finalName = name || templateDefaults.name;
    if (!finalName) {
      return res.status(400).json({
        success: false,
        error: 'Program name is required',
      });
    }

    const finalMedicalTemplateId = medicalTemplateId || templateDefaults.medicalTemplateId;

    // Verify medical template exists if provided
    if (finalMedicalTemplateId) {
      const template = await Questionnaire.findByPk(finalMedicalTemplateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Medical template not found',
        });
      }
    }

    // Verify individual product exists if provided
    if (individualProductId) {
      const product = await Product.findByPk(individualProductId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Individual product not found',
        });
      }
    }

    // Verify parent program exists if provided
    if (parentProgramId) {
      const parentProgram = await Program.findByPk(parentProgramId);
      if (!parentProgram) {
        return res.status(404).json({
          success: false,
          error: 'Parent program not found',
        });
      }
    }

    const program = await Program.create({
      name: finalName,
      description: description !== undefined ? description : templateDefaults.description,
      clinicId,
      medicalTemplateId: finalMedicalTemplateId || null,
      individualProductId: individualProductId || null,
      parentProgramId: parentProgramId || null,
      templateId: templateId || null, // Reference to template
      isTemplate: false, // Brand programs are never templates
      isActive: isActive !== undefined ? isActive : true,
      // Non-medical services (use provided or template defaults)
      hasPatientPortal: hasPatientPortal !== undefined ? hasPatientPortal : (templateDefaults.hasPatientPortal || false),
      patientPortalPrice: patientPortalPrice !== undefined ? patientPortalPrice : (templateDefaults.patientPortalPrice || 0),
      hasBmiCalculator: hasBmiCalculator !== undefined ? hasBmiCalculator : (templateDefaults.hasBmiCalculator || false),
      bmiCalculatorPrice: bmiCalculatorPrice !== undefined ? bmiCalculatorPrice : (templateDefaults.bmiCalculatorPrice || 0),
      hasProteinIntakeCalculator: hasProteinIntakeCalculator !== undefined ? hasProteinIntakeCalculator : (templateDefaults.hasProteinIntakeCalculator || false),
      proteinIntakeCalculatorPrice: proteinIntakeCalculatorPrice !== undefined ? proteinIntakeCalculatorPrice : (templateDefaults.proteinIntakeCalculatorPrice || 0),
      hasCalorieDeficitCalculator: hasCalorieDeficitCalculator !== undefined ? hasCalorieDeficitCalculator : (templateDefaults.hasCalorieDeficitCalculator || false),
      calorieDeficitCalculatorPrice: calorieDeficitCalculatorPrice !== undefined ? calorieDeficitCalculatorPrice : (templateDefaults.calorieDeficitCalculatorPrice || 0),
      hasEasyShopping: hasEasyShopping !== undefined ? hasEasyShopping : (templateDefaults.hasEasyShopping || false),
      easyShoppingPrice: easyShoppingPrice !== undefined ? easyShoppingPrice : (templateDefaults.easyShoppingPrice || 0),
    });

    // Fetch with relationships
    const programWithRelations = await Program.findByPk(program.id, {
      include: [
        {
          model: Questionnaire,
          as: 'medicalTemplate',
          attributes: ['id', 'title', 'description', 'formTemplateType'],
        },
        {
          model: Product,
          as: 'individualProduct',
          attributes: ['id', 'name', 'slug', 'imageUrl'],
          required: false,
        },
        {
          model: Program,
          as: 'template',
          attributes: ['id', 'name', 'description'],
          required: false,
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
 * Body: { name?, description?, medicalTemplateId?, individualProductId?, isActive?, ... }
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
      individualProductId,
      parentProgramId,
      isActive,
      frontendDisplayProductId,
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

    // Verify individual product exists if provided
    if (individualProductId) {
      const product = await Product.findByPk(individualProductId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Individual product not found',
        });
      }
    }

    // Verify parent program exists if provided
    if (parentProgramId) {
      const parentProgram = await Program.findByPk(parentProgramId);
      if (!parentProgram) {
        return res.status(404).json({
          success: false,
          error: 'Parent program not found',
        });
      }
    }

    // Update fields
    if (name !== undefined) program.name = name;
    if (description !== undefined) program.description = description;
    if (medicalTemplateId !== undefined) program.medicalTemplateId = medicalTemplateId;
    if (individualProductId !== undefined) program.individualProductId = individualProductId || null;
    if (parentProgramId !== undefined) program.parentProgramId = parentProgramId || null;
    if (isActive !== undefined) program.isActive = isActive;
    if (frontendDisplayProductId !== undefined) program.frontendDisplayProductId = frontendDisplayProductId || null;

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
        {
          model: Product,
          as: 'individualProduct',
          attributes: ['id', 'name', 'slug', 'imageUrl'],
          required: false,
        },
        {
          model: Program,
          as: 'template',
          attributes: ['id', 'name', 'description'],
          required: false,
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

/**
 * Calculate visit fee for a program based on patient's state
 * POST /programs/calculate-visit-fee
 */
router.post('/calculate-visit-fee', async (req: Request, res: Response) => {
  try {
    const { programId, state } = req.body || {};

    console.log("🔍 [CALC VISIT FEE] Request received:", { programId, state });

    if (!programId || !state) {
      console.log("❌ [CALC VISIT FEE] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "programId and state are required",
      });
    }

    // Fetch program
    const program = await Program.findByPk(programId);
    if (!program) {
      console.log("❌ [CALC VISIT FEE] Program not found:", programId);
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    console.log("✅ [CALC VISIT FEE] Program found:", {
      programId: program.id,
      medicalTemplateId: program.medicalTemplateId,
      clinicId: program.clinicId,
    });

    let visitFeeAmount = 0;
    let visitType: 'synchronous' | 'asynchronous' | null = null;
    
    try {
      const patientState = state.toUpperCase();
      console.log("🔍 [CALC VISIT FEE] Patient state:", patientState);
      
      if (program.medicalTemplateId && program.clinicId) {
        // Get questionnaire with visit type configuration
        const questionnaire = await Questionnaire.findByPk(program.medicalTemplateId, {
          attributes: ['id', 'visitTypeByState'],
        });

        console.log("🔍 [CALC VISIT FEE] Questionnaire found:", {
          id: questionnaire?.id,
          hasVisitTypeByState: !!questionnaire?.visitTypeByState,
          visitTypeByState: questionnaire?.visitTypeByState,
        });

        if (questionnaire && questionnaire.visitTypeByState) {
          // Determine visit type required for this state
          visitType = (questionnaire.visitTypeByState as any)[patientState] || 'asynchronous';
          console.log("✅ [CALC VISIT FEE] Visit type for state:", { patientState, visitType });
          
          // Resolve fees by medical company (platform) with clinic fallback
          const clinic = await Clinic.findByPk(program.clinicId, {
            attributes: ['id', 'visitTypeFees', 'patientPortalDashboardFormat'],
          });

          const medicalCompany = clinic?.patientPortalDashboardFormat
            ? await MedicalCompany.findOne({
                where: { slug: clinic.patientPortalDashboardFormat },
                attributes: ['id', 'slug', 'visitTypeFees'],
              })
            : null;

          console.log("🔍 [CALC VISIT FEE] Clinic found:", {
            id: clinic?.id,
            patientPortalDashboardFormat: clinic?.patientPortalDashboardFormat,
            medicalCompanySlug: medicalCompany?.slug,
            medicalCompanyVisitTypeFees: medicalCompany?.visitTypeFees,
            hasVisitTypeFees: !!clinic?.visitTypeFees,
            visitTypeFees: clinic?.visitTypeFees,
          });

          if (visitType) {
            const medicalCompanyFee = Number((medicalCompany?.visitTypeFees as any)?.[visitType]) || 0;
            const clinicFallbackFee = Number((clinic?.visitTypeFees as any)?.[visitType]) || 0;
            visitFeeAmount = medicalCompanyFee || clinicFallbackFee;
            console.log("✅ [CALC VISIT FEE] Final calculation:", {
              visitType,
              visitFeeAmount,
              source: medicalCompanyFee ? 'medical-company' : 'clinic-fallback',
              rawMedicalCompanyValue: (medicalCompany?.visitTypeFees as any)?.[visitType],
              rawClinicValue: (clinic?.visitTypeFees as any)?.[visitType],
            });
          } else {
            console.warn("⚠️ [CALC VISIT FEE] Missing data:", {
              hasClinic: !!clinic,
              hasMedicalCompany: !!medicalCompany,
              hasMedicalCompanyFees: !!medicalCompany?.visitTypeFees,
              hasVisitTypeFees: !!clinic?.visitTypeFees,
              visitType,
            });
          }
        } else {
          console.warn("⚠️ [CALC VISIT FEE] No questionnaire or visitTypeByState");
        }
      } else {
        console.warn("⚠️ [CALC VISIT FEE] Missing medicalTemplateId or clinicId:", {
          medicalTemplateId: program.medicalTemplateId,
          clinicId: program.clinicId,
        });
      }
    } catch (error) {
      console.warn("⚠️ [CALC VISIT FEE] Failed to calculate visit fee:", error);
    }

    console.log("📤 [CALC VISIT FEE] Sending response:", {
      visitType,
      visitFeeAmount,
      requiresVisit: visitFeeAmount > 0,
    });

    return res.status(200).json({
      success: true,
      data: {
        visitType,
        visitFeeAmount,
        requiresVisit: visitFeeAmount > 0,
      },
    });
  } catch (error) {
    console.error("❌ [CALC VISIT FEE] Error calculating visit fee:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to calculate visit fee",
    });
  }
});

export default router;
