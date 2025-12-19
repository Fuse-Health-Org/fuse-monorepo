import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { apiCall } from "../../../lib/api";
import { replaceVariables, getVariablesFromClinic } from "../../../lib/templateVariables";
import { signInUser, createUserAccount as createUserAccountAPI, signInWithGoogle } from "../auth";
import { createEmailVerificationHandlers } from "../emailVerification";
import { trackFormConversion } from "../../../lib/analytics";
import { QuestionnaireModalProps, QuestionnaireData, PlanOption } from "../types";
import { useQuestionnaireData } from "./useQuestionnaireData";
import { useGoogleOAuth } from "./useGoogleOAuth";
import { useGoogleMfa } from "./useGoogleMfa";
import { useQuestionnaireAnalytics } from "./useQuestionnaireAnalytics";
import { useQuestionnairePlans } from "./useQuestionnairePlans";
import { useQuestionnaireTheme } from "./useQuestionnaireTheme";
import { usePharmacyCoverages } from "./usePharmacyCoverages";

export function useQuestionnaireModal(
  props: QuestionnaireModalProps,
  domainClinic: any,
  isLoadingClinic: boolean
) {
  const { isOpen, onClose, questionnaireId, tenantProductId, tenantProductFormId, productName } = props;

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
    },
    onClose
  );

  // State management
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'succeeded' | 'failed'>('idle');
  const [userId, setUserId] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [patientName, setPatientName] = useState<string>('');
  const [patientFirstName, setPatientFirstName] = useState<string>('');
  const [shippingInfo, setShippingInfo] = useState({
    address: "", apartment: "", city: "", state: "", zipCode: "", country: "us"
  });
  const [checkoutPaymentInfo, setCheckoutPaymentInfo] = useState({
    cardNumber: "", expiryDate: "", securityCode: "", country: "brazil"
  });

  // Affiliate tracking: Extract affiliate slug from URL
  const [affiliateSlug, setAffiliateSlug] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      
      // Check for affiliate subdomain pattern
      if (hostname.includes('.localhost')) {
        const beforeLocalhost = hostname.split('.localhost')[0];
        const subdomainParts = beforeLocalhost.split('.');
        if (subdomainParts.length >= 2) {
          // affiliate.brand.localhost -> affiliateSlug = first part
          setAffiliateSlug(subdomainParts[0]);
          console.log('👤 Detected affiliate slug (dev):', subdomainParts[0]);
        }
      } else if (hostname.endsWith('.fusehealth.com') || hostname.endsWith('.fuse.health') || hostname.endsWith('.fusehealthstaging.xyz')) {
        if (parts.length >= 4) {
          // affiliate.brand.fusehealth.com -> affiliateSlug = first part
          setAffiliateSlug(parts[0]);
          console.log('👤 Detected affiliate slug (prod):', parts[0]);
        }
      }
    }
  }, []);

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

  // Track initialization
  const hasInitializedStepRef = useRef(false);

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
  const isProductSelectionStep = useCallback((): boolean => false, []);

  const isCheckoutStep = useCallback((): boolean => {
    if (!questionnaire) return false;
    const checkoutPos = questionnaire.checkoutStepPosition;
    const checkoutStepIndex = checkoutPos === -1 ? questionnaire.steps.length : checkoutPos;
    return currentStepIndex === checkoutStepIndex;
  }, [questionnaire, currentStepIndex]);

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
    const checkoutPos = questionnaire.checkoutStepPosition;
    let actualStepIndex = currentStepIndex;
    if (checkoutPos !== -1 && currentStepIndex > checkoutPos + 1) {
      actualStepIndex = currentStepIndex - 2;
    }

    // Check if user is signed in
    const isSignedIn = accountCreated || userId;

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
  }, [questionnaire, currentStepIndex, isProductSelectionStep, isCheckoutStep, evaluateStepConditionalLogic, accountCreated, userId]);

  // Analytics
  const getCurrentStage = useCallback((): 'product' | 'payment' | 'account' => {
    if (isCheckoutStep()) return 'payment';
    const currentStep = getCurrentQuestionnaireStep();
    if (currentStep?.category === 'user_profile') return 'account';
    return 'product';
  }, [isCheckoutStep, getCurrentQuestionnaireStep]);

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
    const isSignedIn = accountCreated || userId;
    const visibleSteps = questionnaire.steps.filter(step => {
      if (isSignedIn && step.category === 'user_profile') return false;
      return true;
    }).length;
    return visibleSteps + 1; // +1 for checkout
  }, [questionnaire, accountCreated, userId]);

  // Get current visible step number for progress display
  const getCurrentVisibleStepNumber = useCallback((): number => {
    if (!questionnaire) return 1;
    const isSignedIn = accountCreated || userId;
    const checkoutPos = questionnaire.checkoutStepPosition;
    const checkoutStepIndex = checkoutPos === -1 ? questionnaire.steps.length : checkoutPos;

    // Log all steps with their categories for debugging
    const stepCategories = questionnaire.steps.map((s, i) => `${i}:${s.category}`);
    console.log('📊 [STEP NUM] Calculating visible step number:', {
      currentStepIndex,
      isSignedIn,
      accountCreated,
      userId,
      checkoutStepIndex,
      totalQuestionnaireSteps: questionnaire.steps.length,
      stepCategories
    });

    // If we're on checkout step
    if (currentStepIndex >= checkoutStepIndex) {
      return getTotalSteps();
    }

    // Count visible steps up to and including current index
    let visibleCount = 0;
    for (let i = 0; i <= currentStepIndex && i < questionnaire.steps.length; i++) {
      const step = questionnaire.steps[i];
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
  }, [questionnaire, currentStepIndex, accountCreated, userId, getTotalSteps]);

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
        setAnswers(prev => ({ ...prev, [questionId]: numericValue }));
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
  }, [answers, errors]);

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
    if (isProductSelectionStep()) {
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
  }, [questionnaire, isProductSelectionStep, isCheckoutStep, selectedProducts, shippingInfo, paymentStatus, getCurrentQuestionnaireStep, answers]);

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
      answers['firstName'], answers['lastName'], answers['email'], answers['mobile'], domainClinic?.id
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
          setClientSecret(subscriptionData.clientSecret);
          setPaymentIntentId(subscriptionData.paymentIntentId || subscriptionData.subscriptionId || subscriptionData.id);
          if (subscriptionData.orderId) setOrderId(subscriptionData.orderId);
          setPaymentStatus('idle');
          return subscriptionData.clientSecret;
        }
      }
      setPaymentStatus('failed');
      return null;
    } catch (error) {
      setPaymentStatus('failed');
      return null;
    }
  }, [plans, answers, domainClinic, tenantProductId, shippingInfo, affiliateSlug, buildQuestionnaireAnswers]);

  const handlePlanSelection = useCallback(async (planId: string) => {
    setSelectedPlan(planId);
    setClientSecret(null);
    setTimeout(async () => { await createSubscriptionForPlan(planId); }, 100);
  }, [setSelectedPlan, createSubscriptionForPlan]);

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

  const handlePaymentSuccess = useCallback(async () => {
    try {
      if (!paymentIntentId) throw new Error('No payment intent ID');
      setPaymentStatus('succeeded');
      await triggerCheckoutSequenceRun();
      await trackConversion(paymentIntentId, orderId || undefined);
    } catch (error) {
      setPaymentStatus('failed');
      alert('Payment authorization failed. Please contact support.');
    }
  }, [paymentIntentId, orderId, triggerCheckoutSequenceRun, trackConversion]);

  const handlePaymentError = useCallback((error: string) => {
    setPaymentStatus('failed');
    alert(`Payment failed: ${error}`);
  }, []);

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
      alert('Order submitted successfully!');
      onClose();
    } else {
      alert('Questionnaire submitted!');
      onClose();
    }
  }, [isCheckoutStep, onClose]);

  const handleNext = useCallback(async () => {
    if (validateCurrentStep() && questionnaire) {
      const currentStep = getCurrentQuestionnaireStep();

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

      const isSignedIn = accountCreated || userId;
      const checkoutPos = questionnaire.checkoutStepPosition;
      const checkoutStepIndex = checkoutPos === -1 ? questionnaire.steps.length : checkoutPos;

      // Find the next valid step (skipping user_profile if signed in)
      let nextIndex = currentStepIndex + 1;

      while (nextIndex < questionnaire.steps.length) {
        const step = questionnaire.steps[nextIndex];
        if (step && isSignedIn && step.category === 'user_profile') {
          console.log('⏭️ Skipping user_profile step when advancing (user signed in):', step.title);
          nextIndex++;
          continue;
        }
        break;
      }

      if (nextIndex >= questionnaire.steps.length) {
        console.log('⏭️ No more valid questionnaire steps, advancing to checkout');
        setCurrentStepIndex(checkoutStepIndex);
      } else if (nextIndex <= checkoutStepIndex) {
        setCurrentStepIndex(nextIndex);
      } else {
        handleSubmit();
      }
    }
  }, [validateCurrentStep, questionnaire, getCurrentQuestionnaireStep, isCheckoutStep, paymentStatus, accountCreated, userId, createUserAccount, currentStepIndex, handleSubmit]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0 && questionnaire) {
      const isSignedIn = accountCreated || userId;
      let targetIndex = currentStepIndex - 1;

      while (targetIndex >= 0) {
        const step = questionnaire.steps[targetIndex];
        if (step && isSignedIn && step.category === 'user_profile') {
          console.log('⏭️ Skipping user_profile step when going back (user signed in):', step.title);
          targetIndex--;
          continue;
        }
        break;
      }

      if (targetIndex >= 0) {
        setCurrentStepIndex(targetIndex);
      }
    }
  }, [currentStepIndex, questionnaire, accountCreated, userId]);

  const handleProductQuantityChange = useCallback((productId: string, quantity: number) => {
    setSelectedProducts(prev => ({ ...prev, [productId]: quantity }));
  }, []);

  // Step initialization
  useEffect(() => {
    if (questionnaire && isOpen) {
      console.log('🟡 [STEP INIT] Effect triggered', {
        hasHandledGoogleAuth: hasHandledGoogleAuthRef.current,
        hasInitializedStep: hasInitializedStepRef.current,
        currentStepIndex,
        stepsCount: questionnaire.steps.length
      });

      // If user just signed in via Google OAuth, find the first non-user_profile step
      if (hasHandledGoogleAuthRef.current && !hasInitializedStepRef.current) {
        console.log('🔍 [STEP INIT] Google OAuth handled, finding first non-user_profile step');
        let targetStepIndex = 0;
        for (let i = 0; i < questionnaire.steps.length; i++) {
          const step = questionnaire.steps[i];
          if (step.category !== 'user_profile') {
            targetStepIndex = i;
            break;
          }
        }
        if (targetStepIndex === 0 && questionnaire.steps[0]?.category === 'user_profile') {
          const checkoutPos = questionnaire.checkoutStepPosition;
          targetStepIndex = checkoutPos === -1 ? questionnaire.steps.length : checkoutPos;
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
  }, [questionnaire, isOpen, hasHandledGoogleAuthRef]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      setAnswers({});
      setErrors({});
      setQuestionnaire(null);
      setSelectedProducts({});
      setClientSecret(null);
      setPaymentIntentId(null);
      setPaymentStatus('idle');
      setSelectedPlan("monthly");
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
    }
  }, [isOpen, setQuestionnaire, setSelectedPlan, resetTrackingFlags]);

  return {
    // Data
    questionnaire, loading,
    // State
    currentStepIndex, setCurrentStepIndex,
    answers, setAnswers,
    errors, setErrors,
    selectedProducts,
    clientSecret, paymentIntentId, orderId, paymentStatus,
    userId, accountCreated,
    patientName, patientFirstName,
    shippingInfo, setShippingInfo,
    checkoutPaymentInfo, setCheckoutPaymentInfo,
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
    handlePlanSelection, createSubscriptionForPlan, handlePaymentSuccess, handlePaymentError,
    handleNext, handlePrevious, handleSubmit,
    buildQuestionnaireAnswers
  };
}
