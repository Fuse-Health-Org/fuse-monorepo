import { olympiaPharmacyAuthService } from './auth.service';

/**
 * Olympia Pharmacy API Service
 * 
 * Service for making API calls to Olympia Pharmacy.
 * Uses the auth service to handle authentication automatically.
 */

// ========== Patient Interfaces ==========

interface OlympiaPatient {
  uuid?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  dob: string; // Format: YYYY-MM-DD
  gender: 'M' | 'F';
  allergies: string;
  medication_list: string;
  email: string;
  phone?: string;
  b_addr_1?: string; // Billing address line 1
  b_addr_2?: string; // Billing address line 2
  b_addr_city?: string;
  b_addr_state?: string;
  b_addr_zip?: string;
  s_addr_1: string; // Shipping address line 1
  s_addr_2?: string; // Shipping address line 2
  s_addr_city: string;
  s_addr_state: string;
  s_addr_zip: string;
  drivers_license_state?: string;
  drivers_license_number?: string;
  drivers_license_exp_date?: string;
  email_opt_in?: string;
  emr_record_id?: string; // Third-party EMR ID
  has_pending_prescription?: boolean;
  has_processing_prescription?: boolean;
}

interface CreatePatientRequest extends Omit<OlympiaPatient, 'uuid' | 'has_pending_prescription' | 'has_processing_prescription'> {}

interface CreatePatientResponse {
  uuid: string;
}

interface UpdatePatientRequest extends Partial<OlympiaPatient> {
  uuid: string; // UUID is required for updates
}

interface UpdatePatientResponse {
  uuid: string;
}

interface SearchPatientField {
  search: string;
  wildcard?: 'before' | 'after' | 'both';
}

interface SearchPatientsRequest {
  [key: string]: SearchPatientField;
}

// ========== Prescription Interfaces ==========

interface PrescriptionProduct {
  prod_id: number;
  qty: number;
  sig: string; // Prescription instructions (e.g., "Use as directed")
  doc_note?: string; // Doctor's notes
  refills: number;
}

interface PrescriptionPhysician {
  physician_fname: string;
  physician_lname: string;
  physician_phone: string;
  physician_npi: string; // National Provider Identifier
}

interface CreatePrescriptionRequest {
  patient_id: string; // Olympia patient UUID (13 characters)
  physician: PrescriptionPhysician;
  products: PrescriptionProduct[];
  allergies?: string;
  med_cond?: string; // Medical conditions
  p_last_visit?: string; // Format: YYYY-MM-DD
  ship_method: string; // e.g., "overnight", "standard"
  ship_to: string; // e.g., "patient", "physician"
  bill_to: string; // e.g., "patient", "physician"
  vendor_order_id?: string; // Your internal order ID for tracking
  pt_team_username?: string;
  
  // Optional patient override fields
  pt_fname?: string;
  pt_lname?: string;
  pt_address?: string;
  pt_address2?: string;
  pt_city?: string;
  pt_state?: string;
  pt_zip?: string;
  pt_phone?: string;
  pt_email?: string;
  pt_dob?: string;
  pt_dl_state?: string;
  pt_dl_number?: string;
  pt_dl_exp?: string;
  
  // Optional shipping override
  ship_address_1?: string;
  ship_address_2?: string;
  ship_city?: string;
  ship_state?: string;
  ship_zip?: string;
  
  // Optional additional fields
  created_date?: string; // datetime
  est_ship_date?: string; // datetime
  ship_date?: string; // datetime
  technician?: number;
  notes?: string;
  entered?: string; // date
  entered_by?: number;
  po?: string; // Purchase order
  refills?: number;
  can_by?: string;
  cc_used?: number;
  patient_team_id?: number;
  credit_card_ref?: string;
  discount_code_applied?: string;
}

interface CreatePrescriptionResponse {
  prescriptionID: number;
}

class OlympiaPharmacyApiService {
  // ========== Patient Methods ==========

