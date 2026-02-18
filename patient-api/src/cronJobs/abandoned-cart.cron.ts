import { CronJobDefinition } from './index';

/**
 * Abandoned Cart Detection Cron Job
 * 
 * Runs every hour to detect abandoned carts and trigger recovery sequences.
 * 
 * Detection Criteria:
 * - User started checkout flow (view event with contact info)
 * - Did not complete purchase (no conversion event)
 * - Cart abandoned for at least 1 hour
 * - No existing abandoned cart sequence triggered for this session
 * 
 * Schedule: Every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
 */

let serviceInstance: any = null;

async function getService() {
    if (!serviceInstance) {
        const { AbandonedCartTriggerService } = await import('../services/abandonedCartTrigger.service');
        serviceInstance = AbandonedCartTriggerService;
    }
    return serviceInstance;
}

const abandonedCartJob: CronJobDefinition = {
    name: 'abandoned-cart',
    schedule: '0 * * * *',  // Every hour at minute 0
    description: 'Check for abandoned carts and trigger recovery sequences',
    handler: async () => {
        console.log('[Cron] Starting abandoned cart processing...');
        
        const service = await getService();
        const result = await service.processAbandonedCarts(
            24,  // Look back 24 hours
            1    // Cart must be abandoned for at least 1 hour
        );
        
        console.log('[Cron] Abandoned cart processing complete:', result);
    },
    runOnStartup: false,  // Don't run immediately on startup
    startupDelay: 0,
};

export default abandonedCartJob;
