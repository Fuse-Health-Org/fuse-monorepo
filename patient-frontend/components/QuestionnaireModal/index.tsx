import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal, ModalContent, ModalBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { stripePromise } from "../../lib/stripe";
import { QuestionnaireModalProps, PaymentStatus } from "./types";
import { useClinicFromDomain } from "../../hooks/useClinicFromDomain";
import { MedicalCompanySlug } from "@fuse/enums";
import { useQuestionnaireModal } from "./hooks/useQuestionnaireModal";
import { LoadingState } from "./components/LoadingState";
import { ModalHeader } from "./components/ModalHeader";
import { CheckoutStepView } from "./components/CheckoutStepView";
import { ProductSelectionStepView } from "./components/ProductSelectionStepView";
import { ProgressBar } from "./components/ProgressBar";
import { StepHeader } from "./components/StepHeader";
import { RecommendedTreatmentView } from "./components/RecommendedTreatmentView";
import { BMICalculator } from "./components/BMICalculator";
import { SuccessStoriesView } from "./components/SuccessStoriesView";
import {
  AccountCreationStep,
  EmailVerificationStep,
  EmailInputModal,
  SignInOptionsStep,
  GoogleMfaStep,
  PasswordSignInStep
} from "./AccountCreationStep";
import { RegularQuestionsView } from "./components/RegularQuestionsView";
import { InformationalStepView } from "./components/InformationalStepView";
import { BelugaConsentStep } from "./components/BelugaConsentStep";
import { StepNavigationButtons } from "./components/StepNavigationButtons";
import { OrderSuccessModal } from "./components/OrderSuccessModal";

