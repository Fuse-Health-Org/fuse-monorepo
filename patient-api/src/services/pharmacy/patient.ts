import axios, { AxiosResponse } from 'axios';
import { config, PharmacyApiConfig, PharmacyApiResponse } from './config';
import User from '../../models/User';
import ShippingAddress from '../../models/ShippingAddress';
import UserPatient from '../../models/UserPatient';
import { PharmacyProvider } from '../../models/Product';

interface PatientAllergy {
  name: string;
}

interface PatientDisease {
  name: string;
}

interface PatientMedication {
  name: string;
  strength: string;
}

interface PatientAddress {
  street: string;
  street_2?: string;
  city: string;
  state: string;
  zip: string;
}

interface CreatePatientRequest {
  first_name: string;
  middle_name?: string;
  last_name: string;
  dob: string; // Format: YYYY-MM-DD
  gender: string;
  allergies: PatientAllergy[];
  diseases: PatientDisease[];
  medications: PatientMedication[];
  email: string;
  phone_number: string; // The phone number must be 10 characters
  address: PatientAddress;
}

interface UserToPatientValidationResult {
  valid: boolean;
  missingFields: string[];
  errorMessage?: string;
}

class PatientService {
  private config: PharmacyApiConfig;

  constructor() {
    this.config = config
  }

