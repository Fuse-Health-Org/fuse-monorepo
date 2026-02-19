import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Shield, Mail, ArrowLeft, RefreshCw, FlaskConical } from 'lucide-react'
import PricingPlansModal from '@/components/PricingPlansModal'


export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [shortSession, setShortSession] = useState(false)
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const { login, verifyMfa, resendMfaCode, cancelMfa, mfa, overrideToken, isLoading, error, user } = useAuth()
  const router = useRouter()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
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
      const message = router.query.message
      // Session-related messages should be displayed as info/warning, not success
      if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('session')) {
        setInfoMessage(message)
      } else {
        setSuccessMessage(message)
      }
      // Clean up the URL by removing the message parameter
      const { message: _, ...restQuery } = router.query
      router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true })
    }
  }, [router.query.message])

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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const freshToken = localStorage.getItem('admin_token')
        const res = await fetch(`${apiUrl}/auth/debug/short-token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${freshToken}` },
        })
        const data = await res.json()
        if (data.success && data.token) overrideToken(data.token)
      }
      router.push('/')
    }
    // If result === 'mfa_required', the UI will update to show MFA form
  }

  const handleMfaCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)
    
    const newCode = [...mfaCode]
    newCode[index] = digit
    setMfaCode(newCode)

    // Auto-focus next input
    if (digit && index < 5) {
      mfaInputRefs.current[index + 1]?.focus()
    }
  }

  const handleMfaKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace
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
      // Clear code on failure
      setMfaCode(['', '', '', '', '', ''])
      mfaInputRefs.current[0]?.focus()
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    
    const success = await resendMfaCode()
    if (success) {
      setSuccessMessage('New verification code sent!')
      setResendCooldown(30) // 30 second cooldown
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }

  const handleBackToLogin = () => {
    cancelMfa()
    setMfaCode(['', '', '', '', '', ''])
    setPassword('')
  }

  const handleSelectPlan = (plan: any) => {
    setIsPricingModalOpen(false)
    // Redirect to signup page
    router.push('/signup')
  }

  // MFA Verification Form
  if (mfa.required) {
    return (
      <>
        <Head>
          <title>Verify Your Identity - Admin Dashboard</title>
          <meta name="description" content="Enter verification code" />
        </Head>

        <div className="h-screen bg-background overflow-y-auto">
          <div className="flex items-center justify-center p-4 min-h-full">
            <div className="w-full max-w-md space-y-6">
              {/* Logo/Header */}
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

            {/* MFA Form */}
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

                  {/* 6-digit code input */}
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

                {/* Resend and Back buttons */}
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

              {/* Security notice */}
              <p className="text-xs text-center text-muted-foreground">
                🔒 Two-factor authentication required for HIPAA compliance
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Sign In - Admin Dashboard</title>
        <meta name="description" content="Sign in to admin dashboard" />
      </Head>

      <div className="h-screen bg-background overflow-y-auto">
        <div className="flex items-center justify-center p-4 min-h-full">
          <div className="w-full max-w-md space-y-6">
            {/* Logo/Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Sign in to your account</p>
          </div>

          {/* Sign In Form */}
          <Card className="bg-card border-border">
            <CardHeader className="space-y-1">
              <CardTitle className="text-center">Sign In</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && !infoMessage && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                    {error}
                  </div>
                )}

                {infoMessage && (
                  <div className="p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
                    {infoMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
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
                    placeholder="admin@example.com"
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
                </div>

                <div className="text-right -mt-2 mb-2">
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Forgot your password?
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShortSession(v => !v)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                    shortSession
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <FlaskConical className="h-3.5 w-3.5 shrink-0" />
                  {shortSession ? 'Short session active — token expires in 1 min' : 'Short session (debug)'}
                </button>

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
                  <button
                    type="button"
                    onClick={() => setIsPricingModalOpen(true)}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>

      {/* Pricing Plans Modal */}
      <PricingPlansModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        onSelectPlan={handleSelectPlan}
      />
    </>
  )
}