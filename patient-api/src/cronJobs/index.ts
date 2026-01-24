import cron, { ScheduledTask } from 'node-cron';

/**
 * Centralized Cron Job Registry
 * 
 * All cron job schedules are declared here for easy management.
 * The actual business logic lives in their respective service files.
 * 
 * Cron Format: second minute hour day month weekday
 * 
 * Examples:
 *   '0 9 * * *'     - Every day at 9:00 AM
 *   '0 2 * * *'     - Every day at 2:00 AM
 *   '0 *\/2 * * *'  - Every 2 hours
 *   '0 0 * * 0'     - Every Sunday at midnight
 */

interface CronJobDefinition {
    name: string;
    schedule: string;
    description: string;
    handler: () => Promise<void>;
    runOnStartup?: boolean; // Run immediately on startup (dev mode only)
    startupDelay?: number;  // Delay before startup run in ms (default: 10000)
}

class CronJobRegistry {
    private jobs: Map<string, ScheduledTask> = new Map();
    private runningJobs: Set<string> = new Set();
    private definitions: CronJobDefinition[] = [];

    /**
     * Register all cron jobs
     * Called once at application startup
     */
    async registerAll(): Promise<void> {
        // Import services lazily to avoid circular dependencies
        const PrescriptionExpirationWorker = (await import('../services/sequence/PrescriptionExpirationWorker')).default;
        const SupportTicketAutoCloseService = (await import('../services/supportTicketAutoClose.service')).default;
        const IronSailRetryWorker = (await import('../services/pharmacy/IronSailRetryWorker')).default;

        // Instantiate workers (they contain the business logic)
        const prescriptionWorker = new PrescriptionExpirationWorker();
        const ticketAutoCloseService = new SupportTicketAutoCloseService();
        const ironSailRetryWorker = new IronSailRetryWorker();

        // =============================================================================
        // CRON JOB DEFINITIONS
        // Add new cron jobs here with their schedules and handlers
        // =============================================================================

        this.definitions = [
            {
                name: 'prescription-expiration',
                schedule: '0 9 * * *',  // Every day at 9:00 AM
                description: 'Check for expired prescriptions and trigger sequences',
                handler: async () => {
                    await (prescriptionWorker as any).checkExpiredPrescriptions();
                },
                runOnStartup: true,
                startupDelay: 10000,
            },
            {
                name: 'ticket-auto-close',
                schedule: '0 2 * * *',  // Every day at 2:00 AM
                description: 'Auto-close resolved support tickets after 3 days of inactivity',
                handler: async () => {
                    await (ticketAutoCloseService as any).checkAndCloseResolvedTickets();
                },
                runOnStartup: true,
                startupDelay: 10000,
            },
            {
                name: 'ironsail-retry',
                schedule: '0 */2 * * *',  // Every 2 hours
                description: 'Retry stuck IronSail pharmacy orders (older than 30 minutes)',
                handler: async () => {
                    await (ironSailRetryWorker as any).processStuckOrders();
                },
                runOnStartup: true,
                startupDelay: 15000,
            },
        ];

        // Register and start all jobs
        for (const def of this.definitions) {
            this.registerJob(def);
        }

        console.log('');
        console.log('📅 ═══════════════════════════════════════════════════════');
        console.log('📅 CRON JOBS REGISTERED:');
        console.log('📅 ═══════════════════════════════════════════════════════');
        for (const def of this.definitions) {
            console.log(`📅   ${def.name.padEnd(25)} | ${def.schedule.padEnd(15)} | ${def.description}`);
        }
        console.log('📅 ═══════════════════════════════════════════════════════');
        console.log('');
    }

    /**
     * Register a single cron job
     */
    private registerJob(definition: CronJobDefinition): void {
        const { name, schedule, handler, runOnStartup, startupDelay } = definition;

        // Create the cron task with a wrapper that prevents overlapping runs
        const task = cron.schedule(schedule, async () => {
            if (this.runningJobs.has(name)) {
                console.log(`⚠️ [CRON] ${name} already running, skipping...`);
                return;
            }

            this.runningJobs.add(name);
            console.log(`🔄 [CRON] ${name} started`);

            try {
                await handler();
                console.log(`✅ [CRON] ${name} completed`);
            } catch (error) {
                console.error(`❌ [CRON] ${name} failed:`, error);
            } finally {
                this.runningJobs.delete(name);
            }
        });

        this.jobs.set(name, task);

        // Run on startup in development mode
        if (runOnStartup && process.env.NODE_ENV === 'development') {
            const delay = startupDelay || 10000;
            console.log(`🔍 [CRON] ${name} will run in ${delay / 1000}s (development mode)`);
            setTimeout(async () => {
                if (this.runningJobs.has(name)) {
                    console.log(`⚠️ [CRON] ${name} already running, skipping startup run...`);
                    return;
                }

                this.runningJobs.add(name);
                console.log(`🔄 [CRON] ${name} running (startup)`);

                try {
                    await handler();
                    console.log(`✅ [CRON] ${name} completed (startup)`);
                } catch (error) {
                    console.error(`❌ [CRON] ${name} failed (startup):`, error);
                }finally {
                    this.runningJobs.delete(name);
                }
            }, delay);
        }
    }

    /**
     * Stop all cron jobs
     */
    stopAll(): void {
        for (const [name, task] of this.jobs) {
            task.stop();
            console.log(`🛑 [CRON] ${name} stopped`);
        }
        this.jobs.clear();
    }

    /**
     * Stop a specific cron job by name
     */
    stop(name: string): void {
        const task = this.jobs.get(name);
        if (task) {
            task.stop();
            this.jobs.delete(name);
            console.log(`🛑 [CRON] ${name} stopped`);
        }
    }

    /**
     * Get list of registered job names
     */
    getJobNames(): string[] {
        return Array.from(this.jobs.keys());
    }

    /**
     * Get job definitions (for admin/monitoring)
     */
    getDefinitions(): CronJobDefinition[] {
        return this.definitions;
    }
}

// Export singleton instance
const cronJobRegistry = new CronJobRegistry();
export default cronJobRegistry;

// Also export the class for testing
export { CronJobRegistry, CronJobDefinition };