  async createPatient(patientData: CreatePatientRequest): Promise<PharmacyApiResponse> {
    try {
      const response: AxiosResponse = await axios.post(
        `${this.config.baseUrl}/api/clinics/patients`,
        patientData,
        {
          params: {
            api_key: this.config.apiKey
          },
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error creating patient:', error);

      if (axios.isAxiosError(error)) {
        console.error('🔍 AbsoluteRX Patient Creation Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: JSON.stringify(error.response?.data, null, 2)
        });

        return {
          success: false,
          error: error.response?.data?.message || error.message,
          message: `HTTP ${error.response?.status}: ${error.response?.statusText}`,
          validationErrors: error.response?.data?.errors
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async updatePatient(patientId: number, patientData: CreatePatientRequest): Promise<PharmacyApiResponse> {
    try {
      const response: AxiosResponse = await axios.put(
        `${this.config.baseUrl}/api/clinics/patients/${patientId}`,
        patientData,
        {
          params: {
            api_key: this.config.apiKey
          },
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error updating patient:', error);

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.message || error.message,
          message: `HTTP ${error.response?.status}: ${error.response?.statusText}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  validateUserForPatientCreation(user: User, hasShippingAddress: boolean = false): UserToPatientValidationResult {
    const missingFields: string[] = [];

    // Required string fields for CreatePatientRequest
    if (!user.firstName?.trim()) {
      missingFields.push('firstName (first_name)');
    }
    if (!user.lastName?.trim()) {
      missingFields.push('lastName (last_name)');
    }
    if (!user.dob) {
      missingFields.push('dob (date of birth in YYYY-MM-DD format)');
    }
    if (!user.gender?.trim()) {
      missingFields.push('gender');
    }
    if (!user.email?.trim()) {
      missingFields.push('email');
    }
    if (!user.phoneNumber?.trim()) {
      missingFields.push('phoneNumber (phone_number)');
    }

    // Array fields for CreatePatientRequest - will default to empty arrays if missing
    // No validation needed, as mapUserToPatientRequest will handle defaults

    // Required address fields - only validate if no shipping address is provided
    if (!hasShippingAddress) {
      if (!user.address?.trim()) {
        missingFields.push('address (street)');
      }
      if (!user.city?.trim()) {
        missingFields.push('city');
      }
      if (!user.state?.trim()) {
        missingFields.push('state');
      }
      if (!user.zipCode?.trim()) {
        missingFields.push('zipCode (zip)');
      }
    }

    if (missingFields.length > 0) {
      return {
        valid: false,
        missingFields,
        errorMessage: `Missing required fields for patient creation: ${missingFields.join(', ')}`
      };
    }

    return {
      valid: true,
      missingFields: []
    };
  }

  async mapUserToPatientRequest(user: User, addressId?: string): Promise<CreatePatientRequest> {
    let address: PatientAddress;

    if (addressId) {
      // Use shipping address if provided
      const shippingAddress = await ShippingAddress.findOne({
        where: { id: addressId, userId: user.id }
      });

      if (shippingAddress) {
        address = {
          street: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode
        };
      } else {
        // Fallback to user address if shipping address not found
        address = {
          street: user.address!,
          city: user.city!,
          state: user.state!,
          zip: user.zipCode!
        };
      }
    } else {
      // Use user address
      address = {
        street: user.address!,
        city: user.city!,
        state: user.state!,
        zip: user.zipCode!
      };
    }

    // Format gender for AbsoluteRX (expects "Male" or "Female", capitalized)
    let formattedGender = user.gender!;
    if (formattedGender.toLowerCase() === 'male') {
      formattedGender = 'Male';
    } else if (formattedGender.toLowerCase() === 'female') {
      formattedGender = 'Female';
    }

    // Format phone number: remove all non-digits and take last 10 digits only
    const cleanPhone = user.phoneNumber!.replace(/[^0-9]/g, '');
    const phoneNumber = cleanPhone.slice(-10); // Take last 10 digits

    return {
      first_name: user.firstName,
      last_name: user.lastName,
      dob: user.dob!, // Format: YYYY-MM-DD
      gender: formattedGender,
      allergies: Array.isArray(user.allergies) ? user.allergies : [],
      diseases: Array.isArray(user.diseases) ? user.diseases : [],
      medications: Array.isArray(user.medications) ? user.medications : [],
      email: user.email,
      phone_number: phoneNumber,
      address: address
    };
  }

  async syncPatientFromUser(userId: string, addressId?: string): Promise<string> {

    const user = await User.findByPk(userId);

    if (!user) {
      throw Error("User not found")
    }

    console.log(`🔍 Syncing patient for user ${userId}:`, {
      hasPhoneNumber: !!user.phoneNumber,
      hasDob: !!user.dob,
      hasGender: !!user.gender,
      hasAddress: !!user.address
    });

    const pharmacyPatient = await UserPatient.findOne({
      where: {
        pharmacyProvider: PharmacyProvider.ABSOLUTERX,
        userId: user.id
      }
    })

    const pharmacyPatientId = pharmacyPatient?.pharmacyPatientId

    const validation = this.validateUserForPatientCreation(user, !!addressId);

    if (!validation.valid) {
      console.error('❌ Patient validation failed:', {
        userId: user.id,
        missingFields: validation.missingFields,
        errorMessage: validation.errorMessage
      });
      throw Error(`Cannot sync patient: ${validation.errorMessage || validation.missingFields.join(', ')}`)
    }

    const patientRequest = await this.mapUserToPatientRequest(user, addressId);

    if (pharmacyPatientId) {
      this.updatePatient(
        parseInt(pharmacyPatientId),
        patientRequest
      );
      return pharmacyPatient.pharmacyPatientId
    } else {

      // Create new patient
      const result = await this.createPatient(patientRequest);

      // If creation successful, save the pharmacy patient ID to user
      if (result.success && result.data?.id) {
        await UserPatient.create(
          {
            userId: userId, pharmacyProvider: PharmacyProvider.ABSOLUTERX,
            pharmacyPatientId: result.data.id
          }
        );
        return result.data.id;
      } else {
        // Patient creation failed
        console.error('❌ Failed to create patient in AbsoluteRX:', {
          error: result.error,
          validationErrors: result.validationErrors
        });
        throw new Error(`Failed to create patient in pharmacy: ${result.error}`);
      }

    }

  }

}

export default PatientService;
export type {
  CreatePatientRequest,
  PatientAllergy,
  PatientDisease,
  PatientMedication,
  PatientAddress,
};