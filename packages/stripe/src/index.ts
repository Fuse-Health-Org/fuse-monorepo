import Stripe from 'stripe';
import { stripe } from './config';

export enum BillingInterval {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  BIANNUAL = 'biannual',
  ANNUAL = 'annual'
}

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"



interface CheckoutSubParams {
  line_items: Stripe.Checkout.SessionCreateParams.LineItem[];
  stripeCustomerId: string;
  metadata: {
    userId: string;
    orderId?: string;
    clinicId?: string;
    treatmentId?: string;
  }
}


class StripeService {
  async checkoutSub({
    line_items,
    stripeCustomerId,
    metadata,
  }: CheckoutSubParams) {
    return stripe.checkout.sessions.create({
      line_items,
      customer: stripeCustomerId,
      mode: "subscription",
      cancel_url: `${FRONTEND_URL}/cancel`, // Assuming cart route
      success_url:
        `${FRONTEND_URL}/success`,
      metadata: metadata,
      saved_payment_method_options: {
        payment_method_save: "enabled",
      },
    });
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, string>) {
    return stripe.customers.create({
      email,
      name,
      metadata
    });

  }

  async getCustomer(customerId: string) {
    return stripe.customers.retrieve(customerId);
  }

  async updateCustomerDefaultPaymentMethod(customerId: string, paymentMethodId: string) {
    return stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });
  }

  async attachPaymentMethodToCustomer(paymentMethodId: string, customerId: string) {
    return stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });
  }

  async getPaymentIntent(paymentIntentId: string) {
    return stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["customer", "invoice"] }
    );
  }

  async getInvoice(invoiceId: string) {
    return stripe.invoices.retrieve(invoiceId, {
      expand: ["subscription"]
    });
  }

  async getSubscription(subscriptionId: string, params?: Stripe.SubscriptionRetrieveParams) {
    return stripe.subscriptions.retrieve(subscriptionId, params);
  }

  async cancelSubscription(subscriptionId: string) {
    return stripe.subscriptions.cancel(subscriptionId);
  }




  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId?: string,
    metadata?: Record<string, string>
  ) {
    // Ensure minimum charge amount for USD (50 cents)
    const minimumAmount = currency === 'usd' ? 0.50 : amount;
    const finalAmount = Math.max(amount, minimumAmount);

    console.log(`💰 Payment amount: $${amount} -> $${finalAmount} (minimum: $${minimumAmount})`);

    const paymentIntentParams: any = {
      amount: Math.round(finalAmount * 100), // Convert to cents
      currency,
      customer: customerId,
      capture_method: 'manual',
      setup_future_usage: 'off_session', // Save payment method for future use
      automatic_payment_methods: {
        enabled: true,
      },
      payment_method_options: {
        card: {
          setup_future_usage: 'off_session' // Ensure card is saved
        }
      },
      metadata: metadata || {}
    };

    return stripe.paymentIntents.create(paymentIntentParams);
  }

  async capturePaymentIntent(paymentIntentId: string, amountToCapture?: number) {
    const captureParams: any = {
      expand: ['invoice']
    };
    if (amountToCapture) {
      captureParams.amount_to_capture = Math.round(amountToCapture * 100);
    }

    return stripe.paymentIntents.capture(paymentIntentId, captureParams);
  }


  async createSubscriptionAfterPayment({
    customerId,
    priceId,
    paymentMethodId,
    metadata,
    billingInterval = BillingInterval.MONTHLY,
  }: {
    customerId: string;
    priceId: string;
    paymentMethodId: string;
    metadata?: Record<string, string>;
    billingInterval?: BillingInterval;
  }) {
    try {
      // Calculate next billing cycle anchor based on billing interval
      const now = new Date();
      let nextBillingDate: Date;

      // Helper function to safely add months without rolling over
      const addMonthsSafe = (date: Date, months: number): Date => {
        const result = new Date(date);
        const originalDay = date.getDate();
        result.setMonth(result.getMonth() + months);
        
        // If the day changed (e.g., Jan 31 -> Mar 3), set to last day of target month
        if (result.getDate() !== originalDay) {
          // Go back to last day of previous month (the actual target month)
          result.setDate(0);
        }
        return result;
      };

      switch (billingInterval) {
        case 'quarterly':
          nextBillingDate = addMonthsSafe(now, 3);
          break;
        case 'biannual':
          nextBillingDate = addMonthsSafe(now, 6);
          break;
        case 'annual':
          nextBillingDate = new Date(now);
          nextBillingDate.setFullYear(now.getFullYear() + 1);
          break;
        case 'monthly':
        default:
          nextBillingDate = addMonthsSafe(now, 1);
          break;
      }

      const billingCycleAnchor = Math.floor(nextBillingDate.getTime() / 1000);

      console.log(`📅 Setting subscription billing cycle anchor to: ${nextBillingDate.toISOString()} (${billingInterval} billing)`);

      // Create subscription starting at next billing cycle
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        billing_cycle_anchor: billingCycleAnchor,
        proration_behavior: 'none', // Don't prorate - start fresh next cycle
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card', 'link'] // Support both card and Stripe Link
        },
        metadata: {
          ...metadata,
          initial_payment_covered: 'true',
          next_billing_date: nextBillingDate.toISOString(),
          billing_interval: billingInterval
        }
      });

      console.log('✅ Subscription created after payment capture (next billing cycle):', subscription.id);
      console.log(`📅 Next billing will occur on: ${nextBillingDate.toISOString()}`);

      return subscription;
    } catch (error) {
      console.error('❌ Error creating subscription after payment:', error);
      throw error;
    }
  }


  // Product management methods
  async createProduct(params: Stripe.ProductCreateParams) {
    return stripe.products.create(params);
  }

  async getProduct(productId: string) {
    return stripe.products.retrieve(productId);
  }

  async updateProduct(productId: string, params: Stripe.ProductUpdateParams) {
    return stripe.products.update(productId, params);
  }

  // Price management methods
  async createPrice(params: Stripe.PriceCreateParams) {
    return stripe.prices.create(params);
  }

  async getPrice(priceId: string) {
    return stripe.prices.retrieve(priceId);
  }

  async updatePrice(priceId: string, params: Stripe.PriceUpdateParams) {
    return stripe.prices.update(priceId, params);
  }

  async deprecatePrice(priceId: string) {
    return stripe.prices.update(priceId, { active: false });
  }

  async upgradeSubscriptionStripe({
    stripeSubscriptionId,
    stripeItemId,
    stripePriceId,
  }: {
    stripeSubscriptionId: string;
    stripeItemId: string;
    stripePriceId: string;
  }) {
    return stripe.subscriptions.update(stripeSubscriptionId, {
      items: [
        {
          id: stripeItemId,
          deleted: true,
        },
        {
          price: stripePriceId,
        },
      ],
      proration_behavior: "none",
    });
  };

  // Subscription Schedule methods
  async getSubscriptionSchedule(scheduleId: string, options?: {
    expand?: string[];
  }) {
    const expandOptions = options?.expand || [];
    return stripe.subscriptionSchedules.retrieve(scheduleId, {
      expand: expandOptions
    });
  }

  async updateSubscriptionSchedule(
    scheduleId: string,
    params: Stripe.SubscriptionScheduleUpdateParams
  ) {
    return stripe.subscriptionSchedules.update(scheduleId, params);
  }

  async createSchedule({
    customerId,
    paymentMethodId,
    metadata,
    phases
  }: {
    customerId: string;
    paymentMethodId: string;
    metadata: Record<string, string>;
    phases: Stripe.SubscriptionScheduleCreateParams.Phase[];
  }) {
    return stripe.subscriptionSchedules.create({
      customer: customerId,
      start_date: 'now',
      metadata: metadata,
      phases: phases,
      default_settings: {
        default_payment_method: paymentMethodId,
        collection_method: 'charge_automatically'
      },
      expand: ['subscription', 'subscription.latest_invoice', 'subscription.latest_invoice.payment_intent']
    });
  }

  // Refund methods
  async createRefund({
    paymentIntentId,
    amount,
    reverseTransfer = true,
  }: {
    paymentIntentId: string;
    amount?: number;
    reverseTransfer?: boolean;
  }) {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reverse_transfer: reverseTransfer,
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100);
    }

    return stripe.refunds.create(refundParams);
  }

  // Transfer methods
  async createTransfer({
    amount,
    currency = 'usd',
    destination,
    sourceTransaction,
    metadata,
    description,
  }: {
    amount: number;
    currency?: string;
    destination: string;
    sourceTransaction?: string;
    metadata?: Record<string, string>;
    description?: string;
  }) {
    return stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency,
      destination,
      source_transaction: sourceTransaction,
      metadata,
      description,
    });
  }

  async createTransferFromConnectedAccount({
    amount,
    currency = 'usd',
    destination,
    connectedAccountId,
    metadata,
    description,
  }: {
    amount: number;
    currency?: string;
    destination: string;
    connectedAccountId: string;
    metadata?: Record<string, string>;
    description?: string;
  }) {
    return stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency,
      destination,
      metadata,
      description,
    }, {
      stripeAccount: connectedAccountId,
    });
  }


}

export { type CheckoutSubParams, StripeService };