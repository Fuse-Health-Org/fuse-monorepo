import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "@iconify/react";
import { GoogleSignInButton } from "./GoogleSignInButton";

interface AccountCreationStepProps {
  isSignInMode: boolean;
  onToggleMode: () => void;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  onFieldChange: (field: string, value: string) => void;
  signInEmail: string;
  signInPassword: string;
  signInError: string;
  isSigningIn: boolean;
  onSignInEmailChange: (value: string) => void;
  onSignInPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onEmailSignIn: () => void;
  onGoogleSignIn: (credential: string) => void;
  clinicId?: string;
  clinicName?: string;
}

export const AccountCreationStep: React.FC<AccountCreationStepProps> = ({
  isSignInMode,
  onToggleMode,
  firstName,
  lastName,
  email,
  mobile,
  onFieldChange,
  signInEmail,
  signInPassword,
  signInError,
  isSigningIn,
  onSignInEmailChange,
  onSignInPasswordChange,
  onSignIn,
  onEmailSignIn,
  onGoogleSignIn,
  clinicId,
  clinicName
}) => {
  // This component now only shows the sign-up form (no OAuth options)
  // OAuth options are handled by SignInOptionsStep when user clicks "Need to sign in?"
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-gray-900 mb-3">Create Your Medical Profile</h3>
        <p className="text-gray-600 text-base leading-relaxed">
          A licensed healthcare provider will use this information to verify, prescribe and deliver treatments at their discretion.
        </p>
      </div>

      <div className="space-y-6">
        {/* First Name and Last Name Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Legal Name</label>
            </div>
            <input
              type="text"
              value={firstName}
              onChange={(e) => onFieldChange('firstName', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="First Name"
            />
          </div>
          <div>
            <div className="flex items-center justify-end mb-2">
              <span className="text-xs text-gray-500">For prescription</span>
            </div>
            <input
              type="text"
              value={lastName}
              onChange={(e) => onFieldChange('lastName', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Last Name"
            />
          </div>
        </div>

        {/* Email Address */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Icon icon="mdi:email-outline" className="text-gray-400" />
              Medical updates
            </span>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => onFieldChange('email', e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Email Address"
          />
        </div>

        {/* Mobile Number */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Icon icon="mdi:shield-check-outline" className="text-gray-400" />
              Secure verification
            </span>
          </div>
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center">
              <span className="text-lg mr-2">🇺🇸</span>
            </div>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => onFieldChange('mobile', e.target.value)}
              className="w-full pl-16 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Mobile Number"
            />
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="bg-gray-50 rounded-lg p-3 mt-6">
        <div className="flex items-start gap-3 mb-2">
          <Icon icon="healthicons:health-data-security" className="text-emerald-600 text-base flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-gray-900 text-sm">HIPAA-Compliant & Secure</p>
            <p className="text-xs text-gray-600 leading-relaxed mt-0.5">
              Your medical information is protected by federal privacy laws and encrypted with industry-leading security.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 ml-7">
          <span className="flex items-center gap-1">
            <Icon icon="mdi:shield-check" className="text-emerald-600 text-sm" />
            256-bit Encryption
          </span>
          <span className="flex items-center gap-1">
            <Icon icon="healthicons:doctor" className="text-emerald-600 text-sm" />
            Licensed Providers
          </span>
        </div>
      </div>
    </div>
  );
};

// Sign-In Options Step Component
interface SignInOptionsStepProps {
  onBack: () => void;
  onGoogleSignIn: (credential: string) => void;
  onEmailSignIn: () => void;
  onPasswordSignIn: () => void;
  clinicId?: string;
  clinicName?: string;
}

export const SignInOptionsStep: React.FC<SignInOptionsStepProps> = ({
  onBack,
  onGoogleSignIn,
  onEmailSignIn,
  onPasswordSignIn,
  clinicId,
  clinicName
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-medium text-gray-900 mb-3">Welcome back</h3>
        <p className="text-gray-600 text-base">Sign in to continue with your account</p>
      </div>

      <div className="space-y-3 pt-4">
        {/* Continue with Google */}
        <GoogleSignInButton clinicId={clinicId} />

        {/* Continue with Email (OTP) */}
        <button
          type="button"
          onClick={onEmailSignIn}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-full text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          <Icon icon="lucide:mail" className="text-xl" />
          <span>Continue with OTP</span>
        </button>

        {/* Sign in with Password */}
        <button
          type="button"
          onClick={onPasswordSignIn}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-full text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          <Icon icon="lucide:key" className="text-xl" />
          <span>Sign in with Password</span>
        </button>
      </div>

      {/* Back to Create Account */}
      <div className="text-center pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-600 hover:text-gray-900 font-medium transition-colors flex items-center justify-center gap-1 mx-auto"
        >
          <Icon icon="lucide:arrow-left" className="text-sm" />
          <span>Back to create account</span>
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="bg-gray-100 rounded-xl p-4 mt-6">
        <div className="flex items-start gap-3">
          <Icon icon="lucide:lock" className="text-gray-600 text-lg flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 leading-relaxed">
            {clinicName || 'Hims'} takes your privacy seriously with industry leading encryption.
          </p>
        </div>
      </div>
    </div>
  );
};

// Google MFA Step Component
interface GoogleMfaStepProps {
  email: string;
  code: string[];
  error: string;
  isVerifying: boolean;
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onCodeInput: (index: number, value: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onVerify: () => void;
  onCancel: () => void;
}

export const GoogleMfaStep: React.FC<GoogleMfaStepProps> = ({
  email,
  code,
  error,
  isVerifying,
  inputRefs,
  onCodeInput,
  onKeyDown,
  onPaste,
  onVerify,
  onCancel
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon icon="lucide:shield-check" className="text-3xl text-emerald-600" />
        </div>
        <h3 className="text-2xl font-medium text-gray-900 mb-2">Verify your identity</h3>
        <p className="text-gray-600">
          We sent a verification code to <strong>{email}</strong>
        </p>
      </div>

      {/* 6-digit code input */}
      <div className="flex justify-center gap-2" onPaste={onPaste}>
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => onCodeInput(index, e.target.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            className="w-12 h-14 text-center text-2xl font-semibold border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors"
            autoFocus={index === 0}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600 text-center">{error}</p>
        </div>
      )}

      {/* Verify Button */}
      <button
        type="button"
        onClick={onVerify}
        disabled={isVerifying || code.join('').length !== 6}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isVerifying ? (
          <>
            <Icon icon="lucide:loader-2" className="animate-spin" />
            <span>Verifying...</span>
          </>
        ) : (
          'Verify Code'
        )}
      </button>

      {/* Cancel Button */}
      <div className="text-center">
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          Cancel and try again
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="bg-gray-100 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Icon icon="lucide:lock" className="text-gray-600 text-lg flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 leading-relaxed">
            This additional verification step helps protect your account and health information.
          </p>
        </div>
      </div>
    </div>
  );
};

