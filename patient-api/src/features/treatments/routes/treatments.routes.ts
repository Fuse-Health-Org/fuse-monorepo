import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as TreatmentsController from '../controllers/treatments.controller';

const router = Router();

// Public routes
router.get('/treatments/by-clinic-slug/:slug', TreatmentsController.getTreatmentsByClinicSlug);
router.get('/treatments/:id', TreatmentsController.getTreatment);

// Protected routes
router.post('/treatments', authenticateJWT, TreatmentsController.createTreatment);
router.get('/getTreatments', authenticateJWT, TreatmentsController.getTreatments);
router.get('/getProductsByTreatment', authenticateJWT, TreatmentsController.getProductsByTreatment);

// Treatment Plans
router.post('/treatment-plans', authenticateJWT, TreatmentsController.createTreatmentPlan);
router.put('/treatment-plans', authenticateJWT, TreatmentsController.updateTreatmentPlan);
router.delete('/treatment-plans', authenticateJWT, TreatmentsController.deleteTreatmentPlan);

export default router;

