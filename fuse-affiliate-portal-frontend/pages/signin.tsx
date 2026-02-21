import React from "react";
import { motion } from "framer-motion";
import { Button, Input, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { authApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import Head from "next/head";

interface MfaState {
  required: boolean;
  token: string | null;
  resendsRemaining: number;
}

export default function SignIn() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isVisible, setIsVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");
  const [mfa, setMfa] = React.useState<MfaState>({ required: false, token: null, resendsRemaining: 3 });
  const [mfaCode, setMfaCode] = React.useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const mfaInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const { refreshUser, overrideToken } = useAuth();
  const [shortSession, setShortSession] = React.useState(false);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Check for error message from query params
  React.useEffect(() => {
    if (router.query.error) {
      setError(router.query.error as string);
    }
  }, [router.query.error]);

  // Resend cooldown timer
  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await authApi.signIn(email, password);

      console.log('🔐 SignIn result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      // Check if MFA is required
      if (result.data?.requiresMfa && result.data?.mfaToken) {
        setMfa({ required: true, token: result.data.mfaToken, resendsRemaining: 3 });
        setIsLoading(false);
        return;
      }

      // Handle token - check multiple possible locations
      const token = result.data?.token || result.data?.data?.token;
      if (token) {
        localStorage.setItem('auth-token', token);
        if (shortSession) {
          const res = await fetch(`${API_BASE_URL}/auth/debug/short-token`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success && data.token) overrideToken(data.token);
        }
        console.log('✅ Token stored in localStorage from signin component');
        
        // Verify token was stored
        const storedToken = localStorage.getItem('auth-token');
        console.log('🔍 Token verification:', { stored: !!storedToken, length: storedToken?.length });
      } else {
        console.warn('⚠️ No token found in response:', {
          hasData: !!result.data,
          dataKeys: result.data ? Object.keys(result.data) : [],
          fullData: result.data,
        });
        setError('Authentication succeeded but no token received. Please try again.');
        return;
      }

      // Refresh user state
      console.log('🔄 Refreshing user...');
      await refreshUser();
      
      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('✅ Redirecting to dashboard...');
      router.push('/dashboard');

    } catch (err) {
      console.error('❌ Authentication error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
      setPassword("");
    }
  };

  const handleMfaCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    
    const newCode = [...mfaCode];
    newCode[index] = digit;
    setMfaCode(newCode);

    if (digit && index < 5) {
      mfaInputRefs.current[index + 1]?.focus();
    }
  };

  const handleMfaKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
      mfaInputRefs.current[index - 1]?.focus();
    }
  };

  const handleMfaPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      setMfaCode(pastedData.split(''));
      mfaInputRefs.current[5]?.focus();
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = mfaCode.join('').trim();
    if (code.length !== 6 || !mfa.token) return;

    setIsLoading(true);
    setError("");

    try {
      console.log('🔐 MFA Verification attempt:', {
        codeLength: code.length,
        code: code.split('').map(() => '*').join(''), // Masked for security
        hasToken: !!mfa.token,
        tokenLength: mfa.token?.length,
      });

      const result = await authApi.verifyMfa(mfa.token, code);
      
      console.log('🔐 MFA Verification result:', {
        success: result.success,
        hasError: !!result.error,
        error: result.error,
        hasData: !!result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
      });

      if (!result.success) {
        // Check for specific error conditions from backend
        if (result.data?.expired) {
          setMfa({ required: false, token: null, resendsRemaining: 3 });
          throw new Error('Verification code expired. Please sign in again.');
        } else if (result.data?.rateLimited) {
          setMfa({ required: false, token: null, resendsRemaining: 3 });
          throw new Error('Too many failed attempts. Please sign in again.');
        }
        
        // Use the error message from backend, or fallback to default
        const errorMessage = result.error || result.data?.message || 'Invalid verification code. Please try again.';
        const attemptsRemaining = result.data?.attemptsRemaining;
        
        if (attemptsRemaining !== undefined && attemptsRemaining > 0) {
          throw new Error(`${errorMessage} (${attemptsRemaining} attempts remaining)`);
        }
        
        throw new Error(errorMessage);
      }

      // Store JWT token
      if (result.data?.token) {
        localStorage.setItem('auth-token', result.data.token);
      }

      // Reset MFA state
      setMfa({ required: false, token: null, resendsRemaining: 3 });

      // Refresh user state and redirect
      await refreshUser();
      router.push('/dashboard');

    } catch (err) {
      console.error('MFA verification error occurred');
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
      setMfaCode(['', '', '', '', '', '']);
      mfaInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !mfa.token) return;
    
    setIsLoading(true);
    setError("");

    try {
      const result = await authApi.resendMfaCode(mfa.token);

      if (!result.success) {
        if (result.data?.maxResends) {
          setMfa({ required: false, token: null, resendsRemaining: 0 });
          throw new Error('Maximum resend attempts reached. Please sign in again.');
        }
        throw new Error(result.error || 'Failed to resend code');
      }

      setMfa(prev => ({ ...prev, resendsRemaining: result.data?.resendsRemaining ?? prev.resendsRemaining - 1 }));
      setSuccessMessage('New verification code sent!');
      setResendCooldown(30);
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (err) {
      console.error('MFA resend error occurred');
      setError(err instanceof Error ? err.message : 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMfa({ required: false, token: null, resendsRemaining: 3 });
    setMfaCode(['', '', '', '', '', '']);
    setPassword("");
    setError("");
  };

  // MFA Verification Form
  if (mfa.required) {
    return (
      <>
        <Head>
          <title>Affiliate Portal - Verify Code</title>
        </Head>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <Card className="border-border shadow-lg">
              <CardBody className="p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center">
                      <Icon icon="lucide:mail" className="text-3xl text-success-600" />
                    </div>
                  </div>
                  <h2 className="font-bold text-2xl text-foreground mb-2">Check Your Email</h2>
                  <p className="text-muted-foreground">
                    We sent a 6-digit verification code to<br />
                    <span className="font-medium text-foreground">{email}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    (Please check your spam folder)
                  </p>
                </div>

                {/* Success Message */}
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-success-50 border border-success-200 text-success-600 px-4 py-3 rounded-lg text-sm mb-4"
                  >
                    {successMessage}
                  </motion.div>
                )}

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-danger-50 border border-danger-200 text-danger-600 px-4 py-3 rounded-lg text-sm mb-4"
                  >
                    {error}
                  </motion.div>
                )}

                {/* MFA Code Input */}
                <form onSubmit={handleMfaSubmit} className="space-y-6">
                  <div className="flex justify-center gap-2">
                    {mfaCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { mfaInputRefs.current[index] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleMfaCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleMfaKeyDown(index, e)}
                        onPaste={handleMfaPaste}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-content3 rounded-xl bg-content1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    Code expires in 5 minutes
                  </p>

                  <Button
                    type="submit"
                    color="primary"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                    isDisabled={mfaCode.join('').length !== 6}
                  >
                    {isLoading ? "Verifying..." : "Verify & Sign In"}
                  </Button>
                </form>

                {/* Resend and Back buttons */}
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || isLoading || mfa.resendsRemaining <= 0}
                    className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon icon="lucide:refresh-cw" className="w-4 h-4" />
                    {resendCooldown > 0 
                      ? `Resend code in ${resendCooldown}s`
                      : mfa.resendsRemaining <= 0
                        ? 'No resends remaining'
                        : `Resend code (${mfa.resendsRemaining} remaining)`
                    }
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon icon="lucide:arrow-left" className="w-4 h-4" />
                    Back to sign in
                  </button>
                </div>

                {/* Security notice */}
                <div className="mt-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    🔒 Two-factor authentication required for HIPAA compliance
                  </p>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Affiliate Portal - Sign In</title>
      </Head>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-border shadow-lg">
            <CardBody className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Affiliate Portal
                </h1>
                <p className="text-muted-foreground">
                  Sign in to access your affiliate dashboard
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-danger/10 border border-danger rounded-lg">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full"
                    startContent={
                      <Icon icon="lucide:mail" className="text-lg text-muted-foreground" />
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Password
                  </label>
                  <Input
                    type={isVisible ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full"
                    startContent={
                      <Icon icon="lucide:lock" className="text-lg text-muted-foreground" />
                    }
                    endContent={
                      <button
                        type="button"
                        onClick={toggleVisibility}
                        className="focus:outline-none"
                      >
                        <Icon
                          icon={isVisible ? "lucide:eye-off" : "lucide:eye"}
                          className="text-lg text-muted-foreground"
                        />
                      </button>
                    }
                  />
                  <div className="text-right mt-2">
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                      Forgot your password?
                    </Link>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShortSession(v => !v)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    shortSession
                      ? 'bg-secondary-100 border-secondary-300 text-secondary-700'
                      : 'border-default-300 text-default-500 hover:text-default-700 hover:bg-default-100'
                  }`}
                >
                  <Icon icon="lucide:flask-conical" className="h-3.5 w-3.5 shrink-0" />
                  {shortSession ? 'Short session active — token expires in 2 min' : 'Short session (debug)'}
                </button>

                <Button
                  type="submit"
                  color="primary"
                  className="w-full"
                  size="lg"
                  isLoading={isLoading}
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </>
  );
}

