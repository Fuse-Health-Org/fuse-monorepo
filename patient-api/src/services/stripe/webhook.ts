import Stripe from 'stripe';
import { MedicalCompanySlug } from '@fuse/enums';
import Payment, { PaymentGoesTo } from '../../models/Payment';
import Order, { OrderStatus } from '../../models/Order';
import { StripeService } from '@fuse/stripe';
import Subscription from '../../models/Subscription';
import Clinic from '../../models/Clinic';
import { PaymentStatus } from '@fuse/enums';
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
import ClinicBalance from '../../models/ClinicBalance';
import { stripe } from '@fuse/stripe';

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

        // Extract payment method ID from the payment intent and store it in metadata
        // This is needed because the payment method is only known after the user confirms payment
        const paymentMethodIdFromIntent = typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id;

        if (paymentMethodIdFromIntent) {
            // Update payment record with the payment method ID
            const currentMetadata = payment.stripeMetadata || {};
            await payment.update({
                stripeMetadata: {
                    ...currentMetadata,
                    paymentMethodId: paymentMethodIdFromIntent
                }
            });
            console.log('✅ Payment method ID saved to payment record:', paymentMethodIdFromIntent);
        }

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

export const handleChargeRefunded = async (charge: Stripe.Charge): Promise<void> => {
    console.log('💸 Charge refunded:', charge.id);

    // Find payment by charge ID or payment intent ID
    const refundedPayment = await Payment.findOne({
        where: { 
            stripeChargeId: charge.id 
        },
        include: [
            { 
                model: Order, 
                as: 'order',
                include: [
                    { model: Clinic, as: 'clinic' }
                ]
            }
        ]
    });

    if (!refundedPayment || !refundedPayment.order) {
        console.log('⚠️ No order found for refunded charge:', charge.id);
        return;
    }

    const order = refundedPayment.order;
    
    // Check if this was already processed by our manual refund endpoint
    const existingDebtRecord = await ClinicBalance.findOne({
        where: {
            orderId: order.id,
            type: 'refund_debt'
        },
        order: [['createdAt', 'DESC']]
    });

    if (existingDebtRecord) {
        console.log('ℹ️ Refund already processed for this order:', order.orderNumber);
        return;
    }

    // This is a refund that wasn't initiated by our manual endpoint
    // (could be from Stripe dashboard or a chargeback)
    const refundAmount = charge.amount_refunded / 100;
    const brandAmount = Number(order.brandAmount) || 0;
    const fuseCoverage = refundAmount - brandAmount;

    console.log(`💰 Refund breakdown (webhook):`, {
        totalRefund: refundAmount,
        brandAmount: brandAmount,
        fuseCoverage: fuseCoverage,
    });

    // Update payment and order status
    await refundedPayment.update({
        status: 'refunded',
        refundedAmount: refundAmount,
        refundedAt: new Date(),
    });

    await order.updateStatus(OrderStatus.REFUNDED);
    console.log('✅ Order and payment updated to refunded status:', order.orderNumber);

    // If FUSE covered any amount, try to recover it from the brand
    if (fuseCoverage > 0 && (order as any).clinic?.stripeAccountId) {
        try {
            // Attempt instant transfer from brand to FUSE
            const recoveryTransfer = await stripe.transfers.create({
                amount: Math.round(fuseCoverage * 100),
                currency: 'usd',
                destination: process.env.STRIPE_PLATFORM_ACCOUNT_ID || 'acct_1S56nzELzhgYQXTR',
                metadata: {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    chargeId: charge.id,
                    type: 'refund_coverage_webhook',
                },
                description: `Refund coverage recovery for order ${order.orderNumber}`,
            }, {
                stripeAccount: (order as any).clinic.stripeAccountId,
            });

            console.log(`✅ Brand paid refund coverage instantly: ${recoveryTransfer.id}`);

            // Record successful payment
            await ClinicBalance.create({
                clinicId: order.clinicId!,
                orderId: order.id,
                amount: fuseCoverage,
                type: 'refund_debt',
                status: 'paid',
                stripeTransferId: recoveryTransfer.id,
                description: `Refund coverage for order ${order.orderNumber} (via webhook)`,
                notes: `Charge ID: ${charge.id}`,
                paidAt: new Date(),
            });

        } catch (transferError: any) {
            console.log(`⚠️ Brand transfer failed, registering as pending debt:`, transferError.message);

            // Record as pending debt
            await ClinicBalance.create({
                clinicId: order.clinicId!,
                orderId: order.id,
                amount: -fuseCoverage,
                type: 'refund_debt',
                status: 'pending',
                description: `Pending refund coverage for order ${order.orderNumber} (via webhook)`,
                notes: `Transfer failed: ${transferError.message}. Charge ID: ${charge.id}`,
            });
        }
    }
};

