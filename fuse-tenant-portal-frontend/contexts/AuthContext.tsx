import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useRouter } from 'next/router'

interface User {
  id: string
  email: string
  name: string
  role: string
  organization?: string
}

interface MfaState {
  required: boolean
  token: string | null
  resendsRemaining: number
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<boolean | 'mfa_required'>
  verifyMfa: (code: string) => Promise<boolean>
  resendMfaCode: () => Promise<boolean>
  cancelMfa: () => void
  mfa: MfaState
  logout: (opts?: { message?: string }) => void
  handleUnauthorized: () => void
  overrideToken: (newToken: string) => void
  isLoading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000   // 30 min of no activity → log out
const REFRESH_THRESHOLD_MS  = 5  * 60 * 1000   // refresh token when < 5 min remain
const ACTIVITY_CHECK_MS     = 60 * 1000         // check every 60 seconds

// Decode JWT payload without a library
function parseJWT(token: string): { exp?: number } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mfa, setMfa] = useState<MfaState>({ required: false, token: null, resendsRemaining: 3 })
  const router = useRouter()

  // Refs so closures always see latest values without re-registering effects
  const tokenRef      = useRef<string | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const activityCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep tokenRef in sync with state
  useEffect(() => { tokenRef.current = token }, [token])

  // ── Activity tracking ──────────────────────────────────────────────────────
  const recordActivity = () => { lastActivityRef.current = Date.now() }

  const startActivityTracking = () => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, recordActivity, { passive: true }))

    if (activityCheckRef.current) clearInterval(activityCheckRef.current)

    activityCheckRef.current = setInterval(async () => {
      const currentToken = tokenRef.current
      if (!currentToken) return

      const inactiveFor = Date.now() - lastActivityRef.current

      // Inactivity timeout — log the user out
      if (inactiveFor >= INACTIVITY_TIMEOUT_MS) {
        console.warn('⏱️ [Auth] Inactivity timeout reached, logging out')
        stopActivityTracking()
        handleUnauthorized()
        return
      }

      // Proactive refresh — only when user is active and token is near expiry
      const payload = parseJWT(currentToken)
      if (!payload?.exp) return
      const expiresIn = payload.exp * 1000 - Date.now()
      if (expiresIn < REFRESH_THRESHOLD_MS) {
        await silentRefresh(currentToken)
      }
    }, ACTIVITY_CHECK_MS)

    return () => {
      events.forEach(e => window.removeEventListener(e, recordActivity))
      if (activityCheckRef.current) clearInterval(activityCheckRef.current)
    }
  }

  const stopActivityTracking = () => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.removeEventListener(e, recordActivity))
    if (activityCheckRef.current) {
      clearInterval(activityCheckRef.current)
      activityCheckRef.current = null
    }
  }

  const silentRefresh = async (currentToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.token) {
          localStorage.setItem('tenant_token', data.token)
          if (data.user) localStorage.setItem('tenant_user', JSON.stringify(data.user))
          setToken(data.token)
          if (data.user) setUser(data.user)
          console.log('🔄 [Auth] Token refreshed (user active)')
        }
      } else {
        console.warn('⚠️ [Auth] Silent refresh failed, logging out')
        stopActivityTracking()
        handleUnauthorized()
      }
    } catch {
      // Network error — will retry on next interval
    }
  }

  const handleUnauthorized = () => {
    localStorage.removeItem('tenant_token')
    localStorage.removeItem('tenant_user')
    setToken(null)
    setUser(null)
    stopActivityTracking()
    router.push('/signin')
  }

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('tenant_token')
    const storedUser  = localStorage.getItem('tenant_user')

    if (storedToken && storedUser) {
      try {
        const payload = parseJWT(storedToken)
        const expired = payload?.exp && payload.exp * 1000 < Date.now()
        if (expired) {
          localStorage.removeItem('tenant_token')
          localStorage.removeItem('tenant_user')
        } else {
          const userData = JSON.parse(storedUser)
          setToken(storedToken)
          setUser(userData)
          startActivityTracking()
        }
      } catch {
        localStorage.removeItem('tenant_token')
        localStorage.removeItem('tenant_user')
      }
    }
    setIsLoading(false)

    return () => stopActivityTracking()
  }, [])

  const login = async (email: string, password: string): Promise<boolean | 'mfa_required'> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Check if MFA is required
        if (data.requiresMfa && data.mfaToken) {
          setMfa({ required: true, token: data.mfaToken, resendsRemaining: 3 })
          setIsLoading(false)
          return 'mfa_required'
        }

        const authToken = data.token as string
        const userData = data.user as User

        // Store in localStorage
        localStorage.setItem('tenant_token', authToken)
        localStorage.setItem('tenant_user', JSON.stringify(userData))

        // Update state
        setToken(authToken)
        setUser(userData)
        lastActivityRef.current = Date.now()
        startActivityTracking()

        setIsLoading(false)
        return true
      } else {
        setError(data.message || 'Login failed')
        setIsLoading(false)
        return false
      }
    } catch (error) {
      setError('Network error. Please try again.')
      setIsLoading(false)
      return false
    }
  }

  const verifyMfa = async (code: string): Promise<boolean> => {
    if (!mfa.token) {
      setError('MFA session expired. Please sign in again.')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mfaToken: mfa.token, code }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const authToken = data.token as string
        const userData = data.user as User

        localStorage.setItem('tenant_token', authToken)
        localStorage.setItem('tenant_user', JSON.stringify(userData))

        setToken(authToken)
        setUser(userData)
        setMfa({ required: false, token: null, resendsRemaining: 3 })
        lastActivityRef.current = Date.now()
        startActivityTracking()

        setIsLoading(false)
        return true
      } else {
        if (data.expired) {
          setMfa({ required: false, token: null, resendsRemaining: 3 })
          setError('Verification code expired. Please sign in again.')
        } else if (data.rateLimited) {
          setMfa({ required: false, token: null, resendsRemaining: 3 })
          setError('Too many failed attempts. Please sign in again.')
        } else {
          setError(data.message || 'Invalid verification code')
        }
        setIsLoading(false)
        return false
      }
    } catch (error) {
      setError('Network error. Please try again.')
      setIsLoading(false)
      return false
    }
  }

  const resendMfaCode = async (): Promise<boolean> => {
    if (!mfa.token) {
      setError('MFA session expired. Please sign in again.')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mfaToken: mfa.token }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMfa(prev => ({ ...prev, resendsRemaining: data.resendsRemaining ?? prev.resendsRemaining - 1 }))
        setIsLoading(false)
        return true
      } else {
        if (data.maxResends) {
          setMfa({ required: false, token: null, resendsRemaining: 0 })
          setError('Maximum resend attempts reached. Please sign in again.')
        } else {
          setError(data.message || 'Failed to resend code')
        }
        setIsLoading(false)
        return false
      }
    } catch (error) {
      setError('Network error. Please try again.')
      setIsLoading(false)
      return false
    }
  }

  const cancelMfa = () => {
    setMfa({ required: false, token: null, resendsRemaining: 3 })
    setError(null)
  }

  const logout = (opts?: { message?: string }) => {
    localStorage.removeItem('tenant_token')
    localStorage.removeItem('tenant_user')
    setToken(null)
    setUser(null)
    setError(null)
    stopActivityTracking()
    const destination = opts?.message
      ? `/signin?message=${encodeURIComponent(opts.message)}`
      : '/signin'
    router.push(destination)
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      verifyMfa,
      resendMfaCode,
      cancelMfa,
      mfa,
      logout,
      handleUnauthorized,
      overrideToken: (newToken: string) => {
        localStorage.setItem('tenant_token', newToken)
        setToken(newToken)
      },
      isLoading,
      error
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}