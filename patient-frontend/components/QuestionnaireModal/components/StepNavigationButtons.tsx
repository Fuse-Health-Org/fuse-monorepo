import React from "react";
import { Icon } from "@iconify/react";
import { QuestionnaireStep } from "../types";

interface StepNavigationButtonsProps {
  isCheckoutStep: () => boolean;
  paymentStatus: 'idle' | 'processing' | 'succeeded' | 'failed';
  currentStep: QuestionnaireStep | null;
  isSignInMode: boolean;
  isEmailVerificationMode: boolean;
  currentStepIndex: number;
  answers: Record<string, any>;
  isLastStep: boolean;
  isProductSelectionStep: () => boolean;
  theme: any;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  setCurrentStepIndex: React.Dispatch<React.SetStateAction<number>>;
}

export const StepNavigationButtons: React.FC<StepNavigationButtonsProps> = ({
  isCheckoutStep,
  paymentStatus,
  currentStep,
  isSignInMode,
  isEmailVerificationMode,
  currentStepIndex,
  answers,
  isLastStep,
  isProductSelectionStep,
  theme,
  onNext,
  onPrevious,
  onClose,
  setCurrentStepIndex,
}) => {
  // Don't show buttons during checkout step - the success modal handles the continue action
  if (isCheckoutStep()) {
    return null;
  }

  if (currentStep?.title === 'Create Your Account' && (isSignInMode || isEmailVerificationMode)) {
    return null;
  }

  // Check if step itself is dead end OR if any VISIBLE question is a dead end
  const visibleQuestions = currentStep?.questions?.filter((question: any) => {
    const conditionalLogic = question.conditionalLogic;
    if (!conditionalLogic) return true;

    try {
      const parentQuestion = currentStep.questions?.find((q: any) =>
        q.conditionalLevel === 0 || !q.conditionalLevel
      );
      if (!parentQuestion) return false;

      const parentAnswer = answers[parentQuestion.id];
      if (!parentAnswer) return false;

      if (conditionalLogic.startsWith('answer_equals:')) {
        const requiredValue = conditionalLogic.replace('answer_equals:', '').trim();
        if (Array.isArray(parentAnswer)) {
          return parentAnswer.includes(requiredValue);
        }
        return parentAnswer === requiredValue;
      }
      return false;
    } catch (error) {
      return true;
    }
  }) || []

  const hasDeadEndQuestion = visibleQuestions.some((q: any) => {
    const questionText = q.questionText?.toLowerCase() || ''
    return questionText.includes('unfortunat') || questionText.includes('disqualif') ||
      questionText.includes('do not qualify') || questionText.includes('cannot be medically')
  })

  const isDeadEndStep = currentStep?.isDeadEnd || hasDeadEndQuestion

  if (isDeadEndStep) {
    return (
      <div className="space-y-3">
        {currentStepIndex > 0 && (
          <button
            onClick={() => setCurrentStepIndex(prev => prev - 1)}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-4 px-6 rounded-2xl text-base h-auto flex items-center justify-center transition-colors"
          >
            <Icon icon="lucide:arrow-left" className="mr-2 h-4 w-4" />
            Go Back
          </button>
        )}
        <button
          onClick={onClose}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-4 px-6 rounded-2xl text-base h-auto flex items-center justify-center transition-colors"
        >
          Close Form
          <Icon icon="lucide:x" className="ml-2 h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onNext}
      disabled={isCheckoutStep() && paymentStatus !== 'succeeded'}
      className="w-full text-white font-medium py-4 px-6 rounded-2xl text-base h-auto flex items-center justify-center transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      style={{
        backgroundColor: theme.primary,
        ...(isCheckoutStep() && paymentStatus !== 'succeeded' ? {} : { boxShadow: `0 10px 20px -10px ${theme.primaryDark}` })
      }}
    >
      {isLastStep ? (isCheckoutStep() ? 'Complete Order' : 'Continue') :
        (isCheckoutStep() && paymentStatus === 'succeeded') ? 'Continue' :
          isProductSelectionStep() ? 'Continue to Checkout' :
            isCheckoutStep() ? 'Complete Order' : 'Continue'}
      <Icon icon="lucide:chevron-right" className="ml-2 h-4 w-4" />
    </button>
  );
};

