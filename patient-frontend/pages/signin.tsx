import React from "react";
import { motion } from "framer-motion";
import { Button, Input, Card, CardBody, Avatar } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { authApi, apiCall } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { extractClinicSlugFromDomain, getDashboardPrefix } from "../lib/clinic-utils";

interface Clinic {
  id: string;
  name: string;
  slug: string;
  logo: string;
  patientPortalDashboardFormat?: string;
}

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
  const [clinic, setClinic] = React.useState<Clinic | null>(null);
  const [loadingClinic, setLoadingClinic] = React.useState(true);
  const [loadingLogo, setLoadingLogo] = React.useState(false);
  const [clinicNotFound, setClinicNotFound] = React.useState(false);
  const [hasClinicSubdomain, setHasClinicSubdomain] = React.useState(false);
  const [mfa, setMfa] = React.useState<MfaState>({ required: false, token: null, resendsRemaining: 3 });
  const [mfaCode, setMfaCode] = React.useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const mfaInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const { refreshUser, overrideToken } = useAuth();
  const [shortSession, setShortSession] = React.useState(false);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Function to preload logo image
  const preloadLogoImage = (logoUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!logoUrl) {
        resolve(); // No logo to load
        return;
      }

      const img = new Image();
      img.onload = () => {
        console.log('✅ Logo image loaded successfully:', logoUrl);
        resolve();
      };
      img.onerror = () => {
        console.log('⚠️ Logo image failed to load:', logoUrl);
        resolve(); // Still resolve so UI doesn't hang
      };
      img.src = logoUrl;
    });
  };

  // Load clinic data based on subdomain
  React.useEffect(() => {
    const loadClinicFromDomain = async () => {
      setLoadingClinic(true);
      try {
        // This function checks vanity domain first, then falls back to subdomain
        const domainInfo = await extractClinicSlugFromDomain();

        if (domainInfo.hasClinicSubdomain && domainInfo.clinicSlug) {
          setHasClinicSubdomain(true);

          console.log('🏥 Detected clinic slug from subdomain:', domainInfo.clinicSlug);

          const result = await apiCall(`/clinic/by-slug/${domainInfo.clinicSlug}`);
          if (result.success && result.data && result.data.data) {
            const clinicData = result.data.data as Clinic;
            console.log('✅ Loaded clinic data:', result);
            console.log('🏥 Extracted clinic data:', clinicData);
            console.log('🖼️ Logo URL:', clinicData.logo);
            console.log('🏷️ Clinic name:', clinicData.name);

            // Preload logo image before showing UI
            if (clinicData.logo) {
              setLoadingLogo(true);
              console.log('🖼️ Starting logo preload...');
              await preloadLogoImage(clinicData.logo);
              setLoadingLogo(false);
            }

            setClinic(clinicData);
          } else {
            console.error('❌ Failed to load clinic data:', result);
            setClinicNotFound(true);
          }
        } else {
          // No subdomain detected
          setHasClinicSubdomain(false);
        }
      } catch (error) {
        console.error('❌ Error loading clinic data:', error);
        if (hasClinicSubdomain) {
          setClinicNotFound(true);
        }
      } finally {
        setLoadingClinic(false);
      }
    };

    loadClinicFromDomain();
  }, []);

  React.useEffect(() => {
    // Check for success message from signup
    if (router.query.message) {
      setSuccessMessage(router.query.message as string);
    }
  }, [router.query.message]);

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

      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      // Check if MFA is required
      if (result.data?.requiresMfa && result.data?.mfaToken) {
        setMfa({ required: true, token: result.data.mfaToken, resendsRemaining: 3 });
        setIsLoading(false);
        return;
      }

      // Store JWT token in localStorage (direct login without MFA - shouldn't happen with new flow)
      if (result.data?.token) {
        localStorage.setItem('auth-token', result.data.token);
      }

      if (shortSession) {
        const freshToken = localStorage.getItem('auth-token');
        const res = await fetch(`${API_BASE_URL}/auth/debug/short-token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${freshToken}` },
        });
        const data = await res.json();
        if (data.success && data.token) overrideToken(data.token);
      }

      // Refresh user state and redirect to dashboard
      await refreshUser();
      
      // Use redirect parameter if provided
      let redirectPath = router.query.redirect as string;
      
      // If no redirect parameter, use default dashboard
      if (!redirectPath) {
        redirectPath = getDashboardPrefix(clinic);
      }
      
      console.log('[SIGNIN] Redirecting after login:', { 
        redirectPath, 
        hasRedirectParam: !!router.query.redirect,
        clinicFormat: clinic?.patientPortalDashboardFormat,
      });
      router.push(redirectPath);

    } catch (err) {
      // HIPAA Compliance: Don't log the actual error which might contain PHI
      // Only log sanitized error information for debugging
      console.error('Authentication error occurred');
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
      // Clear password for security
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
    const code = mfaCode.join('');
    if (code.length !== 6 || !mfa.token) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await authApi.verifyMfa(mfa.token, code);

      if (!result.success) {
        if (result.data?.expired) {
          setMfa({ required: false, token: null, resendsRemaining: 3 });
          throw new Error('Verification code expired. Please sign in again.');
        } else if (result.data?.rateLimited) {
          setMfa({ required: false, token: null, resendsRemaining: 3 });
          throw new Error('Too many failed attempts. Please sign in again.');
        }
        throw new Error(result.error || 'Invalid verification code');
      }

      // Store JWT token
      if (result.data?.token) {
        localStorage.setItem('auth-token', result.data.token);
      }

      // Reset MFA state
      setMfa({ required: false, token: null, resendsRemaining: 3 });

      // Refresh user state and redirect
      await refreshUser();
      
      // Use redirect parameter if provided
      let redirectPath = router.query.redirect as string;
      
      // If no redirect parameter, use default dashboard
      if (!redirectPath) {
        redirectPath = getDashboardPrefix(clinic);
      }
      
      console.log('[SIGNIN] Redirecting after MFA verification:', { 
        redirectPath, 
        hasRedirectParam: !!router.query.redirect,
        clinicFormat: clinic?.patientPortalDashboardFormat,
      });
      router.push(redirectPath);

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

  // Show loading state for clinic subdomains (including logo loading)
  if (hasClinicSubdomain && (loadingClinic || loadingLogo)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Card className="w-full">
            <CardBody className="p-6 md:p-8">
              <div className="text-center space-y-6">
                <div className="animate-pulse">
                  <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded-lg w-3/4 mx-auto mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded-lg w-1/2 mx-auto"></div>
                </div>
                <div className="space-y-4">
                  <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                </div>
                <p className="text-foreground-500 text-sm">
                  {loadingLogo ? 'Loading clinic logo...' : 'Loading clinic information...'}
                </p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Show 404 state when clinic subdomain is detected but clinic not found
  if (hasClinicSubdomain && clinicNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Card className="w-full">
            <CardBody className="p-6 md:p-8 text-center">
              <div className="space-y-4">
                <Icon icon="lucide:building-x" className="text-6xl text-danger-500 mx-auto" />
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Clinic Not Found</h2>
                  <p className="text-foreground-600">
                    The clinic you're looking for could not be found. Please check the URL or contact support.
                  </p>
                </div>
                <Button
                  color="primary"
                  variant="bordered"
                  onPress={() => router.push('http://localhost:3000/signin')}
                  startContent={<Icon icon="lucide:home" />}
                >
                  Go to Main Portal
                </Button>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    );
  }

  // MFA Verification Form
  if (mfa.required) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Card className="w-full">
            <CardBody className="p-6 md:p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center">
                    <Icon icon="lucide:mail" className="text-3xl text-success-600" />
                  </div>
                </div>
                <h2 className="font-bold text-2xl text-foreground mb-2">Check Your Email</h2>
                <p className="text-foreground-600">
                  We sent a 6-digit verification code to<br />
                  <span className="font-medium text-foreground">{email}</span>
                </p>
                <p className="text-sm text-foreground-500 mt-2">
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
                      className="w-12 h-14 text-center text-2xl font-bold border-2 border-default-200 rounded-xl bg-default-50 text-foreground focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                <p className="text-xs text-center text-foreground-500">
                  Code expires in 5 minutes
                </p>

                <Button
                  type="submit"
                  color="success"
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
                  className="w-full flex items-center justify-center gap-2 text-sm text-foreground-500 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  className="w-full flex items-center justify-center gap-2 text-sm text-foreground-500 hover:text-foreground transition-colors"
                >
                  <Icon icon="lucide:arrow-left" className="w-4 h-4" />
                  Back to sign in
                </button>
              </div>

              {/* Security notice */}
              <div className="mt-6 text-center">
                <p className="text-xs text-foreground-400">
                  🔒 Two-factor authentication required for HIPAA compliance
                </p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <Card className="w-full">
          <CardBody className="p-6 md:p-8">
            {/* Logo and Title */}
            <div className="text-center mb-8">
              {clinic ? (
                <div className="space-y-4">
                  {/* Logo */}
                  <div className="flex justify-center">
                    <Avatar
                      src={clinic.logo || undefined}
                      icon={!clinic.logo ? <Icon icon="lucide:building" className="text-4xl" /> : undefined}
                      className="w-20 h-20"
                      classNames={{
                        base: clinic.logo ? "" : "bg-primary-100",
                        icon: "text-primary-600"
                      }}
                    />
                  </div>
                  {/* Clinic Name as Main Title */}
                  <div>
                    <div className="font-bold text-3xl text-foreground mb-2">
                      {clinic.name}
                    </div>
                    <p className="text-foreground-600">Sign in to your account</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-2xl text-foreground mb-2">
                    <span className="text-primary">Fuse</span> Health
                  </div>
                  <p className="text-foreground-600">Sign in to your account</p>
                </div>
              )}
            </div>

            {/* Success Message */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-success-50 border border-success-200 text-success-600 px-4 py-3 rounded-lg text-sm"
              >
                {successMessage}
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-danger-50 border border-danger-200 text-danger-600 px-4 py-3 rounded-lg text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Sign In Form */}
            <form onSubmit={handleSignIn} className="space-y-4">
              <Input
                type="email"
                label="Email"
                placeholder="Enter your email"
                value={email}
                onValueChange={setEmail}
                startContent={
                  <Icon icon="lucide:mail" className="text-foreground-400" />
                }
                variant="bordered"
                isRequired
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onValueChange={setPassword}
                startContent={
                  <Icon icon="lucide:lock" className="text-foreground-400" />
                }
                endContent={
                  <button
                    className="focus:outline-none"
                    type="button"
                    onClick={toggleVisibility}
                  >
                    {isVisible ? (
                      <Icon
                        icon="lucide:eye-off"
                        className="text-foreground-400"
                      />
                    ) : (
                      <Icon
                        icon="lucide:eye"
                        className="text-foreground-400"
                      />
                    )}
                  </button>
                }
                type={isVisible ? "text" : "password"}
                variant="bordered"
                isRequired
              />

              <div className="flex items-center justify-between">
                <Link href="/forgot-password">
                  <span className="text-sm text-primary hover:text-primary-600 cursor-pointer">
                    Forgot password?
                  </span>
                </Link>
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
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-content3"></div>
              <span className="px-3 text-sm text-foreground-500">or</span>
              <div className="flex-1 border-t border-content3"></div>
            </div>

            {/* Social Sign In */}
            <div className="space-y-3">
              <Button
                variant="bordered"
                className="w-full"
                startContent={
                  <Icon icon="flat-color-icons:google" className="text-lg" />
                }
              >
                Continue with Google
              </Button>
            </div>

            {/* Sign Up Link */}
            <div className="text-center mt-6">
              <span className="text-foreground-600">Don't have an account? </span>
              <Link href="/signup">
                <span className="text-primary hover:text-primary-600 cursor-pointer font-medium">
                  Sign up
                </span>
              </Link>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}