import { CronJobDefinition } from './index';

/**
 * Prescription Expiration Cron Job
 * 
 * Checks for expired prescriptions daily and triggers sequences
 * for the prescription_expired event.
 */

let workerInstance: any = null;

async function getWorker() {
    if (!workerInstance) {
        const PrescriptionExpirationWorker = (
            await import('../services/sequence/PrescriptionExpirationWorker')
        ).default;
        workerInstance = new PrescriptionExpirationWorker();
    }
    return workerInstance;
}

const prescriptionExpirationJob: CronJobDefinition = {
    name: 'prescription-expiration',
    schedule: '0 9 * * *',  // Every day at 9:00 AM
    description: 'Check for expired prescriptions and trigger sequences',
    handler: async () => {
        const worker = await getWorker();
        await worker.checkExpiredPrescriptions();
    },
    runOnStartup: true,
    startupDelay: 10000,
};

export default prescriptionExpirationJob;
