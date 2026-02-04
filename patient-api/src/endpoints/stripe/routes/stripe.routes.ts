import { Router } from "express";
import { createStripeConnectAccountLink, createStripeConnectSession, getStripeConnectStatus } from "../controllers/stripe.controller";
import { authenticateJWT } from "@/config/jwt";

const router = Router();

// Stripe Connect
router.post("/stripe/connect/session",authenticateJWT, createStripeConnectSession);
router.get("/stripe/connect/status", authenticateJWT, getStripeConnectStatus);
router.post("/stripe/connect/account-link", authenticateJWT, createStripeConnectAccountLink);

export default router;