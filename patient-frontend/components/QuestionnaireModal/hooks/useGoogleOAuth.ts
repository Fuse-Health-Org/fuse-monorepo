import { useEffect, useRef } from "react";

interface GoogleMfaSetters {
  setIsGoogleMfaMode?: (mode: boolean) => void;
  setGoogleMfaToken?: (token: string) => void;
  setGoogleMfaEmail?: (email: string) => void;
  setGoogleMfaCode?: (code: string[]) => void;
  setGoogleMfaError?: (error: string) => void;
}

interface SignInModeSetters {
  setIsSignInOptionsMode?: (mode: boolean) => void;
  setIsPasswordSignInMode?: (mode: boolean) => void;
}

export function useGoogleOAuth(
  answers: Record<string, any>,
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  setPatientFirstName: React.Dispatch<React.SetStateAction<string>>,
  setPatientName: React.Dispatch<React.SetStateAction<string>>,
  setUserId: React.Dispatch<React.SetStateAction<string | null>>,
  setAccountCreated: React.Dispatch<React.SetStateAction<boolean>>,
  googleMfaSetters?: GoogleMfaSetters,
  signInModeSetters?: SignInModeSetters
) {
  const hasHandledGoogleAuthRef = useRef(false);

  // Reset Google OAuth flag when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      console.log('🧹 [CLEANUP] Resetting hasHandledGoogleAuthRef on component unmount');
      hasHandledGoogleAuthRef.current = false;
    };
  }, []);

  // Handle Google OAuth callback - set user data from URL params
  useEffect(() => {
    console.log('🔍 [GOOGLE OAUTH] Effect triggered, current URL:', window.location.href);
    const urlParams = new URLSearchParams(window.location.search);
    const googleAuth = urlParams.get('googleAuth');
    const token = urlParams.get('token');
    const userStr = urlParams.get('user');
    const skipAccount = urlParams.get('skipAccount');

    console.log('🔍 [GOOGLE OAUTH] URL params:', { googleAuth, hasToken: !!token, hasUser: !!userStr, skipAccount });
    console.log('🔍 [GOOGLE OAUTH] Full URL params object:', Object.fromEntries(urlParams.entries()));

    if (googleAuth === 'success' && token && userStr) {
      try {
        const userData = JSON.parse(decodeURIComponent(userStr));
        console.log('👤 [GOOGLE OAUTH] Parsed user data:', userData);

        // Pre-fill the form with user's data
        const newAnswers = {
          ...answers,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          mobile: userData.phoneNumber || ''
        };

        setAnswers(newAnswers);
        setPatientFirstName(userData.firstName);
        setPatientName(`${userData.firstName} ${userData.lastName}`.trim());
        setUserId(userData.id);
        setAccountCreated(true);

        // Exit any sign-in modes
        signInModeSetters?.setIsSignInOptionsMode?.(false);
        signInModeSetters?.setIsPasswordSignInMode?.(false);

        // Mark that we've handled Google OAuth - this prevents step reset
        hasHandledGoogleAuthRef.current = true;

        console.log('✅ [GOOGLE OAUTH] User data loaded, accountCreated set to true, marked as handled');

        // Clean URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

      } catch (error) {
        console.error('❌ [GOOGLE OAUTH] Failed to parse user data:', error);
      }
    } else if (googleAuth === 'mfa_required') {
      // MFA is required - show MFA verification UI
      const mfaToken = urlParams.get('mfaToken');
      const email = urlParams.get('email');
      console.log('🔐 [GOOGLE OAUTH] MFA required for email:', email);
      console.log('🔐 [GOOGLE OAUTH] MFA token:', mfaToken);

      if (mfaToken && email && googleMfaSetters) {
        // Set MFA state to show verification UI
        googleMfaSetters.setIsGoogleMfaMode?.(true);
        googleMfaSetters.setGoogleMfaToken?.(mfaToken);
        googleMfaSetters.setGoogleMfaEmail?.(decodeURIComponent(email));
        googleMfaSetters.setGoogleMfaCode?.(['', '', '', '', '', '']);
        googleMfaSetters.setGoogleMfaError?.('');

        // Exit other sign-in modes
        signInModeSetters?.setIsSignInOptionsMode?.(false);
        signInModeSetters?.setIsPasswordSignInMode?.(false);

        // Mark that we've handled Google OAuth
        hasHandledGoogleAuthRef.current = true;

        console.log('✅ [GOOGLE OAUTH] MFA mode activated, waiting for code verification');
      }

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleAuth === 'error') {
      alert('Google sign-in failed. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      console.log('ℹ️ [GOOGLE OAUTH] No Google OAuth params detected in URL');
    }
  }, []); // Run once on mount

  return { hasHandledGoogleAuthRef };
}
