import axios from 'axios';
import { resolveMdIntegrationsBaseUrl } from './config';

interface License {
  license_id: string;
  type: string;
  value: string;
}

interface Clinician {
  first_name: string;
  last_name: string;
  suffix: string;
  profile_url: string;
  is_online: boolean;
  clinician_id: string;
  full_name: string;
  specialty: string;
  licenses: License[];
}

interface CaseAssignment {
  created_at: string;
  case_assignment_id: string;
  clinician: Clinician;
}

interface Patient {
  prefix: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  gender: number;
  phone_number: string;
  phone_type: string;
  active: boolean;
  metadata: string;
}

interface CaseResponse {
  case_id: string;
  metadata: string;
  patient: Patient;
  case_assignment: CaseAssignment;
}

interface Offering {
  offering_id: string;
}

interface Disease {
  disease_id: string
}

interface Question {
  question: string;
  answer: string;
  type: string;
}

export interface CaseQuestionPayload {
  question: string;
  answer: string;
  type: string;
}

export interface CreateCaseRequest {
  hold_status?: boolean;
  is_additional_approval_needed?: boolean;
  reference_case_id?: string;
  patient_id: string;
  metadata?: string;
  clinician_id?: string;
  case_offerings?: Offering[];
  diseases?: Disease[];
  case_files?: string[];
  case_questions?: CaseQuestionPayload[];
  is_chargeable?: boolean;
  tags?: Array<{ uuid: string }>;
}

class MDCaseService {
  async getCase(caseId: string, accessToken: string): Promise<CaseResponse> {
    const response = await axios.get<CaseResponse>(
      resolveMdIntegrationsBaseUrl(`/partner/cases/${caseId}`),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async getCaseOfferings(caseId: string, accessToken: string): Promise<any[]> {
    const response = await axios.get<any[]>(
      resolveMdIntegrationsBaseUrl(`/partner/cases/${caseId}/offerings`),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async createCase(caseData: CreateCaseRequest, accessToken: string): Promise<CaseResponse> {
    const response = await axios.post<CaseResponse>(
      resolveMdIntegrationsBaseUrl('/partner/cases'),
      caseData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  /**
   * List all available offerings for the partner
   * These are the treatment types/services you can use when creating cases
   */
  async listOfferings(accessToken: string): Promise<any[]> {
    const response = await axios.get<any>(
      resolveMdIntegrationsBaseUrl('/partner/offerings'),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // API might return { data: [...] } or just [...]
    return response.data?.data || response.data || [];
  }

  /**
   * List all available products/services that can be prescribed
   * These are the actual medications/services available through DoseSpot
   */
  async listProducts(accessToken: string, params?: { page?: number; per_page?: number; search?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    if (params?.search) queryParams.append('search', params.search);

    const url = resolveMdIntegrationsBaseUrl('/partner/products') + 
      (queryParams.toString() ? `?${queryParams.toString()}` : '');

    const response = await axios.get<any>(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }
}

export default new MDCaseService();