import { sendVerificationCode, verifyCode } from "./auth";

interface EmailVerificationHandlers {
  handleEmailSignIn: () => void;
  handleSendCodeFromModal: () => Promise<void>;
  handleVerifyCode: () => Promise<void>;
  handleResendCode: () => Promise<void>;
}

interface EmailVerificationState {
  answers: Record<string, any>;
  verificationEmail: string;
  verificationCode: string;
  questionnaire: any;
  currentStepIndex: number;
  setVerificationError: (error: string) => void;
  setVerificationEmail: (email: string) => void;
  setIsEmailVerificationMode: (mode: boolean) => void;
  setIsVerifying: (verifying: boolean) => void;
  setVerificationCode: (code: string) => void;
  setAnswers: (answers: any) => void;
  setPatientFirstName: (name: string) => void;
  setPatientName: (name: string) => void;
  setUserId: (id: string) => void;
  setAccountCreated: (created: boolean) => void;
  setCurrentStepIndex: (index: any) => void;
  getTotalSteps: () => number;
  setShowEmailModal: (show: boolean) => void;
  setEmailModalLoading: (loading: boolean) => void;
  setEmailModalError: (error: string) => void;
  // Sign-in mode setters
  setIsSignInOptionsMode?: (mode: boolean) => void;
  setIsPasswordSignInMode?: (mode: boolean) => void;
}

export const createEmailVerificationHandlers = (
  state: EmailVerificationState
): EmailVerificationHandlers => {
  const handleSendCodeFromModal = async () => {
    const email = state.verificationEmail || state.answers['email'];

    console.log('📧 Attempting to send code to:', email);

    if (!email || !email.includes('@')) {
      state.setEmailModalError('Please enter a valid email address');
      return;
    }

    state.setEmailModalError('');
    state.setEmailModalLoading(true);

    const result = await sendVerificationCode(email);

    state.setEmailModalLoading(false);

    if (result.success) {
      // Update the answers with the email
      if (state.verificationEmail && state.verificationEmail !== state.answers['email']) {
        state.setAnswers((prev: any) => ({ ...prev, email: state.verificationEmail }));
      }

      // Close modal and show verification step
      state.setShowEmailModal(false);
      state.setIsEmailVerificationMode(true);
      console.log('✅ Verification code sent');
    } else {
      state.setEmailModalError(result.error || 'Failed to send verification code');
    }
  };

  const handleVerifyCode = async () => {
    state.setVerificationError('');
    state.setIsVerifying(true);

    console.log('🔐 Verifying code for:', state.verificationEmail);

    const result = await verifyCode(state.verificationEmail, state.verificationCode);

    if (result.success) {
      if (result.isExistingUser && result.userData) {
        // Existing user - fill in their data and advance
        const newAnswers = {
          ...state.answers,
          firstName: result.userData.firstName,
          lastName: result.userData.lastName,
          email: result.userData.email,
          mobile: result.userData.phoneNumber
        };

        state.setAnswers(newAnswers);
        state.setPatientFirstName(result.userData.firstName);
        state.setPatientName(`${result.userData.firstName} ${result.userData.lastName}`.trim());
        state.setUserId(result.userData.id);
        state.setAccountCreated(true);

        // Exit ALL sign-in modes
        state.setIsEmailVerificationMode(false);
        state.setIsSignInOptionsMode?.(false);
        state.setIsPasswordSignInMode?.(false);
        state.setVerificationCode('');

        console.log('✅ Existing user verified, getCurrentQuestionnaireStep will skip user_profile steps');
      } else {
        // New user - email verified, stay on form to complete signup
        state.setAnswers((prev: any) => ({ ...prev, email: result.email || state.verificationEmail }));
        state.setIsEmailVerificationMode(false);
        state.setIsSignInOptionsMode?.(false);
        state.setIsPasswordSignInMode?.(false);
        state.setVerificationCode('');
        console.log('✅ New user email verified, continue with signup');
      }
    } else {
      state.setVerificationError(result.error || 'Invalid verification code');
    }

    state.setIsVerifying(false);
  };

  const handleResendCode = async () => {
    state.setVerificationError('');
    const result = await sendVerificationCode(state.verificationEmail);

    if (result.success) {
      alert('Verification code sent!');
    } else {
      state.setVerificationError(result.error || 'Failed to resend code');
    }
  };

  const handleEmailSignIn = () => {
    console.log('🔵 handleEmailSignIn called');
    const email = state.answers['email'];

    console.log('📧 Current email in answers:', email);

    if (!email || !email.includes('@')) {
      // Show email input modal
      console.log('📧 No valid email, calling setShowEmailModal(true)');
      state.setShowEmailModal(true);
      console.log('📧 setShowEmailModal called');
      state.setVerificationEmail('');
      state.setEmailModalError('');
      return;
    }

    // Email already filled, send code directly
    console.log('📧 Sending verification code to:', email);
    state.setVerificationEmail(email);
    sendVerificationCode(email).then(result => {
      if (result.success) {
        state.setIsEmailVerificationMode(true);
        console.log('✅ Verification code sent');
      } else {
        state.setShowEmailModal(true);
        state.setVerificationEmail(email);
        state.setEmailModalError(result.error || 'Failed to send code');
      }
    });
  };

  return {
    handleEmailSignIn,
    handleSendCodeFromModal,
    handleVerifyCode,
    handleResendCode
  };
};
