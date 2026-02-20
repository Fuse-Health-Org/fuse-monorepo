import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { AmplitudeConfig, AmplitudeUser } from "./types";
import {
  initAmplitude,
  shutdownAmplitude,
  identifyUser,
  resetUser,
  trackPageView,
} from "./tracker";

interface AmplitudeProviderProps {
  config: AmplitudeConfig;
  user: AmplitudeUser | null;
  children: React.ReactNode;
}

export function AmplitudeProvider({
  config,
  user,
  children,
}: AmplitudeProviderProps) {
  const router = useRouter();
  const prevUserIdRef = useRef<string | null>(null);

  // Initialize Amplitude on mount
  useEffect(() => {
    initAmplitude(config);
    return () => {
      shutdownAmplitude();
    };
    // Only re-init if apiKey or appName changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.apiKey, config.appName]);

  // Identify or reset user when user changes
  useEffect(() => {
    const newUserId = user?.id ?? null;
    if (newUserId !== prevUserIdRef.current) {
      if (user) {
        identifyUser(user, config.appName);
      } else {
        resetUser();
      }
      prevUserIdRef.current = newUserId;
    }
  }, [user, config.appName]);

  // Track page views on route change
  useEffect(() => {
    // Track initial page view
    trackPageView(router.asPath);

    const handleRouteChange = (url: string) => {
      trackPageView(url);
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router]);

  return <>{children}</>;
}
