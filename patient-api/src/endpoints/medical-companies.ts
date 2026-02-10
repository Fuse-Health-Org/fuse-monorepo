import { Router, Request, Response } from 'express';
import MedicalCompany from '../models/MedicalCompany';

const router = Router();

// GET /medical-companies - List all medical companies
router.get('/', async (_req: Request, res: Response) => {
  try {
    const companies = await MedicalCompany.findAll({
      order: [['name', 'ASC']],
    });

    res.json({
      success: true,
      data: companies,
    });
  } catch (error) {
    console.error('Error fetching medical companies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medical companies',
    });
  }
});

// GET /medical-companies/:slug - Get a single medical company by slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const company = await MedicalCompany.findOne({
      where: { slug: req.params.slug },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Medical company not found',
      });
    }

    res.json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('Error fetching medical company:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medical company',
    });
  }
});

// PUT /medical-companies/:id - Update a medical company by ID
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const company = await MedicalCompany.findByPk(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Medical company not found',
      });
    }

    const { name, slug, apiUrl, dashboardUrl, documentationUrl } = req.body;

    await company.update({
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(apiUrl !== undefined && { apiUrl }),
      ...(dashboardUrl !== undefined && { dashboardUrl }),
      ...(documentationUrl !== undefined && { documentationUrl }),
    });

    res.json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('Error updating medical company:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medical company',
    });
  }
});

export default router;
