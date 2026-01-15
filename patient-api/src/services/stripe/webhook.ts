import Stripe from 'stripe';
import Payment from '../../models/Payment';
import Order, { OrderStatus } from '../../models/Order';
import { StripeService } from '@fuse/stripe';
import Subscription from '../../models/Subscription';
import Clinic, { PaymentStatus } from '../../models/Clinic';
import BrandSubscription, { BrandSubscriptionStatus } from '../../models/BrandSubscription';
import User from '../../models/User';
import BrandSubscriptionPlans from '../../models/BrandSubscriptionPlans';
import BrandSubscriptionService from '../brandSubscription.service';
import MDAuthService from '../mdIntegration/MDAuth.service';
import MDCaseService from '../mdIntegration/MDCase.service';
import Treatment from '../../models/Treatment';
import PharmacyService from '../pharmacy.service';
import TenantProduct from '../../models/TenantProduct';
import ShippingOrder from '../../models/ShippingOrder';
import Product from '../../models/Product';
import Sale from '../../models/Sale';
import StripeConnectService from './connect.service';
import Sequence from '../../models/Sequence';
import SequenceRun from '../../models/SequenceRun';
import SequenceTriggerService from '../sequence/SequenceTriggerService';

// Helper function to trigger checkout sequence
async function triggerCheckoutSequence(order: Order): Promise<void> {
    try {
        // Find active sequence with checkout trigger
        const activeSequences = await Sequence.findAll({
            where: {
                clinicId: order.clinicId,
                status: 'active',
                isActive: true
            }
        });

        const matchingSequence = activeSequences.find(sequence => {
            if (!sequence?.trigger || typeof sequence.trigger !== 'object') {
                return false;
            }
            const triggerData = sequence.trigger as Record<string, unknown>;
            const triggerEvent = (triggerData.event || triggerData.eventKey || triggerData.type) as string | undefined;
            return triggerEvent === 'checkout_completed';
        });

        if (!matchingSequence) {
            console.log('ℹ️ No active checkout sequence found for clinic:', order.clinicId);
            return;
        }

        // Get user details for the sequence
        const user = await User.findByPk(order.userId);

        // Build payload with user and order data
        const payload = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            userDetails: user ? {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber
            } : undefined,
            patientFirstName: user?.firstName,
            patientName: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
            totalAmount: order.totalAmount,
            orderDate: order.createdAt
        };

        // Create sequence run
        const sequenceRun = await SequenceRun.create({
            sequenceId: matchingSequence.id,
            clinicId: order.clinicId,
            triggerEvent: 'checkout_completed',
            status: 'pending',
            payload
        });

        console.log('🎯 Checkout sequence triggered:', {
            sequenceId: matchingSequence.id,
            sequenceName: matchingSequence.name,
            runId: sequenceRun.id,
            orderNumber: order.orderNumber
        });

        // Import the worker dynamically to avoid circular dependencies
        const { default: SequenceRunWorker } = await import('../sequence/SequenceRunWorker');
        const worker = new SequenceRunWorker();
        await worker.enqueueRun(sequenceRun.id);

    } catch (error) {
        console.error('❌ Error triggering checkout sequence:', error);
        // Don't fail the payment webhook if sequence fails
    }
}

