import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as SubscriptionsController from '../controllers/subscriptions.controller';

const router = Router();

// Public routes
router.post('/payments/product/sub', SubscriptionsController.createProductSubscription);
router.post('/payments/treatment/sub', SubscriptionsController.createTreatmentSubscription);

// Protected routes
router.post('/payments/clinic/sub', authenticateJWT, SubscriptionsController.createClinicSubscription);
router.post('/subscriptions/upgrade', authenticateJWT, SubscriptionsController.upgradeSubscription);
router.post('/subscriptions/cancel', authenticateJWT, SubscriptionsController.cancelSubscription);

// Brand Subscriptions
router.get('/brand-subscriptions/plans', SubscriptionsController.getBrandPlans);
router.get('/brand-subscriptions/current', authenticateJWT, SubscriptionsController.getCurrentBrandSubscription);
router.put('/brand-subscriptions/features', authenticateJWT, SubscriptionsController.updateBrandFeatures);
router.post('/brand-subscriptions/cancel', authenticateJWT, SubscriptionsController.cancelBrandSubscription);
router.post('/brand-subscriptions/change', authenticateJWT, SubscriptionsController.changeBrandSubscription);
router.post('/confirm-payment-intent', authenticateJWT, SubscriptionsController.confirmPaymentIntent);

export default router;

