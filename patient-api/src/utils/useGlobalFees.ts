import { GlobalFees } from "@models/GlobalFees";
import Clinic from "@models/Clinic";
import BrandSubscriptionPlans from "@models/BrandSubscriptionPlans";
import TierConfiguration from "@models/TierConfiguration";

export const useGlobalFees = async () => {
    const globalFees = await GlobalFees.findOne();
    if (!globalFees) {
      throw new Error("Global fees configuration not found in database");
    }
    return {
      platformFeePercent: Number(globalFees.fuseTransactionFeePercent),
      stripeFeePercent: Number(globalFees.stripeTransactionFeePercent),
      doctorFlatFeeUsd: Number(globalFees.fuseTransactionDoctorFeeUsd),
    };
};

/**
 * Get platform fee percent for a clinic based on its tier configuration
 * Falls back to global fee if clinic has no tier or tier has no custom fee
 * @param clinicId - The clinic ID to get the fee for
 * @returns The platform fee percentage to use
 */
export const getPlatformFeePercent = async (clinicId: string): Promise<number> => {
  try {
    // Fetch clinic with subscription plan and tier configuration
    const clinic = await Clinic.findByPk(clinicId, {
      include: [
        {
          model: BrandSubscriptionPlans,
          as: 'brandSubscriptionPlan',
          include: [
            {
              model: TierConfiguration,
              as: 'tierConfig',
            },
          ],
        },
      ],
    });

    // If clinic has a tier with custom fuseFeePercent, use it
    if (
      clinic?.brandSubscriptionPlan?.tierConfig?.fuseFeePercent != null
    ) {
      return Number(clinic.brandSubscriptionPlan.tierConfig.fuseFeePercent);
    }

    // Otherwise, fall back to global fee
    const globalFees = await useGlobalFees();
    return globalFees.platformFeePercent;
  } catch (error) {
    console.error('Error fetching platform fee percent:', error);
    // Fall back to global fee on error
    const globalFees = await useGlobalFees();
    return globalFees.platformFeePercent;
  }
};