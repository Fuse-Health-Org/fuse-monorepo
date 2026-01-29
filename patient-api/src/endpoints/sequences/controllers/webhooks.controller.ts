import { Request, Response } from 'express';
import SequenceRun from '../../../models/SequenceRun';
import Sequence from '../../../models/Sequence';
import User from '../../../models/User';
import { Op } from 'sequelize';
import { calculateSequenceAnalytics } from '../services/sequences.service';

/**
 * GET /unsubscribe/:runId
 * Email unsubscribe page - handles opt-out
 */
export const unsubscribeEmail = async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = await SequenceRun.findByPk(runId);

    if (!run) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Unsubscribe - Link Invalid</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 80px auto; padding: 40px 20px; text-align: center; }
              h1 { color: #ef4444; font-size: 28px; margin-bottom: 16px; }
              p { color: #6b7280; font-size: 16px; line-height: 1.6; }
            </style>
          </head>
          <body>
            <h1>❌ Invalid Link</h1>
            <p>This unsubscribe link is invalid or has expired. If you continue to receive unwanted emails, please contact our support team.</p>
          </body>
        </html>
      `);
    }

    // Extract email from payload
    const payload = run.payload as any;
    const userDetails = payload?.userDetails ?? {};
    const email = userDetails.email || '';

    if (!email) {
      console.warn(`⚠️ No email found in run ${runId} for unsubscribe`);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Unsubscribe - Error</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 80px auto; padding: 40px 20px; text-align: center; }
              h1 { color: #ef4444; font-size: 28px; margin-bottom: 16px; }
              p { color: #6b7280; font-size: 16px; line-height: 1.6; }
            </style>
          </head>
          <body>
            <h1>❌ Error</h1>
            <p>Unable to process your unsubscribe request. Please contact our support team.</p>
          </body>
        </html>
      `);
    }

    // Find user by email and update opt-out status
    const user = await User.findOne({ where: { email } });
    
    if (user && !user.emailOptedOut) {
      user.emailOptedOut = true;
      user.optOutDate = new Date();
      await user.save();
      console.log(`📧 User ${email} opted out from emails (run ${runId})`);
    }

    // Return success page
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Successfully Unsubscribed</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              max-width: 600px; 
              margin: 80px auto; 
              padding: 40px 20px; 
              text-align: center; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
            }
            .card {
              background: white;
              border-radius: 16px;
              padding: 48px 32px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            h1 { color: #10b981; font-size: 32px; margin-bottom: 16px; }
            p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 16px 0; }
            .email { font-weight: 600; color: #374151; }
            .footer { margin-top: 32px; font-size: 14px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✅ You've Been Unsubscribed</h1>
            <p>The email address <span class="email">${email}</span> has been successfully removed from our mailing list.</p>
            <p>You will no longer receive marketing emails from us.</p>
            <p class="footer">If this was a mistake, please contact our support team to resubscribe.</p>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error("❌ Error processing unsubscribe:", error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Unsubscribe - Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 80px auto; padding: 40px 20px; text-align: center; }
            h1 { color: #ef4444; font-size: 28px; margin-bottom: 16px; }
            p { color: #6b7280; font-size: 16px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <h1>❌ Something Went Wrong</h1>
          <p>We encountered an error while processing your request. Please try again later or contact our support team.</p>
        </body>
      </html>
    `);
  }
};

/**
 * POST /webhooks/twilio
 * Twilio webhook - processes incoming SMS (STOP/START commands)
 */
export const twilioWebhook = async (req: Request, res: Response) => {
  try {
    const { From, Body, To } = req.body;
    
    console.log(`📱 Twilio webhook received from ${From}: "${Body}"`);

    // Normalize phone number (remove +1, spaces, dashes, etc.)
    const normalizePhone = (phone: string) => {
      if (!phone) return '';
      return phone.replace(/[\s\-\(\)\+]/g, '').slice(-10); // Get last 10 digits
    };

    const fromPhone = normalizePhone(From);
    
    if (!fromPhone) {
      console.warn('⚠️ Twilio webhook: No valid phone number');
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // Check if message is an opt-out keyword
    const messageBody = (Body || '').trim().toUpperCase();
    const optOutKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
    const isOptOut = optOutKeywords.includes(messageBody);

    if (isOptOut) {
      console.log(`🚫 Processing SMS opt-out for phone: ${fromPhone}`);

      // Find user by phone number (check both with and without country code)
      const user = await User.findOne({
        where: {
          phoneNumber: {
            [Op.or]: [
              fromPhone,
              `+1${fromPhone}`,
              `1${fromPhone}`,
              fromPhone.replace(/^1/, ''), // Remove leading 1 if present
            ]
          }
        }
      });

      if (user && !user.smsOptedOut) {
        user.smsOptedOut = true;
        user.optOutDate = new Date();
        await user.save();
        
        console.log(`✅ User ${user.email} (${fromPhone}) opted out from SMS`);

        // Respond with confirmation message (TwiML)
        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You have been unsubscribed from SMS messages. You will not receive any more texts from us. Reply START to resubscribe.</Message>
</Response>`);
      } else if (user && user.smsOptedOut) {
        console.log(`ℹ️ User ${user.email} already opted out`);
        
        // Already opted out
        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You are already unsubscribed from our SMS messages.</Message>
</Response>`);
      } else {
        console.warn(`⚠️ No user found with phone ${fromPhone}`);
        
        // User not found - still confirm opt-out for compliance
        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You have been unsubscribed. You will not receive any more texts from this number.</Message>
</Response>`);
      }
    }

    // Check if message is a START (re-subscribe) keyword
    const resubKeywords = ['START', 'UNSTOP', 'YES'];
    const isResubscribe = resubKeywords.includes(messageBody);

    if (isResubscribe) {
      console.log(`✅ Processing SMS re-subscribe for phone: ${fromPhone}`);

      const user = await User.findOne({
        where: {
          phoneNumber: {
            [Op.or]: [
              fromPhone,
              `+1${fromPhone}`,
              `1${fromPhone}`,
              fromPhone.replace(/^1/, ''),
            ]
          }
        }
      });

      if (user && user.smsOptedOut) {
        user.smsOptedOut = false;
        user.optOutDate = undefined;
        await user.save();
        
        console.log(`✅ User ${user.email} (${fromPhone}) re-subscribed to SMS`);

        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You have been resubscribed to SMS messages. Reply STOP to unsubscribe at any time.</Message>
</Response>`);
      } else if (user && !user.smsOptedOut) {
        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You are already subscribed to our SMS messages.</Message>
</Response>`);
      }
    }

    // For any other message, just acknowledge receipt (no auto-reply)
    console.log(`ℹ️ Non-command SMS received from ${fromPhone}: "${Body}"`);
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

  } catch (error) {
    console.error("❌ Error processing Twilio webhook:", error);
    // Always return 200 to Twilio to prevent retries
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
};

