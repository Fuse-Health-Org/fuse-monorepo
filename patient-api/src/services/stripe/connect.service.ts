import Stripe from 'stripe';
import Clinic from '../../models/Clinic';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

export class StripeConnectService {
  /**
   * Create or retrieve a Stripe Connect account for a clinic
   * @param merchantModel - 'platform' (Fuse MOR) or 'direct' (Clinic MOR)
   */
  async createOrGetConnectAccount(
    clinicId: string,
    merchantModel: 'platform' | 'direct' = 'platform'
  ): Promise<string> {
    const clinic = await Clinic.findByPk(clinicId);

    if (!clinic) {
      throw new Error('Clinic not found');
    }

    // If clinic already has a Stripe account, return it
    if (clinic.stripeAccountId) {
      console.log(`✅ Clinic ${clinicId} already has Stripe account: ${clinic.stripeAccountId}`);
      return clinic.stripeAccountId;
    }

    // Create a new Express Connect account
    console.log(`🔄 Creating new Stripe Connect account for clinic ${clinicId} (${merchantModel} model)`);

    // Configure capabilities based on merchant model
    // Docs: https://docs.stripe.com/api/accounts/create (change the API to Node.js in the docs)
    // Capabilities: https://docs.stripe.com/connect/account-capabilities
    // Controller: https://docs.stripe.com/connect/controller-reference
    const capabilities: any = {
      transfers: { requested: true }, // Always enable transfers for payouts
    };

    // Only add card_payments if clinic is direct merchant of record
    if (merchantModel === 'direct') {
      capabilities.card_payments = { requested: true };
    }

    try {
      const account = await stripe.accounts.create({
        country: 'US',
        email: clinic.name ? `${clinic.slug}@fuse-brands.com` : undefined,
        capabilities,
        controller: {
          stripe_dashboard: { type: 'express' },        // Express dashboard access
          fees: { payer: 'application' },                // Platform pays Stripe fees
          losses: { payments: 'application' },           // Platform liable for disputes/losses
          requirement_collection: 'stripe',              // Stripe handles compliance/requirements
        },
        business_type: 'company',
        metadata: {
          clinicId: clinic.id,
          clinicName: clinic.name,
          clinicSlug: clinic.slug,
          merchantModel: merchantModel,
        }
      });

      // Save account ID and merchant model to clinic
      await clinic.update({
        stripeAccountId: account.id,
        stripeAccountType: 'express',
        merchantOfRecord: merchantModel === 'direct' ? 'myself' : 'fuse',
      });

      console.log(`✅ Stripe Connect account created: ${account.id} for clinic ${clinicId} (${merchantModel} model)`);

      return account.id;
    } catch (error: any) {
      console.error(`❌ Error creating Stripe Connect account:`, error.message);
      if (error.type === 'StripeInvalidRequestError') {
        console.error(`❌ Stripe error details:`, error.raw);
      }
      throw error;
    }

  }

  /**
   * Update an existing Connect account with proper capabilities and controller settings
   * Note: card_payments is only added for 'direct' merchant model
   */
  async updateAccountCapabilities(
    accountId: string,
    merchantModel: 'platform' | 'direct' = 'platform'
  ): Promise<void> {
    console.log(`🔄 Updating capabilities for account ${accountId} (${merchantModel} model)`);

    try {
      const capabilities: any = {
        transfers: { requested: true },
      };

      // Only add card_payments if direct merchant of record
      if (merchantModel === 'direct') {
        capabilities.card_payments = { requested: true };
      }

      await stripe.accounts.update(accountId, { capabilities });

      console.log(`✅ Account ${accountId} capabilities updated`);
    } catch (error: any) {
      console.error(`❌ Failed to update account capabilities:`, error.message);
      // Don't throw - this might fail if account already has these settings
    }
  }

  /**
   * Create an Account Session for embedded components
   * This allows the frontend to access Stripe Connect UI
   */
  async createAccountSession(
    clinicId: string,
    merchantModel: 'platform' | 'direct' = 'platform'
  ): Promise<string> {
    const clinic = await Clinic.findByPk(clinicId);

    if (!clinic) {
      throw new Error('Clinic not found');
    }

    // Ensure clinic has a Stripe account
    let accountId = clinic.stripeAccountId;
    if (!accountId) {
      accountId = await this.createOrGetConnectAccount(clinicId, merchantModel);
    } else {
      // Verify the account exists and is accessible
      try {
        const account = await stripe.accounts.retrieve(accountId);
        console.log(`✅ Account ${accountId} verified, type: ${account.type}`);

        // Update existing account to ensure it has the right capabilities
        await this.updateAccountCapabilities(accountId, merchantModel);
      } catch (error: any) {
        console.error(`❌ Error retrieving account ${accountId}:`, error.message);
        
        // Mask the account ID for security (show first 9 chars, rest as asterisks)
        const maskedAccountId = accountId.substring(0, 9) + '******';
        
        // If account doesn't exist or is invalid, throw a user-friendly error
        if (error.code === 'resource_missing' || error.message?.includes('No such')) {
          throw new Error(`Your Stripe account ID ${maskedAccountId} is invalid!`);
        }
        
        // For other errors, try to create a new account
        accountId = await this.createOrGetConnectAccount(clinicId, merchantModel);
      }
    }

    console.log(`🔄 Creating Account Session for clinic ${clinicId}, account ${accountId}`);

    try {
      // Create the account session with embedded components configuration
      const accountSession = await stripe.accountSessions.create({
        account: accountId,
        components: {
          account_onboarding: {
            enabled: true,
            features: {
              external_account_collection: true,
            },
          },
          payments: {
            enabled: true,
            features: {
              refund_management: true,
              dispute_management: true,
              capture_payments: true,
            }
          },
          payouts: {
            enabled: true,
            features: {
              standard_payouts: true,
            }
          },
          balances: {
            enabled: true,
            features: {
              standard_payouts: true,
            }
          },
          notification_banner: { enabled: true },
        },
      });

      console.log(`✅ Account Session created for clinic ${clinicId}`);

      return accountSession.client_secret;
    } catch (error: any) {
      console.error(`❌ Error creating Account Session:`, error.message);
      if (error.type === 'StripeInvalidRequestError') {
        console.error(`❌ Stripe error details:`, error.raw);
      }
      
      // Mask the account ID in error messages for security
      const maskedAccountId = accountId.substring(0, 9) + '******';
      
      // Check if it's a "no such account" error
      if (error.code === 'resource_missing' || error.message?.includes('No such account')) {
        throw new Error(`Your Stripe account ID ${maskedAccountId} is invalid!`);
      }
      
      throw error;
    }
  }

