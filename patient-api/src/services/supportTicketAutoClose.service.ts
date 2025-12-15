import cron, { ScheduledTask } from 'node-cron';
import { Op } from 'sequelize';
import SupportTicket, { TicketStatus } from '../models/SupportTicket';
import TicketMessage, { MessageSender } from '../models/TicketMessage';

/**
 * Worker that checks for resolved tickets that haven't been responded to by the patient
 * for 3 days and automatically closes them
 */
export default class SupportTicketAutoCloseService {
  private isRunning = false;
  private cronJob: ScheduledTask | null = null;

  /**
   * Start the cron job to check for tickets to auto-close
   * Runs every day at 2:00 AM
   */
  start() {
    if (this.cronJob) {
      console.log('⚠️ SupportTicketAutoCloseService already started');
      return;
    }

    // Schedule: Every day at 2:00 AM
    // Format: second minute hour day month weekday
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      await this.checkAndCloseResolvedTickets();
    });

    console.log('✅ SupportTicketAutoCloseService started (runs daily at 2:00 AM)');
    
    // Run immediately on startup (for testing/development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Running initial ticket auto-close check (development mode)...');
      // Run after 10 seconds to allow app to fully initialize
      setTimeout(() => {
        this.checkAndCloseResolvedTickets().catch(err => {
          console.error('❌ Initial ticket auto-close check failed:', err);
        });
      }, 10000);
    }
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('🛑 SupportTicketAutoCloseService stopped');
    }
  }

  /**
   * Check for resolved tickets that should be auto-closed
   */
  async checkAndCloseResolvedTickets(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Ticket auto-close check already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      console.log('🔍 Checking for resolved tickets to auto-close...');

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0); // Start of day

      // Find tickets that are resolved and were resolved at least 3 days ago
      const resolvedTickets = await SupportTicket.findAll({
        where: {
          status: TicketStatus.RESOLVED,
          resolvedAt: {
            [Op.lte]: threeDaysAgo
          }
        },
      });

      if (resolvedTickets.length === 0) {
        console.log('✅ No resolved tickets found that need to be auto-closed');
        return;
      }

      console.log(`📋 Found ${resolvedTickets.length} resolved ticket(s) to check`);

      let closedCount = 0;

      for (const ticket of resolvedTickets) {
        try {
          if (!ticket.resolvedAt) {
            console.log(`⚠️ Skipping ticket ${ticket.id} - no resolvedAt date`);
            continue;
          }

          // Check if patient has responded AFTER the ticket was resolved
          const patientResponseAfterResolution = await TicketMessage.findOne({
            where: {
              ticketId: ticket.id,
              senderType: MessageSender.USER,
              createdAt: {
                [Op.gt]: ticket.resolvedAt // Messages created after resolution
              }
            }
          });

          if (patientResponseAfterResolution) {
            console.log(`ℹ️ Skipping ticket ${ticket.id} - patient has responded after resolution`);
            continue;
          }

          // Patient hasn't responded after resolution, close the ticket
          ticket.status = TicketStatus.CLOSED;
          ticket.closedAt = new Date();
          await ticket.save();

          closedCount++;
          console.log(`✅ Auto-closed ticket ${ticket.id} (title: "${ticket.title}") - no patient response for 3+ days after resolution`);
        } catch (error) {
          console.error(`❌ Error processing ticket ${ticket.id}:`, error);
        }
      }

      console.log(
        `✅ Ticket auto-close check complete: ${closedCount} ticket(s) closed out of ${resolvedTickets.length} checked`
      );
    } catch (error) {
      console.error('❌ Error checking resolved tickets:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger a check (for testing or manual execution)
   */
  async triggerManualCheck(): Promise<void> {
    console.log('🔧 Manual ticket auto-close check triggered');
    await this.checkAndCloseResolvedTickets();
  }
}

