import React from "react";
import { Button } from "@heroui/react";
import { ProgressBar } from "./ProgressBar";
import { StepHeader } from "./StepHeader";
import { CheckoutView } from "./CheckoutView";
import { PlanOption, ProgramData, PaymentStatus } from "../types";

interface CheckoutStepViewProps {
  progressPercent: number;
  theme: any;
  onPrevious: () => void;
  canGoBack: boolean;
  clinic: { name: string; logo?: string } | null;
  isLoadingClinic: boolean;
  plans: PlanOption[];
  selectedPlan: string;
  onPlanChange: (planId: string) => void;
  paymentStatus: PaymentStatus;
  clientSecret: string | null;
  shippingInfo: any;
  onShippingInfoChange: (field: string, value: any) => void;
  onRetryPaymentSetup: () => void;
  onCreateSubscription: (planId: string) => Promise<void>;
  onPaymentSuccess: () => Promise<void>;
  onPaymentError: (error: string) => void;
  onPaymentConfirm?: () => void;
  stripePromise: any;
  questionnaireProducts: any;
  selectedProducts: Record<string, number>;
  treatmentName: string;
  pharmacyCoverages: any[];
  onNext: () => void;
  // Program props
  programData?: ProgramData;
  selectedProgramProducts?: Record<string, boolean>;
  onProgramProductToggle?: (productId: string) => void;
  onCreateProgramSubscription?: () => Promise<void>;
}

export const CheckoutStepView: React.FC<CheckoutStepViewProps> = ({
  progressPercent,
  theme,
  onPrevious,
  canGoBack,
  clinic,
  isLoadingClinic,
  plans,
  selectedPlan,
  onPlanChange,
  paymentStatus,
  clientSecret,
  shippingInfo,
  onShippingInfoChange,
  onRetryPaymentSetup,
  onCreateSubscription,
  onPaymentSuccess,
  onPaymentError,
  onPaymentConfirm,
  stripePromise,
  questionnaireProducts,
  selectedProducts,
  treatmentName,
  pharmacyCoverages,
  onNext,
  // Program props
  programData,
  selectedProgramProducts,
  onProgramProductToggle,
  onCreateProgramSubscription,
}) => {
  return (
    <>
      {/* Progress Bar */}
      <ProgressBar progressPercent={progressPercent} color={theme.primary} />

      {/* Brand and Previous button for checkout */}
      <StepHeader
        onPrevious={onPrevious}
        canGoBack={canGoBack}
        clinic={clinic}
        isLoadingClinic={isLoadingClinic}
      />

      <div className="bg-white rounded-2xl p-6 space-y-6">
        <CheckoutView
          plans={plans}
          selectedPlan={selectedPlan}
          onPlanChange={onPlanChange}
          paymentStatus={paymentStatus}
          clientSecret={clientSecret}
          shippingInfo={shippingInfo}
          onShippingInfoChange={onShippingInfoChange}
          onRetryPaymentSetup={onRetryPaymentSetup}
          onCreateSubscription={onCreateSubscription}
          onPaymentSuccess={onPaymentSuccess}
          onPaymentError={onPaymentError}
          onPaymentConfirm={onPaymentConfirm}
          stripePromise={stripePromise}
          theme={theme}
          questionnaireProducts={questionnaireProducts}
          selectedProducts={selectedProducts}
          treatmentName={treatmentName}
          pharmacyCoverages={pharmacyCoverages}
          // Program props
          programData={programData}
          selectedProgramProducts={selectedProgramProducts}
          onProgramProductToggle={onProgramProductToggle}
          onCreateProgramSubscription={onCreateProgramSubscription}
        />

        {/* {paymentStatus === 'succeeded' && (
          <div className="pt-2">
            <Button
              color="primary"
              className="w-full"
              onPress={onNext}
            >
              Continue
            </Button>
          </div>
        )} */}
      </div>
    </>
  );
};

