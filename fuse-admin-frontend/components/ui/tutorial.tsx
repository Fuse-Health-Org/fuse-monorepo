import { tutorialSteps, TutorialStep } from "@/utils/tutorialSteps";
import { useRouter } from "next/router";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createPortal } from "react-dom";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface TutorialProps {
  runTutorial: boolean;
  steps?: TutorialStep[];
  setRunTutorial?: (runTutorial: boolean) => void;
  endLabel?: string;
  onFinish?: () => void;
  initialStep?: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right';
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const Tutorial: React.FC<TutorialProps> = ({
  runTutorial,
  steps,
  setRunTutorial,
  endLabel,
  onFinish,
  initialStep = 0,
}) => {
  const router = useRouter();
  const { authenticatedFetch } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [adaptiveStepOverride, setAdaptiveStepOverride] = useState<TutorialStep | null>(null);
  const [skippedStep4, setSkippedStep4] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastHandledStepRef = useRef<string | null>(null);

  const activeSteps = steps || tutorialSteps;
  const currentStepData = adaptiveStepOverride || activeSteps[currentStep];
  const totalSteps = activeSteps.length;

  // Debug logging
  console.log('🔍 Tutorial render:', {
    runTutorial,
    mounted,
    currentStep,
    initialStep,
    pathname: router.pathname,
    targetRect: targetRect ? 'SET' : 'NULL',
    currentStepData: currentStepData?.target,
    adaptiveStepOverride: adaptiveStepOverride?.target || 'NONE'
  });

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset step when initialStep changes or tutorial restarts
  useEffect(() => {
    console.log('🔍 initialStep effect:', { runTutorial, initialStep, currentStep });
    if (runTutorial) {
      setCurrentStep(initialStep);
    }
  }, [runTutorial, initialStep]);

  // API calls
  const handleTutorialFinish = useCallback(async (step?: number) => {
    try {
      console.log('🔍 Marking tutorial as finished', step !== undefined ? `at step ${step}` : '');
      const response = await authenticatedFetch(`${API_URL}/brand-subscriptions/mark-tutorial-finished`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step })
      });
      if (response.ok) {
        console.log('✅ Tutorial marked as finished');
      }
    } catch (error) {
      console.error('❌ Error marking tutorial as finished:', error);
    }
  }, [authenticatedFetch]);

  const handleUpdateStep = useCallback(async (step: number) => {
    try {
      const response = await authenticatedFetch(`${API_URL}/brand-subscriptions/tutorial-step`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step })
      });
      if (response.ok) {
        console.log(`✅ Tutorial step updated to ${step}`);
      }
    } catch (error) {
      console.error('❌ Error updating tutorial step:', error);
    }
  }, [authenticatedFetch]);

  // Calculate target element position
  const updateTargetPosition = useCallback(() => {
    console.log('🔍 updateTargetPosition called:', {
      currentStepData: currentStepData?.target,
      runTutorial,
      isNavigating,
      currentStep,
      pathname: router.pathname
    });
    if (!currentStepData || !runTutorial || isNavigating) {
      console.log('🔍 updateTargetPosition returning early');
      return;
    }

    let target = currentStepData.target;
    let element: Element | null = null;
    let effectiveStepData = currentStepData;

    // For step 3 on programs page: handle fallback from template to program card
    if (currentStep === 3 && router.pathname === '/programs') {
      // First try to find the template
      element = document.getElementById('first-program-template');
      console.log('📍 Step 3 - looking for template:', element ? 'FOUND' : 'NOT FOUND');

      // If no template, try to find the program card instead
      if (!element) {
        element = document.getElementById('first-program-card');
        // Also try data attribute as backup
        if (!element) {
          element = document.querySelector('[data-program-index="0"]');
        }
        console.log('📍 Step 3 - looking for program card:', element ? 'FOUND' : 'NOT FOUND');

        if (element) {
          // Use fallback content for this step
          effectiveStepData = {
            target: "#first-program-card",
            content: "Looks like you already set up your program! Let's continue.",
            placement: "top",
          };
          target = "#first-program-card";

          // Set the adaptive override for other logic (like skipping step 4)
          if (!adaptiveStepOverride) {
            console.log('📍 Setting adaptive step override');
            setAdaptiveStepOverride(effectiveStepData);
          }
        }
      }
    } else {
      // Normal element lookup
      if (target.startsWith('#')) {
        element = document.getElementById(target.slice(1));
      } else if (target.startsWith('.')) {
        element = document.querySelector(target);
      } else {
        element = document.querySelector(target);
      }
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 8;
      setTargetRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });

      // Calculate tooltip position based on placement
      const placement = effectiveStepData.placement || 'bottom';
      const tooltipWidth = 320;
      const tooltipHeight = 150; // Approximate
      const gap = 12;

      let tooltipTop = 0;
      let tooltipLeft = 0;
      let arrowPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

      switch (placement) {
        case 'top':
          tooltipTop = rect.top - tooltipHeight - gap;
          tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
          arrowPosition = 'bottom';
          break;
        case 'bottom':
          tooltipTop = rect.bottom + gap;
          tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
          arrowPosition = 'top';
          break;
        case 'left':
          tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
          tooltipLeft = rect.left - tooltipWidth - gap;
          arrowPosition = 'right';
          break;
        case 'right':
          tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
          tooltipLeft = rect.right + gap;
          arrowPosition = 'left';
          break;
      }

      // Keep tooltip in viewport
      tooltipLeft = Math.max(16, Math.min(tooltipLeft, window.innerWidth - tooltipWidth - 16));
      tooltipTop = Math.max(16, Math.min(tooltipTop, window.innerHeight - tooltipHeight - 16));

      setTooltipPosition({ top: tooltipTop, left: tooltipLeft, arrowPosition });
    } else {
      setTargetRect(null);
      setTooltipPosition(null);
    }
  }, [currentStepData, runTutorial, isNavigating, currentStep, router.pathname, adaptiveStepOverride]);

  // Update position on scroll, resize, and step change
  useEffect(() => {
    if (!runTutorial) return;

    updateTargetPosition();

    const handleUpdate = () => updateTargetPosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Also update periodically to catch dynamic content
    const interval = setInterval(handleUpdate, 500);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      clearInterval(interval);
    };
  }, [runTutorial, currentStep, updateTargetPosition]);

  // Handle navigation for specific steps
  // Returns the step index we should actually be on (for skipping)
  const handleStepNavigation = useCallback(async (stepIndex: number): Promise<number | void> => {
    const stepData = activeSteps[stepIndex];

    // Step 3: Navigate to programs page and adapt step content based on what's available
    if (stepIndex === 3) {
      if (router.pathname !== '/programs') {
        console.log('📍 Step 3 - navigating to programs page');
        setIsNavigating(true);
        await router.push('/programs');
      }

      // Wait for elements and determine which version to show
      const result = await new Promise<'template' | 'program' | 'timeout'>((resolve) => {
        const checkElement = setInterval(() => {
          if (document.getElementById('first-program-template')) {
            clearInterval(checkElement);
            console.log('📍 Found first-program-template element');
            resolve('template');
          } else if (document.getElementById('first-program-card')) {
            clearInterval(checkElement);
            console.log('📍 Found first-program-card element (no templates)');
            resolve('program');
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkElement);
          console.log('⚠️ Timeout waiting for program elements');
          resolve('timeout');
        }, 3000);
      });

      setIsNavigating(false);

      // Set adaptive step content based on what's available
      if (result === 'program') {
        // Show alternative version targeting the program card
        setAdaptiveStepOverride({
          target: "#first-program-card",
          content: "Looks like you already set up your program! Let's continue.",
          placement: "top",
        });
      } else if (result === 'template') {
        // Show default version targeting template
        setAdaptiveStepOverride(null);
      } else {
        // Timeout - clear override
        setAdaptiveStepOverride(null);
      }
    } else {
      // Clear adaptive override for other steps
      setAdaptiveStepOverride(null);
    }

    // Step 6: Navigate to portal page (or wait for element if already there)
    if (stepIndex === 6) {
      if (router.pathname !== '/portal') {
        console.log('📍 Step 6 - navigating to portal page');
        setIsNavigating(true);
        await router.push('/portal');
        setIsNavigating(false);
      } else {
        console.log('📍 Step 6 - already on portal page');
      }

      // Wait for element to appear
      await new Promise<void>((resolve) => {
        const checkElement = setInterval(() => {
          if (document.getElementById('brand-portal-url-section')) {
            clearInterval(checkElement);
            console.log('📍 Found brand-portal-url-section element');
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkElement);
          console.log('⚠️ Timeout waiting for brand-portal-url-section');
          resolve();
        }, 3000);
      });
    }
  }, [router, activeSteps]);

  // Run step navigation when route changes to ensure adaptive steps work
  useEffect(() => {
    if (!runTutorial || isNavigating) return;

    const stepPathKey = `${currentStep}-${router.pathname}`;

    // Prevent running multiple times for same step/path
    if (lastHandledStepRef.current === stepPathKey) return;
    lastHandledStepRef.current = stepPathKey;

    // Re-run step navigation for current step when route changes
    // This ensures adaptive step logic runs even on page refresh
    console.log('📍 Route/step changed - running step navigation for step', currentStep);
    handleStepNavigation(currentStep);
  }, [runTutorial, currentStep, router.pathname, isNavigating, handleStepNavigation]);

  // Public method to advance tutorial (can be called from outside)
  const advanceTutorial = useCallback(async () => {
    if (currentStep < totalSteps - 1) {
      let nextStep = currentStep + 1;

      // If we're on step 3 with adaptive override (program already exists), skip step 4
      if (currentStep === 3 && adaptiveStepOverride) {
        console.log('📍 Skipping step 4 (program already created) - jumping to step 5');
        nextStep = 5; // Skip to Portal tab
        setSkippedStep4(true);
      }

      console.log(`📍 Advancing tutorial to step ${nextStep}`);
      setCurrentStep(nextStep);
      handleUpdateStep(nextStep);
      await handleStepNavigation(nextStep);
    } else {
      // Last step - finish tutorial
      console.log('✅ Tutorial completed');
      setRunTutorial?.(false);
      handleTutorialFinish(currentStep);
      onFinish?.();
    }
  }, [currentStep, totalSteps, adaptiveStepOverride, handleUpdateStep, handleStepNavigation, setRunTutorial, handleTutorialFinish, onFinish]);

  // Public method to jump to a specific step
  const jumpToStep = useCallback(async (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < totalSteps) {
      console.log(`📍 Jumping to step ${stepIndex}`);
      setCurrentStep(stepIndex);
      handleUpdateStep(stepIndex);
      await handleStepNavigation(stepIndex);
    } else if (stepIndex >= totalSteps) {
      // Finish tutorial
      console.log('✅ Tutorial completed');
      setRunTutorial?.(false);
      handleTutorialFinish(currentStep);
      onFinish?.();
    }
  }, [totalSteps, handleUpdateStep, handleStepNavigation, setRunTutorial, handleTutorialFinish, onFinish, currentStep]);

  // Expose tutorial control methods globally for element click handlers
  useEffect(() => {
    if (runTutorial) {
      (window as any).__tutorialAdvance = advanceTutorial;
      (window as any).__tutorialJumpToStep = jumpToStep;
      (window as any).__tutorialCurrentStep = currentStep;
      (window as any).__tutorialNavigatingBackwards = false; // Flag to prevent auto-advance during back navigation
    } else {
      delete (window as any).__tutorialAdvance;
      delete (window as any).__tutorialJumpToStep;
      delete (window as any).__tutorialCurrentStep;
      delete (window as any).__tutorialNavigatingBackwards;
    }
    return () => {
      delete (window as any).__tutorialAdvance;
      delete (window as any).__tutorialJumpToStep;
      delete (window as any).__tutorialCurrentStep;
      delete (window as any).__tutorialNavigatingBackwards;
    };
  }, [runTutorial, advanceTutorial, jumpToStep, currentStep]);

  // Button handlers
  const handleNext = useCallback(() => {
    advanceTutorial();
  }, [advanceTutorial]);

  const handleBack = useCallback(async () => {
    if (currentStep > 0) {
      let prevStep = currentStep - 1;

      // Set flag to prevent auto-advance during backwards navigation
      (window as any).__tutorialNavigatingBackwards = true;

      // If we're on step 5 and we skipped step 4, go back to step 3 instead
      if (currentStep === 5 && skippedStep4) {
        console.log('📍 Going back from step 5 to 3 (step 4 was skipped)');
        prevStep = 3;
        setSkippedStep4(false); // Clear the flag
      }

      // Handle specific navigation when going backwards
      // From step 2 (index 1): Scroll to top of settings page for logo
      if (currentStep === 1) {
        console.log('📍 Going back from step 2 to 1 - scrolling to top');
        // Find the main scrollable container
        const mainContent = document.querySelector('main');
        if (mainContent) {
          mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Wait for scroll to complete before updating step
        setTimeout(() => {
          setCurrentStep(prevStep);
          handleUpdateStep(prevStep);
        }, 400);
      }
      // From step 3 (index 2): Navigate back to settings page
      else if (currentStep === 2 && router.pathname !== '/settings') {
        console.log('📍 Going back from step 3 to 2 - navigating to Settings');
        setIsNavigating(true);
        await router.push('/settings');
        setIsNavigating(false);
        setCurrentStep(prevStep);
        handleUpdateStep(prevStep);
      }
      // From step 4 (index 3): Stay on programs page
      // From step 5 (index 4): Navigate back to programs page (if not already there)
      else if ((currentStep === 5 || currentStep === 4) && router.pathname !== '/programs') {
        console.log(`📍 Going back from step ${currentStep + 1} to ${prevStep + 1} - navigating to Programs`);
        setIsNavigating(true);
        await router.push('/programs');
        setIsNavigating(false);
        setCurrentStep(prevStep);
        handleUpdateStep(prevStep);
      }
      // From step 6 (index 5): Navigate back to programs page
      else if (currentStep === 6 && router.pathname !== '/programs') {
        console.log('📍 Going back from step 6 to 5 - navigating to Programs');
        setIsNavigating(true);
        await router.push('/programs');
        setIsNavigating(false);
        setCurrentStep(prevStep);
        handleUpdateStep(prevStep);
      }
      else {
        // No special navigation needed, just go back
        setCurrentStep(prevStep);
        handleUpdateStep(prevStep);
        await handleStepNavigation(prevStep);
      }

      // Clear the flag after a longer delay
      setTimeout(() => {
        (window as any).__tutorialNavigatingBackwards = false;
      }, 600);
    }
  }, [currentStep, skippedStep4, handleUpdateStep, handleStepNavigation, router]);

  const handleSkip = useCallback(() => {
    console.log('⏭️ Tutorial skipped at step', currentStep);
    setRunTutorial?.(false);
    handleTutorialFinish(currentStep);
  }, [currentStep, setRunTutorial, handleTutorialFinish]);

  // Don't render if not running or navigating
  if (!runTutorial || isNavigating || !mounted) return null;

  // Check if we should hide overlay for this step
  const hideOverlay = currentStepData?.hideOverlay || false;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Overlay using 4 rectangles around the spotlight - creates a real hole for pointer events */}
      {!hideOverlay && targetRect && (
        <>
          {/* Top overlay */}
          <div
            className="absolute bg-black/50"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: targetRect.top,
              pointerEvents: 'auto',
            }}
          />
          {/* Bottom overlay */}
          <div
            className="absolute bg-black/50"
            style={{
              top: targetRect.top + targetRect.height,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'auto',
            }}
          />
          {/* Left overlay */}
          <div
            className="absolute bg-black/50"
            style={{
              top: targetRect.top,
              left: 0,
              width: targetRect.left,
              height: targetRect.height,
              pointerEvents: 'auto',
            }}
          />
          {/* Right overlay */}
          <div
            className="absolute bg-black/50"
            style={{
              top: targetRect.top,
              left: targetRect.left + targetRect.width,
              right: 0,
              height: targetRect.height,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}

      {/* Invisible overlay for when visual overlay is hidden - still blocks clicks outside target */}
      {hideOverlay && targetRect && (
        <>
          {/* Top invisible blocker */}
          <div
            className="absolute"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: targetRect.top,
              pointerEvents: 'auto',
            }}
          />
          {/* Bottom invisible blocker */}
          <div
            className="absolute"
            style={{
              top: targetRect.top + targetRect.height,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'auto',
            }}
          />
          {/* Left invisible blocker */}
          <div
            className="absolute"
            style={{
              top: targetRect.top,
              left: 0,
              width: targetRect.left,
              height: targetRect.height,
              pointerEvents: 'auto',
            }}
          />
          {/* Right invisible blocker */}
          <div
            className="absolute"
            style={{
              top: targetRect.top,
              left: targetRect.left + targetRect.width,
              right: 0,
              height: targetRect.height,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}

      {/* Highlight border around target */}
      {targetRect && (
        <div
          className="absolute border-2 border-green-500 rounded-lg pointer-events-none"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: '0 0 0 4px rgba(22, 101, 52, 0.3)',
          }}
        />
      )}

      {/* Tooltip */}
      {tooltipPosition && currentStepData && (
        <div
          ref={tooltipRef}
          className="absolute bg-white rounded-lg shadow-2xl p-4 pointer-events-auto"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            width: 320,
            zIndex: 10000,
          }}
        >
          {/* Arrow */}
          <div
            className={`absolute w-3 h-3 bg-white transform rotate-45 ${tooltipPosition.arrowPosition === 'top' ? '-top-1.5 left-1/2 -translate-x-1/2' :
              tooltipPosition.arrowPosition === 'bottom' ? '-bottom-1.5 left-1/2 -translate-x-1/2' :
                tooltipPosition.arrowPosition === 'left' ? 'top-1/2 -left-1.5 -translate-y-1/2' :
                  'top-1/2 -right-1.5 -translate-y-1/2'
              }`}
            style={{ boxShadow: '-1px -1px 2px rgba(0,0,0,0.1)' }}
          />

          {/* Content */}
          <div className="text-sm text-gray-700 mb-4">
            {currentStepData.content}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Skip
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                Step {currentStep + 1} of {totalSteps}
              </span>

              {(() => {
                // Check if we should show Next button even if hideNextButton is true
                // This happens when the first product is already enabled (user went back)
                let showNextButton = !currentStepData.hideNextButton;

                if (currentStepData.hideNextButton && currentStepData.target === '#first-product-item') {
                  // Check if the first product has "Enabled" text instead of "Activate"
                  const firstProduct = document.getElementById('first-product-item');
                  if (firstProduct) {
                    const hasEnabledBadge = firstProduct.textContent?.includes('Enabled');
                    const hasActivateButton = firstProduct.querySelector('.enable-product-btn');
                    if (hasEnabledBadge && !hasActivateButton) {
                      showNextButton = true;
                    }
                  }
                }

                return (
                  <>
                    {currentStep > 0 && showNextButton && (
                      <button
                        onClick={handleBack}
                        className="px-3 py-1.5 text-sm text-green-700 hover:text-green-800 transition-colors"
                      >
                        Back
                      </button>
                    )}

                    {showNextButton && (
                      <button
                        onClick={handleNext}
                        className="px-4 py-1.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-md transition-colors"
                      >
                        {currentStep === totalSteps - 1 ? (endLabel || 'Finish') : 'Next'}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default Tutorial;
