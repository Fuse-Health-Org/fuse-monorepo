import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/router'

interface User {
  id: string
  email: string
  name: string
  role: string
  firstName?: string
  lastName?: string
  companyName?: string
  phone?: string
  phoneNumber?: string
  website?: string
  clinicId?: string
}

interface Subscription {
  id: string
  planId: string | null
  status: string
  stripeSubscriptionId?: string
  stripePriceId?: string | null
  plan?: {
    name: string
    price: number
    type: string
    priceId?: string
  }
  nextBillingDate?: string
  monthlyPrice?: number
  tierConfig?: {
    canAddCustomProducts?: boolean
    hasAccessToAnalytics?: boolean
    hasCustomPortal?: boolean
    hasPrograms?: boolean
    canCustomizeFormStructure?: boolean
    fuseFeePercent?: number | null
    nonMedicalProfitPercent?: number | null
    merchantServiceFeePercent?: number | null
  } | null
  customFeatures?: {
    canAddCustomProducts?: boolean
    hasAccessToAnalytics?: boolean
    hasCustomPortal?: boolean
    hasPrograms?: boolean
    canCustomizeFormStructure?: boolean
  } | null
}

interface MfaState {
  required: boolean
  token: string | null
  resendsRemaining: number
}

interface AuthContextType {
  user: User | null
  token: string | null
  subscription: Subscription | null
  hasActiveSubscription: boolean
  login: (email: string, password: string) => Promise<boolean | 'mfa_required'>
  verifyMfa: (code: string) => Promise<boolean>
  resendMfaCode: () => Promise<boolean>
  cancelMfa: () => void
  mfa: MfaState
  signup: (email: string, password: string, name: string) => Promise<boolean>
  logout: (options?: { message?: string }) => void
  refreshSubscription: () => Promise<void>
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit & { skipLogoutOn401?: boolean }) => Promise<Response>
  isLoading: boolean
  isSubscriptionLoading: boolean
  error: string | null
  /** Dev helper: replace the active token in both state and localStorage */
  overrideToken: (newToken: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mfa, setMfa] = useState<MfaState>({ required: false, token: null, resendsRemaining: 3 })
  const router = useRouter()

  // Helper reused across unauthorized paths
  const handleUnauthorized = (message?: string) => {
    const logoutMessage = message || 'Your session has expired. Please sign in again.'

    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')

    setToken(null)
    setUser(null)
    setSubscription(null)
    setError(logoutMessage)

    if (router.pathname !== '/signin') {
      router.push(`/signin?message=${encodeURIComponent(logoutMessage)}`)
    }
  }

  const logout = ({ message }: { message?: string } = {}) => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')

    setToken(null)
    setUser(null)
    setSubscription(null)
    setError(message ?? null)

    if (router.pathname !== '/signin') {
      router.push(message ? `/signin?message=${encodeURIComponent(message)}` : '/signin')
    }
  }

  const authenticatedFetch = async (
    input: RequestInfo | URL,
    init: RequestInit & { skipLogoutOn401?: boolean } = {}
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    console.log('🔐 [Auth] authenticatedFetch called for:', url)

    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null)
    console.log('🔐 [Auth] Token present:', !!activeToken)

    const headers = new Headers(init.headers || {})

    if (activeToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${activeToken}`)
    }

    console.log('🔐 [Auth] Sending request...')
    const response = await fetch(input, {
      ...init,
      headers,
      credentials: init.credentials ?? 'include',
    })

    console.log('🔐 [Auth] Response status:', response.status, 'for', url)

    if (response.status === 401 && !init.skipLogoutOn401) {
      console.log('❌ [Auth] 401 Unauthorized - logging out user')
      handleUnauthorized()
      throw new Error('unauthorized')
    }

    return response
  }

  // Check for existing token on mount or impersonation token in URL
  useEffect(() => {
    const checkAuth = async () => {
      // Check for impersonation token in URL
      const urlParams = new URLSearchParams(window.location.search)
      const impersonateToken = urlParams.get('impersonateToken')

      if (impersonateToken) {
        console.log('🎭 [Impersonation] Token found in URL, fetching user data...')

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
          const response = await fetch(`${apiUrl}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${impersonateToken}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.user) {
              console.log('✅ [Impersonation] User data fetched successfully')

              // Store token and user data
              localStorage.setItem('admin_token', impersonateToken)
              localStorage.setItem('admin_user', JSON.stringify(data.user))

              setToken(impersonateToken)
              setUser(data.user)

              // Clean up URL by removing the impersonateToken parameter
              urlParams.delete('impersonateToken')
              const newUrl = urlParams.toString()
                ? `${window.location.pathname}?${urlParams.toString()}`
                : window.location.pathname
              window.history.replaceState({}, '', newUrl)

              setIsLoading(false)
              return
            }
          }

          console.error('❌ [Impersonation] Failed to fetch user data with impersonation token')
        } catch (error) {
          console.error('❌ [Impersonation] Error:', error)
        }
      }

      // Fallback to checking for stored token
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('admin_user') : null

      if (storedToken && storedUser) {
        try {
          // Validate the stored token with the server
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
          const response = await fetch(`${apiUrl}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.user) {
              // Token is valid, use the fresh user data from server
              localStorage.setItem('admin_user', JSON.stringify(data.user))
              setToken(storedToken)
              setUser(data.user)
            } else {
              // Token validation failed, clear storage
              console.log('🔐 [Auth] Token validation failed - clearing session')
              localStorage.removeItem('admin_token')
              localStorage.removeItem('admin_user')
            }
          } else if (response.status === 401) {
            // Token expired or invalid
            console.log('🔐 [Auth] Token expired (401) - clearing session')
            localStorage.removeItem('admin_token')
            localStorage.removeItem('admin_user')
            
            // Only redirect if we're not already on signin page
            if (router.pathname !== '/signin') {
              const message = 'Your session has expired. Please sign in again.'
              router.push(`/signin?message=${encodeURIComponent(message)}`)
            }
          } else {
            // Other error - keep the cached data but log it
            console.error('🔐 [Auth] Token validation request failed:', response.status)
            const userData = JSON.parse(storedUser)
            setToken(storedToken)
            setUser(userData)
          }
        } catch (error) {
          console.error('🔐 [Auth] Network error validating token:', error)
          // On network error, use cached data (offline support)
          try {
            const userData = JSON.parse(storedUser)
            setToken(storedToken)
            setUser(userData)
          } catch {
            localStorage.removeItem('admin_token')
            localStorage.removeItem('admin_user')
          }
        }
      }

      setIsLoading(false)
    }

    checkAuth()
  }, [])

  // Fetch subscription data when user or token changes
  useEffect(() => {
    if (user && token) {
      refreshSubscription()
    } else {
      setSubscription(null)
      setIsSubscriptionLoading(false)
    }
  }, [user, token])

  const login = async (email: string, password: string): Promise<boolean | 'mfa_required'> => {
    setIsLoading(true)
    setError(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      console.log('🔐 [AuthContext] Starting login for:', email)
      console.log('🔐 [AuthContext] API URL:', `${apiUrl}/auth/signin`)

      const response = await fetch(`${apiUrl}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      console.log('🔐 [AuthContext] Response status:', response.status, response.statusText)

      const data = await response.json()
      console.log('🔐 [AuthContext] Response data:', {
        success: data.success,
        requiresMfa: data.requiresMfa,
        hasMfaToken: !!data.mfaToken,
        message: data.message,
      })

      if (response.ok && data.success) {
        // Check if MFA is required
        if (data.requiresMfa && data.mfaToken) {
          console.log('✅ [AuthContext] MFA required - verification email should have been sent!')
          setMfa({ required: true, token: data.mfaToken, resendsRemaining: 3 })
          setIsLoading(false)
          return 'mfa_required'
        }

        // Direct login (no MFA) - shouldn't happen with new flow but kept for compatibility
        console.log('✅ [AuthContext] Direct login (no MFA)')
        const { token: authToken, user: userData } = data

        localStorage.setItem('admin_token', authToken)
        localStorage.setItem('admin_user', JSON.stringify(userData))

        setToken(authToken)
        setUser(userData)

        setIsLoading(false)
        return true
      } else {
        console.error('❌ [AuthContext] Login failed:', data.message)
        setError(data.message || 'Login failed')
        setIsLoading(false)
        return false
      }
    } catch (error) {
      console.error('❌ [AuthContext] Network error:', error)
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mfaToken: mfa.token, code }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const { token: authToken, user: userData } = data

        localStorage.setItem('admin_token', authToken)
        localStorage.setItem('admin_user', JSON.stringify(userData))

        setToken(authToken)
        setUser(userData)
        setMfa({ required: false, token: null, resendsRemaining: 3 })

        setIsLoading(false)
        return true
      } else {
        // Handle specific error cases
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/auth/mfa/resend`, {
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

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const [firstName, ...lastNameParts] = name.split(' ')
      const lastName = lastNameParts.join(' ') || ''

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          role: 'brand',
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const { token: authToken, user: userData } = data

        localStorage.setItem('admin_token', authToken)
        localStorage.setItem('admin_user', JSON.stringify(userData))

        setToken(authToken)
        setUser(userData)

        setIsLoading(false)
        return true
      } else {
        setError(data.message || 'Signup failed')
        setIsLoading(false)
        return false
      }
    } catch (error) {
      setError('Network error. Please try again.')
      setIsLoading(false)
      return false
    }
  }

  const refreshSubscription = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    setIsSubscriptionLoading(true)
    try {
      const response = await authenticatedFetch(`${apiUrl}/subscriptions/current`, {
        method: 'GET',
        skipLogoutOn401: true,
      })

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (response.ok) {
        const subscriptionData = await response.json()
        setSubscription(subscriptionData)
      } else {
        setSubscription(null)
      }
    } catch (error) {
      if ((error as Error).message === 'unauthorized') {
        return
      }
      console.error('Error fetching subscription:', error)
      setSubscription(null)
    } finally {
      setIsSubscriptionLoading(false)
    }
  }

  const hasActiveSubscription = subscription?.status === 'active'

  const overrideToken = (newToken: string) => {
    localStorage.setItem('admin_token', newToken)
    setToken(newToken)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        subscription,
        hasActiveSubscription,
        login,
        verifyMfa,
        resendMfaCode,
        cancelMfa,
        mfa,
        signup,
        logout,
        refreshSubscription,
        authenticatedFetch,
        isLoading,
        isSubscriptionLoading,
        error,
        overrideToken,
      }}
    >
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