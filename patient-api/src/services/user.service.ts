import User from "../models/User";
import { getUser, updateUser } from "./db/user";
import PatientService, {
  CreatePatientRequest,
  PatientAddress,
} from "./pharmacy/patient";
import { ShippingAddressService, AddressData } from "./shippingAddress.service";
import ShippingAddress from "../models/ShippingAddress";
import MDPatientService from "./mdIntegration/MDPatient.service";
import MDAuthService from "./mdIntegration/MDAuth.service";
import { MDGender, MDPhoneType } from "./mdIntegration/MDPatient.service";
import { StripeService } from "@fuse/stripe";

interface UserToPhysicianValidationResult {
  valid: boolean;
  missingFields: string[];
  errorMessage?: string;
}

class UserService {
  private patientService: PatientService;
  private stripeService: StripeService;

  constructor() {
    this.patientService = new PatientService();
    this.stripeService = new StripeService();
  }

  async getOrCreateCustomerId(
    user: User,
    metadata?: Record<string, string>
  ): Promise<string> {
    let stripeCustomerId = user.stripeCustomerId;

    if (stripeCustomerId) {
      try {
        await this.stripeService.getCustomer(stripeCustomerId);
        return stripeCustomerId;
      } catch (error: any) {
        if (
          error?.code === "resource_missing" ||
          error?.type === "StripeInvalidRequestError"
        ) {
          stripeCustomerId = undefined;
        } else {
          throw error;
        }
      }
    }

    const stripeCustomer = await this.stripeService.createCustomer(
      user.email,
      `${user.firstName} ${user.lastName}`,
      metadata || {}
    );

    await user.update({
      stripeCustomerId: stripeCustomer.id,
    });

    return stripeCustomer.id;
  }

  private mapGenderToMDFormat(gender: string): MDGender {
    const genderLower = gender.toLowerCase();
    switch (genderLower) {
      case "male":
      case "m":
        return 1;
      case "female":
      case "f":
        return 2;
      case "not applicable":
      case "n/a":
        return 9;
      default:
        return 0;
    }
  }

  private validatePhoneTypeForMD(): MDPhoneType {
    return 2;
  }

  private formatPhoneNumberToUS(phoneNumber: string): string {
    const digits = phoneNumber.replace(/[^0-9]/g, "");

    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      const areaCode = digits.slice(1, 4);
      const exchange = digits.slice(4, 7);
      const number = digits.slice(7);
      return `(${areaCode}) ${exchange}-${number}`;
    } else {
      return phoneNumber;
    }
  }

  async mapUserToMDPatientRequest(user: User, addressId?: string) {
    let address;

    if (addressId) {
      const shippingAddress = await ShippingAddress.findOne({
        where: { id: addressId, userId: user.id },
      });

      if (shippingAddress) {
        address = {
          address: shippingAddress.address,
          address2: shippingAddress.apartment || undefined,
          city_name: shippingAddress.city,
          state_name: shippingAddress.state,
          zip_code: shippingAddress.zipCode,
        };
      }
    }

    if (!address) {
      address = {
        address: user.address!,
        city_name: user.city!,
        state_name: user.state!,
        zip_code: user.zipCode!,
      };
    }

    return {
      first_name: user.firstName!,
      last_name: user.lastName!,
      email: user.email!,
      date_of_birth: user.dob!,
      gender: this.mapGenderToMDFormat(user.gender!),
      phone_number: this.formatPhoneNumberToUS(user.phoneNumber!),
      phone_type: this.validatePhoneTypeForMD(),
      address: address,
      allergies:
        user.allergies?.map((allergy) => allergy.name).join(", ") || "",
      current_medications:
        user.medications?.map((med) => med.name).join(", ") || "",
      medical_conditions:
        user.diseases?.map((disease) => disease.name).join(", ") || "",
    };
  }

  async syncPatientInMD(userId: string, addressId?: string) {
    let user: any = null;
    try {
      user = await getUser(userId);

      if (!user) {
        throw Error("User not found");
      }

      const tokenResponse = await MDAuthService.generateToken();
      const mdPatientRequest = await this.mapUserToMDPatientRequest(
        user,
        addressId
      );

      if (!user.mdPatientId) {
        const mdResult = await MDPatientService.createPatient(
          mdPatientRequest,
          tokenResponse.access_token
        );

        if (mdResult.patient_id) {
          await User.update(
            { mdPatientId: mdResult.patient_id },
            { where: { id: userId } }
          );
        }
      } else {
        await MDPatientService.updatePatient(
          user.mdPatientId,
          mdPatientRequest,
          tokenResponse.access_token
        );
      }

      await user.reload();
      return user;
    } catch (error) {
      // Try to get user info for logging if available
      if (!user) {
        try {
          user = await getUser(userId);
        } catch {
          // Ignore if we can't get user
        }
      }

      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error syncing with MD Integration:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId,
          hasDob: Boolean(user?.dob),
          hasGender: Boolean(user?.gender),
          hasPhone: Boolean(user?.phoneNumber),
          hasFirstName: Boolean(user?.firstName),
          hasLastName: Boolean(user?.lastName),
          hasEmail: Boolean(user?.email),
        });
      }
      // Log the actual error so we can debug
      console.error("❌ [MD-SYNC] Failed to sync patient:", error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async updateUserPatient(
    userId: string,
    updateData: Partial<User>,
    addressData?: AddressData
  ) {
    try {
      const user = await getUser(userId);

      if (!user) {
        return { success: false, error: "User not found" };
      }

      if (user.role !== "patient") {
        return {
          success: false,
          error: "Only patient users can be updated through this method",
        };
      }

      const {
        email,
        clinicId,
        createdAt,
        updatedAt,
        passwordHash,
        role,
        ...safeUpdateData
      } = updateData;

      await updateUser(userId, safeUpdateData);

      let addressId = addressData?.addressId;
      if (addressData) {
        const updatedAddress =
          await ShippingAddressService.updateOrCreateAddress(
            userId,
            addressData
          );
        addressId = updatedAddress.id;
      }

      await this.syncPatientInMD(userId, addressId);

      return {
        success: true,
        message: "User updated successfully",
      };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error updating user");
      }
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async updateUserDoctor(userId: string, updateData: Partial<User>) {
    try {
      const user = await getUser(userId);

      if (!user) {
        return {
          success: false,
          error: "User not found",
        };
      }

      if (user.role !== "doctor") {
        return {
          success: false,
          error: "Only doctor users can be updated through this method",
        };
      }

      await updateUser(userId, updateData);

      return {
        success: true,
        message: "Doctor updated successfully",
      };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error updating doctor");
      }
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

export default UserService;
export type { UserToPhysicianValidationResult };
