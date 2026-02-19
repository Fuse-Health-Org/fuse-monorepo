import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as ImpersonationController from '../controllers/impersonation.controller';

const router = Router();

router.post('/admin/impersonate', authenticateJWT, ImpersonationController.startImpersonation);
router.post('/admin/exit-impersonation', authenticateJWT, ImpersonationController.exitImpersonation);

export default router;
