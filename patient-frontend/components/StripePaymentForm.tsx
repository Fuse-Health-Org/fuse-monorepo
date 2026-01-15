import React from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';

interface StripePaymentFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  onConfirm?: () => void; // Called when payment is submitted but before confirmation
  amount: number;
  loading?: boolean;
}

export const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  onSuccess,
  onError,
  onConfirm,
  amount,
  loading = false
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    // Verify that Payment Element is mounted before proceeding
    const paymentElement = elements.getElement('payment');
    if (!paymentElement) {
      onError('Payment form is not ready. Please wait a moment and try again.');
      return;
    }

    setIsProcessing(true);

    try {
      // Start the payment confirmation FIRST, then open modal after a brief delay
      // This ensures the Payment Element is fully accessible during confirmation
      const confirmPromise = stripe.confirmPayment({
        elements,
        confirmParams: {
          // Return URL is required but won't be used since we handle success in the callback
          return_url: window.location.origin,
        },
        redirect: 'if_required',
      });

      // Open modal with processing state after a small delay
      // This gives Stripe time to access the Payment Element before the modal potentially interferes
      if (onConfirm) {
        // Use requestAnimationFrame to ensure DOM is stable, then setTimeout for modal
        requestAnimationFrame(() => {
          setTimeout(() => {
            onConfirm();
          }, 200);
        });
      }

      const { error } = await confirmPromise;

      if (error) {
        setIsProcessing(false);
        onError(error.message || 'An error occurred during payment');
      } else {
        // Payment succeeded
        onSuccess();
        setIsProcessing(false);
      }
    } catch (err) {
      setIsProcessing(false);
      onError('An unexpected error occurred during payment');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <PaymentElement 
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card', 'link']
          }}
        />
      </div>
      
      <div className="flex justify-between items-center">
        <div className="text-lg font-semibold">
          Total: ${amount.toFixed(2)}
        </div>
        
        <Button
          type="submit"
          color="primary"
          size="lg"
          isDisabled={!stripe || loading || isProcessing}
          isLoading={isProcessing}
          startContent={
            isProcessing ? null : <Icon icon="lucide:credit-card" />
          }
        >
          {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
        </Button>
      </div>
    </form>
  );
};