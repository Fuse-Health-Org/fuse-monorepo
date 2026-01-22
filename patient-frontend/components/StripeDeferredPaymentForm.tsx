import React from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId?: string;
  orderId?: string;
}

interface StripeDeferredPaymentFormProps {
  amount: number;
  /** Called to create the subscription/PaymentIntent. Must return the clientSecret and optional metadata. */
  onCreatePaymentIntent: () => Promise<PaymentIntentResult | null>;
  /** Called on successful payment with the payment data */
  onSuccess: (data: { paymentIntentId?: string; orderId?: string }) => void;
  onError: (error: string) => void;
  onConfirm?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Stripe Payment Form with deferred intent creation.
 * 
 * This form renders the PaymentElement immediately without waiting for a clientSecret.
 * Uses mode: 'payment' with dynamic amount updates via elements.update().
 * 
 * When the user submits:
 * 1. Validates the payment details with elements.submit()
 * 2. Calls onCreatePaymentIntent to create the subscription and get clientSecret
 * 3. Confirms the payment with the returned clientSecret
 */
export const StripeDeferredPaymentForm: React.FC<StripeDeferredPaymentFormProps> = ({
  amount,
  onCreatePaymentIntent,
  onSuccess,
  onError,
  onConfirm,
  disabled = false,
  disabledReason,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const previousAmountRef = React.useRef<number>(0);

  // Update Elements amount when it changes (without re-mounting)
  React.useEffect(() => {
    if (elements && amount > 0 && amount !== previousAmountRef.current) {
      console.log('💰 [DEFERRED] Updating Elements amount:', amount * 100, 'cents');
      elements.update({ amount: Math.round(amount * 100) });
      previousAmountRef.current = amount;
    }
  }, [elements, amount]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (disabled) {
      if (disabledReason) {
        onError(disabledReason);
      }
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Validate and collect payment details
      console.log('🔄 [DEFERRED] Step 1: Submitting elements to validate...');
      const { error: submitError } = await elements.submit();
      
      if (submitError) {
        console.error('❌ [DEFERRED] Submit validation failed:', submitError);
        setIsProcessing(false);
        onError(submitError.message || 'Please check your payment details');
        return;
      }

      console.log('✅ [DEFERRED] Step 1 complete: Payment details validated');

      // Show processing modal
      if (onConfirm) {
        onConfirm();
      }

      // Step 2: Create the subscription/PaymentIntent
      console.log('🔄 [DEFERRED] Step 2: Creating subscription...');
      const result = await onCreatePaymentIntent();
      
      if (!result || !result.clientSecret) {
        console.error('❌ [DEFERRED] Failed to create subscription');
        setIsProcessing(false);
        onError('Failed to set up payment. Please try again.');
        return;
      }

      console.log('✅ [DEFERRED] Step 2 complete: Got clientSecret, paymentIntentId:', result.paymentIntentId);

      // Step 3: Confirm the payment with the clientSecret
      console.log('🔄 [DEFERRED] Step 3: Confirming payment...');
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: result.clientSecret,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        console.error('❌ [DEFERRED] Payment confirmation failed:', confirmError);
        setIsProcessing(false);
        onError(confirmError.message || 'Payment failed. Please try again.');
        return;
      }

      console.log('✅ [DEFERRED] Step 3 complete: Payment confirmed!');
      onSuccess({ paymentIntentId: result.paymentIntentId, orderId: result.orderId });
      setIsProcessing(false);

    } catch (err: any) {
      console.error('❌ [DEFERRED] Unexpected error:', err);
      setIsProcessing(false);
      onError(err?.message || 'An unexpected error occurred');
    }
  };

  const hasValidAmount = amount > 0;
  const isButtonDisabled = !stripe || !elements || isProcessing || disabled || !hasValidAmount;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        {/* Info message when no product selected */}
        {!hasValidAmount && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 flex items-center gap-2">
              <Icon icon="lucide:info" className="text-blue-500" />
              Select a product above to see the total and complete checkout
            </p>
          </div>
        )}
        
        <PaymentElement 
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card', 'link']
          }}
        />
      </div>
      
      <div className="flex justify-between items-center">
        <div className="text-lg font-semibold">
          {hasValidAmount ? `Total: $${amount.toFixed(2)}` : 'Total: --'}
        </div>
        
        <Button
          type="submit"
          color="primary"
          size="lg"
          isDisabled={isButtonDisabled}
          isLoading={isProcessing}
          startContent={
            isProcessing ? null : <Icon icon="lucide:credit-card" />
          }
        >
          {isProcessing 
            ? 'Processing...' 
            : hasValidAmount 
              ? `Pay $${amount.toFixed(2)}`
              : 'Select a product'
          }
        </Button>
      </div>

      {disabled && disabledReason && (
        <p className="text-sm text-amber-600 text-center">{disabledReason}</p>
      )}
    </form>
  );
};