export const handlePaymentIntentSucceeded = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
    console.log('💳 Payment succeeded:', paymentIntent.id);

    // Find payment record
    const payment = await Payment.findOne({
        where: { stripePaymentIntentId: paymentIntent.id },
        include: [
            { model: Order, as: 'order' },
            { model: BrandSubscription, as: 'brandSubscription' }
        ]
    });



    // Attach payment method to customer and set as default if customer exists
    if (paymentIntent.customer && paymentIntent.payment_method) {
        try {
            const stripeService = new StripeService();
            const customerId = typeof paymentIntent.customer === 'string'
                ? paymentIntent.customer
                : paymentIntent.customer.id;
            const paymentMethodId = typeof paymentIntent.payment_method === 'string'
                ? paymentIntent.payment_method
                : paymentIntent.payment_method.id;

            // Attach payment method to customer (if not already attached)
            try {
                await stripeService.attachPaymentMethodToCustomer(paymentMethodId, customerId);
                console.log('✅ Payment method attached to customer:', customerId);
            } catch (attachError: any) {
                // Ignore if already attached
                if (attachError.code !== 'resource_already_exists') {
                    throw attachError;
                }
                console.log('ℹ️ Payment method already attached to customer');
            }

            // Set as default payment method
            await stripeService.updateCustomerDefaultPaymentMethod(customerId, paymentMethodId);
            console.log('✅ Default payment method updated for customer:', customerId);
        } catch (error) {
            console.error('❌ Error attaching payment method to customer:', error);
            // Don't fail the whole webhook if this fails
        }
    }

    if (!payment) {
        console.log('⚠️ Payment intent not associated with any Payment record:', paymentIntent.id);
        return;
    }

    // Update payment status
    await payment.updateFromStripeEvent({ object: paymentIntent });

    // CASE 1: Treatment order payment
    if (payment.orderId && payment.order) {
        const previousStatus = payment.order.status;
        await payment.order.updateStatus(OrderStatus.PAID);
        console.log('✅ Order updated to paid status:', payment.order.orderNumber);

        // Only trigger checkout_completed sequence if this is the FIRST time payment succeeds
        // (not when capturing a previously authorized payment)
        const isManualCapture = previousStatus === OrderStatus.AMOUNT_CAPTURABLE_UPDATED;

        if (!isManualCapture) {
            // First time payment succeeds (immediate capture or automatic)
            await triggerCheckoutSequence(payment.order);
        } else {
            console.log('ℹ️ Skipping checkout sequence (manual capture from previously authorized payment)');
        }

        // Trigger protocol_start sequence for the order (only on manual capture)
        if (isManualCapture && payment.order.clinicId) {
            try {
                const sequenceTrigger = new SequenceTriggerService();
                const user = await User.findByPk(payment.order.userId);

                if (user) {
                    console.log('🎯 Triggering protocol_start for order:', payment.order.orderNumber);

                    // Build payload with user details (same as checkout_completed)
                    const payload = {
                        orderNumber: payment.order.orderNumber,
                        orderDate: payment.order.createdAt,
                        orderId: payment.order.id,
                        totalAmount: payment.order.totalAmount,
                        userDetails: {
                            firstName: user.firstName,
                            lastName: user.lastName,
                            email: user.email,
                            phoneNumber: user.phoneNumber
                        },
                        patientFirstName: user.firstName,
                        patientName: `${user.firstName} ${user.lastName}`.trim()
                    };

                    const triggeredCount = await sequenceTrigger.triggerSequencesForEvent(
                        'protocol_start',
                        user.id,
                        payment.order.clinicId,
                        payload
                    );

                    if (triggeredCount > 0) {
                        console.log(`✅ Protocol start triggered: ${triggeredCount} sequence(s) for order "${payment.order.orderNumber}"`);
                    } else {
                        console.log('ℹ️ No active sequences found for protocol_start trigger');
                    }
                }
            } catch (error) {
                console.error('❌ Error triggering protocol_start sequence:', error);
                // Don't fail the webhook if sequence trigger fails
            }
        }

        return;
    }

    // CASE 2: Brand subscription 
    if (payment.brandSubscriptionId) {
        console.log('🆕 Enable brand subscription from payment');

        const brandSubscriptionService = new BrandSubscriptionService();
        const result = await brandSubscriptionService.createFromPayment({
            paymentId: payment.id,
            brandSubscriptionId: payment.brandSubscriptionId
        });

        if (result.success) {
            console.log('✅ Brand subscription created via webhook:', result.data?.subscription.id);
        } else {
            console.error('❌ Failed to create brand subscription:', result.error);
        }
        return;
    }

    console.log('⚠️ Payment has no associated order or brand subscription metadata:', paymentIntent.id);
};

