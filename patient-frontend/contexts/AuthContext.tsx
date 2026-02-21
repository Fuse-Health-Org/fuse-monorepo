import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, checkAuth, signOut, hasPatientFrontendAccess } from '../lib/auth';
import { useRouter } from 'next/router';
import { SessionTimeoutManager } from '../lib/sessionTimeout';
import { SessionWarning } from '../components/SessionWarning';
import { PUBLIC_PATH_PATTERNS } from '@fuse/enums';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
const REFRESH_THRESHOLD_MS  =  5 * 60 * 1000
const ACTIVITY_CHECK_MS     = 60 * 1000

function parseJWT(token: string): { exp?: number } | null {
  try { return JSON.parse(atob(token.split('.')[1])) } catch { return null }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  overrideToken: (newToken: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


// Extend base public paths locally for patient-frontend only
const PATIENT_PUBLIC_PATH_PATTERNS = [
  ...PUBLIC_PATH_PATTERNS,
  '/fuse-dashboard/my-products',
  '/fuse-dashboard/my-products/[...rest]',
  '/mdi-dashboard/my-products',
  '/mdi-dashboard/my-products/[...rest]',
  '/verify-email',
] as const

const matchesPublicPattern = (pattern: string, pathname: string, asPath: string) => {
  const cleanPattern = pattern.trim()
  if (!cleanPattern.includes('[')) {
    const ok = cleanPattern === pathname || cleanPattern === asPath
    console.log('[AuthContext] matchesPublicPattern static', { pattern: cleanPattern, pathname, asPath, ok })
    return ok
  }

  // Support Next.js style dynamic segments including catch-all and optional catch-all
  // [[...param]] => optional catch-all
  // [...param] => required catch-all
  // [param] => single segment
  const source = cleanPattern
    .replace(/\[\[\.\.\.(.+?)\]\]/g, '(?:.*)?')
    .replace(/\[\.\.\.(.+?)\]/g, '.+')
    .replace(/\[(.+?)\]/g, '[^/]+')

  const regex = new RegExp(`^${source}$`)
  const ok = regex.test(pathname) || regex.test(asPath)
  console.log('[AuthContext] matchesPublicPattern dynamic', { pattern: cleanPattern, source, regex: regex.toString(), pathname, asPath, ok })
  return ok
}

const isPublicRoute = (pathname: string, asPath: string) => {
  console.log('[AuthContext] isPublicRoute input', { pathname, asPath })
  if (pathname.includes('/fuse-dashboard/my-products') || asPath.includes('/fuse-dashboard/my-products') ||
      pathname.includes('/mdi-dashboard/my-products') || asPath.includes('/mdi-dashboard/my-products')) {
    console.log('[AuthContext] public via contains dashboard/my-products')
    return true
  }
  const result = PATIENT_PUBLIC_PATH_PATTERNS.some((pattern) => matchesPublicPattern(pattern as string, pathname, asPath))
  console.log('[AuthContext] isPublicRoute result', { result })
  return result
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes countdown
  const router = useRouter();
  const sessionManager    = React.useRef<SessionTimeoutManager | null>(null);
  const lastActivityRef   = useRef<number>(Date.now());
  const activityCheckRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordActivity = () => { lastActivityRef.current = Date.now(); };

  const stopTokenRefresh = () => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.removeEventListener(e, recordActivity));
    if (activityCheckRef.current) { clearInterval(activityCheckRef.current); activityCheckRef.current = null; }
  };

  const startTokenRefresh = () => {
    lastActivityRef.current = Date.now();
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, recordActivity, { passive: true }));
    if (activityCheckRef.current) clearInterval(activityCheckRef.current);
    activityCheckRef.current = setInterval(async () => {
      const t = localStorage.getItem('auth-token');
      if (!t) return;
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) { stopTokenRefresh(); return; }
      const payload = parseJWT(t);
      if (!payload?.exp) return;
      if (payload.exp * 1000 - Date.now() < REFRESH_THRESHOLD_MS) {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${t}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.token) {
              localStorage.setItem('auth-token', data.token);
              console.log('🔄 [Auth] Patient token refreshed (user active)');
            }
          }
        } catch { /* retry next tick */ }
      }
    }, ACTIVITY_CHECK_MS);
  };

  const refreshUser = async () => {
    try {
      const userData = await checkAuth();
      console.log('🔍 AuthContext - Loaded user data:', userData);
      console.log('🔍 AuthContext - User clinicId:', userData?.clinicId);
      
      // Check if currently impersonating (superAdmin viewing as patient)
      // This is now determined by the user.impersonating field from the JWT
      const isImpersonating = userData?.impersonating === true;
      
      // Check if user has valid access to patient-frontend (patient or brand role)
      // Skip this check if impersonating (superAdmin can view as patient)
      if (userData && !isImpersonating && !hasPatientFrontendAccess(userData)) {
        console.warn('⚠️ AuthContext - User does not have patient or brand role, denying access');
        setUser(null);
        return;
      }
      
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user');
      setUser(null);
    }
  };

  const handleSignOut = async () => {
    try {
      // Stop session timeout when signing out
      if (sessionManager.current) {
        sessionManager.current.stop();
      }
      setShowSessionWarning(false);
      stopTokenRefresh();

      // Remove JWT token from localStorage (using same key as api.ts)
      localStorage.removeItem('auth-token');
      // Clear impersonation flag on sign out
      localStorage.removeItem('impersonating');

      await signOut();
      setUser(null);
      router.push('/signin');
    } catch (error) {
      console.error('Sign out failed');
    }
  };

  const handleSessionWarning = () => {
    setShowSessionWarning(true);
    setCountdown(300); // 5 minutes

    // Start countdown
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSignOut(); // Auto logout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleExtendSession = () => {
    setShowSessionWarning(false);
    if (sessionManager.current) {
      sessionManager.current.resetTimer();
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const publicRoute = isPublicRoute(router.pathname, router.asPath.split('?')[0])
      console.log('[AuthContext] initAuth', { pathname: router.pathname, asPath: router.asPath, publicRoute })

      if (!publicRoute) {
        console.log('[AuthContext] initAuth -> protected route, refreshing user')
        await refreshUser();
      } else {
        console.log('[AuthContext] initAuth -> public route, skipping refreshUser')
      }
      setLoading(false);
    };

    initAuth();
  }, [router.pathname]);

  // Redirect to signin if user becomes unauthenticated
  useEffect(() => {
    const publicRoute = isPublicRoute(router.pathname, router.asPath.split('?')[0])
    console.log('[AuthContext] redirect check', { pathname: router.pathname, asPath: router.asPath, loading, hasUser: !!user, publicRoute })
    if (!loading && !user && !publicRoute) {
      console.log('[AuthContext] redirecting to /signin')
      router.push('/signin');
    }
  }, [user, loading, router]);

  // Initialize session timeout when user is authenticated
  useEffect(() => {
    const publicRoute = isPublicRoute(router.pathname, router.asPath.split('?')[0])
    if (user && !publicRoute) {
      // Initialize session manager
      if (!sessionManager.current) {
        sessionManager.current = new SessionTimeoutManager({
          onWarning: handleSessionWarning,
          onTimeout: handleSignOut,
        });
      }
      sessionManager.current.start();
      startTokenRefresh();
    } else if (sessionManager.current) {
      // Stop session manager when user is not authenticated or on public pages
      sessionManager.current.stop();
      stopTokenRefresh();
    }

    // Cleanup on unmount
    return () => {
      if (sessionManager.current) {
        sessionManager.current.stop();
      }
      stopTokenRefresh();
    };
  }, [user, router.pathname]);

  const value = {
    user,
    loading,
    signOut: handleSignOut,
    refreshUser,
    overrideToken: (newToken: string) => {
      localStorage.setItem('auth-token', newToken)
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionWarning
        isOpen={showSessionWarning}
        onExtendSession={handleExtendSession}
        onLogout={handleSignOut}
        countdown={countdown}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}