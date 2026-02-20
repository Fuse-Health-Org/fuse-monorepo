export enum AmplitudeEvent {
  PAGE_VIEW = "Page Viewed",
  LOGIN = "Login",
  LOGOUT = "Logout",
  ORDER_STARTED = "Order Started",
  ORDER_COMPLETED = "Order Completed",
  FORM_STARTED = "Form Started",
  FORM_SUBMITTED = "Form Submitted",
  BUTTON_CLICKED = "Button Clicked",
  SEARCH_PERFORMED = "Search Performed",
  FILTER_APPLIED = "Filter Applied",
  MODAL_OPENED = "Modal Opened",
  MODAL_CLOSED = "Modal Closed",
  ERROR_OCCURRED = "Error Occurred",
}

/** HIPAA-safe user properties — no PII (names, emails, DOB, addresses) */
export interface AmplitudeUserProperties {
  role: string;
  clinicId?: string;
  appName: string;
}

export interface SessionReplayConfig {
  /** Fraction of sessions to record (0–1). Defaults to 0.01 (1%). */
  sampleRate?: number;
  /** Additional CSS selectors to completely block from replay (e.g. '[data-patient]', '.phi-content'). */
  blockSelector?: string[];
  /** Additional CSS selectors to mask text content in replay. */
  maskSelector?: string[];
}

export interface AmplitudeConfig {
  apiKey: string;
  appName: string;
  debug?: boolean;
  /** Fraction of events to send (0–1). Defaults to 0.1 (10%). */
  sampleRate?: number;
  /** Session replay configuration. Omit to disable session replay entirely. */
  sessionReplay?: SessionReplayConfig;
}

export interface AmplitudeUser {
  id: string;
  role: string;
  clinicId?: string;
}
