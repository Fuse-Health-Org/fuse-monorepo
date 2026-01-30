import { GlobalFees } from "@models/GlobalFees";

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