import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as OrdersController from '../controllers/orders.controller';

const router = Router();

// Protected routes
router.post('/orders/create-payment-intent', authenticateJWT, OrdersController.createPaymentIntent);
router.post('/confirm-payment', authenticateJWT, OrdersController.confirmPayment);
router.get('/orders', authenticateJWT, OrdersController.listOrders);
router.get('/orders/:id', authenticateJWT, OrdersController.getOrder);

export default router;

