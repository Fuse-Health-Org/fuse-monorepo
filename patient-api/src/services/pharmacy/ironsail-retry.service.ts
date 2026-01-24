import Order from '../../models/Order';
import ShippingOrder, { OrderShippingStatus } from '../../models/ShippingOrder';
import IronSailApiOrderService from './ironsail-api-order.service';

// Exponential backoff intervals in milliseconds
// 30s -> 60s -> 2m -> 4m -> 8m -> 16m
const RETRY_INTERVALS_MS = [
    30 * 1000,      // 30 seconds
    60 * 1000,      // 1 minute
    2 * 60 * 1000,  // 2 minutes
    4 * 60 * 1000,  // 4 minutes
    8 * 60 * 1000,  // 8 minutes
    16 * 60 * 1000, // 16 minutes (max)
];

const MAX_RETRIES = RETRY_INTERVALS_MS.length;

interface RetryResult {
    success: boolean;
    shouldRetry: boolean;
    error?: string;
    nextRetryAt?: Date;
    retryCount?: number;
}

class IronSailRetryService {
    private retryTimers: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Calculate the next retry delay based on retry count
     */
    private getRetryDelay(retryCount: number): number {
        const index = Math.min(retryCount, RETRY_INTERVALS_MS.length - 1);
        return RETRY_INTERVALS_MS[index];
    }

    /**
     * Check if error is retryable (429, 5xx, network errors)
     */
    private isRetryableError(error: string): boolean {
        const retryablePatterns = [
            '429',           // Rate limited
            '500',           // Internal server error
            '502',           // Bad gateway
            '503',           // Service unavailable
            '504',           // Gateway timeout
            'ECONNREFUSED',  // Connection refused
            'ETIMEDOUT',     // Timeout
            'ENOTFOUND',     // DNS lookup failed
            'network',       // Generic network error
            'timeout',       // Generic timeout
        ];

        const lowerError = error.toLowerCase();
        return retryablePatterns.some(pattern => lowerError.includes(pattern.toLowerCase()));
    }

    /**
     * Create a ShippingOrder record for tracking retry state
     * Called when the initial IronSail order submission fails
     */
    async createRetryRecord(
        order: Order,
        error: string
    ): Promise<ShippingOrder> {
        const isRetryable = this.isRetryableError(error);
        const nextRetryDelay = this.getRetryDelay(0);
        const nextRetryAt = isRetryable ? new Date(Date.now() + nextRetryDelay) : null;

        const shippingOrder = await ShippingOrder.create({
            orderId: order.id,
            shippingAddressId: order.shippingAddressId,
            status: isRetryable ? OrderShippingStatus.RETRY_PENDING : OrderShippingStatus.FAILED,
            pharmacyOrderId: `PENDING-${order.orderNumber}`,
            retryCount: 0,
            lastRetryAt: new Date(),
            nextRetryAt: nextRetryAt,
            retryError: error.substring(0, 65535), // TEXT field limit
        });

        console.log(`[IronSail Retry] Created retry record for order ${order.orderNumber}`, {
            isRetryable,
            status: shippingOrder.status,
            nextRetryAt: nextRetryAt?.toISOString(),
        });

        // Schedule the next retry if retryable
        if (isRetryable && nextRetryAt) {
            this.scheduleRetry(shippingOrder.id, order.id, nextRetryDelay);
        }

        return shippingOrder;
    }