export const handleChargeDisputeClosed = async (dispute: Stripe.Dispute): Promise<void> => {
    console.log('🔒 Dispute closed:', dispute.id, 'Status:', dispute.status);

    // If dispute was won, we may need to reverse the debt tracking
    if (dispute.status === 'won') {
        console.log('✅ Dispute won! Checking if we need to reverse any debt records...');
        
        // Find any pending debt records for this dispute
        const debtRecords = await ClinicBalance.findAll({
            where: {
                stripeRefundId: dispute.id,
                status: 'pending'
            }
        });

        if (debtRecords.length > 0) {
            console.log(`✅ Found ${debtRecords.length} pending debt record(s) to cancel`);
            
            for (const debt of debtRecords) {
                await debt.update({
                    status: 'cancelled',
                    notes: `${debt.notes || ''}\nDispute won on ${new Date().toISOString()}. Debt cancelled.`
                });
            }
            
            console.log('✅ Cancelled debt records for won dispute');
        } else {
            console.log('ℹ️ No pending debt records found for this dispute');
        }
    } else if (dispute.status === 'lost') {
        console.log('❌ Dispute lost. Brand coverage debt remains active.');
        // Debt records should remain as pending or paid - no action needed
    }
};

export const handleChargeDisputeCreated = async (dispute: Stripe.Dispute): Promise<void> => {
    console.log('⚠️ Chargeback/Dispute created:', dispute.id);

    // Find payment by charge ID
    const disputedPayment = await Payment.findOne({
        where: { stripeChargeId: dispute.charge },
        include: [
            { 
                model: Order, 
                as: 'order',
                include: [
                    { model: Clinic, as: 'clinic' }
                ]
            },
            { model: BrandSubscription, as: 'brandSubscription' }
        ]
    });

    if (!disputedPayment || !disputedPayment.order) {
        console.log('⚠️ No order found for disputed charge:', dispute.charge);
        return;
    }

    const order = disputedPayment.order;
    const chargebackAmount = dispute.amount / 100; // Convert from cents to dollars

    console.log(`💰 Chargeback amount: $${chargebackAmount} for order ${order.orderNumber}`);

    // Update order status to refunded (dispute handling)
    await order.updateStatus(OrderStatus.REFUNDED);
    await disputedPayment.update({
        status: 'refunded',
        refundedAmount: chargebackAmount,
        refundedAt: new Date(),
    });
    console.log('⚠️ Order marked as disputed/refunded:', order.orderNumber);

    // Calculate what FUSE covered (difference between total and brand's portion)
    const brandAmount = Number(order.brandAmount) || 0;
    const fuseCoverage = chargebackAmount - brandAmount;

    console.log(`💸 Chargeback breakdown:`, {
        totalChargeback: chargebackAmount,
        brandAmount: brandAmount,
        fuseCoverage: fuseCoverage,
    });

    // If FUSE covered any amount, try to recover it from the brand
    if (fuseCoverage > 0 && (order as any).clinic?.stripeAccountId) {
        try {
            // Attempt instant transfer from brand to FUSE to recover the coverage
            const recoveryTransfer = await stripe.transfers.create({
                amount: Math.round(fuseCoverage * 100), // Convert to cents
                currency: 'usd',
                destination: process.env.STRIPE_PLATFORM_ACCOUNT_ID || 'acct_1S56nzELzhgYQXTR',
                metadata: {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    disputeId: dispute.id,
                    chargeId: dispute.charge as string,
                    type: 'chargeback_coverage',
                },
                description: `Chargeback coverage recovery for order ${order.orderNumber}`,
            }, {
                stripeAccount: (order as any).clinic.stripeAccountId,
            });

            console.log(`✅ Brand paid chargeback coverage instantly via transfer: ${recoveryTransfer.id}`);

            // Record successful payment
            await ClinicBalance.create({
                clinicId: order.clinicId!,
                orderId: order.id,
                amount: fuseCoverage,
                type: 'refund_debt',
                status: 'paid',
                stripeTransferId: recoveryTransfer.id,
                stripeRefundId: dispute.id,
                description: `Chargeback coverage for order ${order.orderNumber}`,
                notes: `Chargeback ID: ${dispute.id}, Charge ID: ${dispute.charge}`,
                paidAt: new Date(),
            });

        } catch (transferError: any) {
            console.log(`⚠️ Brand transfer failed for chargeback coverage, registering as pending debt:`, transferError.message);

            // Record as pending debt if transfer fails
            await ClinicBalance.create({
                clinicId: order.clinicId!,
                orderId: order.id,
                amount: -fuseCoverage, // Negative = brand owes money
                type: 'refund_debt',
                status: 'pending',
                stripeRefundId: dispute.id,
                description: `Pending chargeback coverage for order ${order.orderNumber}`,
                notes: `Transfer failed: ${transferError.message}. Chargeback ID: ${dispute.id}, Charge ID: ${dispute.charge}`,
            });
        }
    } else if (fuseCoverage <= 0) {
        console.log(`ℹ️ No FUSE coverage needed - brand amount (${brandAmount}) covers full chargeback (${chargebackAmount})`);
    } else {
        console.log(`⚠️ Brand has no Stripe account connected - cannot recover chargeback coverage`);
        
        // Still record the debt even if we can't collect it immediately
        await ClinicBalance.create({
            clinicId: order.clinicId!,
            orderId: order.id,
            amount: -fuseCoverage,
            type: 'refund_debt',
            status: 'pending',
            stripeRefundId: dispute.id,
            description: `Pending chargeback coverage for order ${order.orderNumber} (no Stripe account)`,
            notes: `Brand has no connected Stripe account. Chargeback ID: ${dispute.id}, Charge ID: ${dispute.charge}`,
        });
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

    if (!clinic || (clinic as any).patientPortalDashboardFormat !== MedicalCompanySlug.MD_INTEGRATIONS) {
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

        // Step 1: Generate access token (uses cached token if available)
        const MDAuthService = (await import('../mdIntegration/MDAuth.service')).default;
        const MDCaseService = (await import('../mdIntegration/MDCase.service')).default;
        const tokenResponse = await MDAuthService.generateToken();

        // Ensure mdPatientId exists before creating case
        if (!user.mdPatientId) {
            console.error('[MD-WH] ❌ User mdPatientId is still missing after sync');
            return;
        }

        // Create case with minimal payload (questions posted separately)
        const caseData = {
            patient_id: user.mdPatientId,
            metadata: `orderId: ${order.id}`,
            hold_status: false,
            case_offerings: [{ offering_id: offeringId }],
        };

        const caseResponse = await MDCaseService.createCase(caseData, tokenResponse.access_token);
        const caseId = caseResponse.case_id;

        // Save the case ID to the order
        await order.update({ mdCaseId: caseId });

        console.log('[MD-WH] ✅ MD Integration case created and saved to order:', {
            orderId: order.id,
            caseId,
            patientId: user.mdPatientId
        });

        // Post case questions individually after case creation
        if (order.questionnaireAnswers) {
            const { extractRichCaseQuestions, extractCaseQuestions } = await import('../../utils/questionnaireAnswers');

            // Determine medicalCompanySource from the questionnaire
            let medicalCompanySource: string | null = null;
            try {
                if ((order as any).questionnaireId) {
                    const Questionnaire = (await import('../../models/Questionnaire')).default;
                    const questionnaire = await Questionnaire.findByPk((order as any).questionnaireId);
                    if (questionnaire) {
                        medicalCompanySource = questionnaire.medicalCompanySource;
                    }
                }
                if (!medicalCompanySource && tenantProduct && (tenantProduct as any).productId) {
                    const Questionnaire = (await import('../../models/Questionnaire')).default;
                    const q = await Questionnaire.findOne({ where: { productId: (tenantProduct as any).productId } });
                    if (q) {
                        medicalCompanySource = q.medicalCompanySource;
                    }
                }
            } catch (e) {
                console.warn('[MD-WH] Could not determine medicalCompanySource:', e);
            }

            // Default to md-integrations (clinic already confirmed as MDI)
            if (!medicalCompanySource) {
                medicalCompanySource = 'md-integrations';
            }

            if (medicalCompanySource === 'md-integrations') {
                const richQuestions = extractRichCaseQuestions(order.questionnaireAnswers);
                if (richQuestions.length > 0) {
                    console.log(`[MD-WH] Posting ${richQuestions.length} rich questions to case ${caseId}`);
                    const result = await MDCaseService.postCaseQuestions(caseId, richQuestions, tokenResponse.access_token);
                    console.log(`[MD-WH] Questions posted: ${result.posted} success, ${result.failed} failed`);
                }
            } else {
                const basicQuestions = extractCaseQuestions(order.questionnaireAnswers);
                if (basicQuestions.length > 0) {
                    console.log(`[MD-WH] Posting ${basicQuestions.length} basic questions to case ${caseId}`);
                    const result = await MDCaseService.postCaseQuestions(caseId, basicQuestions, tokenResponse.access_token);
                    console.log(`[MD-WH] Questions posted: ${result.posted} success, ${result.failed} failed`);
                }
            }
        }

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

/**
 * Handle Stripe transfer.created webhook
 * When money is transferred to a brand/doctor/pharmacy, create a Payment record
 */
export const handleTransferCreated = async (transfer: Stripe.Transfer): Promise<void> => {
    try {
        console.log('💸 Transfer created:', transfer.id);

        // Get the payment intent ID from transfer metadata or source transaction
        // When transfer_data is used, the transfer is linked to the original payment intent's charge
        let paymentIntentId: string | null = null;

        // Try to get payment intent ID from metadata first
        if (transfer.metadata?.paymentIntentId) {
            paymentIntentId = transfer.metadata.paymentIntentId;
        } else if (transfer.metadata?.orderId) {
            // If we have orderId in metadata, find the original payment intent
            const Order = (await import('../../models/Order')).default;
            const order = await Order.findByPk(transfer.metadata.orderId, {
                include: [{ model: Payment, as: 'payment' }]
            });
            if (order && (order as any).payment) {
                paymentIntentId = (order as any).payment.stripePaymentIntentId;
            }
        } else if (transfer.source_transaction) {
            // The source_transaction is the charge ID, we can retrieve the charge to get payment intent
            try {
                const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY!, {
                    apiVersion: '2025-08-27.basil',
                });
                const charge = await stripe.charges.retrieve(transfer.source_transaction as string);
                if (charge.payment_intent) {
                    paymentIntentId = typeof charge.payment_intent === 'string' 
                        ? charge.payment_intent 
                        : charge.payment_intent.id;
                }
            } catch (error) {
                console.error('❌ Error retrieving charge for transfer:', error);
            }
        }

        if (!paymentIntentId) {
            console.warn('⚠️ Could not determine payment intent ID for transfer:', transfer.id);
            // Use transfer ID as a fallback payment intent ID for tracking
            paymentIntentId = `transfer_${transfer.id}`;
        }

        // Determine paymentGoesTo based on transfer metadata or order information
        let paymentGoesTo: PaymentGoesTo = PaymentGoesTo.FUSE;
        
        if (transfer.metadata?.paymentGoesTo) {
            // If explicitly set in metadata
            paymentGoesTo = transfer.metadata.paymentGoesTo as PaymentGoesTo;
        } else if (transfer.metadata?.orderId) {
            // Try to determine from order
            const Order = (await import('../../models/Order')).default;
            const order = await Order.findByPk(transfer.metadata.orderId);
            
            if (order) {
                // Determine based on which amount is being transferred
                // If brandAmount > 0 and matches transfer amount, it's for brand
                // If doctorAmount > 0 and matches transfer amount, it's for doctor
                // If pharmacyWholesaleAmount > 0 and matches transfer amount, it's for pharmacy
                const transferAmountUsd = transfer.amount / 100;
                const brandAmount = Number(order.brandAmount) || 0;
                const doctorAmount = Number(order.doctorAmount) || 0;
                const pharmacyAmount = Number(order.pharmacyWholesaleAmount) || 0;
                
                // Check which amount matches (with small tolerance for rounding)
                if (Math.abs(brandAmount - transferAmountUsd) < 0.01 && brandAmount > 0) {
                    paymentGoesTo = PaymentGoesTo.BRAND;
                } else if (Math.abs(doctorAmount - transferAmountUsd) < 0.01 && doctorAmount > 0) {
                    paymentGoesTo = PaymentGoesTo.DOCTOR;
                } else if (Math.abs(pharmacyAmount - transferAmountUsd) < 0.01 && pharmacyAmount > 0) {
                    paymentGoesTo = PaymentGoesTo.PHARMACY;
                } else {
                    // Default to brand if going to a clinic account
                    const Clinic = (await import('../../models/Clinic')).default;
                    const clinic = await Clinic.findOne({
                        where: { stripeAccountId: transfer.destination }
                    });
                    if (clinic) {
                        paymentGoesTo = PaymentGoesTo.BRAND;
                    }
                }
            } else {
                // If order not found, try to determine from destination account
                const Clinic = (await import('../../models/Clinic')).default;
                const clinic = await Clinic.findOne({
                    where: { stripeAccountId: transfer.destination }
                });
                if (clinic) {
                    paymentGoesTo = PaymentGoesTo.BRAND;
                }
            }
        } else {
            // Try to determine from destination account (Clinic)
            const Clinic = (await import('../../models/Clinic')).default;
            const clinic = await Clinic.findOne({
                where: { stripeAccountId: transfer.destination }
            });
            
            // For now, assume it's a brand payment if going to a clinic account
            // This can be refined based on business logic
            if (clinic) {
                paymentGoesTo = PaymentGoesTo.BRAND;
            }
        }

        // Check if payment already exists for this transfer
        const existingPayment = await Payment.findOne({
            where: { stripePaymentIntentId: paymentIntentId }
        });

        // Only create if it doesn't exist and it's not the original fuse payment
        if (!existingPayment || paymentIntentId.startsWith('transfer_')) {
            // Create payment record for the transfer
            await Payment.create({
                stripePaymentIntentId: paymentIntentId.startsWith('transfer_') 
                    ? paymentIntentId 
                    : `transfer_${transfer.id}`,
                status: transfer.reversed ? 'failed' : 'succeeded',
                paymentMethod: 'card',
                amount: transfer.amount / 100, // Convert from cents
                currency: transfer.currency.toUpperCase(),
                paymentGoesTo: paymentGoesTo,
                stripeMetadata: {
                    transferId: transfer.id,
                    destination: transfer.destination,
                    sourceTransaction: transfer.source_transaction,
                    originalPaymentIntentId: paymentIntentId.startsWith('transfer_') ? null : paymentIntentId,
                    ...transfer.metadata
                },
            });

            console.log(`✅ Created Payment record for transfer ${transfer.id} (paymentGoesTo: ${paymentGoesTo})`);
        } else {
            console.log(`ℹ️ Payment already exists for transfer ${transfer.id}`);
        }
    } catch (error) {
        console.error('❌ Error handling transfer.created webhook:', error);
        // Don't throw - we don't want to fail the webhook processing
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

        case 'charge.dispute.closed':
            await handleChargeDisputeClosed(event.data.object as Stripe.Dispute);
            break;

        case 'charge.refunded':
            await handleChargeRefunded(event.data.object as Stripe.Charge);
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

        case 'transfer.created':
            await handleTransferCreated(event.data.object as Stripe.Transfer);
            break;

        default:
            console.log(`🔍 Unhandled event type ${event.type}`);
    }
};