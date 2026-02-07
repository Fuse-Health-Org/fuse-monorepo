import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  Shield,
  Lock,
  Building2,
  Star,
  Users,
  XCircle,
  Loader2
} from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import Layout from '@/components/Layout'

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...'
console.log('🔑 Stripe publishable key loaded:', stripePublishableKey ? 'YES' : 'NO')
const stripePromise = loadStripe(stripePublishableKey)

const paymentElementOptions = {
  layout: 'tabs' as const,
  business: {
    name: 'Fuse Health'
  },
  wallets: {
    applePay: 'auto' as const,
    googlePay: 'auto' as const
  }
}

interface CheckoutData {
  planCategory: string
  planType: string
  planName: string
  planPrice: number
  subscriptionMonthlyPrice?: number
  downpaymentPlanType?: string
  downpaymentName?: string
  upgradeDelta?: number
  previousMonthlyPrice?: number
  brandSubscriptionPlanId?: string
  stripePriceId?: string
}

// Payment Processing Modal Component
type PaymentModalState = 'processing' | 'success' | 'error'

interface PaymentModalProps {
  isOpen: boolean
  state: PaymentModalState
  errorMessage?: string
  planName?: string
  amount?: number
  onClose: () => void
  onRedirect: () => void
}

function PaymentModal({ isOpen, state, errorMessage, planName, amount, onClose, onRedirect }: PaymentModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header gradient */}
        <div className={`h-2 ${
          state === 'processing' ? 'bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse' :
          state === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
          'bg-gradient-to-r from-red-500 to-orange-500'
        }`} />
        
        <div className="p-8">
          {/* Processing State */}
          {state === 'processing' && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                <CreditCard className="absolute inset-0 m-auto w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment</h2>
              <p className="text-gray-600 mb-4">
                Please wait while we securely process your payment...
              </p>
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 font-medium">
                  {planName && `${planName} Plan`}
                  {amount !== undefined && ` • $${amount.toLocaleString()}`}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Lock className="w-4 h-4" />
                <span>Secure payment powered by Stripe</span>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Do not close or refresh this page
              </p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
              <p className="text-gray-600 mb-6">
                Your subscription has been activated successfully.
              </p>
              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-800 font-medium">
                  {planName && `${planName} Plan`}
                  {amount !== undefined && ` • $${amount.toLocaleString()}/month`}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Your first charge of ${amount?.toLocaleString()} has been processed
                </p>
              </div>
              <Button
                onClick={onRedirect}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-semibold rounded-xl"
              >
                <Check className="w-5 h-5 mr-2" />
                Go to Dashboard
              </Button>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
              <p className="text-gray-600 mb-4">
                We couldn't process your payment.
              </p>
              {errorMessage && (
                <div className="bg-red-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-800">
                    {errorMessage}
                  </p>
                </div>
              )}
              <Button
                onClick={onClose}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 text-lg font-semibold rounded-xl"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Checkout form component that uses Stripe hooks
function CheckoutForm({ checkoutData, paymentData, token, intentClientSecret, onSuccess, onError }: {
  checkoutData: CheckoutData
  paymentData: any
  token: string | null
  intentClientSecret: string
  onSuccess: () => void
  onError: (error: string) => void
}) {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [cardError, setCardError] = useState('')
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalState, setModalState] = useState<PaymentModalState>('processing')
  const [modalError, setModalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    console.log('🔍 handleSubmit called')
    console.log('🔍 Stripe loaded:', !!stripe)
    console.log('🔍 Elements loaded:', !!elements)
    console.log('🔍 Token available:', !!token)

    if (!stripe || !elements) {
      const errorMsg = 'Stripe has not loaded yet.'
      console.error('❌', errorMsg)
      onError(errorMsg)
      return
    }

    if (!intentClientSecret) {
      const errorMsg = 'Payment could not be initialized. Please refresh and try again.'
      console.error('❌', errorMsg)
      onError(errorMsg)
      return
    }

    if (!token) {
      const errorMsg = 'User not authenticated.'
      console.error('❌', errorMsg)
      onError(errorMsg)
      return
    }

    setIsProcessing(true)
    setCardError('')
    setModalOpen(true)
    setModalState('processing')
    setModalError('')

    try {
      const paymentElement = elements.getElement(PaymentElement)
      console.log('🔍 PaymentElement found:', !!paymentElement)

      if (!paymentElement) {
        const errorMsg = 'Payment details form is not ready yet.'
        console.error('❌', errorMsg)
        setModalState('error')
        setModalError(errorMsg)
        onError(errorMsg)
        return
      }

      const { error: submitError } = await elements.submit()
      if (submitError) {
        const errorMsg = submitError.message || 'Please check your payment details and try again.'
        console.error('❌ Payment element submission error:', submitError)
        setCardError(errorMsg)
        setModalState('error')
        setModalError(errorMsg)
        onError(errorMsg)
        return
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: intentClientSecret,
        redirect: 'if_required',
        confirmParams: {
          receipt_email: paymentData.email || undefined,
          payment_method_data: {
            billing_details: {
              name: `${paymentData.firstName} ${paymentData.lastName}`.trim() || undefined,
              email: paymentData.email || undefined,
              phone: paymentData.phone || undefined
            }
          }
        }
      })

      if (confirmError) {
        const errorMsg = confirmError.message || 'Payment authorization failed.'
        console.error('❌ Payment confirmation error:', confirmError)
        setCardError(errorMsg)
        setModalState('error')
        setModalError(errorMsg)
        onError(errorMsg)
        return
      }

      if (!paymentIntent) {
        const errorMsg = 'Stripe did not return a payment intent.'
        console.error('❌', errorMsg)
        setModalState('error')
        setModalError(errorMsg)
        onError(errorMsg)
        return
      }

      if (paymentIntent.status !== 'succeeded' && paymentIntent.status !== 'requires_capture') {
        const errorMsg = `Downpayment not completed. Status: ${paymentIntent.status}`
        console.error('❌', errorMsg)
        setModalState('error')
        setModalError(errorMsg)
        onError(errorMsg)
        return
      }

      const paymentMethodId = typeof paymentIntent.payment_method === 'string'
        ? paymentIntent.payment_method
        : paymentIntent.payment_method?.id

      if (!paymentMethodId) {
        const errorMsg = 'Unable to determine payment method after confirmation.'
        console.error('❌', errorMsg)
        setModalState('error')
        setModalError(errorMsg)
        onError(errorMsg)
        return
      }

      console.log('🔍 Downpayment succeeded. Proceeding to create subscription...')
      console.log('🔍 Payment method ID:', paymentMethodId)
      console.log('🔍 Plan type:', checkoutData.planType)
      console.log('🔍 Amount:', checkoutData.planPrice)

      const response = await fetch('/api/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentMethodId,
          planType: checkoutData.planType,
          planCategory: checkoutData.planCategory,
          downpaymentPlanType: checkoutData.downpaymentPlanType,
          amount: checkoutData.planPrice,
          currency: 'usd'
        })
      })

      console.log('🔍 Response status:', response.status)
      console.log('🔍 Response ok:', response.ok)

      if (!response.ok) {
        const errorData = await response.json()
        const errorMsg = errorData.message || `Payment confirmation failed: ${response.statusText}`
        console.error('❌ Payment confirmation error:', errorData)
        throw new Error(errorMsg)
      }

      const { clientSecret: subscriptionClientSecret, requiresAction, subscription, subscriptionId } = await response.json()
      console.log('🔍 Subscription confirmation response:', { clientSecret: !!subscriptionClientSecret, requiresAction, subscription, subscriptionId })

      if (requiresAction && subscriptionClientSecret) {
        // Handle 3D Secure or other authentication for the subscription invoice
        const { error: subscriptionConfirmError } = await stripe.confirmCardPayment(subscriptionClientSecret)

        if (subscriptionConfirmError) {
          const errorMsg = subscriptionConfirmError.message || 'Subscription authentication failed.'
          setCardError(errorMsg)
          setModalState('error')
          setModalError(errorMsg)
          onError(errorMsg)
          return
        }
      }

      // Subscription created successfully
      console.log('✅ Subscription created successfully:', subscriptionId)
      setModalState('success')
      onSuccess()

    } catch (error: any) {
      console.error('Payment error:', error)
      const errorMessage = error.message || 'An unexpected error occurred'
      setCardError(errorMessage)
      setModalState('error')
      setModalError(errorMessage)
      onError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setModalState('processing')
    setModalError('')
  }

  const handleModalRedirect = () => {
    router.push('/plans?success=true&payment_intent=completed')
  }

  return (
    <>
      {/* Payment Processing Modal */}
      <PaymentModal
        isOpen={modalOpen}
        state={modalState}
        errorMessage={modalError}
        planName={checkoutData.planName}
        amount={checkoutData.subscriptionMonthlyPrice || checkoutData.planPrice}
        onClose={handleModalClose}
        onRedirect={handleModalRedirect}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Information */}
        <fieldset disabled={isProcessing} className={isProcessing ? 'opacity-50 pointer-events-none' : ''}>
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Contact information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email address</label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={paymentData.email}
                onChange={(e) => paymentData.setEmail(e.target.value)}
                autoComplete="email"
                className="w-full"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">First name</label>
                <Input
                  type="text"
                  placeholder="First name"
                  value={paymentData.firstName}
                  onChange={(e) => paymentData.setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className="w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Last name</label>
                <Input
                  type="text"
                  placeholder="Last name"
                  value={paymentData.lastName}
                  onChange={(e) => paymentData.setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone number</label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={paymentData.phone}
                onChange={(e) => paymentData.setPhone(e.target.value)}
                autoComplete="tel"
                className="w-full"
                required
              />
            </div>
          </div>
        </div>

        {/* Stripe Payment Element */}
        <div className="mt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Payment method
          </h3>
          <div className="border rounded-lg p-4">
            <PaymentElement options={paymentElementOptions} />
            {cardError && (
              <div className="mt-2 text-sm text-red-600">
                {cardError}
              </div>
            )}
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground py-4">
          <div className="flex items-center gap-2">
            <span>By proceeding, you agree to our</span>
            <a href="/terms" className="text-blue-600 hover:text-blue-700 underline">Terms & Conditions</a>
            <span>and</span>
            <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">Privacy Policy</a>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed rounded-xl"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
              Processing payment...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              <span>Pay ${checkoutData.subscriptionMonthlyPrice?.toLocaleString() || checkoutData.planPrice.toLocaleString()} & Get Started</span>
            </>
          )}
        </Button>

        <div className="text-center space-y-2">
          <p className="text-sm font-medium">
            ✅ Subscription activates immediately after payment
          </p>
          <p className="text-xs text-muted-foreground">
            You can add optional onboarding support later from Settings.
          </p>
        </div>
      </fieldset>
      </form>
    </>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const { user, token, isLoading, refreshSubscription, subscription } = useAuth()
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null)
  const [clientSecret, setClientSecret] = useState('')

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/signin?redirect=' + encodeURIComponent(router.asPath))
    }
  }, [user, isLoading, router])
  const [paymentData, setPaymentData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    setEmail: (value: string) => setPaymentData(prev => ({ ...prev, email: value })),
    setFirstName: (value: string) => setPaymentData(prev => ({ ...prev, firstName: value })),
    setLastName: (value: string) => setPaymentData(prev => ({ ...prev, lastName: value })),
    setPhone: (value: string) => setPaymentData(prev => ({ ...prev, phone: value }))
  })

  useEffect(() => {
    // Wait for router to be ready (query params are empty on first render in production)
    if (!router.isReady) return

    // Wait for auth to load and check if user is authenticated
    if (isLoading) return

    if (!user) {
      // User not authenticated, redirect handled by other useEffect
      return
    }

    // Get checkout data from query params
    const {
      planCategory,
      downpaymentPlanType,
      downpaymentName,
      downpaymentAmount,
      subscriptionPlanType,
      subscriptionPlanName,
      subscriptionMonthlyPrice,
      brandSubscriptionPlanId,
      stripePriceId
    } = router.query

    if (
      planCategory &&
      downpaymentPlanType &&
      downpaymentName &&
      downpaymentAmount &&
      subscriptionPlanType &&
      subscriptionPlanName &&
      subscriptionMonthlyPrice
    ) {
      const downpaymentAmountNum = parseInt(downpaymentAmount as string)
      const monthlyPriceNum = parseInt(subscriptionMonthlyPrice as string)

      const existingPlanType = subscription?.plan?.type
      const existingMonthlyPrice =
        subscription?.plan?.price ?? (subscription as any)?.monthlyPrice

      const isUpgrade = Boolean(existingPlanType && existingPlanType !== subscriptionPlanType)
      const delta = isUpgrade && existingMonthlyPrice
        ? Math.max(monthlyPriceNum - Number(existingMonthlyPrice || 0), 0)
        : 0

      setCheckoutData({
        planCategory: planCategory as string,
        planType: subscriptionPlanType as string,
        planName: subscriptionPlanName as string,
        planPrice: isUpgrade ? delta : downpaymentAmountNum,
        subscriptionMonthlyPrice: monthlyPriceNum,
        downpaymentPlanType: downpaymentPlanType as string,
        downpaymentName: downpaymentName as string,
        upgradeDelta: isUpgrade ? delta : undefined,
        previousMonthlyPrice: existingMonthlyPrice ?? undefined,
        brandSubscriptionPlanId: brandSubscriptionPlanId as string,
        stripePriceId: stripePriceId as string
      })

      if (isUpgrade) {
        createUpgradePaymentIntent(subscriptionPlanType as string, delta)
      } else {
        createPaymentIntent(subscriptionPlanType as string, downpaymentAmountNum, brandSubscriptionPlanId as string)
      }
    } else {
      // Redirect back if missing data
      router.push('/plans')
    }
  }, [router.isReady, router.query, user, isLoading, subscription])

  const createPaymentIntent = async (planType: string, amount: number, brandSubscriptionPlanId?: string) => {
    try {
      if (!token) {
        throw new Error('User not authenticated. Please log in again.')
      }

      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planType,
          amount,
          currency: 'usd',
          brandSubscriptionPlanId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const { clientSecret } = await response.json()
      setClientSecret(clientSecret)
    } catch (error: any) {
      console.error('Error creating payment intent:', error)
      // Show error message to user
      alert(`Payment setup failed: ${error.message}`)
      // Redirect to plans page on error
      router.push('/plans')
    }
  }

  const createUpgradePaymentIntent = async (planType: string, amount: number) => {
    try {
      if (!token) {
        throw new Error('User not authenticated. Please log in again.')
      }

      const response = await fetch('/api/create-upgrade-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planType,
          amount,
          currency: 'usd',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const { clientSecret } = await response.json()
      setClientSecret(clientSecret)
    } catch (error: any) {
      console.error('Error creating upgrade payment intent:', error)
      alert(`Upgrade payment setup failed: ${error.message}`)
      router.push('/plans')
    }
  }

  const handlePaymentSuccess = async () => {
    try {
      // Wait a bit for the webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Try to fetch subscription with retries until it's active
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      let attempts = 0
      const maxAttempts = 5
      let isActive = false
      
      while (attempts < maxAttempts && !isActive) {
        try {
          const response = await fetch(`${apiUrl}/subscriptions/current`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.status === 'active') {
              console.log('✅ Subscription activated successfully')
              isActive = true
              // Update the context with the latest data
              await refreshSubscription()
              break
            }
          }
        } catch (err) {
          console.error('Error checking subscription status:', err)
        }
        
        attempts++
        if (attempts < maxAttempts) {
          console.log(`⏳ Subscription not active yet, retrying (${attempts}/${maxAttempts})...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      
      // Final refresh to ensure context is updated
      if (!isActive) {
        console.log('⚠️ Max attempts reached, doing final refresh')
      }
      await refreshSubscription()
      
    } catch (error) {
      console.error('Error refreshing subscription after payment:', error)
    } finally {
      router.push('/plans?success=true&payment_intent=completed')
    }
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
    // You could show a toast notification here
  }

  // Auto-populate user data when user is available
  useEffect(() => {
    if (user) {
      setPaymentData(prev => ({
        ...prev,
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        setEmail: (value: string) => setPaymentData(prev => ({ ...prev, email: value })),
        setFirstName: (value: string) => setPaymentData(prev => ({ ...prev, firstName: value })),
        setLastName: (value: string) => setPaymentData(prev => ({ ...prev, lastName: value })),
        setPhone: (value: string) => setPaymentData(prev => ({ ...prev, phone: value }))
      }))
    }
  }, [user])


  // Show loading if auth is loading or if we don't have checkout data yet
  if (isLoading || !checkoutData || !clientSecret) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {isLoading ? 'Checking authentication...' : 'Loading checkout...'}
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Head>
        <title>Checkout - Fuse Health</title>
        <meta name="description" content="Complete your Fuse Health setup" />
      </Head>

      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Secure checkout</span>
            </div>
          </div>

          <div className="max-w-2xl mx-auto space-y-6">
            {/* Plan Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">
                  Complete your payment
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Start your subscription with Fuse
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{checkoutData.planName} Plan</h3>
                    <p className="text-sm text-muted-foreground">Monthly subscription</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">${checkoutData.planPrice.toLocaleString()}.00</div>
                  </div>
                </div>

                <div className="border-t mt-6 pt-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Monthly subscription</span>
                    <span className="text-lg font-semibold text-[#825AD1]">
                      ${checkoutData.subscriptionMonthlyPrice?.toLocaleString() || '0'} / month
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Previous plan</span>
                    <span className="text-sm font-medium">
                      {checkoutData.previousMonthlyPrice ? `$${checkoutData.previousMonthlyPrice.toLocaleString()} / month` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">New plan</span>
                    <span className="text-lg font-semibold text-[#825AD1]">
                      ${checkoutData.subscriptionMonthlyPrice?.toLocaleString() || '0'} / month
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Due today</span>
                    <span className="text-lg font-semibold text-[#825AD1]">
                      ${checkoutData.planPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Transaction fee</span>
                    <span className="text-sm font-medium">1% monthly</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 mt-4">
                  <span className="font-bold">Due Today</span>
                  <div className="text-3xl font-bold text-[#825AD1]">${checkoutData.planPrice.toLocaleString()}</div>
                </div>
                {checkoutData.subscriptionMonthlyPrice && (
                  <p className="text-sm text-muted-foreground">
                    Then ${checkoutData.subscriptionMonthlyPrice.toLocaleString()} billed monthly starting next period.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Stripe Elements Provider */}
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">
                    Payment Information
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Enter your payment details to get started
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Social Proof */}
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center">
                              <Users className="w-3 h-3 text-white" />
                            </div>
                          ))}
                        </div>
                        <div className="text-sm font-medium">
                          50+ clinics launched
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                        <span className="ml-1 text-sm font-medium">4.8/5</span>
                      </div>
                    </div>
                  </div>

                  <CheckoutForm
                    checkoutData={checkoutData}
                    paymentData={paymentData}
                    token={token}
                    intentClientSecret={clientSecret}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </CardContent>
              </Card>
            </Elements>
          </div>
        </div>
      </div>
    </Layout>
  )
}