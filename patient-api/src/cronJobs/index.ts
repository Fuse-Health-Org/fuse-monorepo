import cron, { ScheduledTask } from 'node-cron';

/**
 * Centralized Cron Job Registry
 * 
 * This file handles registration and lifecycle of all cron jobs.
 * Individual job definitions are in separate files (*.cron.ts).
 * 
 * Cron Format: second minute hour day month weekday
 * 
 * Examples:
 *   '0 9 * * *'      - Every day at 9:00 AM
 *   '0 2 * * *'      - Every day at 2:00 AM
 *   '0 0 *​/2 * * *'  - Every 2 hours (at minute 0)
 *   '0 0 * * 0'      - Every Sunday at midnight
 */

export interface CronJobDefinition {
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
        // Import all cron job definitions from separate files
        const prescriptionExpirationJob = (await import('./prescription-expiration.cron')).default;
        const ticketAutoCloseJob = (await import('./ticket-auto-close.cron')).default;
        const ironSailRetryJob = (await import('./ironsail-retry.cron')).default;

        // Add all job definitions to the registry
        this.definitions = [
            prescriptionExpirationJob,
            ticketAutoCloseJob,
            ironSailRetryJob,
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
                } finally {
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
export { CronJobRegistry };
