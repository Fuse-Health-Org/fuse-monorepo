import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Building2, Mail, ArrowLeft, RefreshCw, FlaskConical } from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [shortSession, setShortSession] = useState(false)
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { login, verifyMfa, resendMfaCode, cancelMfa, mfa, overrideToken, isLoading, error, user } = useAuth()
  const router = useRouter()
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
        const freshToken = localStorage.getItem('tenant_token')
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
          <title>Verify Your Identity - Tenant Portal</title>
          <meta name="description" content="Enter verification code" />
        </Head>
        
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Mail className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">Check Your Email</h1>
              <p className="text-muted-foreground">
                We sent a 6-digit verification code to<br />
                <span className="font-medium text-foreground">{email}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                (Please check your spam folder)
              </p>
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="p-8 pb-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground text-center">Enter Verification Code</h2>
              </div>
              <div className="p-8">
                <form onSubmit={handleMfaSubmit} className="space-y-6">
                  {error && (
                    <div className="p-4 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl shadow-sm">
                      {error}
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-4 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-2xl shadow-sm">
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
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    Code expires in 5 minutes
                  </p>

                  <button
                    type="submit"
                    disabled={isLoading || mfaCode.join('').length !== 6}
                    className="w-full px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                </form>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || isLoading || mfa.resendsRemaining <= 0}
                    className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </button>
                </div>
              </div>
            </div>

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
        <title>Sign In - Tenant Portal</title>
        <meta name="description" content="Sign in to tenant management portal" />
      </Head>
      
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Logo/Header */}
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-2xl flex items-center justify-center shadow-lg">
                <Building2 className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">Tenant Portal</h1>
            <p className="text-muted-foreground">Sign in to manage your clinics</p>
          </div>

          {/* Sign In Form */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-8 pb-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground text-center">Welcome Back</h2>
              <p className="text-sm text-muted-foreground text-center mt-1">Enter your credentials to continue</p>
            </div>
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {successMessage && (
                  <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-2xl shadow-sm">
                    {successMessage}
                  </div>
                )}
                
                {error && (
                  <div className="p-4 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl shadow-sm">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground block">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-input rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                    placeholder="tenant@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground block">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-input rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <div className="text-right">
                    <Link href="/forgot-password" className="text-xs text-[#4FA59C] hover:underline font-medium">
                      Forgot your password?
                    </Link>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className="w-full px-6 py-3 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm hover:shadow-md transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-[#6B7280]">
                  Tenant accounts are managed by administrators. Contact your administrator for access.
                </p>
              </div>
            </div>
          </div>
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