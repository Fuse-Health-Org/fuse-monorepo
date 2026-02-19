import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { apiCall } from "../../../lib/api";
import { replaceVariables, getVariablesFromClinic } from "../../../lib/templateVariables";
import { signInUser, createUserAccount as createUserAccountAPI, signInWithGoogle } from "../auth";
import { createEmailVerificationHandlers } from "../emailVerification";
import { trackFormConversion, generateSessionId } from "../../../lib/analytics";
import { trackContactInfoDebounced } from "../../../lib/contactTracking";
import { QuestionnaireModalProps, QuestionnaireData, PlanOption, PaymentStatus } from "../types";
import { useQuestionnaireData } from "./useQuestionnaireData";
import { useGoogleOAuth } from "./useGoogleOAuth";
import { useGoogleMfa } from "./useGoogleMfa";
import { useQuestionnaireAnalytics } from "./useQuestionnaireAnalytics";
import { useQuestionnairePlans } from "./useQuestionnairePlans";
import { useQuestionnaireTheme } from "./useQuestionnaireTheme";
import { usePharmacyCoverages } from "./usePharmacyCoverages";
import { getDashboardPrefix, getDashboardPrefixByMedicalCompany } from "../../../lib/clinic-utils";
import { MedicalCompanySlug } from "@fuse/enums";
import { hasPOBox } from "../addressValidation";

