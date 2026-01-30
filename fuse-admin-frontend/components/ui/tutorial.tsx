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
  // Track if we're waiting for page navigation
  const [isNavigating, setIsNavigating] = React.useState(false);

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
    const { status, action, index, type, step, lifecycle } = data;
    const totalSteps = (steps || tutorialSteps).length;

    console.log('🔍 Joyride callback:', { status, action, index, type, lifecycle, totalSteps, step: step?.target });

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
        // We just moved to step 3, which is on products page - navigate there
        console.log('📍 Moving to step 3 - navigating to products page');
        setIsNavigating(true);
        setTimeout(() => {
          router.push("/products").then(() => {
            // Wait for the target element to appear
            const checkElement = setInterval(() => {
              const element = document.getElementById("select-products-btn");
              if (element) {
                console.log('✅ Target element found, resuming tutorial');
                clearInterval(checkElement);
                setIsNavigating(false);
              }
            }, 100);
            // Timeout after 5 seconds
            setTimeout(() => {
              clearInterval(checkElement);
              setIsNavigating(false);
              console.log('⚠️ Timeout waiting for element, resuming tutorial anyway');
            }, 5000);
          });
        }, 100);
      } else if (index === 4) {
        // At step 4, click select products button to open modal
        console.log('📍 Moving to step 4 - clicking select products button');
        setTimeout(() => {
          document.getElementById("select-products-btn")?.click();
        }, 300);
      } else if (index === 7) {
        // At step 7, enable product and switch to my products tab
        console.log('📍 Moving to step 7 - enabling product and switching tabs');
        setTimeout(() => {
          const el = document.getElementsByClassName("enable-product-btn")[0] as HTMLElement | undefined;
          if (el) el.click();
          document.getElementById("my-products-btn")?.click();
        }, 300);
      }
    }

    // Handle tutorial completion - only mark as truly finished in specific cases
    if (status === "skipped") {
      // User explicitly skipped - mark as finished
      console.log('⏭️ Tutorial skipped by user at step', index);
      setRunTutorial?.(false);
      handleTutorialFinish(index);
    } else if (status === "finished") {
      // Check if we're actually at the last step
      const isLastStep = index >= totalSteps - 1;
      if (isLastStep) {
        console.log('✅ Tutorial completed at final step', index);
        setRunTutorial?.(false);
        handleTutorialFinish(index);
      } else {
        // Joyride triggered "finished" but we're not at the last step
        // This can happen when target element is not found after navigation
        console.log('⚠️ Joyride reported finished at step', index, 'but not at last step. Ignoring.');
        // Don't mark as finished - the tutorial should continue when targets are found
      }
    } else if (action === "close" && type === "step:after") {
      // User clicked close button
      console.log('❌ Tutorial closed by user at step', index);
      setRunTutorial?.(false);
      handleTutorialFinish(index);
    }
  };

  return (
    <Joyride
      steps={steps || tutorialSteps}
      run={runTutorial && !isNavigating}
      callback={handleJoyrideCallback}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      disableCloseOnEsc={false}
      disableOverlayClose={false}
      disableScrollParentFix={true}
      spotlightClicks={true}
      // Control stepIndex - update it when callback tells us step changed
      stepIndex={runTutorial && currentStepIndex !== undefined ? currentStepIndex : undefined}
      floaterProps={{
        disableAnimation: true,
        hideArrow: false,
        styles: {
          floater: {
            transition: 'none',
            filter: 'none',
          },
          wrapper: {
            transition: 'none',
          },
          arrow: {
            transition: 'none',
          },
        },
      }}
      styles={{
        options: {
          primaryColor: '#166534', // Dark green instead of red
          overlayColor: 'rgba(0, 0, 0, 0.4)', // Lighter overlay
        },
        overlay: {
          pointerEvents: 'none' as const, // Allow scroll through overlay
          transition: 'none',
          animation: 'none',
        },
        overlayLegacy: {
          transition: 'none',
          animation: 'none',
        },
        overlayLegacyCenter: {
          transition: 'none',
          animation: 'none',
        },
        buttonNext: {
          backgroundColor: '#166534', // Dark green
          color: '#fff',
          borderRadius: '6px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '500',
          pointerEvents: 'auto' as const, // Re-enable clicks on buttons
        },
        buttonBack: {
          color: '#166534', // Dark green for back button text
          marginRight: '8px',
          pointerEvents: 'auto' as const,
        },
        buttonSkip: {
          color: '#166534', // Dark green for skip button
          pointerEvents: 'auto' as const,
        },
        buttonClose: {
          color: '#166534', // Dark green for close button
          pointerEvents: 'auto' as const,
        },
        spotlight: {
          borderRadius: '8px',
          pointerEvents: 'none' as const, // Allow scroll through spotlight
          transition: 'none',
          animation: 'none',
        },
        spotlightLegacy: {
          transition: 'none',
          animation: 'none',
        },
        tooltip: {
          borderRadius: '8px',
          pointerEvents: 'auto' as const, // Re-enable clicks on tooltip
          transition: 'none',
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
