import { useCallback } from "react";
import { AmplitudeEvent } from "./types";
import { trackEvent } from "./tracker";

export const useAmplitude = () => {
  const track = useCallback(
    (eventName: AmplitudeEvent | string, properties?: Record<string, unknown>) => {
      trackEvent(eventName, properties);
    },
    []
  );

  return { track };
};