export const handlePaymentIntentFailed = async (failedPayment: Stripe.PaymentIntent): Promise<void> => {
    console.log('❌ Payment failed:', failedPayment.id);

    // Find payment record
    const failedPaymentRecord = await Payment.findOne({
        where: { stripePaymentIntentId: failedPayment.id },
        include: [
            { model: Order, as: 'order' },
            { model: BrandSubscription, as: 'brandSubscription' }
        ]
    });

    if (failedPaymentRecord) {
        // Update payment status
        await failedPaymentRecord.updateFromStripeEvent({ object: failedPayment });

        if (failedPaymentRecord.order) {
            // Update order status
            await failedPaymentRecord.order.updateStatus(OrderStatus.CANCELLED);
            console.log('❌ Order updated to cancelled status:', failedPaymentRecord.order.orderNumber);
        }
        if (failedPaymentRecord.brandSubscription) {
            // Update brand subscription status
            await failedPaymentRecord.brandSubscription.cancel();
            console.log('❌ Brand subscription updated to cancelled status:', failedPaymentRecord.brandSubscription.id);
        }
    }
};

export const handlePaymentIntentCanceled = async (cancelledPayment: Stripe.PaymentIntent): Promise<void> => {
    console.log('🚫 Payment cancelled:', cancelledPayment.id);

    // Find payment record
    const cancelledPaymentRecord = await Payment.findOne({
        where: { stripePaymentIntentId: cancelledPayment.id },
        include: [
            { model: Order, as: 'order' },
            { model: BrandSubscription, as: 'brandSubscription' }
        ]
    });

    if (cancelledPaymentRecord) {
        // Update payment status
        await cancelledPaymentRecord.updateFromStripeEvent({ object: cancelledPayment });

        if (cancelledPaymentRecord.order) {
            // Update order status
            await cancelledPaymentRecord.order.updateStatus(OrderStatus.CANCELLED);
            console.log('🚫 Order updated to cancelled status:', cancelledPaymentRecord.order.orderNumber);
        }

        if (cancelledPaymentRecord.brandSubscription) {
            // Update brand subscription status
            await cancelledPaymentRecord.brandSubscription.cancel();
            console.log('❌ Brand subscription updated to cancelled status:', cancelledPaymentRecord.brandSubscription.id);
        }
    }
};

export const handleChargeDisputeCreated = async (dispute: Stripe.Dispute): Promise<void> => {
    console.log('⚠️ Dispute created:', dispute.id);

    // Find payment by charge ID
    const disputedPayment = await Payment.findOne({
        where: { stripeChargeId: dispute.charge },
        include: [
            { model: Order, as: 'order' },
            { model: BrandSubscription, as: 'brandSubscription' }
        ]
    });

    if (disputedPayment && disputedPayment.order) {
        // Update order status to refunded (dispute handling)
        await disputedPayment.order.updateStatus(OrderStatus.REFUNDED);
        console.log('⚠️ Order marked as disputed:', disputedPayment.order.orderNumber);
    }
};

export const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
    console.log('🛒 Checkout session completed:', session.id);

    // Handle subscription checkout completion
    if (session.mode === 'subscription' && session.metadata) {
        const { orderId, clinicId, userId, planType } = session.metadata;
        const { subscription } = session;

        console.log(" subscription ", subscription)

        let createSub = false


        // Handle existing clinic/order subscriptions
        if (orderId) {
            const order = await Order.findByPk(orderId);
            if (order) {
                createSub = true
                console.log("Order found")
            }
        } else if (clinicId) {
            const clinic = await Clinic.findByPk(clinicId);
            if (clinic) {
                createSub = true
                console.log("Clinic found")
            }
        }

        if (createSub) {
            console.log("Creating sub")
            const sub = await Subscription.create({
                ...(orderId && { orderId: orderId }),
                ...(clinicId && { clinicId: clinicId }),
                stripeSubscriptionId: subscription as string
            })
            console.log('✅ Subscription created:', sub.id);
        }
    }
};