/**
 * POST /webhooks/sendgrid
 * SendGrid webhook - processes email events (open, click, bounce, etc.)
 */
export const sendgridWebhook = async (req: Request, res: Response) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    console.log(`📨 Received ${events.length} SendGrid webhook events`);

    for (const event of events) {
      const { event: eventType, sg_message_id, email } = event;
      
      // Extract runId from custom args if available
      const runId = event.runId || event.run_id;
      
      if (!runId) {
        console.warn('⚠️ SendGrid event missing runId:', eventType);
        continue;
      }

      const run = await SequenceRun.findByPk(runId);
      
      if (!run) {
        console.warn(`⚠️ Run ${runId} not found for event ${eventType}`);
        continue;
      }

      let updated = false;

      // Handle different event types
      switch (eventType) {
        case 'open':
        case 'opened':
          if (run.emailsOpened === 0) {
            run.emailsOpened = 1;
            updated = true;
            console.log(`📧 Email opened via webhook for run ${runId}`);
          }
          break;

        case 'click':
          run.emailsClicked = (run.emailsClicked || 0) + 1;
          // Auto-increment opens if clicked (user must have opened to click)
          if (run.emailsOpened === 0) {
            run.emailsOpened = 1;
          }
          updated = true;
          console.log(`🖱️ Email clicked via webhook for run ${runId}`);
          break;

        case 'delivered':
          console.log(`✅ Email delivered for run ${runId}`);
          break;

        case 'bounce':
        case 'dropped':
          console.log(`❌ Email bounced/dropped for run ${runId}`);
          break;

        default:
          console.log(`ℹ️ Unhandled SendGrid event: ${eventType}`);
      }

      if (updated) {
        await run.save();

        // Update sequence analytics
        const sequence = await Sequence.findByPk(run.sequenceId);
        if (sequence) {
          const analytics = await calculateSequenceAnalytics(run.sequenceId);
          sequence.analytics = analytics;
          await sequence.save();
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Error processing SendGrid webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

