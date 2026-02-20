import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { PostHogConfig } from "./types";

interface PostHogAnalyticsProviderProps {
  config: PostHogConfig;
  children: React.ReactNode;
}

export const PostHogAnalyticsProvider = ({
  config,
  children,
}: PostHogAnalyticsProviderProps) => {
  const router = useRouter();
  const initializedRef = useRef(false);

  const isActive = Boolean(config.apiKey) && config.enabled !== false;

  // Initialize PostHog on mount
  useEffect(() => {
    if (!isActive || initializedRef.current) return;

    posthog.init(config.apiKey, {
      api_host: config.host || "https://us.i.posthog.com",
      capture_pageview: false, // We manually capture on Next.js route changes
      capture_pageleave: true,
      session_recording: {
        maskAllInputs: true, // HIPAA: mask all form inputs
        maskTextSelector: "*", // HIPAA: mask all rendered text in session recordings
      },
      sanitize_properties: (properties, _event) => {
        // HIPAA: Strip potential PHI from captured URLs
        if (properties["$current_url"]) {
          try {
            const url = new URL(properties["$current_url"]);
            for (const param of ["email", "name", "patientId", "dob", "phone", "address"]) {
              url.searchParams.delete(param);
            }
            properties["$current_url"] = url.toString();
          } catch {
            // If URL parsing fails, keep the original
          }
        }
        return properties;
      },
    });

    initializedRef.current = true;

    return () => {
      // Don't shutdown on HMR / strict mode re-run
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, config.apiKey, config.host]);

  // Track page views on route change
  useEffect(() => {
    if (!isActive) return;

    // Capture initial pageview
    posthog.capture("$pageview");

    const handleRouteChange = () => {
      posthog.capture("$pageview");
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router, isActive]);

  if (!isActive) {
    return <>{children}</>;
  }

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
};