export const handleInvoicePaid = async (invoice: Stripe.Invoice): Promise<void> => {
    console.log('Invoice paid:', invoice.id);

    const subItem = invoice?.lines?.data[0]
    const subscriptionId = (subItem?.subscription || subItem?.parent?.subscription_item_details?.subscription) as string

    console.log('🔍 Invoice subscription ID from webhook:', subscriptionId);
    console.log('🔍 Invoice details:', {
        id: invoice.id,
        customer: invoice.customer,
        linesCount: invoice.lines?.data?.length
    });

    if (subscriptionId && typeof subscriptionId === 'string') {
        // Check for brand subscription first
        const brandSub = await BrandSubscription.findOne({
            where: {
                stripeSubscriptionId: subscriptionId
            }
        });

        console.log('🔍 Brand subscription found in DB:', brandSub ? {
            id: brandSub.id,
            stripeSubscriptionId: brandSub.stripeSubscriptionId,
            status: brandSub.status,
            userId: brandSub.userId
        } : 'None');

        if (brandSub) {
            // Handle brand subscription payment
            const stripeService = new StripeService();
            try {
                const stripeSubscription = await stripeService.getSubscription(subscriptionId);

                // Extract period dates safely  
                const subscription = stripeSubscription as any; // Type assertion for Stripe subscription
                const periodStart = subscription.current_period_start
                    ? new Date(subscription.current_period_start * 1000)
                    : new Date();
                const periodEnd = subscription.current_period_end
                    ? new Date(subscription.current_period_end * 1000)
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

                await brandSub.activate({
                    subscriptionId: subscriptionId,
                    customerId: subscription.customer as string,
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd
                });

                console.log('✅ Brand subscription activated:', brandSub.id);
            } catch (error) {
                console.error('Error activating brand subscription:', error);
                // Fallback activation without period data
                await brandSub.updateProcessing(subscriptionId);
            }
            return; // Exit early for brand subscriptions
        }

        // Handle existing clinic/order subscriptions
        const sub = await Subscription.findOne({
            where: {
                stripeSubscriptionId: subscriptionId
            }
        });

        console.log('🔍 Regular subscription found in DB:', sub ? {
            id: sub.id,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            status: sub.status,
            orderId: sub.orderId,
            clinicId: sub.clinicId
        } : 'None');

        if (sub) {
            await sub.markSubAsPaid();
            console.log('✅ Subscription updated to paid:', sub.id);

            if (sub.orderId) {
                const order = await Order.findByPk(sub.orderId, {
                    include: [
                        {
                            model: Treatment,
                            as: 'treatment',
                        },
                        {
                            model: TenantProduct,
                            as: 'tenantProduct',
                        },
                        {
                            model: ShippingOrder,
                            as: 'shippingOrders',
                        }
                    ]
                });
                if (order) {
                    await order.update({
                        status: PaymentStatus.PAID
                    })

                    await Sale.create({
                        orderId: order.id,
                        clinicId: order.clinicId,
                        salePrice: order.totalAmount
                    })
                    console.log("Sending new order ", order?.shippingOrders?.length)

                    // Order Renewal
                    const pharmacyService = new PharmacyService()
                    const pharmacyOrder = await pharmacyService.createPharmacyOrder(order)
                    console.log("Pharmacy order", pharmacyOrder)
                }
            }
            if (sub.clinicId) {
                const clinic = await Clinic.findByPk(sub.clinicId);
                if (clinic) {
                    await clinic.update({
                        isActive: true,
                        status: PaymentStatus.PAID
                    })
                }
            }
        }
    }
};

