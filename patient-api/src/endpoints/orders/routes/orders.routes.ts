import { Router } from "express";
import { createPaymentIntent, getOrdersByClinicId, getOrdersById } from "../controllers/orders.controller";
import { authenticateJWT } from "@/config/jwt";

const router = Router();

router.post('/orders/create-payment-intent', authenticateJWT, createPaymentIntent);
router.get('/orders/:id', authenticateJWT, getOrdersById);
router.get('/orders/clinic/:clinicId', authenticateJWT, getOrdersByClinicId);

export default router;