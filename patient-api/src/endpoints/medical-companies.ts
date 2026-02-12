import { Router, Request, Response } from 'express';
import MedicalCompany from '../models/MedicalCompany';
import MedicalCompanyPharmacy from '../models/MedicalCompanyPharmacy';
import DoctorPharmacy from '../models/DoctorPharmacy';
import Pharmacy from '../models/Pharmacy';
import User from '../models/User';

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

    const { name, slug, apiUrl, dashboardUrl, documentationUrl, visitTypeFees } = req.body;

    if (visitTypeFees !== undefined) {
      const isObject = typeof visitTypeFees === 'object' && visitTypeFees !== null;
      const hasValidKeys =
        isObject &&
        typeof visitTypeFees.synchronous === 'number' &&
        typeof visitTypeFees.asynchronous === 'number';

      if (!hasValidKeys) {
        return res.status(400).json({
          success: false,
          message: "visitTypeFees must include numeric 'synchronous' and 'asynchronous' values",
        });
      }

      if (visitTypeFees.synchronous < 0 || visitTypeFees.asynchronous < 0) {
        return res.status(400).json({
          success: false,
          message: 'visitTypeFees must be non-negative',
        });
      }
    }

    await company.update({
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(apiUrl !== undefined && { apiUrl }),
      ...(dashboardUrl !== undefined && { dashboardUrl }),
      ...(documentationUrl !== undefined && { documentationUrl }),
      ...(visitTypeFees !== undefined && { visitTypeFees }),
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

// GET /medical-companies/doctor/:doctorUserId/pharmacies
// Returns all pharmacies with effective approval status for a doctor:
// - Inherits from MedicalCompanyPharmacy (company-level approval)
// - Can be overridden by DoctorPharmacy (doctor-level override per pharmacy)
router.get('/doctor/:doctorUserId/pharmacies', async (req: Request, res: Response) => {
  try {
    const doctor = await User.findByPk(req.params.doctorUserId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const medicalCompanyId = doctor.medicalCompanyId;

    // Get all pharmacies
    const pharmacies = await Pharmacy.findAll({ order: [['name', 'ASC']] });

    // Get company-level approvals (if doctor has a medical company)
    let companyApprovalMap = new Map<string, 'pending' | 'approved' | 'rejected'>();
    if (medicalCompanyId) {
      const companyApprovals = await MedicalCompanyPharmacy.findAll({
        where: { medicalCompanyId },
      });
      for (const ca of companyApprovals) {
        companyApprovalMap.set(ca.pharmacyId, ca.doctorCompanyApprovedByPharmacy);
      }
    }

    // Get doctor-level overrides (per pharmacy)
    const doctorOverrides = await DoctorPharmacy.findAll({
      where: { doctorUserId: req.params.doctorUserId },
    });
    const doctorOverrideMap = new Map(
      doctorOverrides.map(d => [d.pharmacyId, d])
    );

    // Build the result: each pharmacy gets an effective status
    const result = pharmacies.map(pharmacy => {
      const companyStatus = companyApprovalMap.get(pharmacy.id) || null;
      const doctorOverride = doctorOverrideMap.get(pharmacy.id);
      const hasOverride = !!doctorOverride;
      const effectiveStatus = hasOverride
        ? doctorOverride.doctorApprovedByPharmacy
        : companyStatus || 'pending';

      return {
        id: pharmacy.id,
        name: pharmacy.name,
        slug: pharmacy.slug,
        isActive: pharmacy.isActive,
        companyStatus,       // inherited from MedicalCompanyPharmacy
        doctorOverride: hasOverride ? doctorOverride.doctorApprovedByPharmacy : null,
        effectiveStatus,     // what actually applies
        hasOverride,
      };
    });

    res.json({ success: true, data: result, medicalCompanyId });
  } catch (error) {
    console.error('Error fetching doctor pharmacy approvals:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch doctor pharmacy approvals' });
  }
});

// PUT /medical-companies/doctor/:doctorUserId/pharmacies/:pharmacyId
// Create or update a DoctorPharmacy override for a specific pharmacy
router.put('/doctor/:doctorUserId/pharmacies/:pharmacyId', async (req: Request, res: Response) => {
  try {
    const { doctorApprovedByPharmacy } = req.body;

    // If value is 'inherit', delete the override so doctor inherits from company
    if (doctorApprovedByPharmacy === 'inherit') {
      await DoctorPharmacy.destroy({
        where: {
          doctorUserId: req.params.doctorUserId,
          pharmacyId: req.params.pharmacyId,
        },
      });
      return res.json({ success: true, message: 'Override removed, inheriting from company' });
    }

    if (!['pending', 'approved', 'rejected'].includes(doctorApprovedByPharmacy)) {
      return res.status(400).json({
        success: false,
        message: 'doctorApprovedByPharmacy must be pending, approved, rejected, or inherit',
      });
    }

    let override = await DoctorPharmacy.findOne({
      where: {
        doctorUserId: req.params.doctorUserId,
        pharmacyId: req.params.pharmacyId,
      },
    });

    if (override) {
      await override.update({ doctorApprovedByPharmacy });
    } else {
      override = await DoctorPharmacy.create({
        doctorUserId: req.params.doctorUserId,
        pharmacyId: req.params.pharmacyId,
        doctorApprovedByPharmacy,
      });
    }

    res.json({ success: true, data: override });
  } catch (error) {
    console.error('Error updating doctor pharmacy override:', error);
    res.status(500).json({ success: false, message: 'Failed to update doctor pharmacy override' });
  }
});

export default router;