export const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice): Promise<void> => {
    console.log('❌ Invoice payment failed:', invoice.id);

    const subItem = invoice?.lines?.data[0]
    const subscriptionId = (subItem?.subscription || subItem?.parent?.subscription_item_details?.subscription) as string

    const stripeService = new StripeService();

    if (subscriptionId && typeof subscriptionId === 'string') {
        // Check for brand subscription first
        const brandSub = await BrandSubscription.findOne({
            where: {
                stripeSubscriptionId: subscriptionId
            }
        });

        if (brandSub) {
            if (brandSub.status === BrandSubscriptionStatus.CANCELLED) {
                console.warn('⚠️ Brand subscription has been cancelled', subscriptionId);
                return;
            }

            try {
                const subscriptionResponse = await stripeService.getSubscription(subscriptionId);
                const validUntil = new Date((subscriptionResponse as any).current_period_end * 1000);

                await brandSub.markPaymentDue(validUntil);
                console.log('⚠️ Brand subscription marked as payment due until:', validUntil.toISOString());
            } catch (error) {
                console.error('Error handling brand subscription payment failure:', error);
                await brandSub.markPastDue();
            }
            return; // Exit early for brand subscriptions
        }

        // Handle existing clinic/order subscriptions
        const sub = await Subscription.findOne({
            where: {
                stripeSubscriptionId: subscriptionId
            }
        });

        if (sub) {
            if (sub.orderId) {
                const order = await Order.findByPk(sub.orderId);
                if (order) {
                    await order.update({
                        status: OrderStatus.PAYMENT_DUE
                    })
                }
            }
            if (sub.clinicId) {
                const clinic = await Clinic.findByPk(sub.clinicId);
                if (clinic) {
                    await clinic.update({
                        status: PaymentStatus.PAYMENT_DUE
                    })
                }
            }

            if (sub.status == PaymentStatus.CANCELLED) {
                console.warn('⚠️ Subscription has been cancelled', subscriptionId);
                return
            }

            const subscriptionResponse = await stripeService.getSubscription(subscriptionId as string);
            const currentPeriodEnd = subscriptionResponse.items.data[0]

            if (currentPeriodEnd?.current_period_end) {
                const validUntil = new Date(currentPeriodEnd?.current_period_end * 1000);

                await sub.markSubAsPaymentDue(validUntil);
                console.log('⚠️ Subscription order marked as payment due until:', validUntil.toISOString());
            }
        } else {
            console.warn('⚠️ No subscription found for failed payment:', subscriptionId);
        }
    } else {
        console.warn('⚠️ No subscription ID found in failed invoice:', invoice.id);
    }
};

export const handleSubscriptionDeleted = async (subscription: Stripe.Subscription): Promise<void> => {
    console.log('Subscription Cancel:', subscription.id);

    const { id: subscriptionId } = subscription;

    // Check for brand subscription first
    const brandSub = await BrandSubscription.findOne({
        where: {
            stripeSubscriptionId: subscriptionId
        }
    });

    if (brandSub) {
        await brandSub.cancel();
        console.log('✅ Brand subscription canceled:', brandSub.id);
        return; // Exit early for brand subscriptions
    }

    // Handle existing clinic/order subscriptions
    const sub = await Subscription.findOne({
        where: {
            stripeSubscriptionId: subscriptionId
        }
    });

    if (sub) {
        await sub.markSubAsCanceled();
        console.log('✅ Subscription updated to canceled:', sub.id);

        if (sub.orderId) {
            const order = await Order.findByPk(sub.orderId);
            if (order) {
                await order.update({
                    status: OrderStatus.CANCELLED
                })
            }
        }

        if (sub.clinicId) {
            const clinic = await Clinic.findByPk(sub.clinicId);
            if (clinic) {
                await clinic.update({
                    isActive: false,
                    status: PaymentStatus.CANCELLED
                })
            }
        }
    }
};

