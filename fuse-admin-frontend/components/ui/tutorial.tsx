import { tutorialSteps } from "@/utils/tutorialSteps";
import Joyride from "react-joyride";
import { useRouter } from "next/router";
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const Tutorial = ({
  runTutorial,
  steps,
  setRunTutorial,
  endLabel,
  onFinish,
  initialStep,
}: {
  runTutorial: boolean;
  steps?: any;
  onFinish?: () => void;
  setRunTutorial?: (runTutorial: boolean) => void;
  endLabel?: string;
  initialStep?: number;
}) => {
  const router = useRouter();
  const { authenticatedFetch } = useAuth();
  // Track the current step index - only set on start, then update via callback
  const [currentStepIndex, setCurrentStepIndex] = React.useState<number | undefined>(undefined);

  const handleTutorialFinish = async (step?: number) => {
    try {
      console.log('🔍 Marking tutorial as finished', step ? `at step ${step}` : '')
      const response = await authenticatedFetch(`${API_URL}/brand-subscriptions/mark-tutorial-finished`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ step })
      })

      if (response.ok) {
        console.log('✅ Tutorial marked as finished')
      } else {
        console.error('❌ Failed to mark tutorial as finished')
      }
    } catch (error) {
      console.error('❌ Error marking tutorial as finished:', error)
    }
  }

  const handleUpdateStep = async (step: number) => {
    try {
      const response = await authenticatedFetch(`${API_URL}/brand-subscriptions/tutorial-step`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ step })
      })

      if (response.ok) {
        console.log(`✅ Tutorial step updated to ${step}`)
      } else {
        console.error('❌ Failed to update tutorial step')
      }
    } catch (error) {
      console.error('❌ Error updating tutorial step:', error)
    }
  }

  // Set initial step only when tutorial begins
  React.useEffect(() => {
    if (runTutorial && currentStepIndex === undefined) {
      // Tutorial is starting - set the initial step
      const startStep = initialStep !== undefined ? initialStep : 0;
      setCurrentStepIndex(startStep);
    } else if (!runTutorial) {
      // Reset when tutorial stops
      setCurrentStepIndex(undefined);
    }
  }, [runTutorial, initialStep, currentStepIndex]);

  const handleJoyrideCallback = (data: any) => {
    const { status, action, index, type, step } = data;

    console.log('🔍 Joyride callback:', { status, action, index, type, step });

    // Update local step index when step changes (this is needed for controlled stepIndex)
    if (type === "step:after") {
      console.log(`📍 Step changed to ${index}`);
      setCurrentStepIndex(index);
    }

    // Update step in DB when moving to next step
    // "step:after" means we've moved to the next step, so use the new index
    if (action === "next" && type === "step:after") {
      // index is now the new step we're on (after clicking next)
      console.log(`🔄 Moving to step ${index}`);
      // Use setTimeout to avoid blocking the UI update
      setTimeout(() => {
        handleUpdateStep(index);
      }, 0);
    }

    // Also update when going back
    if (action === "prev" && type === "step:after") {
      console.log(`🔙 Moving back to step ${index}`);
      setTimeout(() => {
        handleUpdateStep(index);
      }, 0);
    }

    // Handle special navigation cases - use setTimeout to avoid interrupting Joyride flow
    if (action === "next") {
      if (index === 3) {
        // After moving to step 3, navigate to products page
        setTimeout(() => {
          router.push("/products");
        }, 100);
      } else if (index === 4) {
        // After moving to step 4, click select products button
        setTimeout(() => {
          document.getElementById("select-products-btn")?.click();
        }, 300);
      } else if (index === 7) {
        // After moving to step 7, click enable product and my products buttons
        setTimeout(() => {
          const el = document.getElementsByClassName("enable-product-btn")[0] as HTMLElement | undefined;
          if (el) el.click();
          document.getElementById("my-products-btn")?.click();
        }, 300);
      }
    }

    // When tutorial is finished, skipped, or closed, mark as finished with current step
    if (status === "finished" || status === "skipped" || status === "closed") {
      setRunTutorial?.(false);
      // Use the current index (step) when closing/skipping
      handleTutorialFinish(index);
    }
  };

  return (
    <Joyride
      steps={steps || tutorialSteps}
      run={runTutorial}
      callback={handleJoyrideCallback}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      disableCloseOnEsc={false}
      disableOverlayClose={false}
      // Control stepIndex - update it when callback tells us step changed
      stepIndex={runTutorial && currentStepIndex !== undefined ? currentStepIndex : undefined}
      styles={{
        options: {
          primaryColor: '#166534', // Dark green instead of red
        },
        buttonNext: {
          backgroundColor: '#166534', // Dark green
          color: '#fff',
          borderRadius: '6px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '500',
        },
        buttonBack: {
          color: '#166534', // Dark green for back button text
          marginRight: '8px',
        },
        buttonSkip: {
          color: '#166534', // Dark green for skip button
        },
        buttonClose: {
          color: '#166534', // Dark green for close button
        },
        spotlight: {
          borderRadius: '8px',
        },
        tooltip: {
          borderRadius: '8px',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontSize: '16px',
          fontWeight: '600',
          marginBottom: '8px',
        },
        tooltipContent: {
          padding: '12px 0',
        },
        badge: {
          backgroundColor: '#166534', // Dark green for step badge
        },
        progress: {
          accentColor: '#166534', // Dark green for progress
        },
      } as any}
      locale={{
        close: "Close",
        last: endLabel || "End",
        next: "Continue",
        skip: "Skip",
        back: "Back",
      }}
    />
  );
};

export default Tutorial;
