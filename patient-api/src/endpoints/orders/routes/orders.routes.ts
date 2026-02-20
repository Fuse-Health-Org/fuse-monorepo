import { Router } from "express";
import { createPaymentIntent, getOrdersByClinicId, getOrdersById } from "../controllers/orders.controller";
import { authenticateJWT } from "@/config/jwt";

const router = Router();

/** @deprecated Not used by any frontend. Order creation goes through main.ts checkout flow. */
router.post('/orders/create-payment-intent', authenticateJWT, createPaymentIntent);
router.get('/orders/:id', authenticateJWT, getOrdersById);
router.get('/orders/by-clinic/:clinicId', authenticateJWT, getOrdersByClinicId);

export default router;