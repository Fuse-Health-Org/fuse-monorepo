import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, checkAuth, signOut } from '../lib/auth';
import { useRouter } from 'next/router';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = ['/signin', '/signup', '/onboarding', '/forgot-password'];

const isPublicRoute = (pathname: string) => {
  return PUBLIC_PATHS.includes(pathname);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
  }, [router.pathname]);

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

