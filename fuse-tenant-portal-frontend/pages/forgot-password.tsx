import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { Eye, EyeOff, Lock, Mail, ArrowLeft, RefreshCw, CheckCircle } from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Step = 'email' | 'code' | 'reset'

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send reset code')
      }

      setSuccessMessage('Reset code sent to your email!')
      setStep('code')
      setResendCooldown(60)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)

    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus()
    }
  }

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus()
    }
  }

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData.length === 6) {
      setCode(pastedData.split(''))
      codeInputRefs.current[5]?.focus()
    }
  }

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const codeString = code.join('').trim()
    if (codeString.length !== 6) return

    setIsLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-reset-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code: codeString }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Invalid or expired code')
      }

      setSuccessMessage('Code verified! Please set your new password.')
      setStep('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code. Please try again.')
      setCode(['', '', '', '', '', ''])
      codeInputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to resend code')
      }

      setSuccessMessage('New code sent to your email!')
      setResendCooldown(60)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match")
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const codeString = code.join('').trim()
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: codeString,
          password: newPassword,
          confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset password')
      }

      // Show success modal instead of redirecting
      setShowSuccessModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password - Tenant Portal</title>
        <meta name="description" content="Reset your password" />
      </Head>
      
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-2xl flex items-center justify-center shadow-lg">
                <Lock className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-semibold text-[#1F2937] mb-2">
              {step === 'email' && 'Reset Password'}
              {step === 'code' && 'Verify Code'}
              {step === 'reset' && 'New Password'}
            </h1>
            <p className="text-[#6B7280]">
              {step === 'email' && 'Enter your email to receive a reset code'}
              {step === 'code' && `We sent a 6-digit code to ${email}`}
              {step === 'reset' && 'Enter your new password'}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="p-8">
              {/* Success Message */}
              {successMessage && (
                <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-2xl shadow-sm mb-6">
                  {successMessage}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl shadow-sm mb-6">
                  {error}
                </div>
              )}

              {/* Step 1: Email */}
              {step === 'email' && (
                <form onSubmit={handleEmailSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-[#4B5563] block">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 pl-12 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                        placeholder="tenant@example.com"
                        required
                      />
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#6B7280]" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !email}
                    className="w-full px-6 py-3 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm hover:shadow-md transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Sending...' : 'Send Reset Code'}
                  </button>

                  <div className="text-center">
                    <Link href="/signin" className="text-sm text-[#4FA59C] hover:underline">
                      Back to sign in
                    </Link>
                  </div>
                </form>
              )}

              {/* Step 2: Code Verification */}
              {step === 'code' && (
                <form onSubmit={handleCodeSubmit} className="space-y-5">
                  <div className="flex justify-center gap-2">
                    {code.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { codeInputRefs.current[index] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        onPaste={handleCodePaste}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-[#4FA59C] transition-all"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-center text-[#6B7280]">
                    Code expires in 10 minutes
                  </p>

                  <button
                    type="submit"
                    disabled={isLoading || code.join('').length !== 6}
                    className="w-full px-6 py-3 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm hover:shadow-md transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Verifying...' : 'Verify Code'}
                  </button>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCooldown > 0 || isLoading}
                      className="w-full flex items-center justify-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {resendCooldown > 0 
                        ? `Resend code in ${resendCooldown}s`
                        : 'Resend code'
                      }
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStep('email')
                        setCode(['', '', '', '', '', ''])
                        setError('')
                      }}
                      className="w-full flex items-center justify-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Change email
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Reset Password */}
              {step === 'reset' && (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="newPassword" className="text-sm font-medium text-[#4B5563] block">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={isPasswordVisible ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                        placeholder="Enter new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#6B7280] hover:text-[#1F2937] transition-colors"
                      >
                        {isPasswordVisible ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-[#4B5563] block">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={isConfirmPasswordVisible ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                        placeholder="Confirm new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#6B7280] hover:text-[#1F2937] transition-colors"
                      >
                        {isConfirmPasswordVisible ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !newPassword || !confirmPassword}
                    className="w-full px-6 py-3 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm hover:shadow-md transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Resetting...' : 'Reset Password'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('code')
                        setNewPassword('')
                        setConfirmPassword('')
                        setError('')
                      }}
                      className="text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4 inline mr-1" />
                      Back to code verification
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] max-w-md w-full p-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#1F2937] mb-2">Password Reset Successful!</h2>
                <p className="text-[#6B7280]">
                  Your password has been reset successfully. You can now sign in with your new password.
                </p>
              </div>
              <button
                onClick={() => router.push('/signin')}
                className="w-full px-6 py-3 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm hover:shadow-md transition-all text-sm font-medium"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
