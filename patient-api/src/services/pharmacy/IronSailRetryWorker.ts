import IronSailRetryService from './ironsail-retry.service';

/**
 * Service that retries stuck IronSail orders
 * Processes all orders in retry_pending status immediately
 * 
 * Cron schedule is managed by cronJobs/index.ts
 */
export default class IronSailRetryWorker {
    /**
     * Process stuck orders with retry logic
     * Called by cron job registry
     */
    async processStuckOrders(): Promise<void> {
        console.log('[IronSail Retry Worker] 🔄 Starting stuck order retry check...');

        try {
            // Retry all pending orders immediately (no age requirement for testing)
            // Process up to 50 orders, oldest first
            const result = await IronSailRetryService.retryStuckOrders(0, 50);

            if (result.total > 0) {
                console.log('[IronSail Retry Worker] 📊 Retry summary:', {
                    total: result.total,
                    succeeded: result.succeeded,
                    stillRetrying: result.stillRetrying,
                    failed: result.failed,
                });
            } else {
                console.log('[IronSail Retry Worker] ✅ No stuck orders found');
            }
        } catch (error) {
            console.error('[IronSail Retry Worker] ❌ Error processing stuck orders:', error);
            throw error; // Re-throw so cron registry can log it
        }
    }

    /**
     * Manually trigger retry processing (for admin/testing)
     */
    async manualRun(): Promise<{
        total: number;
        succeeded: number;
        failed: number;
        stillRetrying: number;
    }> {
        return await IronSailRetryService.retryStuckOrders(0, 50);
    }
}
