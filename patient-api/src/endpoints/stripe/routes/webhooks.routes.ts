import { Router } from 'express';
import express from 'express';
import * as WebhooksController from '../controllers/webhooks.controller';

const router = Router();

// Stripe webhook
router.post('/webhook/stripe', express.raw({ type: "application/json" }), WebhooksController.stripeWebhook);

export default router;