export const QuestionnaireModal: React.FC<QuestionnaireModalProps> = (props) => {
  const { isOpen, onClose } = props;
  const { clinic: domainClinic, isLoading: isLoadingClinic } = useClinicFromDomain();

  const modal = useQuestionnaireModal(props, domainClinic, isLoadingClinic);

  if (modal.loading || !modal.questionnaire || !modal.questionnaire.steps) {
    return <LoadingState isOpen={isOpen} onClose={onClose} loading={modal.loading} />;
  }

  const totalSteps = modal.getTotalSteps();
  const currentVisibleStep = modal.getCurrentVisibleStepNumber();
  const progressPercent = (currentVisibleStep / totalSteps) * 100;
  const isLastStep = currentVisibleStep === totalSteps;
  const currentStep = modal.getCurrentQuestionnaireStep();

  console.log('🔵 [INDEX RENDER]', {
    currentStepIndex: modal.currentStepIndex,
    currentVisibleStep,
    totalSteps,
    currentStepTitle: currentStep?.title,
    accountCreated: modal.accountCreated,
    userId: modal.userId
  });

  // Determine step title and description
  let stepTitle = '';
  let stepDescription = '';
  if (modal.isProductSelectionStep()) {
    stepTitle = 'Product Selection';
    stepDescription = 'Choose your NAD+ products';
  } else if (modal.isCheckoutStep()) {
    stepTitle = 'Complete Your Order';
    stepDescription = 'Secure checkout for your weight management treatment';
  } else if (currentStep) {
    stepTitle = modal.replaceCurrentVariables(currentStep.title);
    stepDescription = modal.replaceCurrentVariables(currentStep.description || '');
  }

  // Handle case when no visible steps remain
  if (!currentStep && !modal.isProductSelectionStep() && !modal.isCheckoutStep()) {
    if (modal.questionnaire) {
      const checkoutPos = modal.questionnaire.checkoutStepPosition;
      const belugaOffset = modal.questionnaire.medicalCompanySource === MedicalCompanySlug.BELUGA ? 1 : 0;
      const checkoutStepIndex = (checkoutPos === -1 ? modal.questionnaire.steps.length : checkoutPos) + belugaOffset;
      console.log('⏭️ No more visible questionnaire steps, advancing to checkout at index:', checkoutStepIndex);
      modal.setCurrentStepIndex(checkoutStepIndex);
    }
    return null;
  }

  // Render regular step content
  const renderStepContent = () => {
    // Beluga consent step (first step for Beluga medical company)
    if (modal.isBelugaConsentStep) {
      return (
        <BelugaConsentStep
          consentGiven={modal.belugaConsentGiven}
          onConsentChange={modal.setBelugaConsentGiven}
          error={modal.errors?.belugaConsent}
        />
      );
    }

    // Google MFA takes precedence
    if (modal.isGoogleMfaMode) {
      return (
        <GoogleMfaStep
          email={modal.googleMfaEmail}
          code={modal.googleMfaCode}
          error={modal.googleMfaError}
          isVerifying={modal.isVerifyingGoogleMfa}
          inputRefs={modal.googleMfaInputRefs}
          onCodeInput={modal.handleGoogleMfaInput}
          onKeyDown={modal.handleGoogleMfaKeyDown}
          onPaste={modal.handleGoogleMfaPaste}
          onVerify={modal.handleGoogleMfaVerify}
          onCancel={modal.handleGoogleMfaCancel}
        />
      );
    }

    // Sign-in options mode
    if (modal.isSignInOptionsMode) {
      if (modal.isEmailVerificationMode) {
        return (
          <EmailVerificationStep
            email={modal.verificationEmail}
            code={modal.verificationCode}
            onCodeChange={modal.setVerificationCode}
            onVerify={modal.emailVerificationHandlers.handleVerifyCode}
            onBack={() => {
              modal.setIsEmailVerificationMode(false);
              modal.setVerificationCode('');
            }}
            onResendCode={modal.emailVerificationHandlers.handleResendCode}
            error={modal.verificationError}
            isVerifying={modal.isVerifying}
            clinicName={domainClinic?.name}
          />
        );
      }

      if (modal.isPasswordSignInMode) {
        return (
          <PasswordSignInStep
            email={modal.signInEmail}
            password={modal.signInPassword}
            error={modal.signInError}
            isSigningIn={modal.isSigningIn}
            onEmailChange={(v) => { modal.setSignInEmail(v); modal.setSignInError(''); }}
            onPasswordChange={(v) => { modal.setSignInPassword(v); modal.setSignInError(''); }}
            onSignIn={modal.handleSignIn}
            onBack={() => {
              modal.setIsPasswordSignInMode(false);
              modal.setSignInEmail('');
              modal.setSignInPassword('');
              modal.setSignInError('');
            }}
            clinicName={domainClinic?.name}
          />
        );
      }

      return (
        <SignInOptionsStep
          onBack={() => {
            modal.setIsSignInOptionsMode(false);
            modal.setIsPasswordSignInMode(false);
          }}
          onGoogleSignIn={modal.handleGoogleSignIn}
          onEmailSignIn={modal.emailVerificationHandlers.handleEmailSignIn}
          onPasswordSignIn={() => modal.setIsPasswordSignInMode(true)}
          clinicId={domainClinic?.id}
          clinicName={domainClinic?.name}
        />
      );
    }

    // Recommended Treatment
    if (currentStep?.title === 'Recommended Treatment') {
      return (
        <RecommendedTreatmentView
          onAnswerChange={modal.handleAnswerChange}
          onNext={modal.handleNext}
        />
      );
    }

    // BMI Calculator
    if (currentStep?.title === 'Body Measurements' || currentStep?.questions?.some(q => q.questionSubtype === 'bmi')) {
      return (
        <BMICalculator
          currentStep={currentStep}
          answers={modal.answers}
          onAnswerChange={modal.handleAnswerChange}
        />
      );
    }

    // Success Stories
    if (currentStep?.title === 'Success Stories') {
      return <SuccessStoriesView />;
    }

    // Create Your Account
    if (currentStep?.title === 'Create Your Account') {
      return (
        <AccountCreationStep
          isSignInMode={false}
          onToggleMode={() => { }}
          firstName={modal.answers['firstName'] || ''}
          lastName={modal.answers['lastName'] || ''}
          email={modal.answers['email'] || ''}
          mobile={modal.answers['mobile'] || ''}
          onFieldChange={modal.handleAnswerChange}
          signInEmail=""
          signInPassword=""
          signInError=""
          isSigningIn={false}
          onSignInEmailChange={() => { }}
          onSignInPasswordChange={() => { }}
          onSignIn={() => { }}
          onEmailSignIn={() => { }}
          onGoogleSignIn={() => { }}
          clinicId={domainClinic?.id}
          clinicName={domainClinic?.name}
        />
      );
    }

    // Regular Questions
    if (currentStep?.questions && currentStep.questions.length > 0) {
      return (
        <RegularQuestionsView
          currentStep={currentStep}
          answers={modal.answers}
          errors={modal.errors}
          theme={modal.theme}
          replaceCurrentVariables={modal.replaceCurrentVariables}
          onAnswerChange={modal.handleAnswerChange}
          onRadioChange={modal.handleRadioChange}
          onCheckboxChange={modal.handleCheckboxChange}
          setErrors={modal.setErrors}
        />
      );
    }

    // Informational Step
    return (
      <InformationalStepView
        stepTitle={stepTitle}
        stepDescription={stepDescription}
      />
    );
  };

  // Check if we should show "Need to sign in?" link
  const showNeedToSignIn = !modal.accountCreated && !modal.userId && !modal.isSignInOptionsMode &&
    !modal.isGoogleMfaMode && !modal.isCheckoutStep();

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        onOpenChange={(open) => { if (!open && modal.showEmailModal) return; }}
        isDismissable={!modal.showEmailModal && !modal.isCheckoutStep()}
        isKeyboardDismissDisabled={modal.showEmailModal}
        size="full"
        classNames={{
          base: "m-0 sm:m-0 max-w-full max-h-full",
          wrapper: "w-full h-full !z-40",
          backdrop: modal.showEmailModal ? "!hidden" : "bg-overlay/50 !z-40"
        }}
        hideCloseButton
      >
        <ModalContent
          className="h-full bg-gray-50 questionnaire-theme"
          style={modal.themeVars}
        >
          <ModalBody
            className="p-0 h-full flex flex-col"
            {...(modal.showEmailModal ? { inert: '' as any } : {})}
          >
            <ModalHeader
              onClose={onClose}
              currentStep={currentVisibleStep}
              totalSteps={totalSteps}
            />

            <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
              <div className={`w-full ${modal.isCheckoutStep() ? 'max-w-5xl' : 'max-w-md'} mx-auto min-h-full flex flex-col justify-center`}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={modal.currentStepIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    {modal.isCheckoutStep() ? (
                      <CheckoutStepView
                        progressPercent={progressPercent}
                        theme={modal.theme}
                        onPrevious={modal.handlePrevious}
                        canGoBack={modal.currentStepIndex > 0}
                        clinic={domainClinic ? { name: domainClinic.name, logo: (domainClinic as any).logo } : null}
                        isLoadingClinic={isLoadingClinic}
                        plans={modal.plans}
                        selectedPlan={modal.selectedPlan}
                        onPlanChange={modal.handlePlanSelection}
                        paymentStatus={modal.paymentStatus as PaymentStatus}
                        clientSecret={modal.clientSecret}
                        shippingInfo={modal.shippingInfo}
                        onShippingInfoChange={(field, value) =>
                          modal.setShippingInfo((prev) => ({ ...prev, [field]: value }))
                        }
                        onRetryPaymentSetup={() => { }}
                        onCreateSubscription={modal.createSubscriptionForPlan}
                        onPaymentSuccess={modal.handlePaymentSuccess}
                        onPaymentError={modal.handlePaymentError}
                        onPaymentConfirm={modal.handlePaymentConfirm}
                        stripePromise={stripePromise}
                        questionnaireProducts={modal.questionnaire.treatment?.products}
                        selectedProducts={modal.selectedProducts}
                        treatmentName={props.treatmentName ?? props.productName ?? ''}
                        pharmacyCoverages={modal.pharmacyCoverages}
                        // Visit fee props
                        visitFeeAmount={modal.visitFeeAmount}
                        visitType={modal.visitType}
                        loadingVisitFee={modal.loadingVisitFee}
                        onCalculateVisitFee={modal.calculateVisitFee}
                        onNext={modal.handleNext}
                        // Program props
                        programData={modal.programData}
                        selectedProgramProducts={modal.selectedProgramProducts}
                        onProgramProductToggle={modal.handleProgramProductToggle}
                        onCreateProgramSubscription={modal.createProgramSubscription}
                      />
                    ) : modal.isProductSelectionStep() ? (
                      <ProductSelectionStepView
                        progressPercent={progressPercent}
                        theme={modal.theme}
                        products={modal.questionnaire.treatment?.products}
                        selectedProducts={modal.selectedProducts}
                        onProductQuantityChange={modal.handleProductQuantityChange}
                        onNext={modal.handleNext}
                        isCheckoutStep={modal.isCheckoutStep}
                        paymentStatus={modal.paymentStatus as PaymentStatus}
                        isLastStep={isLastStep}
                        isProductSelectionStep={modal.isProductSelectionStep}
                      />
                    ) : (
                      <>
                        <ProgressBar progressPercent={progressPercent} color={modal.theme.primary} backgroundColor="#E5E7EB" />
                        <StepHeader
                          onPrevious={modal.handlePrevious}
                          canGoBack={modal.currentStepIndex > 0}
                          clinic={domainClinic ? { name: domainClinic.name, logo: (domainClinic as any).logo } : null}
                          isLoadingClinic={isLoadingClinic}
                        />

                        {/* DEBUG: Show step category */}
                        {/* {currentStep && (
                          <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-2 mb-4">
                            <p className="text-sm font-mono">
                              <strong>DEBUG Category:</strong> {currentStep.category || 'undefined'}
                            </p>
                          </div>
                        )} */}

                        {renderStepContent()}

                        {/* Navigation buttons - only show when not in special modes */}
                        {!modal.isCheckoutStep() &&
                          !modal.isSignInOptionsMode &&
                          !modal.isGoogleMfaMode && (
                            <>
                              <StepNavigationButtons
                                isCheckoutStep={modal.isCheckoutStep}
                                paymentStatus={modal.paymentStatus as PaymentStatus}
                                currentStep={currentStep}
                                isSignInMode={modal.isSignInMode}
                                isEmailVerificationMode={modal.isEmailVerificationMode}
                                currentStepIndex={modal.currentStepIndex}
                                answers={modal.answers}
                                isLastStep={isLastStep}
                                isProductSelectionStep={modal.isProductSelectionStep}
                                theme={modal.theme}
                                onNext={modal.handleNext}
                                onPrevious={modal.handlePrevious}
                                onClose={onClose}
                                setCurrentStepIndex={() => { }}
                              />

                              {/* "Need to sign in?" link */}
                              {showNeedToSignIn && (
                                <div className="text-center pt-2">
                                  <button
                                    type="button"
                                    onClick={() => modal.setIsSignInOptionsMode(true)}
                                    className="text-gray-500 text-sm hover:text-gray-700 hover:underline transition-colors"
                                  >
                                    Need to sign in?
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                      </>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      <EmailInputModal
        isOpen={modal.showEmailModal}
        email={modal.verificationEmail}
        onEmailChange={modal.setVerificationEmail}
        onContinue={modal.emailVerificationHandlers.handleSendCodeFromModal}
        onCancel={() => {
          modal.setShowEmailModal(false);
          modal.setVerificationEmail('');
          modal.setEmailModalError('');
        }}
        isLoading={modal.emailModalLoading}
        error={modal.emailModalError}
      />

      <OrderSuccessModal
        isOpen={modal.showSuccessModal}
        paymentStatus={modal.paymentStatus}
        onContinue={modal.handleSuccessModalContinue}
      />
    </>
  );
};
