import { GlobalFees } from "@models/GlobalFees";
import Clinic from "@models/Clinic";
import BrandSubscriptionPlans from "@models/BrandSubscriptionPlans";
import TierConfiguration from "@models/TierConfiguration";
import BrandSubscription, { BrandSubscriptionStatus } from "@models/BrandSubscription";
import User from "@models/User";

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

const getClinicTierConfig = async (clinicId: string): Promise<TierConfiguration | null> => {
  // Preferred source: active BrandSubscription linked to any user in this clinic
  const activeBrandSubscription = await BrandSubscription.findOne({
    where: { status: BrandSubscriptionStatus.ACTIVE },
    include: [
      {
        model: User,
        required: true,
        where: { clinicId },
        attributes: ["id"],
      },
    ],
    order: [["updatedAt", "DESC"]],
  });

  if (activeBrandSubscription?.planType) {
    const planByType = await BrandSubscriptionPlans.findOne({
      where: {
        planType: activeBrandSubscription.planType,
        isActive: true,
      },
      include: [
        {
          model: TierConfiguration,
          as: "tierConfig",
        },
      ],
    });

    if (planByType?.tierConfig) {
      return planByType.tierConfig;
    }
  }

  // Fallback: clinic.brandSubscriptionPlanId direct link (legacy/newer path)
  const clinic = await Clinic.findByPk(clinicId, {
    include: [
      {
        model: BrandSubscriptionPlans,
        as: "brandSubscriptionPlan",
        include: [
          {
            model: TierConfiguration,
            as: "tierConfig",
          },
        ],
      },
    ],
  });

  return clinic?.brandSubscriptionPlan?.tierConfig ?? null;
};

/**
 * Get platform fee percent for a clinic based on its tier configuration
 * Falls back to global fee if clinic has no tier or tier has no custom fee
 * @param clinicId - The clinic ID to get the fee for
 * @returns The platform fee percentage to use
 */
export const getPlatformFeePercent = async (clinicId: string): Promise<number> => {
  try {
    const tierConfig = await getClinicTierConfig(clinicId);
    if (tierConfig?.fuseFeePercent != null) {
      return Number(tierConfig.fuseFeePercent);
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

/**
 * Get non-medical services profit percentage for a clinic based on tier configuration.
 */
export const getNonMedicalServicesProfitPercent = async (clinicId: string): Promise<number> => {
  try {
    const tierConfig = await getClinicTierConfig(clinicId);
    if (tierConfig?.nonMedicalProfitPercent != null) {
      return Number(tierConfig.nonMedicalProfitPercent);
    }

    return 0;
  } catch (error) {
    console.error("Error fetching non-medical services profit percent:", error);
    return 0;
  }
};