  /**
   * Create a new patient in Olympia Pharmacy
   * If patient already exists, returns existing patient UUID
   * @param data Patient data
   * @returns Patient UUID
   */
  async createPatient(data: CreatePatientRequest): Promise<CreatePatientResponse> {
    try {
      console.log('👤 Creating patient in Olympia Pharmacy:', data.email);

      const client = await olympiaPharmacyAuthService.getAuthenticatedClient();

      const response = await client.post<CreatePatientResponse>(
        '/api/v2/createPatient',
        data
      );

      console.log('✅ Patient created successfully, UUID:', response.data.uuid);

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('🔄 Token expired, refreshing and retrying...');
        await olympiaPharmacyAuthService.refreshToken();
        const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
        const response = await client.post<CreatePatientResponse>(
          '/api/v2/createPatient',
          data
        );
        return response.data;
      }

      console.error('❌ Failed to create patient:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Search for patients in Olympia Pharmacy
   * @param searchCriteria Search criteria with optional wildcards
   * @returns Array of matching patients
   */
  async searchPatients(searchCriteria: SearchPatientsRequest): Promise<OlympiaPatient[]> {
    try {
      console.log('🔍 Searching patients in Olympia Pharmacy:', JSON.stringify(searchCriteria));

      const client = await olympiaPharmacyAuthService.getAuthenticatedClient();

      const response = await client.post<OlympiaPatient[]>(
        '/api/v2/searchPatients',
        searchCriteria
      );

      console.log('✅ Found', response.data.length, 'patient(s)');

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('🔄 Token expired, refreshing and retrying...');
        await olympiaPharmacyAuthService.refreshToken();
        const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
        const response = await client.post<OlympiaPatient[]>(
          '/api/v2/searchPatients',
          searchCriteria
        );
        return response.data;
      }

      console.error('❌ Failed to search patients:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update an existing patient in Olympia Pharmacy
   * @param data Patient data with UUID (only include fields to update)
   * @returns Updated patient UUID
   */
  async updatePatient(data: UpdatePatientRequest): Promise<UpdatePatientResponse> {
    try {
      console.log('📝 Updating patient in Olympia Pharmacy, UUID:', data.uuid);

      const client = await olympiaPharmacyAuthService.getAuthenticatedClient();

      const response = await client.post<UpdatePatientResponse>(
        '/api/v2/updatePatient',
        data
      );

      console.log('✅ Patient updated successfully, UUID:', response.data.uuid);

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('🔄 Token expired, refreshing and retrying...');
        await olympiaPharmacyAuthService.refreshToken();
        const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
        const response = await client.post<UpdatePatientResponse>(
          '/api/v2/updatePatient',
          data
        );
        return response.data;
      }

      console.error('❌ Failed to update patient:', error.response?.data || error.message);
      throw error;
    }
  }

  // ========== Prescription Methods ==========

  /**
   * Create a new prescription order in Olympia Pharmacy
   * @param data Prescription data including patient ID, physician, and products
   * @returns Prescription ID
   */
  async createPrescription(data: CreatePrescriptionRequest): Promise<CreatePrescriptionResponse> {
    try {
      console.log('💊 Creating prescription in Olympia Pharmacy for patient:', data.patient_id);

      // Get authenticated axios client
      const client = await olympiaPharmacyAuthService.getAuthenticatedClient();

      // Make API request
      const response = await client.post<CreatePrescriptionResponse>(
        '/api/v2/createPrescription',
        data
      );

      console.log('✅ Prescription created successfully, ID:', response.data.prescriptionID);

      return response.data;
    } catch (error: any) {
      // Handle 401 - token might have expired
      if (error.response?.status === 401) {
        console.log('🔄 Token expired, refreshing and retrying...');
        
        // Refresh token and retry once
        await olympiaPharmacyAuthService.refreshToken();
        const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
        
        const response = await client.post<CreatePrescriptionResponse>(
          '/api/v2/createPrescription',
          data
        );
        
        return response.data;
      }

      console.error('❌ Failed to create prescription:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get prescription order status
   * @param orderId Olympia's order ID
   */
  async getOrderStatus(orderId: string): Promise<any> {
    try {
      const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
      
      const response = await client.get(`/api/v2/order/${orderId}`);
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await olympiaPharmacyAuthService.refreshToken();
        const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
        const response = await client.get(`/api/v2/order/${orderId}`);
        return response.data;
      }

      console.error('❌ Failed to get order status:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get available products from Olympia Pharmacy
   */
  async getProducts(): Promise<any> {
    try {
      const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
      
      const response = await client.get('/api/v2/products');
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await olympiaPharmacyAuthService.refreshToken();
        const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
        const response = await client.get('/api/v2/products');
        return response.data;
      }

      console.error('❌ Failed to get products:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Cancel a prescription order
   * @param orderId Olympia's order ID
   */
  async cancelOrder(orderId: string): Promise<any> {
    try {
      const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
      
      const response = await client.post(`/api/v2/order/${orderId}/cancel`);
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await olympiaPharmacyAuthService.refreshToken();
        const client = await olympiaPharmacyAuthService.getAuthenticatedClient();
        const response = await client.post(`/api/v2/order/${orderId}/cancel`);
        return response.data;
      }

      console.error('❌ Failed to cancel order:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Export singleton instance
export const olympiaPharmacyApiService = new OlympiaPharmacyApiService();

// Export types for use in other modules
export type {
  OlympiaPatient,
  CreatePatientRequest,
  CreatePatientResponse,
  UpdatePatientRequest,
  UpdatePatientResponse,
  SearchPatientsRequest,
  SearchPatientField,
  PrescriptionProduct,
  PrescriptionPhysician,
  CreatePrescriptionRequest,
  CreatePrescriptionResponse,
};
