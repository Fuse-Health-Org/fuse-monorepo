import { CronJobDefinition } from './index';

/**
 * Support Ticket Auto-Close Cron Job
 * 
 * Checks for resolved tickets that haven't been responded to by the patient
 * for 3 days and automatically closes them.
 */

let serviceInstance: any = null;

async function getService() {
    if (!serviceInstance) {
        const SupportTicketAutoCloseService = (
            await import('../services/supportTicketAutoClose.service')
        ).default;
        serviceInstance = new SupportTicketAutoCloseService();
    }
    return serviceInstance;
}

const ticketAutoCloseJob: CronJobDefinition = {
    name: 'ticket-auto-close',
    schedule: '0 2 * * *',  // Every day at 2:00 AM
    description: 'Auto-close resolved support tickets after 3 days of inactivity',
    handler: async () => {
        const service = await getService();
        await service.checkAndCloseResolvedTickets();
    },
    runOnStartup: true,
    startupDelay: 10000,
};

export default ticketAutoCloseJob;
