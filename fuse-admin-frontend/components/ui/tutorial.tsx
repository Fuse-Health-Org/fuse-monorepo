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
  const tooltipRef = useRef<HTMLDivElement>(null);

  const activeSteps = steps || tutorialSteps;
  const currentStepData = activeSteps[currentStep];
  const totalSteps = activeSteps.length;

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset step when initialStep changes or tutorial restarts
  useEffect(() => {
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
    if (!currentStepData || !runTutorial || isNavigating) return;

    const target = currentStepData.target;
    let element: Element | null = null;

    if (target.startsWith('#')) {
      element = document.getElementById(target.slice(1));
    } else if (target.startsWith('.')) {
      element = document.querySelector(target);
    } else {
      element = document.querySelector(target);
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
      const placement = currentStepData.placement || 'bottom';
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
  }, [currentStepData, runTutorial, isNavigating]);

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
  const handleStepNavigation = useCallback(async (stepIndex: number) => {
    const stepData = activeSteps[stepIndex];

    // Step 2 -> 3: Navigate to products page
    if (stepIndex === 3 && router.pathname !== '/products') {
      console.log('📍 Navigating to products page for step 3');
      setIsNavigating(true);
      await router.push('/products');
      // Wait for element to appear
      await new Promise<void>((resolve) => {
        const checkElement = setInterval(() => {
          if (document.getElementById('select-products-btn')) {
            clearInterval(checkElement);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkElement);
          resolve();
        }, 3000);
      });
      setIsNavigating(false);
    }

    // Step 3 -> 4: Click select products button
    if (stepIndex === 4) {
      console.log('📍 Clicking select products button');
      setTimeout(() => {
        document.getElementById('select-products-btn')?.click();
      }, 100);
    }

    // Step 6: Switch to My Products tab to show the enabled product
    if (stepIndex === 6) {
      console.log('📍 Switching to My Products tab for final step');
      setTimeout(() => {
        document.getElementById('my-products-btn')?.click();
      }, 100);
    }
  }, [router, activeSteps]);

  // Public method to advance tutorial (can be called from outside)
  const advanceTutorial = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      const nextStep = currentStep + 1;
      console.log(`📍 Advancing tutorial to step ${nextStep}`);
      setCurrentStep(nextStep);
      handleUpdateStep(nextStep);
      handleStepNavigation(nextStep);
    } else {
      // Last step - finish tutorial
      console.log('✅ Tutorial completed');
      setRunTutorial?.(false);
      handleTutorialFinish(currentStep);
      onFinish?.();
    }
  }, [currentStep, totalSteps, handleUpdateStep, handleStepNavigation, setRunTutorial, handleTutorialFinish, onFinish]);

  // Public method to jump to a specific step
  const jumpToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < totalSteps) {
      console.log(`📍 Jumping to step ${stepIndex}`);
      setCurrentStep(stepIndex);
      handleUpdateStep(stepIndex);
      handleStepNavigation(stepIndex);
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
    } else {
      delete (window as any).__tutorialAdvance;
      delete (window as any).__tutorialJumpToStep;
      delete (window as any).__tutorialCurrentStep;
    }
    return () => {
      delete (window as any).__tutorialAdvance;
      delete (window as any).__tutorialJumpToStep;
      delete (window as any).__tutorialCurrentStep;
    };
  }, [runTutorial, advanceTutorial, jumpToStep, currentStep]);

  // Button handlers
  const handleNext = useCallback(() => {
    advanceTutorial();
  }, [advanceTutorial]);

  const handleBack = useCallback(async () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;

      // Handle specific navigation when going backwards
      // Step 3 -> 2: Navigate back to settings page
      if (currentStep === 3 && router.pathname !== '/settings') {
        console.log('📍 Going back from step 3 to 2 - navigating to Settings');
        setIsNavigating(true);
        await router.push('/settings');
        setIsNavigating(false);
      }
      // Step 6 -> 5: Switch from My Products to Select Products tab
      else if (currentStep === 6) {
        console.log('📍 Going back from step 6 to 5 - switching to Select Products tab');
        setTimeout(() => {
          document.getElementById('select-products-btn')?.click();
        }, 100);
      }

      setCurrentStep(prevStep);
      handleUpdateStep(prevStep);
    }
  }, [currentStep, handleUpdateStep, router]);

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
      {/* Overlay with spotlight hole */}
      {!hideOverlay && targetRect && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="tutorial-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.5)"
            mask="url(#tutorial-mask)"
          />
        </svg>
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