export const handleSubscriptionCreated = async (subscription: Stripe.Subscription): Promise<void> => {
    console.log('📬 Subscription created event received:', subscription.id);

    const subscriptionData = subscription as any;
    const periodStart = subscriptionData?.current_period_start
        ? new Date(subscriptionData.current_period_start * 1000)
        : undefined;
    const periodEnd = subscriptionData?.current_period_end
        ? new Date(subscriptionData.current_period_end * 1000)
        : undefined;

    // First try to sync a brand subscription record
    const brandSub = await BrandSubscription.findOne({
        where: {
            stripeSubscriptionId: subscription.id
        }
    });

    if (brandSub) {
        const updates: any = {
            status: BrandSubscriptionStatus.ACTIVE,
        };

        if (periodStart) {
            updates.currentPeriodStart = periodStart;
        }

        if (periodEnd) {
            updates.currentPeriodEnd = periodEnd;
        }

        if (!brandSub.stripeCustomerId && subscription.customer) {
            updates.stripeCustomerId = typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer.id;
        }

        if (subscription.schedule) {
            const features = brandSub.features ? { ...brandSub.features } : {};
            const scheduleFeature = features.subscriptionSchedule || {};
            const price = subscription.items?.data?.[0]?.price;

            features.subscriptionSchedule = {
                ...scheduleFeature,
                id: subscription.schedule as string,
                currentPhasePriceId: price?.id ?? scheduleFeature.currentPhasePriceId,
                currentPhaseLookupKey: price?.lookup_key ?? scheduleFeature.currentPhaseLookupKey,
                currentPeriodEnd: periodEnd ? periodEnd.toISOString() : scheduleFeature.currentPeriodEnd?.toString()
            };

            updates.features = features;
        }

        await brandSub.update(updates);
        console.log('✅ Brand subscription synced from subscription.created webhook:', brandSub.id);
        return;
    }

    // Fallback: log for other subscription types we might support later
    console.log('ℹ️ No BrandSubscription record found for subscription:', subscription.id);
};

export const handleSubscriptionUpdated = async (event: Stripe.Event): Promise<void> => {
    const subscription = event.data.object as Stripe.Subscription;

    console.log('🔄 Subscription updated event received:', subscription.id);

    try {
        // Find and update local BrandSubscription record
        const brandSub = await BrandSubscription.findOne({
            where: {
                stripeSubscriptionId: subscription.id
            }
        });

        if (brandSub) {
            console.log('\n💾 UPDATING LOCAL BRAND SUBSCRIPTION:', brandSub.id);

            // Get the current primary price (assuming first item is primary)
            const primaryItem = subscription.items.data[0];
            if (primaryItem) {
                // Try to find the plan by stripe price ID
                const newPlan = await BrandSubscriptionPlans.findOne({
                    where: { stripePriceId: primaryItem.price.id }
                });

                if (newPlan) {
                    console.log(`  🎯 Found matching plan: ${newPlan.planType} (${newPlan.name})`);

                    await brandSub.update({
                        status: BrandSubscriptionStatus.ACTIVE
                    });

                    console.log('✅ Brand subscription updated successfully');
                } else {
                    console.log(`⚠️ No local plan found for price ID: ${primaryItem.price.id}`);
                }
            }
        } else {
            console.log('⚠️ No local BrandSubscription found for Stripe subscription:', subscription.id);
        }

    } catch (error) {
        console.error('❌ Error processing subscription update:', error);
    }

    console.log('\n🏁 Subscription update processing completed\n');
};

/**
 * This event fires when:
  - A payment method is authorized (validated) but not yet captured
  - The amount_capturable field on the PaymentIntent becomes greater than 0
  - You're using manual capture mode (capture_method: 'manual')
 * @param paymentIntent
 */
