import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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
  logout: () => void
  isLoading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mfa, setMfa] = useState<MfaState>({ required: false, token: null, resendsRemaining: 3 })
  const router = useRouter()

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('tenant_token')
    const storedUser = localStorage.getItem('tenant_user')

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        setToken(storedToken)
        setUser(userData)
      } catch (error) {
        // Clear invalid stored data
        localStorage.removeItem('tenant_token')
        localStorage.removeItem('tenant_user')
      }
    }
    setIsLoading(false)
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

  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('tenant_token')
    localStorage.removeItem('tenant_user')

    // Clear state
    setToken(null)
    setUser(null)
    setError(null)

    // Redirect to signin
    router.push('/signin')
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