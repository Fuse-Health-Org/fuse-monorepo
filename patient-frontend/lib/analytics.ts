import { apiCall } from "./api";

interface TrackEventParams {
  userId: string;
  productId: string;
  formId: string;
  eventType: "view" | "conversion" | "dropoff";
  sessionId?: string;
  dropOffStage?: "product" | "payment" | "account";
  metadata?: Record<string, any>;
}

// Deduplication cache to prevent duplicate tracking events
// Key format: userId:productId:formId:eventType
const recentEvents = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000; // 5 seconds

/**
 * Get approximate location from IP (client-side fallback)
 */
const getApproximateLocation = async (): Promise<string> => {
  try {
    // Try to get location from ipapi.co (free tier)
    const response = await fetch('https://ipapi.co/json/', { timeout: 2000 } as any);
    if (response.ok) {
      const data = await response.json();
      return `${data.city}, ${data.region_code}`;
    }
  } catch {
    // Fallback to browser timezone
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return timezone.split('/')[1] || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }
  return 'Unknown';
};

/**
 * Track a form view event
 */
export const trackFormView = async (params: {
  userId: string;
  productId: string;
  formId: string;
  clinicId?: string;
  clinicName?: string;
  productName?: string;
  sourceType?: 'brand' | 'affiliate';
  affiliateSlug?: string;
  stepNumber?: number;
  stepTitle?: string;
  sectionType?: string;
  isAnonymous?: boolean;
}): Promise<void> => {
  try {
    const eventKey = `${params.userId}:${params.productId}:${params.formId}:view:${params.stepNumber || 'initial'}`;
    const now = Date.now();
    const lastTracked = recentEvents.get(eventKey);

    if (lastTracked && now - lastTracked < DEDUP_WINDOW_MS) {
      if (process.env.NODE_ENV === "development") {
        console.log("📊 [Analytics] Skipping duplicate form view event");
      }
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.log("📊 [Analytics] Tracking form view", {
        sourceType: params.sourceType || 'brand',
        affiliateSlug: params.affiliateSlug,
        stepNumber: params.stepNumber,
        stepTitle: params.stepTitle,
      });
    }

    // Get location if anonymous
    let location = undefined;
    if (params.isAnonymous) {
      location = await getApproximateLocation();
    }

    const payload = {
      userId: params.userId,
      productId: params.productId,
      formId: params.formId,
      eventType: "view" as const,
      sessionId: generateSessionId(),
      sourceType: params.sourceType || 'brand',
      metadata: {
        clinicId: params.clinicId,
        clinicName: params.clinicName,
        productName: params.productName || "Unknown Product",
        ...(params.affiliateSlug && { affiliateSlug: params.affiliateSlug }),
        ...(params.stepNumber && { stepNumber: params.stepNumber }),
        ...(params.stepTitle && { stepTitle: params.stepTitle }),
        ...(params.sectionType && { sectionType: params.sectionType }),
        ...(params.isAnonymous && { isAnonymous: true }),
        ...(location && { location }),
        timestamp: new Date().toISOString(),
      },
    };

    await apiCall("/analytics/track", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    recentEvents.set(eventKey, now);
    setTimeout(() => recentEvents.delete(eventKey), DEDUP_WINDOW_MS);
  } catch {}
};

/**
 * Track a form conversion event
 */
export const trackFormConversion = async (params: {
  userId: string;
  productId: string;
  formId: string;
  clinicId?: string;
  clinicName?: string;
  productName?: string;
  paymentIntentId?: string;
  orderId?: string;
  sourceType?: 'brand' | 'affiliate';
  affiliateSlug?: string;
}): Promise<void> => {
  try {
    const eventKey = `${params.userId}:${params.productId}:${params.formId}:conversion`;
    const now = Date.now();
    const lastTracked = recentEvents.get(eventKey);

    if (lastTracked && now - lastTracked < DEDUP_WINDOW_MS) return;

    if (process.env.NODE_ENV === "development") {
      console.log("📊 [Analytics] Tracking form conversion", {
        sourceType: params.sourceType || 'brand',
        affiliateSlug: params.affiliateSlug,
      });
    }

    await apiCall("/analytics/track", {
      method: "POST",
      body: JSON.stringify({
        userId: params.userId,
        productId: params.productId,
        formId: params.formId,
        eventType: "conversion",
        sessionId: generateSessionId(),
        sourceType: params.sourceType || 'brand',
        metadata: {
          clinicId: params.clinicId,
          clinicName: params.clinicName,
          productName: params.productName || "Unknown Product",
          paymentIntentId: params.paymentIntentId,
          orderId: params.orderId,
          ...(params.affiliateSlug && { affiliateSlug: params.affiliateSlug }),
          timestamp: new Date().toISOString(),
        },
      }),
    });

    recentEvents.set(eventKey, now);
    setTimeout(() => recentEvents.delete(eventKey), DEDUP_WINDOW_MS);
  } catch {}
};

export const generateSessionId = (): string => {
  if (typeof window === "undefined") {
    return `server-session-${Date.now()}`;
  }

  let sessionId = sessionStorage.getItem("fuse-analytics-session-id");

  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("fuse-analytics-session-id", sessionId);
  }

  return sessionId;
};

export const trackFormDropOff = async (params: {
  userId: string;
  productId: string;
  formId: string;
  dropOffStage: "product" | "payment" | "account";
  clinicId?: string;
  clinicName?: string;
  productName?: string;
  useBeacon?: boolean;
  sourceType?: 'brand' | 'affiliate';
  affiliateSlug?: string;
  stepNumber?: number;
  stepTitle?: string;
  sectionType?: string;
}): Promise<void> => {
  try {
    const eventKey = `${params.userId}:${params.productId}:${params.formId}:dropoff:${params.dropOffStage}`;
    const now = Date.now();
    const lastTracked = recentEvents.get(eventKey);

    if (lastTracked && now - lastTracked < DEDUP_WINDOW_MS) return;

    const payload = {
      userId: params.userId,
      productId: params.productId,
      formId: params.formId,
      eventType: "dropoff" as const,
      dropOffStage: params.dropOffStage,
      sessionId: generateSessionId(),
      sourceType: params.affiliateSlug ? 'affiliate' : (params.sourceType || 'brand'),
      metadata: {
        clinicId: params.clinicId,
        clinicName: params.clinicName,
        productName: params.productName || "Unknown Product",
        affiliateSlug: params.affiliateSlug,
        ...(params.stepNumber && { stepNumber: params.stepNumber }),
        ...(params.stepTitle && { stepTitle: params.stepTitle }),
        ...(params.sectionType && { sectionType: params.sectionType }),
        timestamp: new Date().toISOString(),
      },
    };

    if (
      params.useBeacon &&
      typeof navigator !== "undefined" &&
      navigator.sendBeacon
    ) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      navigator.sendBeacon(`${apiUrl}/analytics/track`, blob);
    } else {
      await apiCall("/analytics/track", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    recentEvents.set(eventKey, now);
    setTimeout(() => recentEvents.delete(eventKey), DEDUP_WINDOW_MS);
  } catch {}
};

export const trackEvent = async (params: TrackEventParams): Promise<void> => {
  try {
    await apiCall("/analytics/track", {
      method: "POST",
      body: JSON.stringify({
        ...params,
        sessionId: params.sessionId || generateSessionId(),
      }),
    });
  } catch {}
};