export const handlePaymentIntentAmountCapturableUpdated = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
    console.log('💰 payment_intent.amount_capturable_updated:', paymentIntent.id);
    console.log('💰 Amount capturable:', paymentIntent.amount_capturable / 100, paymentIntent.currency.toUpperCase());

    // Find payment record to get associated order
    const payment = await Payment.findOne({
        where: { stripePaymentIntentId: paymentIntent.id },
        include: [
            {
                model: Order,
                as: 'order',
                include: [
                    { model: User, as: 'user' },
                    { model: Treatment, as: 'treatment' },
                    {
                        model: TenantProduct, as: 'tenantProduct', include: [
                            {
                                model: Product, as: 'product',
                            }
                        ]
                    }
                ]
            }
        ]
    });

    if (!payment || !payment.order || !payment.order.user) {
        console.log('ℹ️ Payment intent not associated with order or user not found:', paymentIntent.id);
        return;
    }

    const user = payment.order.user;
    const order = payment.order;
    const treatment = payment.order.treatment;
    const tenantProduct = payment.order.tenantProduct;

    // Update payment status to reflect it's authorized (uncaptured)
    try {
        await payment.updateFromStripeEvent({ object: paymentIntent });
        console.log('✅ Payment record updated with authorization status');
    } catch (error) {
        console.error('❌ Error updating payment record:', error);
    }

    // Update order status to AMOUNT_CAPTURABLE_UPDATED to indicate it has an authorized payment awaiting doctor approval
    try {
        if (order.status === OrderStatus.PENDING || order.status === OrderStatus.PAYMENT_PROCESSING) {
            await order.update({ status: OrderStatus.AMOUNT_CAPTURABLE_UPDATED });
            console.log('✅ Order status updated to AMOUNT_CAPTURABLE_UPDATED (authorized payment, awaiting doctor approval)');
        }
    } catch (error) {
        console.error('❌ Error updating order status:', error);
    }

    // ============================================
    // MINIMAL MD INTEGRATIONS IMPLEMENTATION
    // Following the same 3-API-call pattern as /md/cases endpoint
    // ============================================

    // Check if order already has mdCaseId
    if (order.mdCaseId) {
        console.log('[MD-WH] ℹ️ Order already has mdCaseId:', order.mdCaseId);
        return;
    }

    // Check if clinic uses md-integrations dashboard format
    let clinic: any = null;
    if (user.clinicId) {
        clinic = await Clinic.findByPk(user.clinicId);
    }

    if (!clinic || (clinic as any).patientPortalDashboardFormat !== 'md-integrations') {
        console.log('[MD-WH] ℹ️ Skipping MD Integrations - clinic does not use md-integrations format');
        return;
    }

    try {
        // Step 2: Ensure patient is synced with MD Integrations (creates mdPatientId if doesn't exist)
        if (!user.mdPatientId) {
            console.log('[MD-WH] User does not have mdPatientId, syncing patient...');
            const { default: UserServiceClass } = await import('../user.service');
            const userService = new UserServiceClass();
            const syncedUser = await userService.syncPatientInMD(user.id, (order as any).shippingAddressId);
            
            if (!syncedUser || !syncedUser.mdPatientId) {
                console.error('[MD-WH] ❌ Failed to sync patient with MD Integrations');
                return;
            }
            
            // Reload user to get updated mdPatientId
            await user.reload();
            
            if (process.env.NODE_ENV === 'development') {
                console.log('[MD-WH] ✅ Patient synced, mdPatientId:', user.mdPatientId);
            }
        }

        // Step 3: Resolve pre-configured offering_id (same logic as /md/cases endpoint)
        // Priority: Product -> Config -> Sandbox fallback
        let offeringId: string | undefined;

        // Try product-level offering first
        if (tenantProduct && tenantProduct.product && tenantProduct.product.mdCaseId) {
            offeringId = tenantProduct.product.mdCaseId;
        } else if (treatment && treatment.mdCaseId) {
            offeringId = treatment.mdCaseId;
        }

        // Fallback to config default
        if (!offeringId) {
            try {
                const mdConfig = (await import('../mdIntegration/config')).mdIntegrationsConfig;
                if (mdConfig.defaultOfferingId) {
                    offeringId = mdConfig.defaultOfferingId;
                }
            } catch { }
        }

        // Development sandbox fallback
        if (!offeringId && process.env.NODE_ENV !== 'production') {
            offeringId = '3c3d0118-e362-4466-9c92-d852720c5a41';
        }

        if (!offeringId) {
            console.error('[MD-WH] ❌ No offering_id configured. Cannot create MD case.');
            return;
        }

        // Build case questions from questionnaire answers (optional)
        const { extractCaseQuestions } = await import('../../utils/questionnaireAnswers');
        const caseQuestions = order.questionnaireAnswers
            ? extractCaseQuestions(order.questionnaireAnswers)
            : [];

        // Step 1: Generate access token (uses cached token if available)
        const MDAuthService = (await import('../mdIntegration/MDAuth.service')).default;
        const MDCaseService = (await import('../mdIntegration/MDCase.service')).default;
        const tokenResponse = await MDAuthService.generateToken();

        // Ensure mdPatientId exists before creating case
        if (!user.mdPatientId) {
            console.error('[MD-WH] ❌ User mdPatientId is still missing after sync');
            return;
        }

        // Step 3: Create case with minimal payload
        const caseData = {
            patient_id: user.mdPatientId, // TypeScript now knows this is string (not undefined)
            metadata: `orderId: ${order.id}`,
            hold_status: false,
            case_offerings: [{ offering_id: offeringId }],
        };

        // Add questionnaire answers if available
        if (caseQuestions.length > 0) {
            (caseData as any).case_questions = caseQuestions;
        }

        const caseResponse = await MDCaseService.createCase(caseData, tokenResponse.access_token);

        // Save the case ID to the order
        await order.update({
            mdCaseId: caseResponse.case_id
        });

        console.log('[MD-WH] ✅ MD Integration case created and saved to order:', {
            orderId: order.id,
            caseId: caseResponse.case_id,
            patientId: user.mdPatientId
        });

    } catch (error: any) {
        const errorMsg = error?.message || 'Unknown error';
        console.error('[MD-WH] ❌ Error creating MD Integration case:', errorMsg);
        if (process.env.NODE_ENV === 'development') {
            console.error('[MD-WH] Error details:', error);
        }
    }
};

