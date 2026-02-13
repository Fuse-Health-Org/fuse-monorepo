import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CheckCircle, XCircle, Loader2, Building2, Mail } from 'lucide-react'

export default function VerifyEmail() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid' | 'awaiting'>('loading')
  const [message, setMessage] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [showResendForm, setShowResendForm] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resendMessage, setResendMessage] = useState('')
  const [userEmail, setUserEmail] = useState<string>('')
  const router = useRouter()
  const { token: queryToken, email: queryEmail } = router.query

  useEffect(() => {
    // Wait for router to be ready before checking query params
    if (!router.isReady) return

    // If no token, show awaiting verification screen
    if (!queryToken || typeof queryToken !== 'string') {
      setStatus('awaiting')
      if (queryEmail && typeof queryEmail === 'string') {
        setUserEmail(queryEmail)
        setResendEmail(queryEmail)
      }
      return
    }

    verifyEmail(queryToken)
  }, [router.isReady, queryToken, queryEmail])

  const verifyEmail = async (token: string) => {
    try {
      setStatus('loading')
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/auth/verify-email?token=${token}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setStatus('success')
        setMessage(data.message || 'Account activated successfully!')
        
        // Store the JWT token for automatic login
        if (data.token && data.user) {
          localStorage.setItem('admin_token', data.token)
          localStorage.setItem('admin_user', JSON.stringify(data.user))
          
          setIsLoggingIn(true)
          
          // Redirect to dashboard after verification.
          const selectedPlanType = localStorage.getItem('selectedPlanType')
          setMessage('Redirecting to dashboard...')

          const redirectToCheckout = async () => {
            if (!selectedPlanType) {
              window.location.href = '/'
              return
            }

            try {
              const plansResponse = await fetch(`${apiUrl}/brand-subscriptions/plans`, {
                headers: {
                  Authorization: `Bearer ${data.token}`,
                },
              })

              const plansData = await plansResponse.json()
              const selectedPlan = plansData?.success && Array.isArray(plansData?.plans)
                ? plansData.plans.find(
                    (plan: any) =>
                      String(plan.planType || '').toLowerCase() === selectedPlanType.toLowerCase(),
                  )
                : null

              if (!selectedPlan) {
                console.error('Selected plan not found for checkout redirect:', selectedPlanType)
                window.location.href = '/'
                return
              }

              const hasIntroPricing =
                selectedPlan.introMonthlyPrice != null &&
                selectedPlan.introMonthlyPriceDurationMonths &&
                selectedPlan.introMonthlyPriceStripeId

              const downpaymentAmount = hasIntroPricing
                ? Number(selectedPlan.introMonthlyPrice)
                : Number(selectedPlan.monthlyPrice || 0)

              // Keep /plans behavior: save selected plan profile payload before checkout
              const payload = {
                selectedPlanCategory: selectedPlan.planType,
                selectedPlanType: selectedPlan.planType,
                selectedPlanName: selectedPlan.name,
                selectedPlanPrice: downpaymentAmount,
                selectedDownpaymentType: `downpayment_${selectedPlan.planType}`,
                selectedDownpaymentName: `${selectedPlan.name} First Month`,
                selectedDownpaymentPrice: downpaymentAmount,
                planSelectionTimestamp: new Date().toISOString(),
              }

              await fetch(`${apiUrl}/auth/profile`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${data.token}`,
                },
                body: JSON.stringify(payload),
              })

              const queryParams = new URLSearchParams({
                planCategory: selectedPlan.planType,
                subscriptionPlanType: selectedPlan.planType,
                subscriptionPlanName: selectedPlan.name,
                subscriptionMonthlyPrice: String(Number(selectedPlan.monthlyPrice || 0)),
                downpaymentPlanType: `downpayment_${selectedPlan.planType}`,
                downpaymentName: `${selectedPlan.name} First Month`,
                downpaymentAmount: String(downpaymentAmount),
                brandSubscriptionPlanId: String(selectedPlan.id || ''),
                stripePriceId: String(selectedPlan.stripePriceId || ''),
              })

              if (hasIntroPricing) {
                queryParams.set('introMonthlyPrice', String(Number(selectedPlan.introMonthlyPrice)))
                queryParams.set(
                  'introMonthlyPriceDurationMonths',
                  String(Number(selectedPlan.introMonthlyPriceDurationMonths)),
                )
                queryParams.set('introMonthlyPriceStripeId', String(selectedPlan.introMonthlyPriceStripeId))
              }

              window.location.href = `/?openCheckout=1&${queryParams.toString()}`
            } catch (error) {
              console.error('Failed to build checkout redirect from selected plan:', error)
              window.location.href = '/'
            }
          }

          setTimeout(() => {
            void redirectToCheckout()
          }, 1500)
        }
      } else {
        setStatus('error')
        setMessage(data.message || 'Verification failed')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Network error. Please try again.')
    }
  }

  const handleResendEmail = async () => {
    const emailToUse = resendEmail || userEmail
    
    if (!emailToUse) {
      setShowResendForm(true)
      return
    }

    try {
      setResendStatus('sending')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToUse }),
      })
      
      const data = await response.json()

      if (response.ok && data.success) {
        setResendStatus('sent')
        setResendMessage('Verification email sent! Please check your inbox.')
      } else {
        setResendStatus('error')
        setResendMessage(data.message || 'Failed to send verification email')
      }
    } catch (error) {
      setResendStatus('error')
      setResendMessage('Network error. Please try again.')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-600" />
      case 'awaiting':
        return <Mail className="h-16 w-16 text-primary" />
      case 'error':
      case 'invalid':
        return <XCircle className="h-16 w-16 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'awaiting':
        return 'text-primary'
      case 'error':
      case 'invalid':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <>
      <Head>
        <title>Email Verification - Fuse</title>
        <meta name="description" content="Verify your email address" />
      </Head>
      
      <div className="h-screen bg-background overflow-y-auto">
        <div className="flex items-center justify-center p-4 min-h-full">
          <div className="w-full max-w-md space-y-6">
          {/* Logo/Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Fuse</h1>
            <p className="text-muted-foreground">Email Verification</p>
          </div>

          {/* Verification Status */}
          <Card className="bg-card border-border">
            <CardHeader className="space-y-1">
              <CardTitle className="text-center">Account Verification</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              {/* Status Icon */}
              <div className="flex justify-center">
                {getStatusIcon()}
              </div>

              {/* Status Message */}
              <div className="space-y-2">
                <h3 className={`text-lg font-semibold ${getStatusColor()}`}>
                  {status === 'loading' && 'Verifying your email...'}
                  {status === 'success' && 'Account Activated!'}
                  {status === 'awaiting' && 'Check Your Email'}
                  {status === 'error' && 'Verification Failed'}
                  {status === 'invalid' && 'Invalid Link'}
                </h3>
                <p className="text-muted-foreground">
                  {status === 'awaiting' && userEmail 
                    ? `We sent a verification email to ${userEmail}`
                    : message}
                </p>
              </div>

              {/* Verification Steps */}
              {status === 'awaiting' && (
                <div className="text-left space-y-4">
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <h4 className="font-semibold text-foreground mb-3">Next Steps:</h4>
                    <ol className="space-y-3 text-sm text-foreground">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">
                          1
                        </span>
                        <span>Check your email inbox (and spam folder)</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">
                          2
                        </span>
                        <span>Click the verification link in the email</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">
                          3
                        </span>
                        <span>You'll be automatically logged in and redirected to your dashboard</span>
                      </li>
                    </ol>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    The verification link will expire in 24 hours
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {status === 'success' && isLoggingIn && (
                  <div className="text-sm text-muted-foreground">
                    Logging you in and redirecting to your dashboard...
                  </div>
                )}

                {status === 'success' && !isLoggingIn && (
                  <Button 
                    onClick={() => router.push('/')}
                    className="w-full"
                  >
                    Go to Dashboard
                  </Button>
                )}

                {status === 'awaiting' && (
                  <div className="space-y-3">
                    {resendStatus === 'sent' ? (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">Verification email resent! Please check your inbox.</span>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        onClick={handleResendEmail}
                        variant="outline"
                        className="w-full"
                        disabled={resendStatus === 'sending'}
                      >
                        {resendStatus === 'sending' ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Resending...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Resend Verification Email
                          </>
                        )}
                      </Button>
                    )}
                    {resendStatus === 'error' && (
                      <p className="text-sm text-red-600 text-center">{resendMessage}</p>
                    )}
                  </div>
                )}

                {(status === 'error' || status === 'invalid') && (
                  <div className="space-y-4">
                    {!showResendForm ? (
                      <Button 
                        onClick={() => setShowResendForm(true)}
                        className="w-full"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Request New Verification Email
                      </Button>
                    ) : resendStatus === 'sent' ? (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">{resendMessage}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Enter your email address to receive a new verification link:
                        </p>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          disabled={resendStatus === 'sending'}
                        />
                        {resendStatus === 'error' && (
                          <p className="text-sm text-red-600">{resendMessage}</p>
                        )}
                        <Button 
                          onClick={handleResendEmail}
                          className="w-full"
                          disabled={!resendEmail || resendStatus === 'sending'}
                        >
                          {resendStatus === 'sending' ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Verification Email
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Or{' '}
                      <Link href="/signin" className="text-primary hover:underline">
                        sign in
                      </Link>{' '}
                      if you already have an account
                    </p>
                  </div>
                )}

                {status === 'loading' && (
                  <p className="text-xs text-muted-foreground">
                    Please wait while we verify your email address...
                  </p>
                )}

                {status === 'awaiting' && (
                  <p className="text-xs text-muted-foreground text-center">
                    Can't find the email?{' '}
                    <button 
                      onClick={() => router.push('/signin')}
                      className="text-primary hover:underline"
                    >
                      Back to sign in
                    </button>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </>
  )
}