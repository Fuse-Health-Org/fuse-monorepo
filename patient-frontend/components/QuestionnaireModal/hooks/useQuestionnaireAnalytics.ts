import { useEffect, useRef } from "react";
import { trackFormView, trackFormConversion, trackFormDropOff } from "../../../lib/analytics";

export function useQuestionnaireAnalytics(
  isOpen: boolean,
  questionnaireId: string | undefined,
  tenantProductFormId: string | undefined,
  tenantProductId: string | undefined,
  domainClinic: any,
  productName: string | undefined,
  currentStepIndex: number,
  getCurrentStage: () => 'product' | 'payment' | 'account',
  questionnaire: any,
  affiliateSlug?: string | null
) {
  const hasTrackedViewRef = useRef(false);
  const hasConvertedRef = useRef(false);
  const hasTrackedDropOffRef = useRef(false);
  const lastStageRef = useRef<'product' | 'payment' | 'account'>('product');
  const prevIsOpenRef = useRef(isOpen);

  // Track form view when modal opens
  useEffect(() => {
    const handleTrackFormView = async () => {
      // Use tenantProductFormId - this should always be available from the URL
      const formIdForTracking = tenantProductFormId;

      console.log('🔍 [Analytics] Checking tracking conditions:', {
        isOpen,
        questionnaireId,
        tenantProductFormId,
        formIdForTracking,
        tenantProductId,
        hasTrackedView: hasTrackedViewRef.current,
        affiliateSlug,
        domainClinic: domainClinic ? { 
          id: domainClinic.id, 
          name: domainClinic.name, 
          userId: (domainClinic as any).userId,
          ownerId: (domainClinic as any).ownerId,
          fullClinic: domainClinic
        } : null
      });

      // Only track if modal is open and we have the required data
      if (!isOpen || !formIdForTracking || !tenantProductId || !domainClinic) {
        console.log('⚠️ [Analytics] Skipping tracking - missing required data', {
          isOpen,
          hasFormId: !!formIdForTracking,
          hasProductId: !!tenantProductId,
          hasClinic: !!domainClinic
        });
        return;
      }

      // Skip if we've already tracked this modal session
      if (hasTrackedViewRef.current) {
        console.log('⚠️ [Analytics] Skipping tracking - already tracked for this modal session');
        return;
      }

      // Get the user ID from the clinic (the brand owner)
      const userId = (domainClinic as any).userId || (domainClinic as any).ownerId;

      if (!userId) {
        console.warn('⚠️ [Analytics] Cannot track view: no userId found on clinic. Full clinic data:', JSON.stringify(domainClinic, null, 2));
        return;
      }

      console.log('✅ [Analytics] All conditions met, calling trackFormView with:', {
        userId,
        productId: tenantProductId,
        formId: formIdForTracking,
        sourceType: affiliateSlug ? 'affiliate' : 'brand',
        affiliateSlug
      });

      // Mark as tracked IMMEDIATELY to prevent duplicate calls
      hasTrackedViewRef.current = true;

      await trackFormView({
        userId,
        productId: tenantProductId,
        formId: formIdForTracking,
        clinicId: domainClinic.id,
        clinicName: domainClinic.name,
        productName: productName || undefined,
        sourceType: affiliateSlug ? 'affiliate' : 'brand',
        affiliateSlug: affiliateSlug || undefined
      });

      console.log('✅ [Analytics] trackFormView call completed successfully');
    };

    handleTrackFormView();
  }, [isOpen, questionnaireId, tenantProductFormId, tenantProductId, domainClinic, productName, affiliateSlug]);

  // Track drop-off when user leaves page or closes modal
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Reset drop-off flag when opening
    hasTrackedDropOffRef.current = false;

    // Function to track drop-off
    const trackDropOff = (useBeacon = false) => {
      if (hasTrackedViewRef.current && !hasConvertedRef.current && !hasTrackedDropOffRef.current && tenantProductFormId && tenantProductId && domainClinic) {
        const userId = (domainClinic as any).userId || (domainClinic as any).ownerId;

        if (userId) {
          const stage = lastStageRef.current;

          console.log('📊 [Analytics] Tracking drop-off:', {
            userId,
            productId: tenantProductId,
            formId: tenantProductFormId,
            stage,
            useBeacon,
            sourceType: affiliateSlug ? 'affiliate' : 'brand',
            affiliateSlug,
          });

          hasTrackedDropOffRef.current = true;

          trackFormDropOff({
            userId,
            productId: tenantProductId,
            formId: tenantProductFormId,
            dropOffStage: stage,
            clinicId: domainClinic.id,
            clinicName: domainClinic.name,
            productName: productName || undefined,
            useBeacon,
            sourceType: affiliateSlug ? 'affiliate' : 'brand',
            affiliateSlug: affiliateSlug || undefined,
          });
        }
      }
    };

    // Handle page unload (tab close, window close, navigation away)
    const handleBeforeUnload = () => {
      trackDropOff(true); // Use sendBeacon for reliability
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isOpen, tenantProductFormId, tenantProductId, domainClinic, productName]);

  // Track drop-off when modal closes explicitly (user clicks X or back button)
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    const isNowClosed = !isOpen;

    // Track drop-off only when modal was open and is now closed
    if (wasOpen && isNowClosed && hasTrackedViewRef.current && !hasConvertedRef.current && !hasTrackedDropOffRef.current && tenantProductFormId && tenantProductId && domainClinic) {
      const userId = (domainClinic as any).userId || (domainClinic as any).ownerId;

      if (userId) {
        const stage = lastStageRef.current;

        console.log('📊 [Analytics] Tracking drop-off on modal close:', {
          userId,
          productId: tenantProductId,
          formId: tenantProductFormId,
          stage,
          sourceType: affiliateSlug ? 'affiliate' : 'brand',
          affiliateSlug,
        });

        hasTrackedDropOffRef.current = true;

        trackFormDropOff({
          userId,
          productId: tenantProductId,
          formId: tenantProductFormId,
          dropOffStage: stage,
          clinicId: domainClinic.id,
          clinicName: domainClinic.name,
          productName: productName || undefined,
          useBeacon: false, // Use regular fetch for explicit closes
          sourceType: affiliateSlug ? 'affiliate' : 'brand',
          affiliateSlug: affiliateSlug || undefined,
        });
      }
    }

    // Update the previous value
    prevIsOpenRef.current = isOpen;
  }, [isOpen, tenantProductFormId, tenantProductId, domainClinic, productName]);

  // Update the last stage ref whenever the user navigates
  useEffect(() => {
    if (isOpen && questionnaire) {
      const currentStage = getCurrentStage();
      lastStageRef.current = currentStage;
    }
  }, [currentStepIndex, isOpen, questionnaire, getCurrentStage]);

  const trackConversion = async (paymentIntentId: string, orderId?: string) => {
    if (tenantProductFormId && tenantProductId && domainClinic) {
      const userId = (domainClinic as any).userId || (domainClinic as any).ownerId;

      if (userId) {
        console.log('📊 [Analytics] Tracking conversion with:', {
          sourceType: affiliateSlug ? 'affiliate' : 'brand',
          affiliateSlug,
          orderId
        });

        await trackFormConversion({
          userId,
          productId: tenantProductId,
          formId: tenantProductFormId,
          clinicId: domainClinic.id,
          clinicName: domainClinic.name,
          productName: productName || undefined,
          paymentIntentId: paymentIntentId,
          orderId: orderId || undefined,
          sourceType: affiliateSlug ? 'affiliate' : 'brand',
          affiliateSlug: affiliateSlug || undefined
        });

        // Mark as converted so we don't track a drop-off
        hasConvertedRef.current = true;
      }
    }
  };

  const resetTrackingFlags = () => {
    hasTrackedViewRef.current = false;
    hasConvertedRef.current = false;
    hasTrackedDropOffRef.current = false;
  };

  return {
    trackConversion,
    resetTrackingFlags
  };
}