/**
 * Handle Stripe Connect account.updated webhook
 */
export const handleAccountUpdated = async (account: Stripe.Account): Promise<void> => {
    try {
        await StripeConnectService.handleAccountUpdated(account);
    } catch (error) {
        console.error('❌ Error handling account.updated webhook:', error);
        throw error;
    }
};

export const processStripeWebhook = async (event: Stripe.Event): Promise<void> => {
    switch (event.type) {
        case 'payment_intent.succeeded':
            await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
            break;

        case 'payment_intent.payment_failed':
            await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
            break;

        case 'payment_intent.canceled':
            await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
            break;

        case 'charge.dispute.created':
            await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
            break;

        case 'checkout.session.completed':
            await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
            break;

        case 'customer.subscription.created':
            await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
            break;

        case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event);
            break;

        case 'invoice.paid':
            await handleInvoicePaid(event.data.object as Stripe.Invoice);
            break;
        case "invoice.payment_failed":
            await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
            break;

        case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
            break;
        case "payment_intent.amount_capturable_updated":
            await handlePaymentIntentAmountCapturableUpdated(event.data.object as Stripe.PaymentIntent)
            break;

        // Stripe Connect events
        case 'account.updated':
            await handleAccountUpdated(event.data.object as Stripe.Account);
            break;

        case 'account.application.authorized':
            console.log('📬 Account application authorized:', event.data.object);
            break;

        case 'account.application.deauthorized':
            console.log('📬 Account application deauthorized:', event.data.object);
            break;

        default:
            console.log(`🔍 Unhandled event type ${event.type}`);
    }
};