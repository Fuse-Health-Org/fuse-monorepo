import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as AdminController from '../controllers/admin.controller';

const router = Router();

// Protected routes
router.get('/tenants', authenticateJWT, AdminController.listTenants);
router.get('/tenants/:id', authenticateJWT, AdminController.getTenant);
router.get('/admin/tenants', authenticateJWT, AdminController.listAllTenants);
router.get('/admin/patients/list', authenticateJWT, AdminController.listPatients);
router.post('/admin/impersonate', authenticateJWT, AdminController.impersonate);
router.post('/admin/exit-impersonation', authenticateJWT, AdminController.exitImpersonation);

// Users by clinic
router.get('/users/by-clinic/:clinicId', authenticateJWT, AdminController.getUsersByClinic);

export default router;

