import { CronJobDefinition } from './index';

/**
 * IronSail Retry Cron Job
 * 
 * Retries all IronSail pharmacy orders in retry_pending status.
 * Processes up to 50 orders per run, oldest first.
 */

let workerInstance: any = null;

async function getWorker() {
    if (!workerInstance) {
        const IronSailRetryWorker = (
            await import('../services/pharmacy/IronSailRetryWorker')
        ).default;
        workerInstance = new IronSailRetryWorker();
    }
    return workerInstance;
}

const ironSailRetryJob: CronJobDefinition = {
    name: 'ironsail-retry',
    schedule: '0 */2 * * *',  // Every 2 hours
    description: 'Retry all IronSail pharmacy orders in retry_pending status',
    handler: async () => {
        const worker = await getWorker();
        await worker.processStuckOrders();
    },
    runOnStartup: true,
    startupDelay: 15000,
};

export default ironSailRetryJob;
