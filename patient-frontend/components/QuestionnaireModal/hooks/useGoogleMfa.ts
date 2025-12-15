import { useState, useRef, useCallback } from "react";
import { authApi } from "../../../lib/api";

interface GoogleMfaState {
    isGoogleMfaMode: boolean;
    googleMfaToken: string;
    googleMfaEmail: string;
    googleMfaCode: string[];
    googleMfaError: string;
    isVerifyingGoogleMfa: boolean;
}

interface GoogleMfaActions {
    setIsGoogleMfaMode: (mode: boolean) => void;
    setGoogleMfaToken: (token: string) => void;
    setGoogleMfaEmail: (email: string) => void;
    setGoogleMfaCode: (code: string[]) => void;
    setGoogleMfaError: (error: string) => void;
    handleGoogleMfaInput: (index: number, value: string) => void;
    handleGoogleMfaKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
    handleGoogleMfaPaste: (e: React.ClipboardEvent) => void;
    handleGoogleMfaVerify: () => Promise<void>;
    handleGoogleMfaCancel: () => void;
    googleMfaInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
}

export function useGoogleMfa(
    setAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    setPatientFirstName: React.Dispatch<React.SetStateAction<string>>,
    setPatientName: React.Dispatch<React.SetStateAction<string>>,
    setUserId: React.Dispatch<React.SetStateAction<string | null>>,
    setAccountCreated: React.Dispatch<React.SetStateAction<boolean>>,
    answers: Record<string, any>
): GoogleMfaState & GoogleMfaActions {
    const [isGoogleMfaMode, setIsGoogleMfaMode] = useState(false);
    const [googleMfaToken, setGoogleMfaToken] = useState('');
    const [googleMfaEmail, setGoogleMfaEmail] = useState('');
    const [googleMfaCode, setGoogleMfaCode] = useState<string[]>(['', '', '', '', '', '']);
    const [googleMfaError, setGoogleMfaError] = useState('');
    const [isVerifyingGoogleMfa, setIsVerifyingGoogleMfa] = useState(false);
    const googleMfaInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleGoogleMfaInput = useCallback((index: number, value: string) => {
        if (!/^\d*$/.test(value)) return; // Only allow digits

        setGoogleMfaCode(prev => {
            const newCode = [...prev];
            newCode[index] = value.slice(-1); // Only keep last digit
            return newCode;
        });
        setGoogleMfaError('');

        // Auto-focus next input
        if (value && index < 5) {
            googleMfaInputRefs.current[index + 1]?.focus();
        }
    }, []);

    const handleGoogleMfaKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !googleMfaCode[index] && index > 0) {
            googleMfaInputRefs.current[index - 1]?.focus();
        }
    }, [googleMfaCode]);

    const handleGoogleMfaPaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pastedData.length > 0) {
            const newCode = ['', '', '', '', '', ''];
            for (let i = 0; i < pastedData.length; i++) {
                newCode[i] = pastedData[i];
            }
            setGoogleMfaCode(newCode);
            // Focus on the next empty input or last input
            const nextEmptyIndex = Math.min(pastedData.length, 5);
            googleMfaInputRefs.current[nextEmptyIndex]?.focus();
        }
    }, []);

    const handleGoogleMfaVerify = useCallback(async () => {
        const code = googleMfaCode.join('');
        if (code.length !== 6 || !googleMfaToken) {
            setGoogleMfaError('Please enter the 6-digit code');
            return;
        }

        setIsVerifyingGoogleMfa(true);
        setGoogleMfaError('');

        try {
            console.log('🔐 [GOOGLE MFA] Verifying code...');
            const result = await authApi.verifyMfa(googleMfaToken, code);

            if (result.success && result.data) {
                console.log('✅ [GOOGLE MFA] Verification successful');

                // Store JWT token
                if (result.data.token) {
                    localStorage.setItem('auth-token', result.data.token);
                }

                // Get user data from the response
                const userData = result.data.user;
                if (userData) {
                    // Pre-fill the form with user's existing data
                    const newAnswers = {
                        ...answers,
                        firstName: userData.firstName || '',
                        lastName: userData.lastName || '',
                        email: userData.email || googleMfaEmail,
                        mobile: userData.phoneNumber || ''
                    };

                    setAnswers(newAnswers);

                    // Set patient variables
                    const firstName = userData.firstName || '';
                    const lastName = userData.lastName || '';
                    const fullName = `${firstName} ${lastName}`.trim();
                    setPatientFirstName(firstName);
                    setPatientName(fullName);

                    // Mark as already having an account
                    setUserId(userData.id);
                    setAccountCreated(true);

                    console.log('✅ [GOOGLE MFA] User data set, account created');
                } else {
                    // No user data in response, but token is valid
                    // Mark as signed in with email
                    setAnswers(prev => ({ ...prev, email: googleMfaEmail }));
                    setAccountCreated(true);
                    console.log('✅ [GOOGLE MFA] Token stored, user authenticated');
                }

                // Exit MFA mode
                setIsGoogleMfaMode(false);
                setGoogleMfaToken('');
                setGoogleMfaEmail('');
                setGoogleMfaCode(['', '', '', '', '', '']);

            } else {
                // Handle specific error cases
                if (result.data?.expired) {
                    setGoogleMfaError('Verification code expired. Please sign in again.');
                    setTimeout(() => {
                        setIsGoogleMfaMode(false);
                    }, 2000);
                } else if (result.data?.rateLimited) {
                    setGoogleMfaError('Too many failed attempts. Please sign in again.');
                    setTimeout(() => {
                        setIsGoogleMfaMode(false);
                    }, 2000);
                } else {
                    const attemptsRemaining = result.data?.attemptsRemaining;
                    setGoogleMfaError(
                        attemptsRemaining
                            ? `Invalid code. ${attemptsRemaining} attempts remaining.`
                            : result.error || 'Invalid verification code'
                    );
                    setGoogleMfaCode(['', '', '', '', '', '']);
                    googleMfaInputRefs.current[0]?.focus();
                }
            }
        } catch (error) {
            console.error('❌ [GOOGLE MFA] Verification error:', error);
            setGoogleMfaError('Verification failed. Please try again.');
            setGoogleMfaCode(['', '', '', '', '', '']);
            googleMfaInputRefs.current[0]?.focus();
        } finally {
            setIsVerifyingGoogleMfa(false);
        }
    }, [googleMfaCode, googleMfaToken, googleMfaEmail, answers, setAnswers, setPatientFirstName, setPatientName, setUserId, setAccountCreated]);

    const handleGoogleMfaCancel = useCallback(() => {
        setIsGoogleMfaMode(false);
        setGoogleMfaToken('');
        setGoogleMfaEmail('');
        setGoogleMfaCode(['', '', '', '', '', '']);
        setGoogleMfaError('');
    }, []);

    return {
        isGoogleMfaMode,
        googleMfaToken,
        googleMfaEmail,
        googleMfaCode,
        googleMfaError,
        isVerifyingGoogleMfa,
        setIsGoogleMfaMode,
        setGoogleMfaToken,
        setGoogleMfaEmail,
        setGoogleMfaCode,
        setGoogleMfaError,
        handleGoogleMfaInput,
        handleGoogleMfaKeyDown,
        handleGoogleMfaPaste,
        handleGoogleMfaVerify,
        handleGoogleMfaCancel,
        googleMfaInputRefs
    };
}