export function useQuestionnaireModal(
  props: QuestionnaireModalProps,
  domainClinic: any,
  isLoadingClinic: boolean
) {
  const { isOpen, onClose, questionnaireId, tenantProductId, tenantProductFormId, productName, programData } = props;

  // Get session ID for tracking
  const sessionId = generateSessionId();
  const productId = tenantProductId;

  // Data loading
  const { questionnaire, loading, setQuestionnaire } = useQuestionnaireData(
    isOpen,
    {
      treatmentId: props.treatmentId,
      questionnaireId: props.questionnaireId,
      productName: props.productName,
      productCategory: props.productCategory,
      productFormVariant: props.productFormVariant,
      globalFormStructure: props.globalFormStructure,
      programData: props.programData,
    },
    onClose
  );

  // State management
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [belugaConsentGiven, setBelugaConsentGiven] = useState(false);
  const [belugaPhoto, setBelugaPhoto] = useState<{ mime: "image/jpeg"; data: string; fileName: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  // Program-specific state
  const [selectedProgramProducts, setSelectedProgramProducts] = useState<Record<string, boolean>>({});
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [userId, setUserId] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [isAuthenticatedUser, setIsAuthenticatedUser] = useState(false);
  const [patientName, setPatientName] = useState<string>('');
  const [patientFirstName, setPatientFirstName] = useState<string>('');
  const [shippingInfo, setShippingInfo] = useState({
    address: "", apartment: "", city: "", state: "", zipCode: "", country: "us"
  });
  // Visit fee state
  const [visitFeeAmount, setVisitFeeAmount] = useState<number>(0);
  const [visitType, setVisitType] = useState<'synchronous' | 'asynchronous' | null>(null);
  const [loadingVisitFee, setLoadingVisitFee] = useState<boolean>(false);

  // Callback to calculate visit fee (can be called manually)
  const calculateVisitFee = useCallback(async (state?: string) => {
    const stateToUse = state || shippingInfo.state;
    
    console.log('🔍 [VISIT FEE] calculateVisitFee called:', {
      hasProgramData: !!programData,
      state: stateToUse,
      programId: programData?.id,
    });

    if (!programData || !stateToUse) {
      console.log('⏭️ [VISIT FEE] Skipping: no program or state');
      return;
    }

    setLoadingVisitFee(true);
    try {
      const result = await apiCall('/programs/calculate-visit-fee', {
        method: 'POST',
        body: JSON.stringify({
          programId: programData.id,
          state: stateToUse,
        }),
      });

      console.log('📥 [VISIT FEE] API Response:', result);
      console.log('📥 [VISIT FEE] API Response.data:', result.data);

      if (result.success && result.data) {
        const feeData = result.data.data || result.data; // Handle nested response
        console.log('📥 [VISIT FEE] Fee data extracted:', feeData);
        
        setVisitFeeAmount(feeData.visitFeeAmount || 0);
        setVisitType(feeData.visitType || null);
        console.log('✅ [VISIT FEE] Visit fee set:', {
          state: stateToUse,
          visitType: feeData.visitType,
          visitFeeAmount: feeData.visitFeeAmount,
        });
      }
    } catch (error) {
      console.error('❌ [VISIT FEE] Failed to calculate visit fee:', error);
      setVisitFeeAmount(0);
      setVisitType(null);
    } finally {
      setLoadingVisitFee(false);
    }
  }, [programData, shippingInfo.state]);
  const [checkoutPaymentInfo, setCheckoutPaymentInfo] = useState({
    cardNumber: "", expiryDate: "", securityCode: "", country: "brazil"
  });

  // Affiliate tracking: Derive affiliate slug from URL using extractClinicSlugFromDomain
  const [affiliateSlug, setAffiliateSlug] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasAuthToken = !!localStorage.getItem("auth-token");
    setIsAuthenticatedUser(hasAuthToken);
  }, [isOpen, userId, accountCreated]);

  useEffect(() => {
    const detectAffiliateSlug = async () => {
      if (typeof window === 'undefined') return;

      try {
        // Import dynamically to avoid circular dependency
        const { extractClinicSlugFromDomain } = await import('../../../lib/clinic-utils');
        const domainInfo = await extractClinicSlugFromDomain();

        // Use affiliateSlug from domain detection (works for subdomains AND custom domains)
        if (domainInfo.affiliateSlug) {
          setAffiliateSlug(domainInfo.affiliateSlug);
          console.log('👤 Detected affiliate slug from domain:', domainInfo.affiliateSlug);
        }
      } catch (error) {
        console.error('❌ Error detecting affiliate slug:', error);
      }
    };

    detectAffiliateSlug();
  }, []);

  // Calculate visit fee when entering checkout step
  useEffect(() => {
    // Only calculate for program flows when on checkout step
    if (!programData || !questionnaire) return;
    
    const checkoutPos = questionnaire.checkoutStepPosition;
    const belugaOffset = questionnaire.medicalCompanySource === MedicalCompanySlug.BELUGA ? 2 : 0;
    const checkoutStepIndex = (checkoutPos === -1 ? questionnaire.steps.length : checkoutPos) + belugaOffset;
    const isOnCheckout = currentStepIndex === checkoutStepIndex;
    
    console.log('🔍 [VISIT FEE] useEffect check:', {
      isOnCheckout,
      currentStepIndex,
      checkoutStepIndex,
      state: shippingInfo.state,
    });
    
    if (isOnCheckout && shippingInfo.state) {
      console.log('🚀 [VISIT FEE] Triggering calculation from useEffect');
      calculateVisitFee(shippingInfo.state);
    }
  }, [programData, questionnaire, currentStepIndex, shippingInfo.state, calculateVisitFee]);

  // Auth state
  const [isSignInMode, setIsSignInMode] = useState(false);
  const [isSignInOptionsMode, setIsSignInOptionsMode] = useState(false);
  const [isPasswordSignInMode, setIsPasswordSignInMode] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isEmailVerificationMode, setIsEmailVerificationMode] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailModalLoading, setEmailModalLoading] = useState(false);
  const [emailModalError, setEmailModalError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Track initialization
  const hasInitializedStepRef = useRef(false);
  const hasRestoredFromCacheRef = useRef(false);

  // Debug sign-in mode changes
  useEffect(() => {
    console.log('🔴 [SIGN IN MODE] isSignInOptionsMode changed to:', isSignInOptionsMode);
  }, [isSignInOptionsMode]);

  useEffect(() => {
    console.log('🔴 [SIGN IN MODE] isPasswordSignInMode changed to:', isPasswordSignInMode);
  }, [isPasswordSignInMode]);

  // Google MFA
  const googleMfa = useGoogleMfa(
    setAnswers, setPatientFirstName, setPatientName, setUserId, setAccountCreated, answers
  );

  // Google OAuth - pass MFA and sign-in mode setters
  const { hasHandledGoogleAuthRef } = useGoogleOAuth(
    answers, setAnswers, setPatientFirstName, setPatientName, setUserId, setAccountCreated,
    {
      setIsGoogleMfaMode: googleMfa.setIsGoogleMfaMode,
      setGoogleMfaToken: googleMfa.setGoogleMfaToken,
      setGoogleMfaEmail: googleMfa.setGoogleMfaEmail,
      setGoogleMfaCode: googleMfa.setGoogleMfaCode,
      setGoogleMfaError: googleMfa.setGoogleMfaError,
    },
    {
      setIsSignInOptionsMode,
      setIsPasswordSignInMode,
    }
  );

  // Step helpers - must be defined before getCurrentStage
  const isBeluga = questionnaire?.medicalCompanySource === MedicalCompanySlug.BELUGA;
  const belugaIntroStepsOffset = isBeluga ? 2 : 0;
  const isBelugaConsentStep = isBeluga && currentStepIndex === 0;
  const isBelugaPhotoStep = isBeluga && currentStepIndex === 1;
  const shouldSkipUserProfileSteps = Boolean(accountCreated || userId || isAuthenticatedUser);

  const isProductSelectionStep = useCallback((): boolean => {
    if (!questionnaire) return false;
    const productSelectionPos = questionnaire.productSelectionStepPosition;
    const productSelectionStepIndex = (productSelectionPos !== undefined && productSelectionPos !== -1) ? productSelectionPos : -1;
    const checkoutPos = questionnaire.checkoutStepPosition;
    const checkoutStepIndex = (checkoutPos === -1 ? questionnaire.steps.length : checkoutPos) + belugaIntroStepsOffset;
    return productSelectionStepIndex !== -1 && currentStepIndex === productSelectionStepIndex;
  }, [questionnaire, currentStepIndex, belugaIntroStepsOffset]);

  const isCheckoutStep = useCallback((): boolean => {
    if (!questionnaire) return false;
    const checkoutPos = questionnaire.checkoutStepPosition;
    const checkoutStepIndex = (checkoutPos === -1 ? questionnaire.steps.length : checkoutPos) + belugaIntroStepsOffset;
    return currentStepIndex === checkoutStepIndex;
  }, [questionnaire, currentStepIndex, belugaIntroStepsOffset]);

  const evaluateStepConditionalLogic = useCallback((step: any): boolean => {
    const conditionalLogic = step.conditionalLogic;
    if (!conditionalLogic) return true;
    try {
      const tokens = conditionalLogic.split(' ');
      let result = false;
      let currentOperator: 'OR' | 'AND' | null = null;
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.startsWith('answer_equals:')) {
          const parts = token.replace('answer_equals:', '').split(':');
          if (parts.length === 2) {
            const [questionId, requiredValue] = parts;
            const answer = answers[questionId];
            const conditionMet = Array.isArray(answer) ? answer.includes(requiredValue) : answer === requiredValue;
            if (currentOperator === 'AND') result = result && conditionMet;
            else if (currentOperator === 'OR') result = result || conditionMet;
            else result = conditionMet;
          }
        } else if (token === 'OR' || token === 'AND') {
          currentOperator = token as 'OR' | 'AND';
        }
      }
      return result;
    } catch (error) {
      return true;
    }
  }, [answers]);

  const getCurrentQuestionnaireStep = useCallback(() => {
    if (!questionnaire || isProductSelectionStep() || isCheckoutStep()) return null;
    if (isBelugaConsentStep || isBelugaPhotoStep) return null;
    const checkoutPos = questionnaire.checkoutStepPosition;
    let actualStepIndex = currentStepIndex - belugaIntroStepsOffset;
    if (checkoutPos !== -1 && currentStepIndex > checkoutPos + 1 + belugaIntroStepsOffset) {
      actualStepIndex = currentStepIndex - 2 - belugaIntroStepsOffset;
    }

    // Check if user is signed in
    const isSignedIn = shouldSkipUserProfileSteps;

    // Find the current visible step at actualStepIndex
    // Don't modify currentStepIndex during render - that should only happen in handleNext/handlePrevious
    for (let i = actualStepIndex; i < questionnaire.steps.length; i++) {
      const step = questionnaire.steps[i];

      // Skip user_profile steps if user is signed in
      if (isSignedIn && step.category === 'user_profile') {
        console.log('⏭️ Skipping user_profile step (user signed in):', step.title);
        continue;
      }

      if (evaluateStepConditionalLogic(step)) {
        // Return the step but DON'T modify currentStepIndex here
        // The index will be correct when handleNext advances properly
        return step;
      }
    }
    return null;
  }, [questionnaire, currentStepIndex, isProductSelectionStep, isCheckoutStep, evaluateStepConditionalLogic, isBelugaConsentStep, isBelugaPhotoStep, belugaIntroStepsOffset, shouldSkipUserProfileSteps]);

  // Analytics
  const getCurrentStage = useCallback((): 'product' | 'payment' | 'account' => {
    if (isCheckoutStep()) return 'payment';
    const currentStep = getCurrentQuestionnaireStep();

    console.log('📊 [getCurrentStage] Current step analysis:', {
      currentStepIndex,
      currentStep: currentStep ? {
        title: currentStep.title,
        category: currentStep.category,
        stepOrder: currentStep.stepOrder
      } : null,
      isCheckoutStep: isCheckoutStep(),
      isSignedIn: isAuthenticatedUser,
    });

    // Only consider "account" stage if the step title indicates account creation
    // (e.g., "Create Your Account", not "Location Verification")
    const isSignedIn = shouldSkipUserProfileSteps;
    if (!isSignedIn && currentStep?.category === 'user_profile') {
      const stepTitle = currentStep.title?.toLowerCase() || '';
      // Check if it's actually an account creation step
      if (stepTitle.includes('create') && stepTitle.includes('account')) {
        return 'account';
      }
    }

    return 'product';
  }, [isCheckoutStep, getCurrentQuestionnaireStep, currentStepIndex, shouldSkipUserProfileSteps]);

  const { trackConversion, resetTrackingFlags } = useQuestionnaireAnalytics(
    isOpen, questionnaireId, tenantProductFormId, tenantProductId, domainClinic, productName,
    currentStepIndex, getCurrentStage, questionnaire, affiliateSlug
  );

  // Plans and theme
  const { plans, selectedPlan, setSelectedPlan } = useQuestionnairePlans(
    questionnaire, props.productPrice, props.productStripePriceId, props.productName, props.tenantProductId
  );
  const { theme, themeVars } = useQuestionnaireTheme(isOpen, questionnaireId, questionnaire, domainClinic);
  const pharmacyCoverages = usePharmacyCoverages(isOpen, tenantProductId);

  // Helper: Get total steps (excluding user_profile if signed in)
  const getTotalSteps = useCallback((): number => {
    if (!questionnaire) return 0;
    const isSignedIn = shouldSkipUserProfileSteps;
    const visibleSteps = questionnaire.steps.filter(step => {
      if (isSignedIn && step.category === 'user_profile') return false;
      return true;
    }).length;
    return visibleSteps + 1 + belugaIntroStepsOffset; // + Beluga intro steps + checkout
  }, [questionnaire, belugaIntroStepsOffset, shouldSkipUserProfileSteps]);

  // Get current visible step number for progress display
  const getCurrentVisibleStepNumber = useCallback((): number => {
    if (!questionnaire) return 1;
    if (isBelugaConsentStep) return 1;
    if (isBelugaPhotoStep) return 2;
    const isSignedIn = shouldSkipUserProfileSteps;
    const productSelectionPos = questionnaire.productSelectionStepPosition;
    const checkoutPos = questionnaire.checkoutStepPosition;
    const productSelectionStepIndex = (productSelectionPos !== undefined && productSelectionPos !== -1) ? productSelectionPos : -1;
    const checkoutStepIndex = (checkoutPos === -1 ? questionnaire.steps.length : checkoutPos) + belugaIntroStepsOffset;

    // Log all steps with their categories for debugging
    const stepCategories = questionnaire.steps.map((s, i) => `${i}:${s.category}`);
    console.log('📊 [STEP NUM] Calculating visible step number:', {
      currentStepIndex,
      isSignedIn,
      accountCreated,
      userId,
      productSelectionStepIndex,
      checkoutStepIndex,
      totalQuestionnaireSteps: questionnaire.steps.length,
      stepCategories
    });

    // If we're on checkout step
    if (currentStepIndex >= checkoutStepIndex) {
      return getTotalSteps();
    }

    // If we're on product selection step
    if (productSelectionStepIndex !== -1 && currentStepIndex === productSelectionStepIndex) {
      // Count all visible steps before product selection + 1 for product selection itself
      let visibleCount = 0;
      for (let i = 0; i < productSelectionStepIndex && i < questionnaire.steps.length; i++) {
        const step = questionnaire.steps[i];
        if (isSignedIn && step.category === 'user_profile') continue;
        visibleCount++;
      }
      return visibleCount + 1;
    }

    // Count visible steps: Beluga consent (1) + questionnaire steps up to current
    let visibleCount = belugaIntroStepsOffset;
    const startIdx = belugaIntroStepsOffset;
    for (let i = startIdx; i <= currentStepIndex && i - belugaIntroStepsOffset < questionnaire.steps.length; i++) {
      const step = questionnaire.steps[i - belugaIntroStepsOffset];
      if (!step) break;
      // Skip user_profile steps ONLY if signed in
      if (isSignedIn && step.category === 'user_profile') {
        console.log(`📊 [STEP NUM] Skipping step ${i} (${step.category}) - user signed in`);
        continue;
      }
      visibleCount++;
      console.log(`📊 [STEP NUM] Counting step ${i} (${step.category}) - visibleCount now ${visibleCount}`);
    }

    console.log('📊 [STEP NUM] Final result:', { visibleCount, returning: Math.max(visibleCount, 1) });

    // Ensure we return at least 1
    return Math.max(visibleCount, 1);
  }, [questionnaire, currentStepIndex, getTotalSteps, isBelugaConsentStep, isBelugaPhotoStep, belugaIntroStepsOffset, shouldSkipUserProfileSteps]);

  // Build questionnaire answers
  const buildQuestionnaireAnswers = useCallback((currentAnswers: Record<string, any>) => {
    const structuredAnswers: any[] = [];
    const legacyAnswers: Record<string, string> = {};
    questionnaire?.steps?.forEach(step => {
      step.questions?.forEach(question => {
        const answerValue = currentAnswers[question.id];
        if (answerValue !== undefined && answerValue !== '') {
          const structuredAnswer: any = {
            questionId: question.id,
            stepId: step.id,
            stepCategory: step.category,
            questionText: question.questionText,
            answerType: question.answerType,
            answer: answerValue,
            answeredAt: new Date().toISOString()
          };
          if (question.answerType === 'single_choice' || question.answerType === 'multiple_choice' || question.answerType === 'checkbox') {
            const selectedOptions: any[] = [];
            if (Array.isArray(answerValue)) {
              answerValue.forEach(value => {
                const option = question.options?.find(opt => opt.optionValue === value);
                if (option) selectedOptions.push({ optionId: option.id, optionText: option.optionText, optionValue: option.optionValue });
              });
              legacyAnswers[question.questionText] = answerValue.map(v => question.options?.find(o => o.optionValue === v)?.optionText || v).join(', ');
            } else {
              const option = question.options?.find(opt => opt.optionValue === answerValue);
              if (option) selectedOptions.push({ optionId: option.id, optionText: option.optionText, optionValue: option.optionValue });
              legacyAnswers[question.questionText] = option?.optionText || answerValue;
            }
            structuredAnswer.selectedOptions = selectedOptions;
          } else {
            legacyAnswers[question.questionText] = String(answerValue);
          }
          structuredAnswers.push(structuredAnswer);
        }
      });
    });
    ['firstName', 'lastName', 'email', 'mobile'].forEach(key => {
      const label = key === 'firstName' ? 'First Name' : key === 'lastName' ? 'Last Name' : key === 'email' ? 'Email Address' : 'Mobile Number';
      if (currentAnswers[key]) {
        legacyAnswers[label] = currentAnswers[key];
        structuredAnswers.push({
          questionId: key, stepId: 'account-creation', stepCategory: 'user_profile',
          questionText: label, answerType: 'text', answer: currentAnswers[key], answeredAt: new Date().toISOString()
        });
      }
    });
    return {
      structured: { answers: structuredAnswers, metadata: { questionnaireId: questionnaire?.id, completedAt: new Date().toISOString(), version: "1.0" } },
      legacy: legacyAnswers
    };
  }, [questionnaire]);

  // Answer handlers
  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    if (questionId === 'mobile') {
      const numericValue = String(value).replace(/\D/g, '');
      if (numericValue.length <= 10) {
        setAnswers(prev => {
          const updated = { ...prev, [questionId]: numericValue };
          
          // Track contact info when mobile is updated
          if (sessionId && productId && questionnaireId) {
            const contactInfo = {
              firstName: (prev as any).firstName,
              lastName: (prev as any).lastName,
              email: (prev as any).email,
              phoneNumber: numericValue,
            };
            trackContactInfoDebounced(
              sessionId,
              contactInfo,
              productId,
              questionnaireId
            );
          }
          
          return updated;
        });
        if (errors[questionId]) setErrors(prev => { const next = { ...prev }; delete next[questionId]; return next; });
      }
      return;
    }
    const newAnswers = { ...answers, [questionId]: value };
    if (questionId === 'weight' || questionId === 'heightFeet' || questionId === 'heightInches') {
      const weight = parseFloat(newAnswers['weight'] as string);
      const feet = parseFloat(newAnswers['heightFeet'] as string);
      const inches = parseFloat(newAnswers['heightInches'] as string);
      if (weight && feet >= 0 && inches >= 0) {
        const totalInches = feet * 12 + inches;
        const heightInMeters = totalInches * 0.0254;
        const weightInKg = weight * 0.453592;
        const bmi = weightInKg / (heightInMeters * heightInMeters);
        let category = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
        newAnswers['bmi'] = bmi.toFixed(1);
        newAnswers['bmiCategory'] = category;
        newAnswers['heightAndWeight'] = `${weight} lbs, ${feet}'${inches}"`;
      }
    }
    setAnswers(newAnswers);
    if (errors[questionId]) setErrors(prev => { const next = { ...prev }; delete next[questionId]; return next; });
    
    // Track contact info when firstName, lastName, or email are updated
    if (['firstName', 'lastName', 'email'].includes(questionId)) {
      if (sessionId && productId && questionnaireId) {
        trackContactInfoDebounced(
          sessionId,
          {
            firstName: newAnswers.firstName,
            lastName: newAnswers.lastName,
            email: newAnswers.email,
            phoneNumber: newAnswers.mobile,
          },
          productId,
          questionnaireId
        );
      }
    }
  }, [answers, errors, sessionId, productId, questionnaireId]);

  const handleRadioChange = useCallback((questionId: string, value: any) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    setErrors(prev => { const next = { ...prev }; delete next[questionId]; return next; });
    const step = getCurrentQuestionnaireStep();
    const otherInvalid = step?.questions?.some((q: any) => {
      if (q.id === questionId || !q.isRequired) return false;
      const a = newAnswers[q.id];
      return a === undefined || a === null || (typeof a === 'string' && a.trim() === '') || (Array.isArray(a) && a.length === 0);
    });
    if (!otherInvalid && currentStepIndex < getTotalSteps() - 1) {
      setTimeout(() => setCurrentStepIndex(prev => prev + 1), 300);
    }
  }, [answers, currentStepIndex, getCurrentQuestionnaireStep, getTotalSteps]);

  const handleCheckboxChange = useCallback((questionId: string, optionValue: string, isChecked: boolean) => {
    const currentValues = answers[questionId] || [];
    const newValues = isChecked ? [...currentValues, optionValue] : currentValues.filter((v: string) => v !== optionValue);
    setAnswers(prev => ({ ...prev, [questionId]: newValues }));
    if (errors[questionId]) setErrors(prev => { const next = { ...prev }; delete next[questionId]; return next; });
  }, [answers, errors]);

  // Validation
  const validateCurrentStep = useCallback((): boolean => {
    if (!questionnaire) return true;
    if (isBelugaConsentStep) {
      const nextErrors: Record<string, string> = {};

      if (!belugaConsentGiven) {
        nextErrors.belugaConsent = 'Please acknowledge the Informed Consent and Privacy Policy to continue.';
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...nextErrors }));
        return false;
      }

      setErrors((prev) => {
        const next = { ...prev };
        delete next.belugaConsent;
        return next;
      });
      return true;
    }
    if (isBelugaPhotoStep) {
      if (!belugaPhoto?.data) {
        setErrors((prev) => ({ ...prev, belugaPhoto: 'Please upload a JPEG image before continuing.' }));
        return false;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next.belugaPhoto;
        return next;
      });
      return true;
    }
    if (isProductSelectionStep()) {
      if (programData) {
        if (!Object.values(selectedProgramProducts).some(Boolean)) {
          alert('Please select at least one product to continue.');
          return false;
        }
        return true;
      }
      if (!Object.values(selectedProducts).some(qty => qty > 0)) {
        alert('Please select at least one product to continue.');
        return false;
      }
      return true;
    }
    if (isCheckoutStep()) {
      const requiredFields = ['address', 'city', 'state', 'zipCode'];
      for (const field of requiredFields) {
        if (!shippingInfo[field as keyof typeof shippingInfo]?.trim()) {
          alert(`Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} field.`);
          return false;
        }
      }
      if (hasPOBox(shippingInfo.address, shippingInfo.apartment)) {
        alert('We cannot ship to P.O. boxes. Please enter a valid street address.');
        return false;
      }
      if (paymentStatus !== 'succeeded') {
        alert('Please complete your payment information before proceeding.');
        return false;
      }
      return true;
    }
    const currentStep = getCurrentQuestionnaireStep();
    if (!currentStep || currentStep.required === false) return true;
    if (currentStep.title === 'Create Your Account') {
      const stepErrors: Record<string, string> = {};
      ['firstName', 'lastName', 'email', 'mobile'].forEach(field => {
        const answer = answers[field];
        if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
          stepErrors[field] = 'This field is required';
        }
      });
      if (answers['email'] && !answers['email'].includes('@')) {
        stepErrors['email'] = 'Please enter a valid email address';
      }
      setErrors(stepErrors);
      return Object.keys(stepErrors).length === 0;
    }
    const stepErrors: Record<string, string> = {};
    currentStep.questions?.forEach(question => {
      const conditionalLogic = (question as any).conditionalLogic;
      let isVisible = true;
      if (conditionalLogic) {
        try {
          const parentQuestion = currentStep.questions?.find((q: any) => q.conditionalLevel === 0 || !q.conditionalLevel);
          if (parentQuestion) {
            const parentAnswer = answers[parentQuestion.id];
            if (parentAnswer && conditionalLogic.startsWith('answer_equals:')) {
              const requiredValue = conditionalLogic.replace('answer_equals:', '').trim();
              isVisible = Array.isArray(parentAnswer) ? parentAnswer.includes(requiredValue) : parentAnswer === requiredValue;
            } else isVisible = false;
          }
        } catch { isVisible = true; }
      }
      if (isVisible && question.isRequired) {
        const answer = answers[question.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0) || (typeof answer === 'string' && answer.trim() === '')) {
          stepErrors[question.id] = 'This field is required';
        }
      }
    });
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }, [
    questionnaire,
    isBelugaConsentStep,
    isBelugaPhotoStep,
    belugaConsentGiven,
    belugaPhoto,
    programData,
    selectedProgramProducts,
    isProductSelectionStep,
    isCheckoutStep,
    selectedProducts,
    shippingInfo,
    paymentStatus,
    getCurrentQuestionnaireStep,
    answers,
  ]);

  // Auth handlers
  const handleSignIn = useCallback(async () => {
    setSignInError('');
    setIsSigningIn(true);
    const result = await signInUser(signInEmail, signInPassword);
    if (result.success && result.userData) {
      const newAnswers = {
        ...answers,
        firstName: result.userData.firstName,
        lastName: result.userData.lastName,
        email: result.userData.email,
        mobile: result.userData.phoneNumber
      };
      setAnswers(newAnswers);
      setPatientFirstName(result.userData.firstName);
      setPatientName(`${result.userData.firstName} ${result.userData.lastName}`.trim());
      setUserId(result.userData.id);
      setAccountCreated(true);
      setIsAuthenticatedUser(true);
      setIsSignInMode(false);
      setIsSignInOptionsMode(false);
      setIsPasswordSignInMode(false);
      setIsSigningIn(false);
      console.log('✅ User signed in successfully');
    } else {
      setSignInError(result.error || 'Sign-in failed');
      setIsSigningIn(false);
    }
  }, [signInEmail, signInPassword, answers]);

  const handleGoogleSignIn = useCallback(async (credential: string) => {
    if (!credential) return;
    setIsSigningIn(true);
    const result = await signInWithGoogle(credential, domainClinic?.id);
    if (result.success && result.userData) {
      const newAnswers = {
        ...answers,
        firstName: result.userData.firstName,
        lastName: result.userData.lastName,
        email: result.userData.email,
        mobile: result.userData.phoneNumber
      };
      setAnswers(newAnswers);
      setPatientFirstName(result.userData.firstName);
      setPatientName(`${result.userData.firstName} ${result.userData.lastName}`.trim());
      setUserId(result.userData.id);
      setAccountCreated(true);
      setIsAuthenticatedUser(true);
      setIsSignInMode(false);
      setIsSignInOptionsMode(false);
      setIsPasswordSignInMode(false);
      setIsSigningIn(false);
    } else {
      setSignInError(result.error || 'Google sign-in failed');
      setIsSigningIn(false);
    }
  }, [answers, domainClinic]);

  const createUserAccount = useCallback(async () => {
    const firstName = answers['firstName'] || '';
    const lastName = answers['lastName'] || '';
    setPatientFirstName(firstName);
    setPatientName(`${firstName} ${lastName}`.trim());
    const result = await createUserAccountAPI(
      answers['firstName'],
      answers['lastName'],
      answers['email'],
      answers['mobile'],
      domainClinic?.id,
      answers['dob'] || answers['dateOfBirth'],
      answers['gender']
    );
    if (result.success && result.userId) {
      setUserId(result.userId);
      setAccountCreated(true);
    } else {
      setAccountCreated(true);
    }
  }, [answers, domainClinic]);

  const emailVerificationHandlers = createEmailVerificationHandlers({
    answers, verificationEmail, verificationCode, questionnaire, currentStepIndex,
    setVerificationError, setVerificationEmail, setIsEmailVerificationMode, setIsVerifying, setVerificationCode,
    setAnswers, setPatientFirstName, setPatientName, setUserId, setAccountCreated, setCurrentStepIndex,
    getTotalSteps, setShowEmailModal, setEmailModalLoading, setEmailModalError,
    setIsSignInOptionsMode, setIsPasswordSignInMode
  });

  // Payment handlers
  const createSubscriptionForPlan = useCallback(async (planId: string) => {
    try {
      setPaymentStatus('processing');
      const selectedPlanData = plans.find(plan => plan.id === planId);
      const stripePriceId = selectedPlanData?.stripePriceId;
      const userDetails = {
        firstName: answers['firstName'], lastName: answers['lastName'],
        email: answers['email'], phoneNumber: answers['mobile']
      };
      const questionnaireAnswersData = buildQuestionnaireAnswers(answers);
      const clinicMerchantOfRecord = (domainClinic as any)?.merchantOfRecord;
      const isClinicMOR = clinicMerchantOfRecord === 'myself';
      const requestBody: any = {
        tenantProductId: tenantProductId,
        stripePriceId: stripePriceId || undefined,
        userDetails: userDetails,
        questionnaireAnswers: questionnaireAnswersData.structured,
        shippingInfo: shippingInfo,
        clinicName: domainClinic?.name
      };
      if (isClinicMOR) requestBody.useOnBehalfOf = true;
      // Include affiliate slug for tracking
      if (affiliateSlug) {
        requestBody.affiliateSlug = affiliateSlug;
        console.log('🎯 Including affiliate slug in payment request:', affiliateSlug);
      }
      const result = await apiCall('/payments/product/sub', { method: 'POST', body: JSON.stringify(requestBody) });
      if (result.success && result.data) {
        const subscriptionData = result.data.data || result.data;
        if (subscriptionData.clientSecret) {
          const intentId = subscriptionData.paymentIntentId || subscriptionData.subscriptionId || subscriptionData.id;
          const orderIdValue = subscriptionData.orderId;

          setClientSecret(subscriptionData.clientSecret);
          setPaymentIntentId(intentId);
          if (orderIdValue) setOrderId(orderIdValue);
          setPaymentStatus('idle');

          // Return full data for deferred payment flow
          return {
            clientSecret: subscriptionData.clientSecret,
            paymentIntentId: intentId,
            orderId: orderIdValue,
          };
        }
      }
      setPaymentStatus('failed');
      return null;
    } catch (error) {
      setPaymentStatus('failed');
      return null;
    }
  }, [plans, answers, domainClinic, tenantProductId, shippingInfo, affiliateSlug, buildQuestionnaireAnswers]);

  const handlePlanSelection = useCallback((planId: string) => {
    console.log('📋 [PLAN SELECTION] Plan changed to:', planId);
    setSelectedPlan(planId);
    // Reset payment state when plan changes (in case of previous failure)
    if (paymentStatus === 'failed') {
      setPaymentStatus('idle');
    }
  }, [setSelectedPlan, paymentStatus]);

  const triggerCheckoutSequenceRun = useCallback(async () => {
    if (!domainClinic?.id) return;
    try {
      await apiCall('/sequence-triggers/checkout', {
        method: 'POST',
        body: JSON.stringify({
          clinicId: domainClinic.id,
          payload: {
            paymentIntentId, orderId, selectedPlan,
            userDetails: { firstName: answers['firstName'], lastName: answers['lastName'], email: answers['email'], phoneNumber: answers['mobile'] },
            shippingInfo, selectedProducts
          }
        })
      });
    } catch (error) {
      console.error('❌ Failed to trigger checkout sequence:', error);
    }
  }, [domainClinic, paymentIntentId, orderId, selectedPlan, answers, shippingInfo, selectedProducts]);

  // Create MD Integrations case after payment (only for md-integrations clinics)
  const createMDCase = useCallback(async (orderIdForCase: string) => {
    console.log('🔵 [MDI] ========== MD INTEGRATIONS CASE CREATION ==========');
    console.log('🔵 [MDI] Order ID:', orderIdForCase);
    console.log('🔵 [MDI] Questionnaire medicalCompanySource:', questionnaire?.medicalCompanySource);
    console.log('🔵 [MDI] Domain Clinic:', domainClinic ? {
      id: domainClinic.id,
      name: domainClinic.name,
      slug: domainClinic.slug,
    } : 'null');

    // Only proceed if questionnaire uses md-integrations as medical company source
    if (!domainClinic) {
      console.log('⚠️ [MDI] No domain clinic found - skipping MDI case creation');
      return;
    }

    // Use questionnaire's medicalCompanySource instead of clinic's patientPortalDashboardFormat
    const medicalCompany = questionnaire?.medicalCompanySource;
    console.log('🔵 [MDI] Medical company source:', medicalCompany);

    if (medicalCompany !== MedicalCompanySlug.MD_INTEGRATIONS) {
      console.log('ℹ️ [MDI] Questionnaire uses "' + medicalCompany + '" medical company - skipping MDI case creation');
      console.log('🔵 [MDI] ========== END (SKIPPED) ==========');
      return;
    }

    console.log('✅ [MDI] Questionnaire uses md-integrations - proceeding with case creation');

    const patientOverrides = {
      firstName: answers['firstName'],
      lastName: answers['lastName'],
      email: answers['email'],
      phoneNumber: answers['mobile'],
      dob: answers['dob'] || answers['dateOfBirth'],
      gender: answers['gender'],
    };

    console.log('🔵 [MDI] Patient overrides:', patientOverrides);

    const requestPayload = {
      orderId: orderIdForCase,
      clinicId: domainClinic.id,
      patientOverrides
    };

    console.log('🔵 [MDI] Request payload:', JSON.stringify(requestPayload, null, 2));

    try {
      console.log('🔵 [MDI] Calling POST /md/cases...');
      const result = await apiCall('/md/cases', {
        method: 'POST',
        body: JSON.stringify(requestPayload)
      });

      console.log('🔵 [MDI] Response:', JSON.stringify(result, null, 2));

      if (result.success) {
        // Handle nested response structure: result.data may contain another { success, data } object
        const responseData = result.data?.data || result.data;
        if (result.data?.skipped || responseData?.skipped) {
          console.log('⚠️ [MDI] Backend skipped MDI case creation:', (result as any).message || result.data?.message || 'No message');
        } else {
          console.log('✅ [MDI] MD Integrations case created successfully!');
          console.log('✅ [MDI] Case ID:', responseData?.caseId || result.data?.caseId);
        }
      } else {
        console.error('❌ [MDI] Failed to create MD case:', result);
      }
    } catch (error: any) {
      console.error('❌ [MDI] Error creating MD case:', error);
      console.error('❌ [MDI] Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      // Don't fail the checkout flow, just log the error
    }

    console.log('🔵 [MDI] ========== END ==========');
  }, [domainClinic, answers, questionnaire]);

  const createBelugaCase = useCallback(async (orderIdForCase: string) => {
    console.log('🟢 [BELUGA] ========== BELUGA CASE CREATION ==========');
    console.log('🟢 [BELUGA] Order ID:', orderIdForCase);
    console.log('🟢 [BELUGA] Questionnaire medicalCompanySource:', questionnaire?.medicalCompanySource);

    if (!domainClinic) {
      console.log('⚠️ [BELUGA] No domain clinic found - skipping Beluga case creation');
      return;
    }

    const medicalCompany = questionnaire?.medicalCompanySource;
    if (medicalCompany !== MedicalCompanySlug.BELUGA) {
      console.log('ℹ️ [BELUGA] Questionnaire is not beluga - skipping Beluga case creation');
      return;
    }

    const patientOverrides = {
      firstName: answers['firstName'],
      lastName: answers['lastName'],
      email: answers['email'],
      phoneNumber: answers['mobile'],
      dob: answers['dob'] || answers['dateOfBirth'],
      gender: answers['gender'],
    };

    const requestPayload = {
      orderId: orderIdForCase,
      clinicId: domainClinic.id,
      patientOverrides,
      belugaPhotos: belugaPhoto
        ? [{ mime: belugaPhoto.mime, data: belugaPhoto.data }]
        : [],
    };

    try {
      console.log('🟢 [BELUGA] Calling POST /beluga/cases...');
      const result = await apiCall('/beluga/cases', {
        method: 'POST',
        body: JSON.stringify(requestPayload),
      });

      if (result.success) {
        const wasSkipped = result.data?.skipped;
        if (wasSkipped) {
          console.log('ℹ️ [BELUGA] Backend skipped Beluga case creation:', (result as any).message || result.data?.message || 'No message');
          console.log('🟢 [BELUGA] ========== END (SKIPPED) ==========');
          throw new Error(`Beluga case creation was skipped: ${(result as any).message || result.data?.message || 'Medical company source is not Beluga'}`);
        } else {
          console.log('✅ [BELUGA] Beluga case created successfully');
          console.log('🟢 [BELUGA] ========== END (SUCCESS) ==========');
        }
      } else {
        console.error('❌ [BELUGA] Failed to create Beluga case:', result);
        console.log('🟢 [BELUGA] ========== END (FAILED) ==========');
        throw new Error(`Failed to create Beluga case: ${(result as any).message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('❌ [BELUGA] Error creating Beluga case:', error);
      console.error('❌ [BELUGA] Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      console.log('🟢 [BELUGA] ========== END (EXCEPTION) ==========');
      // Re-throw the error to fail the checkout for Beluga questionnaires
      throw error;
    }
  }, [domainClinic, answers, questionnaire, belugaPhoto]);

  const handlePaymentSuccess = useCallback(async (data?: { paymentIntentId?: string; orderId?: string }) => {
    // Use passed data or fall back to state
    const finalPaymentIntentId = data?.paymentIntentId || paymentIntentId;
    const finalOrderId = data?.orderId || orderId;

    console.log('🎉 [CHECKOUT] ========== PAYMENT SUCCESS ==========');
    console.log('🎉 [CHECKOUT] Payment Intent ID:', finalPaymentIntentId);
    console.log('🎉 [CHECKOUT] Order ID:', finalOrderId);
    console.log('🎉 [CHECKOUT] User ID:', userId);
    console.log('🎉 [CHECKOUT] Account Created:', accountCreated);

    try {
      setPaymentStatus('succeeded');
      console.log('🎉 [CHECKOUT] Payment status set to succeeded');

      console.log('🎉 [CHECKOUT] Triggering checkout sequence...');
      await triggerCheckoutSequenceRun();
      console.log('🎉 [CHECKOUT] Checkout sequence triggered');

      if (finalPaymentIntentId) {
        console.log('🎉 [CHECKOUT] Tracking conversion...');
        await trackConversion(finalPaymentIntentId, finalOrderId || undefined);
        console.log('🎉 [CHECKOUT] Conversion tracked');
      }

      // Create telehealth case if questionnaire uses external medical company source
      const medicalCompany = questionnaire?.medicalCompanySource;
      const needsMDCase = medicalCompany === MedicalCompanySlug.MD_INTEGRATIONS;
      const needsBelugaCase = medicalCompany === MedicalCompanySlug.BELUGA;
      console.log('🔍 [CHECKOUT ROUTING] questionnaire?.id:', questionnaire?.id);
      console.log('🔍 [CHECKOUT ROUTING] medicalCompanySource:', medicalCompany);
      console.log('🔍 [CHECKOUT ROUTING] needsMDCase:', needsMDCase, '| needsBelugaCase:', needsBelugaCase);

      if (needsMDCase && finalOrderId) {
        console.log('🎉 [CHECKOUT] Questionnaire uses MD Integrations, creating case...');
        setPaymentStatus('creatingMDCase'); // Update status to show MD case creation in progress
        await createMDCase(finalOrderId);
        console.log('✅ [CHECKOUT] MD case creation complete');
      } else if (needsBelugaCase && finalOrderId) {
        console.log('🎉 [CHECKOUT] Questionnaire uses Beluga, creating case...');
        setPaymentStatus('creatingBelugaCase');
        await createBelugaCase(finalOrderId);
        console.log('✅ [CHECKOUT] Beluga case creation complete');
      } else {
        console.log('ℹ️ [CHECKOUT] Skipping external case creation (medicalCompanySource: ' + medicalCompany + ', orderId: ' + finalOrderId + ')');
      }

      // Set status to ready - all steps complete, user can now continue to dashboard
      setPaymentStatus('ready');
      console.log('🎉 [CHECKOUT] ========== CHECKOUT COMPLETE - READY TO REDIRECT ==========');

    } catch (error) {
      console.error('❌ [CHECKOUT] Payment success handler error:', error);
      setPaymentStatus('failed');
      setShowSuccessModal(false); // Ensure modal is closed on error
      
      // Show specific error message if available
      const errorMessage = error?.message || 'Payment processing error. Please contact support.';
      alert(`Checkout Error: ${errorMessage}\n\nYour payment was authorized but not captured. Please contact support.`);
    }
  }, [
    paymentIntentId,
    orderId,
    userId,
    accountCreated,
    triggerCheckoutSequenceRun,
    trackConversion,
    createMDCase,
    createBelugaCase,
    questionnaire,
  ]);

  const handlePaymentConfirm = useCallback(() => {
    // Open modal with processing state when payment confirmation starts
    setShowSuccessModal(true);
    setPaymentStatus('processing');
    console.log('🔄 [CHECKOUT] Payment confirmation started, showing processing modal');
  }, []);

  const handlePaymentError = useCallback((error: string) => {
    setPaymentStatus('failed');
    setShowSuccessModal(false); // Close modal on error
    alert(`Payment failed: ${error}`);
  }, []);

  const handleSuccessModalContinue = useCallback(async () => {
    try {
      // Use questionnaire's medicalCompanySource to determine dashboard redirect
      const medicalCompany = questionnaire?.medicalCompanySource || MedicalCompanySlug.FUSE;
      
      console.log('🔍 [CHECKOUT] Determining redirect based on questionnaire:', {
        questionnaireId: questionnaire?.id,
        medicalCompanySource: medicalCompany,
        orderId: orderId,
      });

      // Get dashboard prefix based on questionnaire's medical company source
      let dashboardPrefix = getDashboardPrefixByMedicalCompany(medicalCompany);

      // For MD Integrations, redirect to messages tab after checkout
      if (medicalCompany === MedicalCompanySlug.MD_INTEGRATIONS) {
        dashboardPrefix = `${dashboardPrefix}?tab=messages`;
      }

      console.log('🎉 [CHECKOUT] Final redirect decision:', {
        dashboardPrefix,
        medicalCompanySource: medicalCompany,
        questionnaireId: questionnaire?.id,
      });

      // Build full URL to handle subdomain correctly BEFORE closing modals
      const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
      const baseUrl = `${protocol}//${hostname}${port}`;
      const fullUrl = `${baseUrl}${dashboardPrefix}`;

      console.log('🎉 [CHECKOUT] Prepared redirect URL:', {
        dashboardPrefix,
        fullUrl,
        currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
        hostname,
        willRedirectIn: '300ms',
      });

      // Close success modal and main modal
      setShowSuccessModal(false);
      onClose();

      // Check if user is authenticated before redirecting
      // If not authenticated, redirect to signin with return URL
      const isAuthenticated = typeof window !== 'undefined' && localStorage.getItem('auth-token');

      if (!isAuthenticated) {
        console.log('⚠️ [CHECKOUT] User not authenticated, redirecting to signin with return URL');
        const signinUrl = `${baseUrl}/signin?redirect=${encodeURIComponent(dashboardPrefix)}`;
        setShowSuccessModal(false);
        onClose();
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.replace(signinUrl);
          }
        }, 500);
        return;
      }

      // Redirect after a short delay to allow modals to close
      // Use a longer timeout to ensure modals are fully closed
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          console.log('🎉 [CHECKOUT] Executing redirect NOW:', {
            dashboardPrefix,
            fullUrl,
            currentUrl: window.location.href,
            hostname,
            timestamp: new Date().toISOString(),
            isAuthenticated: true,
          });

          // Use window.location.replace to avoid adding to history
          // This prevents back button issues
          window.location.replace(fullUrl);
        } else {
          console.error('❌ [CHECKOUT] window is undefined, cannot redirect');
        }
      }, 500);
    } catch (error) {
      console.error('❌ [CHECKOUT] Error in handleSuccessModalContinue:', error);
      // Fallback to questionnaire's medicalCompanySource or default to fuse
      const fallbackMedicalCompany = questionnaire?.medicalCompanySource || MedicalCompanySlug.FUSE;
      let dashboardPrefix = getDashboardPrefixByMedicalCompany(fallbackMedicalCompany);

      // For MD Integrations, redirect to messages tab after checkout
      if (fallbackMedicalCompany === MedicalCompanySlug.MD_INTEGRATIONS) {
        dashboardPrefix = `${dashboardPrefix}?tab=messages`;
      }

      console.warn('⚠️ [CHECKOUT] Using fallback redirect:', {
        dashboardPrefix,
        medicalCompanySource: fallbackMedicalCompany,
      });
      setShowSuccessModal(false);
      onClose();
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          // Build full URL to handle subdomain correctly
          const protocol = window.location.protocol;
          const hostname = window.location.hostname;
          const port = window.location.port ? `:${window.location.port}` : '';
          const baseUrl = `${protocol}//${hostname}${port}`;
          const fullUrl = `${baseUrl}${dashboardPrefix}`;

          console.log('⚠️ [CHECKOUT] Fallback redirect:', {
            dashboardPrefix,
            fullUrl,
            currentUrl: window.location.href,
          });

          window.location.href = fullUrl;
        }
      }, 300);
    }
  }, [questionnaire, orderId, onClose]);

  // Navigation
  const replaceCurrentVariables = useCallback((text: string): string => {
    if (!text) return text;
    const variables = {
      ...getVariablesFromClinic(domainClinic || {}),
      productName: props.productName || '',
      patientFirstName: patientFirstName || '',
      patientName: patientName || ''
    };
    return replaceVariables(text, variables);
  }, [domainClinic, props.productName, patientFirstName, patientName]);

  const handleSubmit = useCallback(async () => {
    if (isCheckoutStep()) {
      // Checkout submission is handled by handlePaymentSuccess, which shows the success modal
      // Just close the modal here
      onClose();
    } else {
      alert('Questionnaire submitted!');
      onClose();
    }
  }, [isCheckoutStep, onClose]);

  const handleNext = useCallback(async () => {
    if (validateCurrentStep() && questionnaire) {
      const currentStep = getCurrentQuestionnaireStep();

      // If we're on Beluga consent step, advance to first questionnaire step
      if (isBelugaConsentStep) {
        setCurrentStepIndex(1);
        return;
      }
      if (isBelugaPhotoStep) {
        setCurrentStepIndex(2);
        return;
      }

      // If we're on checkout step and payment succeeded, submit the form
      if (isCheckoutStep() && paymentStatus === 'succeeded') {
        console.log('✅ Checkout complete with payment succeeded, submitting questionnaire');
        handleSubmit();
        return;
      }

      // If we just completed "Create Your Account" step and haven't created account yet, do it now
      if (currentStep?.title === 'Create Your Account' && !accountCreated) {
        await createUserAccount();
      }

      const isSignedIn = shouldSkipUserProfileSteps;
      const productSelectionPos = questionnaire.productSelectionStepPosition;
      const checkoutPos = questionnaire.checkoutStepPosition;
      const baseCheckoutStepIndex = checkoutPos === -1 ? questionnaire.steps.length : checkoutPos;
      const checkoutStepIndex = baseCheckoutStepIndex + belugaIntroStepsOffset;
      const productSelectionStepIndex = (productSelectionPos !== undefined && productSelectionPos !== -1) ? productSelectionPos : -1;

      // Find the next valid step (skipping user_profile if signed in)
      const nextEffectiveIndex = currentStepIndex + 1;
      let nextQuestionnaireIndex = nextEffectiveIndex - belugaIntroStepsOffset;

      while (nextQuestionnaireIndex < questionnaire.steps.length) {
        const step = questionnaire.steps[nextQuestionnaireIndex];
        if (step && isSignedIn && step.category === 'user_profile') {
          console.log('⏭️ Skipping user_profile step when advancing (user signed in):', step.title);
          nextQuestionnaireIndex++;
          continue;
        }
        break;
      }

      if (nextQuestionnaireIndex >= questionnaire.steps.length) {
        console.log('⏭️ No more valid questionnaire steps, checking for product selection or checkout');
        if (productSelectionStepIndex !== -1 && currentStepIndex < productSelectionStepIndex) {
          console.log('➡️ Moving to product selection step');
          setCurrentStepIndex(productSelectionStepIndex);
        } else {
          console.log('➡️ Moving to checkout step');
          setCurrentStepIndex(checkoutStepIndex);
        }
      } else if (nextEffectiveIndex <= checkoutStepIndex) {
        setCurrentStepIndex(nextQuestionnaireIndex + belugaIntroStepsOffset);
      } else {
        handleSubmit();
      }
    }
  }, [validateCurrentStep, questionnaire, getCurrentQuestionnaireStep, isCheckoutStep, isBelugaConsentStep, isBelugaPhotoStep, paymentStatus, createUserAccount, currentStepIndex, belugaIntroStepsOffset, handleSubmit, shouldSkipUserProfileSteps]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0 && questionnaire) {
      const isSignedIn = shouldSkipUserProfileSteps;
      let targetEffectiveIndex = currentStepIndex - 1;

      // When going back from first questionnaire step to Beluga consent
      if (belugaIntroStepsOffset > 0 && targetEffectiveIndex < belugaIntroStepsOffset) {
        setCurrentStepIndex(0);
        return;
      }

      let targetQuestionnaireIndex = targetEffectiveIndex - belugaIntroStepsOffset;
      while (targetQuestionnaireIndex >= 0) {
        const step = questionnaire.steps[targetQuestionnaireIndex];
        if (step && isSignedIn && step.category === 'user_profile') {
          console.log('⏭️ Skipping user_profile step when going back (user signed in):', step.title);
          targetQuestionnaireIndex--;
          targetEffectiveIndex--;
          continue;
        }
        break;
      }

      if (targetQuestionnaireIndex >= 0) {
        setCurrentStepIndex(targetQuestionnaireIndex + belugaIntroStepsOffset);
      } else if (belugaIntroStepsOffset > 0) {
        setCurrentStepIndex(0);
      }
    }
  }, [currentStepIndex, questionnaire, belugaIntroStepsOffset, shouldSkipUserProfileSteps]);

  const handleProductQuantityChange = useCallback((productId: string, quantity: number) => {
    setSelectedProducts(prev => ({ ...prev, [productId]: quantity }));
  }, []);

  // Program product toggle - handles both single_choice and multiple_choice modes
  const handleProgramProductToggle = useCallback((productId: string) => {
    console.log('📦 [PRODUCT TOGGLE] Toggling product:', productId);
    const offerType = programData?.productOfferType || programData?.medicalTemplate?.productOfferType || 'single_choice';

    // Reset payment state when product selection changes (in case of previous failure)
    if (paymentStatus === 'failed') {
      setPaymentStatus('idle');
    }

    if (offerType === 'single_choice') {
      // In single_choice mode, selecting a product deselects all others
      setSelectedProgramProducts(prev => {
        // If clicking the already selected product, deselect it
        if (prev[productId]) {
          return { [productId]: false };
        }
        // Otherwise, select only this product
        const newState: Record<string, boolean> = {};
        if (programData?.products) {
          programData.products.forEach(p => {
            newState[p.id] = p.id === productId;
          });
        }
        return newState;
      });
    } else {
      // In multiple_choice mode, toggle the product
      setSelectedProgramProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
    }
  }, [programData, paymentStatus]);

  // Create program subscription with dynamic pricing
  const createProgramSubscription = useCallback(async () => {
    if (!programData) return null;

    try {
      setPaymentStatus('processing');

      // Calculate total from selected products + non-medical services fee
      // Handles both unified pricing and per-product pricing
      const hasPerProductPricing = programData.hasPerProductPricing || false;
      const selectedProductsList = programData.products.filter(p => selectedProgramProducts[p.id]);
      const productsTotal = selectedProductsList.reduce((sum, p) => sum + p.displayPrice, 0);

      // Calculate non-medical services fee based on pricing model
      let nonMedicalServicesFee: number;
      if (hasPerProductPricing) {
        // For per-product pricing, sum up each product's individual non-medical services fee
        nonMedicalServicesFee = selectedProductsList.reduce((sum, p) => {
          return sum + (p.perProductProgram?.nonMedicalServicesFee || 0);
        }, 0);
      } else {
        // For unified pricing, use the parent program's non-medical services fee
        nonMedicalServicesFee = programData.nonMedicalServicesFee;
      }

      // Calculate visit fee (ensure it's fresh)
      let calculatedVisitFee = 0;
      if (shippingInfo.state && programData.id) {
        try {
          const feeResult = await apiCall('/programs/calculate-visit-fee', {
            method: 'POST',
            body: JSON.stringify({
              programId: programData.id,
              state: shippingInfo.state,
            }),
          });
          if (feeResult.success && feeResult.data) {
            const feeData = feeResult.data.data || feeResult.data;
            calculatedVisitFee = feeData.visitFeeAmount || 0;
            console.log('💰 Visit fee recalculated before payment:', calculatedVisitFee);
          }
        } catch (error) {
          console.warn('⚠️ Failed to calculate visit fee, using 0:', error);
        }
      }

      const totalAmount = productsTotal + nonMedicalServicesFee + calculatedVisitFee;

      console.log('💰 [PROGRAM SUB] Price calculation:', {
        hasPerProductPricing,
        productsTotal,
        nonMedicalServicesFee,
        visitFeeAmount: calculatedVisitFee,
        totalAmount,
        selectedProducts: selectedProductsList.map(p => ({
          name: p.name,
          displayPrice: p.displayPrice,
          perProductFee: p.perProductProgram?.nonMedicalServicesFee
        }))
      });

      const userDetails = {
        firstName: answers['firstName'],
        lastName: answers['lastName'],
        email: answers['email'],
        phoneNumber: answers['mobile']
      };
      const questionnaireAnswersData = buildQuestionnaireAnswers(answers);

      const requestBody = {
        programId: programData.id,
        selectedProductIds: selectedProductsList.map(p => p.id),
        totalAmount,
        productsTotal,
        nonMedicalServicesFee,
        userDetails,
        questionnaireAnswers: questionnaireAnswersData.structured,
        shippingInfo,
        clinicId: programData.clinicId,
        clinicName: domainClinic?.name,
        isProgramSubscription: true,
      };

      console.log('🚀 Creating program subscription:', requestBody);

      const result = await apiCall('/payments/program/sub', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      // So you can find it in Console (enable "Preserve log" in DevTools)
      if (!result.success) {
        console.error('[PAYMENT] Backend error:', (result as { error?: string }).error, 'Full result:', result);
      }

      if (result.success && result.data) {
        const subscriptionData = result.data.data || result.data;
        if (subscriptionData.clientSecret) {
          const intentId = subscriptionData.paymentIntentId || subscriptionData.subscriptionId || subscriptionData.id;
          const orderIdValue = subscriptionData.orderId;

          setClientSecret(subscriptionData.clientSecret);
          setPaymentIntentId(intentId);
          if (orderIdValue) setOrderId(orderIdValue);
          setPaymentStatus('idle');

          // Return full data for deferred payment flow
          return {
            clientSecret: subscriptionData.clientSecret,
            paymentIntentId: intentId,
            orderId: orderIdValue,
          };
        }
      }
      setPaymentStatus('failed');
      const backendMessage = (result as { error?: string }).error;
      throw new Error(backendMessage || 'Failed to set up payment. Please try again.');
    } catch (error) {
      console.error('❌ Program subscription error:', error);
      setPaymentStatus('failed');
      throw error;
    }
  }, [programData, selectedProgramProducts, answers, shippingInfo, domainClinic, buildQuestionnaireAnswers]);

  // FORM CACHING: Save form progress to localStorage
  useEffect(() => {
    if (!isOpen || !questionnaire?.id) return;
    
    // Only save if we have some answers
    if (Object.keys(answers).length > 0) {
      const cacheKey = `form-draft-${questionnaire.id}-${questionnaireId || 'unknown'}`;
      const cacheData = {
        answers,
        currentStepIndex,
        timestamp: Date.now(),
        questionnaireId: questionnaire.id,
        productName,
        selectedProducts,
        selectedProgramProducts,
        shippingInfo,
        // Save user info if account was created
        userId,
        accountCreated,
        patientName,
        patientFirstName,
      };
      
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('💾 [CACHE] Form progress saved to localStorage', {
          cacheKey,
          answersCount: Object.keys(answers).length,
          currentStepIndex,
        });
      } catch (error) {
        console.warn('⚠️ [CACHE] Failed to save to localStorage:', error);
      }
    }
  }, [answers, currentStepIndex, selectedProducts, selectedProgramProducts, shippingInfo, userId, accountCreated, patientName, patientFirstName, isOpen, questionnaire, questionnaireId, productName]);

  // FORM CACHING: Restore form progress from localStorage on mount
  useEffect(() => {
    if (!isOpen || !questionnaire?.id || hasRestoredFromCacheRef.current) return;
    
    const cacheKey = `form-draft-${questionnaire.id}-${questionnaireId || 'unknown'}`;
    
    try {
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const cacheData = JSON.parse(cached);
        const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
        const cacheAge = Date.now() - cacheData.timestamp;
        
        if (cacheAge < CACHE_EXPIRY_MS) {
          // Restore form state
          setAnswers(cacheData.answers || {});
          setCurrentStepIndex(cacheData.currentStepIndex || 0);
          setSelectedProducts(cacheData.selectedProducts || {});
          setSelectedProgramProducts(cacheData.selectedProgramProducts || {});
          setShippingInfo(cacheData.shippingInfo || { address: "", apartment: "", city: "", state: "", zipCode: "", country: "us" });
          
          // Restore user info if it was saved
          // IMPORTANT: Only restore accountCreated/authentication flags if userId is present
          // This prevents skipping "Create Your Account" step from stale cache data
          if (cacheData.userId) {
            setUserId(cacheData.userId);
            // Only mark account as created if we have a valid userId
            if (cacheData.accountCreated) setAccountCreated(cacheData.accountCreated);
            if (cacheData.patientName) setPatientName(cacheData.patientName);
            if (cacheData.patientFirstName) setPatientFirstName(cacheData.patientFirstName);
          } else {
            // No userId means account was never created - clear authentication flags
            console.log('⚠️ [CACHE] No userId found, resetting authentication flags to show account creation step');
            setAccountCreated(false);
            setUserId(null);
          }
          
          const minutesAgo = Math.floor(cacheAge / 1000 / 60);
          const hoursAgo = Math.floor(minutesAgo / 60);
          const timeAgoStr = hoursAgo > 0 
            ? `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`
            : `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
          
          console.log('✅ [CACHE] Form progress restored from localStorage!', {
            cacheKey,
            savedAt: timeAgoStr,
            answersCount: Object.keys(cacheData.answers).length,
            currentStepIndex: cacheData.currentStepIndex,
          });
          
          // Show a subtle notification (you could use a toast library here)
          if (typeof window !== 'undefined' && Object.keys(cacheData.answers).length > 3) {
            console.log(`📋 Progress restored from ${timeAgoStr}`);
          }
          
          hasRestoredFromCacheRef.current = true;
        } else {
          // Cache expired, remove it
          console.log('⏰ [CACHE] Cache expired, clearing:', cacheKey);
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn('⚠️ [CACHE] Failed to restore from localStorage:', error);
    }
  }, [isOpen, questionnaire, questionnaireId]);

  // Step initialization
  useEffect(() => {
    if (questionnaire && isOpen) {
      console.log('🟡 [STEP INIT] Effect triggered', {
        hasHandledGoogleAuth: hasHandledGoogleAuthRef.current,
        hasInitializedStep: hasInitializedStepRef.current,
        hasRestoredFromCache: hasRestoredFromCacheRef.current,
        currentStepIndex,
        stepsCount: questionnaire.steps.length
      });

      // If we restored from cache, mark as initialized and keep the restored step
      if (hasRestoredFromCacheRef.current && !hasInitializedStepRef.current) {
        console.log('📍 [STEP INIT] Cache restored, keeping currentStepIndex:', currentStepIndex);
        hasInitializedStepRef.current = true;
        return;
      }

      // If user just signed in via Google OAuth, find the first non-user_profile step
      if (hasHandledGoogleAuthRef.current && !hasInitializedStepRef.current) {
        console.log('🔍 [STEP INIT] Google OAuth handled, finding first non-user_profile step');
        const belugaOffset = questionnaire.medicalCompanySource === MedicalCompanySlug.BELUGA ? 2 : 0;
        let targetQuestionnaireIndex = 0;
        for (let i = 0; i < questionnaire.steps.length; i++) {
          const step = questionnaire.steps[i];
          if (step.category !== 'user_profile') {
            targetQuestionnaireIndex = i;
            break;
          }
        }
        let targetStepIndex = targetQuestionnaireIndex + belugaOffset;
        if (targetQuestionnaireIndex === 0 && questionnaire.steps[0]?.category === 'user_profile') {
          const checkoutPos = questionnaire.checkoutStepPosition;
          targetStepIndex = (checkoutPos === -1 ? questionnaire.steps.length : checkoutPos) + belugaOffset;
          console.log('⏭️ [STEP INIT] All steps are user_profile, going to checkout:', targetStepIndex);
        }
        console.log('📍 [STEP INIT] Setting step to:', targetStepIndex);
        setCurrentStepIndex(targetStepIndex);
        hasInitializedStepRef.current = true;
        return;
      }

      if (!hasInitializedStepRef.current) {
        console.log('📍 [STEP INIT] First initialization, setting to step 0');
        setCurrentStepIndex(0);
        hasInitializedStepRef.current = true;
      } else {
        console.log('⏭️ [STEP INIT] Already initialized, keeping step:', currentStepIndex);
      }
    }
  }, [questionnaire, isOpen, hasHandledGoogleAuthRef, currentStepIndex]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      setBelugaConsentGiven(false);
      setBelugaPhoto(null);
      setAnswers({});
      setErrors({});
      setQuestionnaire(null);
      setSelectedProducts({});
      setClientSecret(null);
      setPaymentIntentId(null);
      setPaymentStatus('idle');
      setSelectedPlan("monthly");
      setIsAuthenticatedUser(false);
      resetTrackingFlags();
      setIsSignInMode(false);
      setIsSignInOptionsMode(false);
      setIsPasswordSignInMode(false);
      setSignInEmail('');
      setSignInPassword('');
      setSignInError('');
      setIsSigningIn(false);
      setShippingInfo({ address: "", apartment: "", city: "", state: "", zipCode: "", country: "us" });
      setCheckoutPaymentInfo({ cardNumber: "", expiryDate: "", securityCode: "", country: "brazil" });
      hasInitializedStepRef.current = false;
      hasRestoredFromCacheRef.current = false;
      
      // Note: We DON'T clear localStorage cache here - it should persist across modal close/open
      // Only clear it after successful payment or if user explicitly abandons
    }
  }, [isOpen, setQuestionnaire, setSelectedPlan, resetTrackingFlags]);

  return {
    // Data
    questionnaire, loading,
    // State
    currentStepIndex, setCurrentStepIndex,
    belugaConsentGiven, setBelugaConsentGiven,
    belugaPhoto, setBelugaPhoto,
    isBelugaConsentStep,
    isBelugaPhotoStep,
    answers, setAnswers,
    errors, setErrors,
    selectedProducts,
    clientSecret, paymentIntentId, orderId, paymentStatus,
    userId, accountCreated,
    patientName, patientFirstName,
    shippingInfo, setShippingInfo,
    checkoutPaymentInfo, setCheckoutPaymentInfo,
    // Visit fee
    visitFeeAmount, visitType, loadingVisitFee, calculateVisitFee,
    // Auth state
    isSignInMode, setIsSignInMode,
    isSignInOptionsMode, setIsSignInOptionsMode,
    isPasswordSignInMode, setIsPasswordSignInMode,
    signInEmail, setSignInEmail,
    signInPassword, setSignInPassword,
    signInError, setSignInError,
    isSigningIn,
    isEmailVerificationMode, setIsEmailVerificationMode,
    verificationEmail, setVerificationEmail,
    verificationCode, setVerificationCode,
    verificationError, setVerificationError,
    isVerifying,
    showEmailModal, setShowEmailModal,
    emailModalLoading, setEmailModalLoading,
    emailModalError, setEmailModalError,
    showSuccessModal, setShowSuccessModal,
    handleSuccessModalContinue,
    // Google MFA
    ...googleMfa,
    // Plans & theme
    plans, selectedPlan, setSelectedPlan,
    theme, themeVars,
    pharmacyCoverages,
    // Helpers
    getTotalSteps, getCurrentVisibleStepNumber, isProductSelectionStep, isCheckoutStep, getCurrentQuestionnaireStep,
    replaceCurrentVariables,
    // Handlers
    handleAnswerChange, handleRadioChange, handleCheckboxChange,
    handleProductQuantityChange,
    validateCurrentStep,
    handleSignIn, handleGoogleSignIn, createUserAccount, emailVerificationHandlers,
    handlePlanSelection, createSubscriptionForPlan, handlePaymentSuccess, handlePaymentError, handlePaymentConfirm,
    handleNext, handlePrevious, handleSubmit,
    buildQuestionnaireAnswers,
    // Program-related
    programData,
    selectedProgramProducts,
    handleProgramProductToggle,
    createProgramSubscription,
  };
}
