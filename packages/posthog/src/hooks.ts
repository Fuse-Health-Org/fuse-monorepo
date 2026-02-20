import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { usePostHog } from "posthog-js/react";
import { IdentifyUserParams } from "./types";

/**
 * Identifies the current user with PostHog when params are provided,
 * and calls posthog.reset() when params become null (logout).
 */
export const useIdentifyUser = (params: IdentifyUserParams | null): void => {
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const newUserId = params?.userId ?? null;

    if (newUserId !== prevUserIdRef.current) {
      if (params) {
        posthog.identify(params.userId, {
          role: params.role,
          ...(params.clinicId ? { clinicId: params.clinicId } : {}),
        });
      } else {
        posthog.reset();
      }
      prevUserIdRef.current = newUserId;
    }
  }, [params]);
};

export { usePostHog };
