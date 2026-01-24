import { CronJobDefinition } from './index';

/**
 * IronSail Retry Cron Job
 * 
 * Retries stuck IronSail pharmacy orders that have been in retry state
 * for more than 30 minutes. Processes up to 50 orders per run, oldest first.
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
    description: 'Retry stuck IronSail pharmacy orders (older than 30 minutes)',
    handler: async () => {
        const worker = await getWorker();
        await worker.processStuckOrders();
    },
    runOnStartup: true,
    startupDelay: 15000,
};

export default ironSailRetryJob;
