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

  const handleJoyrideCallback = (data: any) => {
    const { status, action, index, type } = data;

    // Update step in DB when moving to next step
    if (action === "next" && type === "step:after") {
      handleUpdateStep(index);
    }

    if (action === "next" && index === 2) {
      router.push("/products");
      return;
    }

    if (action === "next" && index === 3) {
      document.getElementById("select-products-btn")?.click();
      return;
    }

    if (action === "next" && index === 6) {
      const el = document.getElementsByClassName("enable-product-btn")[0] as HTMLElement | undefined;
      if (el) el.click();
      document.getElementById("my-products-btn")?.click();
      return;
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
      stepIndex={initialStep !== undefined ? initialStep : undefined}
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
