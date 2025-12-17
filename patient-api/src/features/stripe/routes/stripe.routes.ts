import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as StripeController from '../controllers/stripe.controller';

const router = Router();

// Protected routes
router.post('/stripe/connect/session', authenticateJWT, StripeController.createConnectSession);
router.get('/stripe/connect/status', authenticateJWT, StripeController.getConnectStatus);
router.post('/stripe/connect/account-link', authenticateJWT, StripeController.createAccountLink);

export default router;

