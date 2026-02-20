import * as amplitude from "@amplitude/analytics-browser";
import { AmplitudeConfig, AmplitudeEvent, AmplitudeUser } from "./types";

let initialized = false;
let currentAppName = "";

export function initAmplitude(config: AmplitudeConfig): void {
  if (!config.apiKey) {
    return;
  }

  amplitude.init(config.apiKey, {
    autocapture: false,
    logLevel: config.debug
      ? amplitude.Types.LogLevel.Debug
      : amplitude.Types.LogLevel.None,
  });

  currentAppName = config.appName;
  initialized = true;

  if (config.debug) {
    console.log(`[Amplitude] Initialized for ${config.appName}`);
  }
}

export function shutdownAmplitude(): void {
  if (!initialized) return;
  amplitude.flush();
  amplitude.reset();
  initialized = false;
}

export function identifyUser(user: AmplitudeUser, appName: string): void {
  if (!initialized) return;

  amplitude.setUserId(user.id);

  const identifyEvent = new amplitude.Identify();
  identifyEvent.set("role", user.role);
  identifyEvent.set("app_name", appName);
  if (user.clinicId) {
    identifyEvent.set("clinic_id", user.clinicId);
  }
  amplitude.identify(identifyEvent);
}

export function resetUser(): void {
  if (!initialized) return;
  amplitude.reset();
}

export function trackEvent(
  eventName: AmplitudeEvent | string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) return;
  amplitude.track(eventName, {
    ...properties,
    app_name: currentAppName,
  });
}

/** HIPAA: Strip potential PHI from query parameters before tracking */
function sanitizeUrl(url: string): string {
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
}

export function trackPageView(url: string): void {
  if (!initialized) return;
  trackEvent(AmplitudeEvent.PAGE_VIEW, { page_path: sanitizeUrl(url) });
}