  /**
   * Get the onboarding status of a clinic's Stripe Connect account
   */
  async getAccountStatus(clinicId: string): Promise<{
    connected: boolean;
    onboardingComplete: boolean;
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    accountId?: string;
    requirements?: {
      currently_due: string[];
      eventually_due: string[];
      past_due: string[];
    };
  }> {
    const clinic = await Clinic.findByPk(clinicId);

    if (!clinic) {
      throw new Error('Clinic not found');
    }

    if (!clinic.stripeAccountId) {
      return {
        connected: false,
        onboardingComplete: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      };
    }

    // Fetch account details from Stripe
    const account = await stripe.accounts.retrieve(clinic.stripeAccountId);

    // Update local record if status changed
    const needsUpdate =
      clinic.stripeDetailsSubmitted !== account.details_submitted ||
      clinic.stripeChargesEnabled !== account.charges_enabled ||
      clinic.stripePayoutsEnabled !== account.payouts_enabled;

    if (needsUpdate) {
      await clinic.update({
        stripeDetailsSubmitted: account.details_submitted,
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeOnboardingComplete: account.details_submitted && account.charges_enabled && account.payouts_enabled,
        stripeOnboardedAt: (account.details_submitted && account.charges_enabled && account.payouts_enabled && !clinic.stripeOnboardedAt)
          ? new Date()
          : clinic.stripeOnboardedAt,
      });
    }

    return {
      connected: true,
      onboardingComplete: account.details_submitted && account.charges_enabled && account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      accountId: account.id,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        past_due: account.requirements?.past_due || [],
      }
    };
  }

  /**
   * Handle account.updated webhook event
   */
  async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    console.log(`📬 Account updated webhook received for account: ${account.id}`);

    // Find clinic by Stripe account ID
    const clinic = await Clinic.findOne({
      where: { stripeAccountId: account.id }
    });

    if (!clinic) {
      console.warn(`⚠️ No clinic found for Stripe account: ${account.id}`);
      return;
    }

    // Update clinic with latest account status
    const wasIncomplete = !clinic.stripeOnboardingComplete;
    const isNowComplete = account.details_submitted && account.charges_enabled && account.payouts_enabled;

    await clinic.update({
      stripeDetailsSubmitted: account.details_submitted,
      stripeChargesEnabled: account.charges_enabled,
      stripePayoutsEnabled: account.payouts_enabled,
      stripeOnboardingComplete: isNowComplete,
      stripeOnboardedAt: (isNowComplete && !clinic.stripeOnboardedAt)
        ? new Date()
        : clinic.stripeOnboardedAt,
    });

    if (wasIncomplete && isNowComplete) {
      console.log(`🎉 Clinic ${clinic.id} completed Stripe Connect onboarding!`);
      // Here you could send a notification to the clinic or trigger other events
    }

    console.log(`✅ Clinic ${clinic.id} Stripe status updated`);
  }

  /**
   * Create a transfer to a connected account
   * This is used to pay brands/pharmacies their share
   */
  async createTransfer(params: {
    amount: number; // in cents
    currency: string;
    destinationAccountId: string;
    description: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Transfer> {
    const { amount, currency, destinationAccountId, description, metadata } = params;

    console.log(`💸 Creating transfer of ${amount} ${currency} to account ${destinationAccountId}`);

    const transfer = await stripe.transfers.create({
      amount,
      currency,
      destination: destinationAccountId,
      description,
      metadata,
    });

    console.log(`✅ Transfer created: ${transfer.id}`);

    return transfer;
  }

  /**
   * Create an account link for onboarding (alternative to embedded components)
   * This can be used as a fallback or for email invitations
   */
  async createAccountLink(
    clinicId: string,
    refreshUrl: string,
    returnUrl: string,
    merchantModel: 'platform' | 'direct' = 'platform'
  ): Promise<string> {
    const clinic = await Clinic.findByPk(clinicId);

    if (!clinic) {
      throw new Error('Clinic not found');
    }

    let accountId = clinic.stripeAccountId;
    if (!accountId) {
      accountId = await this.createOrGetConnectAccount(clinicId, merchantModel);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
      collection_options: {
        fields: 'eventually_due',
        future_requirements: 'include',
      },
    });

    return accountLink.url;
  }
}

export default new StripeConnectService();

