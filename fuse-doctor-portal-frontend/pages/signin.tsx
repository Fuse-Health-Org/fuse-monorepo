import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Stethoscope, Mail, ArrowLeft, RefreshCw, FlaskConical } from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function SignIn() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [shortSession, setShortSession] = useState(false)
    const [mfaCode, setMfaCode] = useState(['', '', '', '', '', ''])
    const [resendCooldown, setResendCooldown] = useState(0)
    const { login, verifyMfa, resendMfaCode, cancelMfa, mfa, overrideToken, isLoading, error, user } = useAuth()
    const router = useRouter()
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const mfaInputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Redirect if already authenticated
    useEffect(() => {
        if (user) {
            router.push('/')
        }
    }, [user, router])

    // Check for query parameter messages
    useEffect(() => {
        if (router.query.message && typeof router.query.message === 'string') {
            setSuccessMessage(router.query.message)
            // Clear the message from URL after showing it
            router.replace('/signin', undefined, { shallow: true })
            // Auto-hide message after 5 seconds
            const timer = setTimeout(() => {
                setSuccessMessage(null)
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [router.query.message, router])

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [resendCooldown])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!email || !password) {
            return
        }

        const result = await login(email, password)
        if (result === true) {
            if (shortSession) {
                const freshToken = localStorage.getItem('doctor_token')
                const res = await fetch(`${API_BASE_URL}/auth/debug/short-token`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${freshToken}` },
                })
                const data = await res.json()
                if (data.success && data.token) overrideToken(data.token)
            }
            router.push('/')
        }
    }

    const handleMfaCodeChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1)
        
        const newCode = [...mfaCode]
        newCode[index] = digit
        setMfaCode(newCode)

        if (digit && index < 5) {
            mfaInputRefs.current[index + 1]?.focus()
        }
    }

    const handleMfaKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
            mfaInputRefs.current[index - 1]?.focus()
        }
    }

    const handleMfaPaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (pastedData.length === 6) {
            setMfaCode(pastedData.split(''))
            mfaInputRefs.current[5]?.focus()
        }
    }

    const handleMfaSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const code = mfaCode.join('')
        if (code.length !== 6) return

        const success = await verifyMfa(code)
        if (success) {
            router.push('/')
        } else {
            setMfaCode(['', '', '', '', '', ''])
            mfaInputRefs.current[0]?.focus()
        }
    }

    const handleResendCode = async () => {
        if (resendCooldown > 0) return
        
        const success = await resendMfaCode()
        if (success) {
            setSuccessMessage('New verification code sent!')
            setResendCooldown(30)
            setTimeout(() => setSuccessMessage(null), 3000)
        }
    }

    const handleBackToLogin = () => {
        cancelMfa()
        setMfaCode(['', '', '', '', '', ''])
        setPassword('')
    }

    // MFA Verification Form
    if (mfa.required) {
        return (
            <>
                <Head>
                    <title>Verify Your Identity - Doctor Portal</title>
                    <meta name="description" content="Enter verification code" />
                </Head>

                <div className="min-h-screen bg-background flex items-center justify-center p-4">
                    <div className="w-full max-w-md space-y-6">
                        <div className="text-center">
                            <div className="flex justify-center mb-4">
                                <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                                    <Mail className="h-6 w-6 text-white" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-bold text-foreground">Check Your Email</h1>
                            <p className="text-muted-foreground mt-2">
                                We sent a 6-digit verification code to<br />
                                <span className="font-medium text-foreground">{email}</span>
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">
                                (Please check your spam folder)
                            </p>
                        </div>

                        <Card className="bg-card border-border">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-center text-lg">Enter Verification Code</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleMfaSubmit} className="space-y-6">
                                    {error && (
                                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                            {error}
                                        </div>
                                    )}

                                    {successMessage && (
                                        <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                                            {successMessage}
                                        </div>
                                    )}

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
                                                className="w-12 h-14 text-center text-2xl font-bold border-2 border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                                autoFocus={index === 0}
                                            />
                                        ))}
                                    </div>

                                    <p className="text-xs text-center text-muted-foreground">
                                        Code expires in 5 minutes
                                    </p>

                                    <Button
                                        type="submit"
                                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                                        disabled={isLoading || mfaCode.join('').length !== 6}
                                    >
                                        {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                                    </Button>
                                </form>

                                <div className="mt-6 space-y-3">
                                    <button
                                        type="button"
                                        onClick={handleResendCode}
                                        disabled={resendCooldown > 0 || isLoading || mfa.resendsRemaining <= 0}
                                        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw className="h-4 w-4" />
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
                                        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Back to sign in
                                    </button>
                                </div>
                            </CardContent>
                        </Card>

                        <p className="text-xs text-center text-muted-foreground">
                            🔒 Two-factor authentication required for HIPAA compliance
                        </p>
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            <Head>
                <title>Sign In - Doctor Portal</title>
                <meta name="description" content="Sign in to doctor portal" />
            </Head>

            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-md space-y-6">
                    {/* Logo/Header */}
                    <div className="text-center">
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                                <Stethoscope className="h-6 w-6 text-primary-foreground" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Doctor Portal</h1>
                        <p className="text-muted-foreground">Sign in to your account</p>
                    </div>

                    {/* Sign In Form */}
                    <Card className="bg-card border-border">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-center">Sign In</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && !successMessage && (
                                    <div className={`p-4 text-sm rounded-md ${
                                        error.includes('under review') || error.includes('pending')
                                            ? 'text-blue-800 bg-blue-50 border border-blue-200'
                                            : 'text-red-600 bg-red-50 border border-red-200'
                                    }`}>
                                        <div className="flex items-start gap-2">
                                            {error.includes('under review') || error.includes('pending') ? (
                                                <span className="text-lg">⏳</span>
                                            ) : (
                                                <span className="text-lg">⚠️</span>
                                            )}
                                            <div>
                                                <p className="font-medium">{error}</p>
                                                {(error.includes('under review') || error.includes('pending')) && (
                                                    <p className="mt-2 text-xs opacity-80">
                                                        Our team reviews all doctor applications to ensure compliance and security. You will receive an email notification once your account is approved.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {successMessage && (
                                    <div className={`p-3 text-sm rounded-md border ${
                                        successMessage.toLowerCase().includes('expired') || successMessage.toLowerCase().includes('session')
                                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                                            : 'text-green-600 bg-green-50 border-green-200'
                                    }`}>
                                        {successMessage}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium text-foreground">
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                        placeholder="doctor@example.com"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="password" className="text-sm font-medium text-foreground">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full px-3 py-2 pr-10 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                            placeholder="Enter your password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    <div className="text-right mt-1">
                                        <button
                                            type="button"
                                            onClick={() => router.push('/forgot-password')}
                                            className="text-xs text-primary hover:underline font-medium"
                                        >
                                            Forgot your password?
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isLoading || !email || !password}
                                >
                                    {isLoading ? 'Signing in...' : 'Sign In'}
                                </Button>
                            </form>

                            <div className="mt-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                    Don't have an account?{' '}
                                    <Link href="/signup" className="text-primary hover:underline">
                                        Sign up
                                    </Link>
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>

            <button
                type="button"
                onClick={() => setShortSession(v => !v)}
                className="fixed bottom-4 left-4 transition-colors"
                style={{ color: shortSession ? '#a78bfa' : '#d1d5db' }}
                title={shortSession ? 'Short session active (2 min)' : 'Short session (debug)'}
            >
                <FlaskConical className="h-3.5 w-3.5" />
            </button>
        </>
    )
}

