import axios from 'axios';
import { resolveMdIntegrationsBaseUrl } from './config';

interface Address {
  address: string;
  address2?: string;
  zip_code: string;
  city_name?: string;
  city_id?: string;
  state_name?: string;
}

interface Metafield {
  key: string;
  title?: string;
  value: string;
  type: string;
}

interface File {
  path: string;
  name: string;
  mime_type: string;
  url: string;
  url_thumbnail: string | null;
  file_id: string;
  created_at?: string;
}

interface State {
  name: string;
  abbreviation: string;
  state_id: string;
  is_av_flow: boolean;
  country: {
    country_id: string;
    name: string;
    abbreviation: string;
  };
}

interface AddressResponse {
  address: string;
  address2: string;
  zip_code: string;
  city_name: string;
  address_id: string;
  state: State;
}

interface DoseSpot {
  patient_dosespot_id?: string;
  dosespot_id?: number;
  synced_at?: string;
  sync_status: string;
  metadata?: string;
  eligibilities?: Array<{ patient_eligibility_id: string }>;
}

interface Partner {
  name: string;
  partner_id: string;
  support_message_capability: string;
  partner_notes: string;
  operations_support_email: string;
  customer_support_email: string;
  patient_message_capability: string;
  vouched_integration_type: string;
  business_model: string;
  enable_av_flow: boolean;
  enable_icd_bmi: boolean;
  is_auto_dl_flow: boolean;
  slack_channel_id: string;
  operation_country: {
    name: string;
    abbreviation: string;
    country_id: string;
  };
}


// ISO 5218 gender format
export type MDGender = 0 | 1 | 2 | 9; // 0 = not known, 1 = male, 2 = female, 9 = not applicable
export type MDPhoneType = 2 | 4; // 2 (cell) or 4 (home)

interface CreatePatientRequest {
  prefix?: string;
  first_name: string;
  last_name: string;
  ssn?: string;
  email: string;
  date_of_birth: string;
  driver_license_id?: string;
  gender: MDGender;
  metadata?: string;
  phone_number: string; //Phone number - US format
  phone_type: MDPhoneType;
  address: Address;
  weight?: number;
  height?: number;
  allergies?: string;
  pregnancy?: boolean;
  current_medications?: string;
  medical_conditions?: string;
  special_necessities?: string;
  intro_video_id?: string;
  metafields?: Metafield[];
}

interface UpdatePatientRequest {
  prefix?: string;
  first_name?: string;
  last_name?: string;
  ssn?: string;
  email?: string;
  date_of_birth?: string;
  driver_license_id?: string;
  gender?: MDGender;
  metadata?: string;
  phone_number?: string;
  phone_type?: number;
  address?: Address;
  weight?: number;
  height?: number;
  allergies?: string;
  pregnancy?: boolean;
  current_medications?: string;
  medical_conditions?: string;
  special_necessities?: string;
  intro_video_id?: string;
}

interface PatientResponse {
  partner_id: string;
  prefix: string;
  ssn: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  metadata: string;
  gender: number;
  gender_label: string;
  phone_number: string;
  phone_type: number;
  date_of_birth: string;
  active: boolean;
  weight: number;
  height: number;
  blood_pressure?: string;
  is_live: boolean;
  dosespot: DoseSpot;
  patient_id: string;
  current_medications: string;
  allergies: string;
  medical_conditions: string;
  special_necessities: string;
  pregnancy: boolean;
  driver_license?: File;
  intro_video?: File;
  address: AddressResponse;
  metafields?: Array<{
    id: string;
    model_type: string;
    model_id: string;
    key: string;
    value: string;
    scope: string;
    type: string;
    title: string;
    metadata: string | null;
    emailed_at: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>;
  partner?: Partner;
  auth_link?: string;
}

interface DriversLicenseResponse {
  drivers_license_url: string;
  verification_code: string;
}

class MDPatientService {
  async createPatient(patientData: CreatePatientRequest, accessToken: string): Promise<PatientResponse> {
    try {
      const response = await axios.post<PatientResponse>(
        resolveMdIntegrationsBaseUrl('/partner/patients'),
        patientData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      // Log the full error details for debugging
      if (axios.isAxiosError(error) && error.response) {
        const errorDetails = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          requestData: patientData,
        };
        console.error('[MD-PATIENT] ❌ Error creating patient in MD Integrations:', JSON.stringify(errorDetails, null, 2));
        throw new Error(`MD Integrations API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async updatePatient(patientId: string, patientData: UpdatePatientRequest, accessToken: string): Promise<PatientResponse> {
    const response = await axios.patch<PatientResponse>(
      resolveMdIntegrationsBaseUrl(`/partner/patients/${patientId}`),
      patientData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async getPatient(patientId: string, accessToken: string): Promise<PatientResponse> {
    const response = await axios.get<PatientResponse>(
      resolveMdIntegrationsBaseUrl(`/partner/patients/${patientId}`),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }


}

export default new MDPatientService();