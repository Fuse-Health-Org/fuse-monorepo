import { Router, Request, Response } from 'express';
import MedicalCompany from '../models/MedicalCompany';
import MedicalCompanyPharmacy from '../models/MedicalCompanyPharmacy';
import Pharmacy from '../models/Pharmacy';

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

// GET /medical-companies/:id/pharmacies - Get all pharmacies with approval status for a medical company
router.get('/:id/pharmacies', async (req: Request, res: Response) => {
  try {
    const company = await MedicalCompany.findByPk(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Medical company not found' });
    }

    // Get all pharmacies
    const pharmacies = await Pharmacy.findAll({ order: [['name', 'ASC']] });

    // Get existing associations for this medical company
    const associations = await MedicalCompanyPharmacy.findAll({
      where: { medicalCompanyId: req.params.id },
    });

    const associationMap = new Map(
      associations.map(a => [a.pharmacyId, a])
    );

    // Merge: each pharmacy gets its approval status (or null if no association exists)
    const result = pharmacies.map(pharmacy => ({
      id: pharmacy.id,
      name: pharmacy.name,
      slug: pharmacy.slug,
      isActive: pharmacy.isActive,
      associationId: associationMap.get(pharmacy.id)?.id || null,
      doctorCompanyApprovedByPharmacy: associationMap.get(pharmacy.id)?.doctorCompanyApprovedByPharmacy || null,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching pharmacies for medical company:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pharmacies' });
  }
});

// PUT /medical-companies/:id/pharmacies/:pharmacyId - Toggle pharmacy approval for a medical company
router.put('/:id/pharmacies/:pharmacyId', async (req: Request, res: Response) => {
  try {
    const { doctorCompanyApprovedByPharmacy } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(doctorCompanyApprovedByPharmacy)) {
      return res.status(400).json({
        success: false,
        message: 'doctorCompanyApprovedByPharmacy must be pending, approved, or rejected',
      });
    }

    // Find or create the association
    let association = await MedicalCompanyPharmacy.findOne({
      where: {
        medicalCompanyId: req.params.id,
        pharmacyId: req.params.pharmacyId,
      },
    });

    if (association) {
      await association.update({ doctorCompanyApprovedByPharmacy });
    } else {
      association = await MedicalCompanyPharmacy.create({
        medicalCompanyId: req.params.id,
        pharmacyId: req.params.pharmacyId,
        doctorCompanyApprovedByPharmacy,
      });
    }

    res.json({ success: true, data: association });
  } catch (error) {
    console.error('Error updating pharmacy association:', error);
    res.status(500).json({ success: false, message: 'Failed to update pharmacy association' });
  }
});

export default router;
