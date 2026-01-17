import React from "react";
import { Icon } from "@iconify/react";
import { PaymentStatus } from "../types";

interface OrderSuccessModalProps {
  isOpen: boolean;
  paymentStatus: PaymentStatus;
  onContinue: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  paymentStatus,
  onContinue,
}) => {
  if (!isOpen) return null;

  const isProcessing = paymentStatus === 'processing';
  const isCreatingMDCase = paymentStatus === 'creatingMDCase';
  const isReady = paymentStatus === 'ready';
  const isSucceeded = paymentStatus === 'succeeded';
  const showContinueButton = isReady;
  const showLoadingState = isProcessing || isCreatingMDCase;
  const showSuccessState = isSucceeded || isReady;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50"
      style={{ zIndex: 50 }}
      onClick={(e) => {
        // Don't allow closing by clicking outside
        e.stopPropagation();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {showLoadingState ? (
          <>
            {/* Loading Animation */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                <Icon
                  icon="lucide:loader-2"
                  className="text-5xl text-blue-600 animate-spin"
                />
              </div>
            </div>

            {/* Processing Message */}
            <div className="text-center space-y-2">
              <h3
                id="success-modal-title"
                className="text-2xl font-semibold text-gray-900"
              >
                {isProcessing ? 'Processing Your Payment' : 'Setting Up Your Account'}
              </h3>
              <p className="text-gray-600 text-base">
                {isProcessing 
                  ? 'Please wait while we process your order. This may take a few moments...'
                  : 'Your payment was successful! We\'re now creating your account and setting everything up...'}
              </p>
            </div>

            {/* Loading dots animation */}
            <div className="flex justify-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </>
        ) : (
          <>
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <Icon
                  icon="mdi:check-circle"
                  className="text-5xl text-green-600"
                />
              </div>
            </div>

            {/* Success Message */}
            <div className="text-center space-y-2">
              <h3
                id="success-modal-title"
                className="text-2xl font-semibold text-gray-900"
              >
                Order Submitted Successfully!
              </h3>
              <p className="text-gray-600 text-base">
                Your order has been processed and is being prepared. You'll receive
                a confirmation email shortly.
              </p>
            </div>

            {/* Continue Button - Only show when ready */}
            {showContinueButton && (
              <button
                type="button"
                onClick={onContinue}
                className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                <span>Continue to Dashboard</span>
                <Icon icon="mdi:arrow-right" className="text-xl" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
