export interface PostHogConfig {
  apiKey: string;
  host?: string;
  enabled?: boolean;
}

/** HIPAA-safe user properties — NO email, name, dob, address, phone */
export interface IdentifyUserParams {
  userId: string;
  role: string;
  clinicId?: string;
}
