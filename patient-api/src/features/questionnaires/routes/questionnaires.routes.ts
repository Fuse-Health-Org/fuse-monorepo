import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as QuestionnairesController from '../controllers/questionnaires.controller';

const router = Router();

// Protected routes
router.get('/questionnaires/standardized', authenticateJWT, QuestionnairesController.getStandardized);
router.get('/global-form-structures', authenticateJWT, QuestionnairesController.getGlobalFormStructures);
router.post('/global-form-structures', authenticateJWT, QuestionnairesController.createGlobalFormStructure);
router.post('/questionnaires/clone-doctor-from-master', authenticateJWT, QuestionnairesController.cloneDoctorFromMaster);
router.get('/questionnaires/templates', authenticateJWT, QuestionnairesController.getTemplates);
router.post('/questionnaires/templates', authenticateJWT, QuestionnairesController.createTemplate);
router.get('/questionnaires/templates/:id', authenticateJWT, QuestionnairesController.getTemplate);
router.put('/questionnaires/templates/:id', authenticateJWT, QuestionnairesController.updateTemplate);
router.get('/questionnaires', authenticateJWT, QuestionnairesController.listQuestionnaires);

// Tenant Product Forms
router.post('/admin/tenant-product-forms', authenticateJWT, QuestionnairesController.createTenantProductForm);
router.get('/admin/tenant-product-forms', authenticateJWT, QuestionnairesController.getTenantProductForms);
router.delete('/admin/tenant-product-forms', authenticateJWT, QuestionnairesController.deleteTenantProductForm);

export default router;

