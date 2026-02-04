import { Router } from 'express';
import express from 'express';
import * as WebhooksController from '../controllers/webhooks.controller';

const router = Router();

// Email unsubscribe
router.get('/unsubscribe/:runId', WebhooksController.unsubscribeEmail);

// Twilio webhook (needs urlencoded parser)
router.post('/webhooks/twilio', 
  express.urlencoded({ extended: false }), 
  WebhooksController.twilioWebhook
);

// SendGrid webhook
router.post('/webhooks/sendgrid', WebhooksController.sendgridWebhook);

export default router;

