import axios from 'axios';
import { resolveQualiphyBaseUrl, qualiphyConfig } from './config';

export interface ExamInviteRequest {
    api_key: string;
    exams: number[];
    first_name: string;
    last_name: string;
    email: string;
    dob: string;
    phone_number: string;
    tele_state: string;
    pharmacy_id?: number;
    provider_pos_selection?: number;
    webhook_url?: string;
    additional_data?: string;
}

export interface PatientExam {
    patient_exam_id: number;
    exam_title: string;
    exam_id: number;
}

export interface ExamInviteResponse {
    http_code: number;
    meeting_url: string;
    meeting_uuid: string;
    patient_exams: PatientExam[];
}

export interface ExamQuestionsRequest {
    api_key: string;
    meeting_uuid: string;
    patient_exam_id: number;
}

export interface ExamQuestionResponse {
    response: string;
    input_field: number;
    exam_question_response_id: number;
}

export interface ExamQuestion {
    id: number;
    question: string;
    responses: ExamQuestionResponse[];
}

export interface ExamAnswer {
    question_id: number;
    exam_question_response_id?: number;
    response?: string;
}

export interface ExamQuestionsResponse {
    answers: ExamAnswer[];
    exam_id: number;
    http_code: number;
    questions: ExamQuestion[];
    meeting_uuid: string;
    patient_exam_id: number;
}

export interface QualiphyErrorResponse {
    error_message: string;
}

class QualiphyExamService {
    /**
     * Invite a patient to an exam
     * @param inviteData Patient and exam data
     * @returns Exam invite response with meeting URL and UUID
     */
    async invitePatientToExam(inviteData: Omit<ExamInviteRequest, 'api_key'>): Promise<ExamInviteResponse> {
        try {
            const payload: ExamInviteRequest = {
                ...inviteData,
                api_key: qualiphyConfig.apiKey,
            };

            const response = await axios.post<ExamInviteResponse>(
                resolveQualiphyBaseUrl('/exam_invite'),
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                const errorData = error.response.data as QualiphyErrorResponse;
                throw new Error(errorData.error_message || `Qualiphy API error: ${error.response.status}`);
            }
            console.error('❌ Error inviting patient to Qualiphy exam:', error);
            throw new Error(`Failed to invite patient to exam: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get exam questions and answers for a patient exam
     * @param meetingUuid Meeting UUID from the exam invite
     * @param patientExamId Patient exam ID from the exam invite
     * @returns Exam questions with possible responses and existing answers
     */
    async getExamQuestions(meetingUuid: string, patientExamId: number): Promise<ExamQuestionsResponse> {
        try {
            const payload: ExamQuestionsRequest = {
                api_key: qualiphyConfig.apiKey,
                meeting_uuid: meetingUuid,
                patient_exam_id: patientExamId,
            };

            const response = await axios.post<ExamQuestionsResponse>(
                resolveQualiphyBaseUrl('/exam_questions'),
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                const errorData = error.response.data as QualiphyErrorResponse;
                throw new Error(errorData.error_message || `Qualiphy API error: ${error.response.status}`);
            }
            console.error('❌ Error fetching Qualiphy exam questions:', error);
            throw new Error(`Failed to fetch exam questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export default new QualiphyExamService();
