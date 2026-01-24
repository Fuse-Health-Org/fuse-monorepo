import cron, { ScheduledTask } from 'node-cron';
import IronSailRetryService from './ironsail-retry.service';

/**
 * Worker that retries stuck IronSail orders
 * Runs every 2 hours and processes orders that have been stuck in retry state
 * for more than 30 minutes
 */
export default class IronSailRetryWorker {
    private isRunning = false;
    private cronJob: ScheduledTask | null = null;

    /**
     * Start the cron job to retry stuck orders
     * Runs every 2 hours
     */
    start() {
        if (this.cronJob) {
            console.log('⚠️ IronSailRetryWorker already started');
            return;
        }

        // Schedule: Every 2 hours
        // Format: second minute hour day month weekday
        // At minute 0, every 2nd hour
        this.cronJob = cron.schedule('0 */2 * * *', async () => {
            await this.processStuckOrders();
        });

        console.log('✅ IronSailRetryWorker started (runs every 2 hours)');

        // Run immediately on startup (for development) after a short delay
        if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Running initial IronSail retry check in 15 seconds (development mode)...');
            setTimeout(() => {
                this.processStuckOrders().catch(err => {
                    console.error('❌ Initial IronSail retry check failed:', err);
                });
            }, 15000);
        }
    }

    /**
     * Stop the cron job
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('🛑 IronSailRetryWorker stopped');
        }
    }

    /**
     * Process stuck orders with retry logic
     */
    async processStuckOrders(): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️ IronSail retry worker already running, skipping...');
            return;
        }

        this.isRunning = true;
        console.log('[IronSail Retry Worker] 🔄 Starting stuck order retry check...');

        try {
            // Retry orders that have been stuck for more than 30 minutes
            // Process up to 50 orders, oldest first
            const result = await IronSailRetryService.retryStuckOrders(30, 50);

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
        } finally {
            this.isRunning = false;
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
        if (this.isRunning) {
            return {
                total: 0,
                succeeded: 0,
                failed: 0,
                stillRetrying: 0,
            };
        }

        this.isRunning = true;
        try {
            return await IronSailRetryService.retryStuckOrders(30, 50);
        } finally {
            this.isRunning = false;
        }
    }
}
