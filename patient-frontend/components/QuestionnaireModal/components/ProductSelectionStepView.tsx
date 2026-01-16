import React from "react";
import { Icon } from "@iconify/react";
import { ProgressBar } from "./ProgressBar";
import { ProductSelection } from "./ProductSelection";
import { PaymentStatus } from "../types";

interface ProductSelectionStepViewProps {
  progressPercent: number;
  theme: any;
  products: any;
  selectedProducts: Record<string, number>;
  onProductQuantityChange: (productId: string, quantity: number) => void;
  onNext: () => void;
  isCheckoutStep: () => boolean;
  paymentStatus: PaymentStatus;
  isLastStep: boolean;
  isProductSelectionStep: () => boolean;
}

export const ProductSelectionStepView: React.FC<ProductSelectionStepViewProps> = ({
  progressPercent,
  theme,
  products,
  selectedProducts,
  onProductQuantityChange,
  onNext,
  isCheckoutStep,
  paymentStatus,
  isLastStep,
  isProductSelectionStep,
}) => {
  return (
    <>
      {/* Progress Bar */}
      <ProgressBar progressPercent={progressPercent} color={theme.primary} />

      <div className="bg-white rounded-2xl p-6 space-y-6">
        <ProductSelection
          products={products}
          selectedProducts={selectedProducts}
          onChange={onProductQuantityChange}
        />

        {/* Continue button for product selection */}
        {!(isCheckoutStep() && paymentStatus !== 'succeeded') && (
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
        )}
      </div>
    </>
  );
};

