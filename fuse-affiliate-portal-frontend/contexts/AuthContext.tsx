import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, checkAuth, signOut } from '../lib/auth';
import { useRouter } from 'next/router';

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
  refreshUser: () => Promise<User | null>;
  overrideToken: (newToken: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = ['/signin', '/signup', '/forgot-password'];

const isPublicRoute = (pathname: string) => {
  return PUBLIC_PATHS.includes(pathname);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const lastActivityRef  = useRef<number>(Date.now());
  const activityCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
              console.log('🔄 [Auth] Affiliate token refreshed (user active)');
            }
          }
        } catch { /* retry next tick */ }
      }
    }, ACTIVITY_CHECK_MS);
  };

  const refreshUser = async () => {
    try {
      const userData = await checkAuth();
      console.log('🔄 AuthContext - User refreshed:', userData ? { id: userData.id, email: userData.email, role: userData.role } : 'null');
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('❌ Failed to refresh user:', error);
      setUser(null);
      return null;
    }
  };

  const handleSignOut = async () => {
    try {
      stopTokenRefresh();
      localStorage.removeItem('auth-token');
      await signOut();
      setUser(null);
      router.push('/signin');
    } catch (error) {
      console.error('Sign out failed');
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const publicRoute = isPublicRoute(router.pathname);

      if (!publicRoute) {
        await refreshUser();
      }
      setLoading(false);
    };

    initAuth();
    return () => stopTokenRefresh();
  }, [router.pathname]);

  // Start/stop token refresh alongside authentication state
  useEffect(() => {
    const publicRoute = isPublicRoute(router.pathname);
    if (user && !publicRoute) {
      startTokenRefresh();
    } else {
      stopTokenRefresh();
    }
  }, [user, router.pathname]);

  // Redirect to signin if user becomes unauthenticated
  useEffect(() => {
    const publicRoute = isPublicRoute(router.pathname);
    if (!loading && !user && !publicRoute) {
      router.push('/signin');
    }
  }, [user, loading, router]);

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

