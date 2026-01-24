import { Op } from 'sequelize';
import SupportTicket, { TicketStatus } from '../models/SupportTicket';
import TicketMessage, { MessageSender } from '../models/TicketMessage';

/**
 * Service that checks for resolved tickets that haven't been responded to by the patient
 * for 3 days and automatically closes them
 * 
 * Cron schedule is managed by cronJobs/index.ts
 */
export default class SupportTicketAutoCloseService {
  /**
   * Check for resolved tickets that should be auto-closed
   * Called by cron job registry
   */
  async checkAndCloseResolvedTickets(): Promise<void> {

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
      throw error; // Re-throw so cron registry can log it
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