    /**
     * Schedule a retry for a specific shipping order
     */
    private scheduleRetry(shippingOrderId: string, orderId: string, delayMs: number): void {
        // Clear any existing timer for this order
        const existingTimer = this.retryTimers.get(shippingOrderId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        console.log(`[IronSail Retry] Scheduling retry in ${delayMs / 1000}s for shipping order ${shippingOrderId}`);

        const timer = setTimeout(async () => {
            this.retryTimers.delete(shippingOrderId);
            await this.executeRetry(shippingOrderId, orderId);
        }, delayMs);

        this.retryTimers.set(shippingOrderId, timer);
    }

    /**
     * Execute a retry attempt for a shipping order
     */
    async executeRetry(shippingOrderId: string, orderId: string): Promise<RetryResult> {
        const shippingOrder = await ShippingOrder.findByPk(shippingOrderId);
        if (!shippingOrder) {
            console.error(`[IronSail Retry] Shipping order ${shippingOrderId} not found`);
            return { success: false, shouldRetry: false, error: 'Shipping order not found' };
        }

        // Don't retry if status is no longer RETRY_PENDING
        if (shippingOrder.status !== OrderShippingStatus.RETRY_PENDING) {
            console.log(`[IronSail Retry] Skipping retry - status is ${shippingOrder.status}`);
            return { success: false, shouldRetry: false, error: 'Order is no longer in retry state' };
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            console.error(`[IronSail Retry] Order ${orderId} not found`);
            await shippingOrder.update({
                status: OrderShippingStatus.FAILED,
                retryError: 'Order not found',
            });
            return { success: false, shouldRetry: false, error: 'Order not found' };
        }

        console.log(`[IronSail Retry] Executing retry #${shippingOrder.retryCount + 1} for order ${order.orderNumber}`);

        // Attempt to create the IronSail order
        const result = await IronSailApiOrderService.createOrder(order);

        if (result.success) {
            // Success! Update the shipping order
            await shippingOrder.update({
                status: OrderShippingStatus.PROCESSING,
                pharmacyOrderId: result.data?.pharmacyOrderId || `IRONSAIL-${result.data?.ironSailOrderUuid}`,
                retryError: null,
                nextRetryAt: null,
            });

            console.log(`[IronSail Retry] ✅ Order ${order.orderNumber} successfully submitted on retry #${shippingOrder.retryCount + 1}`);
            return { success: true, shouldRetry: false };
        }

        // Failed - check if we should retry again
        const newRetryCount = shippingOrder.retryCount + 1;
        const shouldRetry = this.isRetryableError(result.error || '') && newRetryCount < MAX_RETRIES;
        const nextRetryDelay = shouldRetry ? this.getRetryDelay(newRetryCount) : 0;
        const nextRetryAt = shouldRetry ? new Date(Date.now() + nextRetryDelay) : null;

        await shippingOrder.update({
            status: shouldRetry ? OrderShippingStatus.RETRY_PENDING : OrderShippingStatus.FAILED,
            retryCount: newRetryCount,
            lastRetryAt: new Date(),
            nextRetryAt: nextRetryAt,
            retryError: result.error?.substring(0, 65535),
        });

        console.log(`[IronSail Retry] ❌ Order ${order.orderNumber} retry #${newRetryCount} failed`, {
            error: result.error,
            shouldRetry,
            nextRetryAt: nextRetryAt?.toISOString(),
            maxRetries: MAX_RETRIES,
        });

        // Schedule the next retry if applicable
        if (shouldRetry && nextRetryAt) {
            this.scheduleRetry(shippingOrderId, orderId, nextRetryDelay);
        }

        return {
            success: false,
            shouldRetry,
            error: result.error,
            nextRetryAt: nextRetryAt || undefined,
            retryCount: newRetryCount,
        };
    }

    /**
     * Submit order to IronSail with automatic retry on failure
     * This is the main entry point to replace direct IronSailApiOrderService.createOrder calls
     */
    async submitOrderWithRetry(order: Order): Promise<{ success: boolean; data?: any; error?: string }> {
        console.log(`[IronSail Retry] Submitting order ${order.orderNumber} to IronSail`);

        // First attempt
        const result = await IronSailApiOrderService.createOrder(order);

        if (result.success) {
            console.log(`[IronSail Retry] ✅ Order ${order.orderNumber} submitted successfully on first attempt`);
            return result;
        }

        // First attempt failed - create a retry record if error is retryable
        console.log(`[IronSail Retry] ❌ Order ${order.orderNumber} first attempt failed: ${result.error}`);

        if (this.isRetryableError(result.error || '')) {
            await this.createRetryRecord(order, result.error || 'Unknown error');
            return {
                success: false,
                error: `Order submission failed, scheduled for retry: ${result.error}`,
            };
        }

        // Non-retryable error - create a failed record
        await ShippingOrder.create({
            orderId: order.id,
            shippingAddressId: order.shippingAddressId,
            status: OrderShippingStatus.FAILED,
            pharmacyOrderId: `FAILED-${order.orderNumber}`,
            retryCount: 0,
            lastRetryAt: new Date(),
            retryError: result.error?.substring(0, 65535),
        });

        return result;
    }

    /**
     * Get orders that are stuck in retry state (for cron job)
     * Returns orders older than minAgeMinutes that haven't been retried recently
     */
    async getStuckRetryOrders(minAgeMinutes: number = 30, limit: number = 50): Promise<ShippingOrder[]> {
        const minAge = new Date(Date.now() - minAgeMinutes * 60 * 1000);

        const stuckOrders = await ShippingOrder.findAll({
            where: {
                status: OrderShippingStatus.RETRY_PENDING,
                lastRetryAt: {
                    [require('sequelize').Op.lt]: minAge,
                },
            },
            order: [['lastRetryAt', 'ASC']], // Oldest first
            limit,
        });

        return stuckOrders;
    }

    /**
     * Retry stuck orders (called by cron job)
     */
    async retryStuckOrders(minAgeMinutes: number = 30, limit: number = 50): Promise<{
        total: number;
        succeeded: number;
        failed: number;
        stillRetrying: number;
    }> {
        const stuckOrders = await this.getStuckRetryOrders(minAgeMinutes, limit);

        console.log(`[IronSail Retry Cron] Found ${stuckOrders.length} stuck orders to retry`);

        let succeeded = 0;
        let failed = 0;
        let stillRetrying = 0;

        for (const shippingOrder of stuckOrders) {
            try {
                const result = await this.executeRetry(shippingOrder.id, shippingOrder.orderId);

                if (result.success) {
                    succeeded++;
                } else if (result.shouldRetry) {
                    stillRetrying++;
                } else {
                    failed++;
                }

                // Small delay between retries to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`[IronSail Retry Cron] Error retrying order ${shippingOrder.id}:`, error);
                failed++;
            }
        }

        console.log(`[IronSail Retry Cron] Completed: ${succeeded} succeeded, ${stillRetrying} still retrying, ${failed} failed`);

        return {
            total: stuckOrders.length,
            succeeded,
            failed,
            stillRetrying,
        };
    }

    /**
     * Manual retry for a specific order (for admin use)
     */
    async manualRetry(shippingOrderId: string): Promise<RetryResult> {
        const shippingOrder = await ShippingOrder.findByPk(shippingOrderId);
        if (!shippingOrder) {
            return { success: false, shouldRetry: false, error: 'Shipping order not found' };
        }

        // Allow manual retry even if not in RETRY_PENDING state (for FAILED orders)
        if (shippingOrder.status !== OrderShippingStatus.RETRY_PENDING &&
            shippingOrder.status !== OrderShippingStatus.FAILED) {
            return { success: false, shouldRetry: false, error: `Cannot retry order with status: ${shippingOrder.status}` };
        }

        // Reset to RETRY_PENDING state for manual retry
        await shippingOrder.update({
            status: OrderShippingStatus.RETRY_PENDING,
            retryCount: 0, // Reset retry count for manual retry
        });

        return this.executeRetry(shippingOrderId, shippingOrder.orderId);
    }
}

export default new IronSailRetryService();
