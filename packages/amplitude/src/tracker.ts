import * as amplitude from "@amplitude/analytics-browser";
import { sessionReplayPlugin } from "@amplitude/plugin-session-replay-browser";
import { AmplitudeConfig, AmplitudeEvent, AmplitudeUser } from "./types";

let initialized = false;
let currentAppName = "";
let sampleRate = 0.1;

/** HIPAA: Property keys that must never be sent to Amplitude */
const PHI_KEYS = new Set([
  "email", "name", "firstName", "first_name", "lastName", "last_name",
  "fullName", "full_name", "phone", "phoneNumber", "phone_number",
  "dob", "dateOfBirth", "date_of_birth", "birthDate", "birth_date",
  "address", "streetAddress", "street_address", "city", "state", "zip",
  "zipCode", "zip_code", "postalCode", "postal_code",
  "ssn", "socialSecurity", "social_security",
  "insuranceId", "insurance_id", "memberId", "member_id",
  "patientName", "patient_name", "patientEmail", "patient_email",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s().+-]{7,}$/;

/** HIPAA: Strip PHI keys and redact values that look like emails/phones */
const sanitizeProperties = (
  props: Record<string, unknown>
): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (PHI_KEYS.has(key)) continue;
    if (typeof value === "string" && (EMAIL_RE.test(value) || PHONE_RE.test(value))) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export const initAmplitude = (config: AmplitudeConfig): void => {
  if (!config.apiKey) {
    return;
  }

  amplitude.init(config.apiKey, {
    autocapture: false,
    logLevel: config.debug
      ? amplitude.Types.LogLevel.Debug
      : amplitude.Types.LogLevel.None,
  });

  if (config.sessionReplay) {
    const replay = sessionReplayPlugin({
      sampleRate: config.sessionReplay.sampleRate ?? 0.01,
      privacyConfig: {
        defaultMaskLevel: "conservative",
        blockSelector: config.sessionReplay.blockSelector ?? [],
        maskSelector: config.sessionReplay.maskSelector ?? [],
      },
    });
    amplitude.add(replay);
  }

  currentAppName = config.appName;
  sampleRate = config.sampleRate ?? 0.1;
  initialized = true;

  if (config.debug) {
    console.log(`[Amplitude] Initialized for ${config.appName}${config.sessionReplay ? " (session replay enabled)" : ""}`);
  }
};

export const shutdownAmplitude = (): void => {
  if (!initialized) return;
  amplitude.flush();
  amplitude.reset();
  initialized = false;
};

export const identifyUser = (user: AmplitudeUser, appName: string): void => {
  if (!initialized) return;

  amplitude.setUserId(user.id);

  const identifyEvent = new amplitude.Identify();
  identifyEvent.set("role", user.role);
  identifyEvent.set("app_name", appName);
  if (user.clinicId) {
    identifyEvent.set("clinic_id", user.clinicId);
  }
  amplitude.identify(identifyEvent);
};

export const resetUser = (): void => {
  if (!initialized) return;
  amplitude.reset();
};

export const trackEvent = (
  eventName: AmplitudeEvent | string,
  properties?: Record<string, unknown>
): void => {
  if (!initialized) return;
  if (Math.random() > sampleRate) return;
  const raw = { ...properties, app_name: currentAppName };
  amplitude.track(eventName, sanitizeProperties(raw));
};

/** HIPAA: Strip potential PHI from query parameters before tracking */
const sanitizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url, "http://placeholder");
    for (const param of ["email", "name", "patientId", "dob", "phone", "address"]) {
      parsed.searchParams.delete(param);
    }
    // Return pathname + sanitized search (without the placeholder origin)
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
};

export const trackPageView = (url: string): void => {
  if (!initialized) return;
  trackEvent(AmplitudeEvent.PAGE_VIEW, { page_path: sanitizeUrl(url) });
};