// Password Sign-In Step Component
interface PasswordSignInStepProps {
  email: string;
  password: string;
  error: string;
  isSigningIn: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onBack: () => void;
  clinicName?: string;
}

export const PasswordSignInStep: React.FC<PasswordSignInStepProps> = ({
  email,
  password,
  error,
  isSigningIn,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onBack,
  clinicName
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-medium text-gray-900 mb-3">Sign in with password</h3>
        <p className="text-gray-600 text-base">Enter your email and password to continue</p>
      </div>

      <div className="space-y-6">
        {/* Email Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Email Address"
            onKeyDown={(e) => { if (e.key === 'Enter') onSignIn(); }}
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Enter your password"
            onKeyDown={(e) => { if (e.key === 'Enter') onSignIn(); }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Sign In Button */}
        <button
          type="button"
          onClick={onSignIn}
          disabled={isSigningIn || !email || !password}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isSigningIn ? (
            <>
              <Icon icon="lucide:loader-2" className="animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </div>

      {/* Back to Sign-In Options */}
      <div className="text-center pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-600 hover:text-gray-900 font-medium transition-colors flex items-center justify-center gap-1 mx-auto"
        >
          <Icon icon="lucide:arrow-left" className="text-sm" />
          <span>Back to sign-in options</span>
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="bg-gray-100 rounded-xl p-4 mt-6">
        <div className="flex items-start gap-3">
          <Icon icon="lucide:lock" className="text-gray-600 text-lg flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 leading-relaxed">
            {clinicName || 'Hims'} takes your privacy seriously with industry leading encryption.
          </p>
        </div>
      </div>
    </div>
  );
};

// Email Input Modal Component
interface EmailInputModalProps {
  isOpen: boolean;
  email: string;
  onEmailChange: (email: string) => void;
  onContinue: () => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string;
}

export const EmailInputModal: React.FC<EmailInputModalProps> = ({
  isOpen,
  email,
  onEmailChange,
  onContinue,
  onCancel,
  isLoading,
  error
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  console.log('📧 EmailInputModal render - isOpen:', isOpen);

  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        console.log('📧 Input focused');
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  console.log('📧 EmailInputModal is visible!');

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50"
      style={{ zIndex: 50 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-modal-title"
      >
        <div>
          <h3 id="email-modal-title" className="text-xl font-semibold text-gray-900 mb-2">Enter your email</h3>
          <p className="text-gray-600 text-sm">We'll send you a verification code to continue</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={(e) => {
              console.log('📧 Input onChange triggered:', e.target.value);
              onEmailChange(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="your.email@example.com"
            autoFocus
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email && email.includes('@')) onContinue();
            }}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={isLoading || !email || !email.includes('@')}
            className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Icon icon="lucide:loader-2" className="animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(modalContent, document.body);
  }

  return null;
};

// Email Verification Code Input Component
interface EmailVerificationStepProps {
  email: string;
  code: string;
  onCodeChange: (code: string) => void;
  onVerify: () => void;
  onBack: () => void;
  onResendCode: () => void;
  error: string;
  isVerifying: boolean;
  clinicName?: string;
}

export const EmailVerificationStep: React.FC<EmailVerificationStepProps> = ({
  email,
  code,
  onCodeChange,
  onVerify,
  onBack,
  onResendCode,
  error,
  isVerifying,
  clinicName
}) => {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [codeDigits, setCodeDigits] = React.useState<string[]>(['', '', '', '', '', '']);

  React.useEffect(() => {
    if (code.length === 6) {
      setCodeDigits(code.split(''));
    }
  }, [code]);

  const handleDigitChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...codeDigits];
    newDigits[index] = value;
    setCodeDigits(newDigits);
    onCodeChange(newDigits.join(''));

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newDigits.every(d => d) && index === 5) {
      setTimeout(() => onVerify(), 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter' && codeDigits.every(d => d)) {
      onVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setCodeDigits(digits);
      onCodeChange(pastedData);
      inputRefs.current[5]?.focus();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-medium text-gray-900 mb-3">Verify your email</h3>
        <p className="text-gray-600 text-base">
          We've sent a 6-digit code to <span className="font-medium text-gray-900">{email}</span>
        </p>
      </div>

      <div className="space-y-6 pt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3 text-center">Enter verification code</label>
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {codeDigits.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                autoFocus={index === 0}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={onVerify}
          disabled={isVerifying || codeDigits.some(d => !d)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isVerifying ? (
            <>
              <Icon icon="lucide:loader-2" className="animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            'Verify Email'
          )}
        </button>

        <div className="text-center">
          <span className="text-gray-600 text-sm">Didn't receive the code? </span>
          <button
            type="button"
            onClick={onResendCode}
            className="text-emerald-600 text-sm font-medium hover:underline"
          >
            Resend
          </button>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="w-full text-gray-600 hover:text-gray-900 font-medium py-2 transition-colors"
        >
          ← Back
        </button>
      </div>

      <div className="bg-gray-100 rounded-xl p-4 mt-6">
        <div className="flex items-start gap-3">
          <Icon icon="lucide:lock" className="text-gray-600 text-lg flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 leading-relaxed">
            {clinicName || 'Hims'} takes your privacy seriously with industry leading encryption.
          </p>
        </div>
      </div>
    </div>
  );
};
