import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Building2, Mail, ArrowLeft, RefreshCw } from 'lucide-react'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { login, verifyMfa, resendMfaCode, cancelMfa, mfa, isLoading, error, user } = useAuth()
  const router = useRouter()
  const mfaInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

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
        
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Mail className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-semibold text-[#1F2937] mb-2">Check Your Email</h1>
              <p className="text-[#6B7280]">
                We sent a 6-digit verification code to<br />
                <span className="font-medium text-[#1F2937]">{email}</span>
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
              <div className="p-8 pb-6 border-b border-[#E5E7EB]">
                <h2 className="text-xl font-semibold text-[#1F2937] text-center">Enter Verification Code</h2>
              </div>
              <div className="p-8">
                <form onSubmit={handleMfaSubmit} className="space-y-6">
                  {error && (
                    <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
                      {error}
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-2xl shadow-sm">
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
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-center text-[#6B7280]">
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
                    className="w-full flex items-center justify-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    className="w-full flex items-center justify-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-[#6B7280]">
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
      
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Logo/Header */}
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-2xl flex items-center justify-center shadow-lg">
                <Building2 className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-semibold text-[#1F2937] mb-2">Tenant Portal</h1>
            <p className="text-[#6B7280]">Sign in to manage your clinics</p>
          </div>

          {/* Sign In Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="p-8 pb-6 border-b border-[#E5E7EB]">
              <h2 className="text-xl font-semibold text-[#1F2937] text-center">Welcome Back</h2>
              <p className="text-sm text-[#6B7280] text-center mt-1">Enter your credentials to continue</p>
            </div>
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-[#4B5563] block">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                    placeholder="tenant@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-[#4B5563] block">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#6B7280] hover:text-[#1F2937] transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
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
    </>
  )
}