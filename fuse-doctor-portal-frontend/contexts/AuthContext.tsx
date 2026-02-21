import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react'
import { useRouter } from 'next/router'
import { ApiClient } from '@/lib/api'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
const REFRESH_THRESHOLD_MS  =  5 * 60 * 1000
const ACTIVITY_CHECK_MS     = 60 * 1000

function parseJWT(token: string): { exp?: number } | null {
  try { return JSON.parse(atob(token.split('.')[1])) } catch { return null }
}

interface User {
    id: string
    email: string
    name: string
    role: string
    firstName?: string
    lastName?: string
    phone?: string
    userRoles?: {
        patient?: boolean
        doctor?: boolean
        admin?: boolean
        brand?: boolean
        affiliate?: boolean
        superAdmin?: boolean
    }
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
    signup: (email: string, password: string, name: string) => Promise<boolean>
    logout: (options?: { message?: string }) => void
    overrideToken: (newToken: string) => void
    authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit & { skipLogoutOn401?: boolean }) => Promise<Response>
    apiClient: ApiClient
    isLoading: boolean
    error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mfa, setMfa] = useState<MfaState>({ required: false, token: null, resendsRemaining: 3 })
    const router = useRouter()

    const tokenRef         = useRef<string | null>(null)
    const lastActivityRef  = useRef<number>(Date.now())
    const activityCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => { tokenRef.current = token }, [token])

    const recordActivity = () => { lastActivityRef.current = Date.now() }

    const stopActivityTracking = () => {
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
        events.forEach(e => window.removeEventListener(e, recordActivity))
        if (activityCheckRef.current) { clearInterval(activityCheckRef.current); activityCheckRef.current = null }
    }

    const silentRefresh = async (currentToken: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${currentToken}` },
            })
            if (res.ok) {
                const data = await res.json()
                if (data.success && data.token) {
                    localStorage.setItem('doctor_token', data.token)
                    if (data.user) localStorage.setItem('doctor_user', JSON.stringify(data.user))
                    setToken(data.token)
                    if (data.user) setUser(data.user)
                    console.log('🔄 [Auth] Doctor token refreshed (user active)')
                }
            } else {
                stopActivityTracking()
                handleUnauthorized()
            }
        } catch { /* network error — retry next tick */ }
    }

    const startActivityTracking = () => {
        lastActivityRef.current = Date.now()
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
        events.forEach(e => window.addEventListener(e, recordActivity, { passive: true }))
        if (activityCheckRef.current) clearInterval(activityCheckRef.current)
        activityCheckRef.current = setInterval(async () => {
            const t = tokenRef.current
            if (!t) return
            if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
                stopActivityTracking(); handleUnauthorized(); return
            }
            const payload = parseJWT(t)
            if (!payload?.exp) return
            if (payload.exp * 1000 - Date.now() < REFRESH_THRESHOLD_MS) await silentRefresh(t)
        }, ACTIVITY_CHECK_MS)
    }

    // Helper reused across unauthorized paths
    const handleUnauthorized = (message?: string) => {
        const logoutMessage = message || 'Your session has expired. Please sign in again.'

        localStorage.removeItem('doctor_token')
        localStorage.removeItem('doctor_user')

        setToken(null)
        setUser(null)
        setError(logoutMessage)
        stopActivityTracking()

        if (router.pathname !== '/signin') {
            router.push(`/signin?message=${encodeURIComponent(logoutMessage)}`)
        }
    }

    const logout = ({ message }: { message?: string } = {}) => {
        localStorage.removeItem('doctor_token')
        localStorage.removeItem('doctor_user')

        setToken(null)
        setUser(null)
        setError(message ?? null)
        stopActivityTracking()

        if (router.pathname !== '/signin') {
            router.push(message ? `/signin?message=${encodeURIComponent(message)}` : '/signin')
        }
    }

    const authenticatedFetch = async (
        input: RequestInfo | URL,
        init: RequestInit & { skipLogoutOn401?: boolean } = {}
    ): Promise<Response> => {
        const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('doctor_token') : null)
        const headers = new Headers(init.headers || {})

        if (activeToken && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${activeToken}`)
        }

        const response = await fetch(input, {
            ...init,
            headers,
            credentials: init.credentials ?? 'include',
        })

        if (response.status === 401 && !init.skipLogoutOn401) {
            handleUnauthorized()
            throw new Error('unauthorized')
        }

        return response
    }

    // Check for existing token on mount
    useEffect(() => {
        const storedToken = typeof window !== 'undefined' ? localStorage.getItem('doctor_token') : null
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('doctor_user') : null

        if (storedToken && storedUser) {
            try {
                const userData = JSON.parse(storedUser)
                setToken(storedToken)
                setUser(userData)
                startActivityTracking()
            } catch (error) {
                localStorage.removeItem('doctor_token')
                localStorage.removeItem('doctor_user')
            }
        }

        setIsLoading(false)
        return () => stopActivityTracking()
    }, [])

    const login = async (email: string, password: string): Promise<boolean | 'mfa_required'> => {
        setIsLoading(true)
        setError(null)

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const response = await fetch(`${apiUrl}/auth/signin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Portal-Context': 'doctor',
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

                const { token: authToken, user: userData } = data

                localStorage.setItem('doctor_token', authToken)
                localStorage.setItem('doctor_user', JSON.stringify(userData))

                setToken(authToken)
                setUser(userData)
                startActivityTracking()

                setIsLoading(false)
                return true
            } else {
                // Check if it's a pending approval error
                if (data.pendingApproval) {
                    setError(data.message || 'Your doctor application is under review.')
                } else {
                    setError(data.message || 'Login failed')
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
                    'X-Portal-Context': 'doctor',
                },
                body: JSON.stringify({ mfaToken: mfa.token, code }),
            })

            const data = await response.json()

            if (response.ok && data.success) {
                const { token: authToken, user: userData } = data

                localStorage.setItem('doctor_token', authToken)
                localStorage.setItem('doctor_user', JSON.stringify(userData))

                setToken(authToken)
                setUser(userData)
                setMfa({ required: false, token: null, resendsRemaining: 3 })
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
                    role: 'doctor',
                }),
            })

            const data = await response.json()

            if (response.ok && data.success) {
                const { token: authToken, user: userData } = data

                localStorage.setItem('doctor_token', authToken)
                localStorage.setItem('doctor_user', JSON.stringify(userData))

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

    const apiClient = useMemo(() => new ApiClient(authenticatedFetch), [token])

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                login,
                verifyMfa,
                resendMfaCode,
                cancelMfa,
                mfa,
                signup,
                logout,
                overrideToken: (newToken: string) => {
                    localStorage.setItem('doctor_token', newToken)
                    setToken(newToken)
                },
                authenticatedFetch,
                apiClient,
                isLoading,
                error,
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

