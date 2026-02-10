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

export default router;
