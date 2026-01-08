import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Check,
  AlertCircle,
  ArrowRight,
  Building2,
  Shield
} from 'lucide-react'
import Layout from '@/components/Layout'

interface PlanFeatures {
  maxProducts: number
  maxCampaigns: number
  analyticsAccess: boolean
  customerSupport: string
  customBranding: boolean
  apiAccess?: boolean
  whiteLabel?: boolean
  customIntegrations?: boolean
}

interface TierConfig {
  canAddCustomProducts: boolean
  hasAccessToAnalytics: boolean
  canUploadCustomProductImages: boolean
  hasCustomPortal: boolean
  hasPrograms: boolean
  canCustomizeFormStructure: boolean
  customTierCardText: string[] | null
  isCustomTierCardTextActive: boolean
}

interface Plan {
  name: string
  price: number
  planType?: string
  features: PlanFeatures
  stripePriceId: string
  id?: string
  tierConfig?: TierConfig | null
}

interface PlansResponse {
  [key: string]: Plan
}

interface Subscription {
  id: string
  planType: string
  status: string
  monthlyPrice: number
  currentPeriodStart?: string
  currentPeriodEnd?: string
  daysUntilRenewal: number
  isActive: boolean
  isTrialing: boolean
  planDetails: Plan
}

// Generate feature text from TierConfig
function generateFeatureText(plan: Plan): string[] {
  // If custom text is active and provided, use it exclusively
  if (plan.tierConfig?.isCustomTierCardTextActive && plan.tierConfig?.customTierCardText?.length) {
    return plan.tierConfig.customTierCardText
  }

  // Auto-generate based on tier config toggles (only show what's explicitly enabled)
  const features: string[] = []
  const tierConfig = plan.tierConfig

  // Max products (from plan features, not tier config)
  if (plan.features?.maxProducts === -1) {
    features.push('Unlimited products')
  } else if (plan.features?.maxProducts) {
    features.push(`Up to ${plan.features.maxProducts} products`)
  }

  // Only add features that are explicitly enabled in tier config
  if (tierConfig?.hasCustomPortal) {
    features.push('Custom portal')
  }

  if (tierConfig?.canCustomizeFormStructure) {
    features.push('Custom form structures')
  }

  if (tierConfig?.hasPrograms) {
    features.push('Programs & bundles')
  }

  if (tierConfig?.hasAccessToAnalytics) {
    features.push('Advanced analytics')
  }

  if (tierConfig?.canAddCustomProducts) {
    features.push('Create custom products')
  }

  if (tierConfig?.canUploadCustomProductImages) {
    features.push('Custom product images')
  }

  return features
}

export default function Plans() {
  const [plans, setPlans] = useState<PlansResponse | null>(null)
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [creatingCheckout, setCreatingCheckout] = useState<string | null>(null)
  const [showSuperCheap, setShowSuperCheap] = useState(false)
  const [typedChars, setTypedChars] = useState('')
  const { user, token, hasActiveSubscription, refreshSubscription, authenticatedFetch } = useAuth()
  const router = useRouter()

  // Easter egg: Listen for "supercheaphack" to reveal Super Cheap plan
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      setTypedChars(prev => {
        const newChars = (prev + e.key).slice(-15) // Keep last 15 chars
        if (newChars === 'supercheaphack') {
          setShowSuperCheap(true)
          console.log('🎉 Super Cheap plan unlocked!')
        }
        return newChars
      })
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // Handle URL messages
  useEffect(() => {
    if (router.query.message) {
      setMessage(router.query.message as string)
    }
  }, [router.query.message])

  // Handle success/cancel parameters
  useEffect(() => {
    const { success, canceled } = router.query

    if (success === 'true') {
      setError(null)
      refreshSubscription().finally(() => {
        router.replace('/settings?message=Subscription activated successfully!', undefined, { shallow: true })
      })
    }

    if (canceled === 'true') {
      setError('Payment was canceled. You can try again anytime.')
      setTimeout(() => {
        router.replace('/plans', undefined, { shallow: true })
      }, 3000)
    }
  }, [router.query, refreshSubscription, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return

      try {
        setLoading(true)

        const plansResponse = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/brand-subscriptions/plans`,
          { method: 'GET' }
        )

        if (plansResponse.ok) {
          const plansData = await plansResponse.json()
          if (plansData.success && plansData.plans) {
            const plansObject = plansData.plans.reduce((acc: PlansResponse, plan: any) => {
              acc[plan.planType] = {
                name: plan.name,
                price: plan.monthlyPrice,
                planType: plan.planType,
                features: plan.features,
                stripePriceId: plan.stripePriceId,
                id: plan.id,
                tierConfig: plan.tierConfig || null
              }
              return acc
            }, {} as PlansResponse)
            setPlans(plansObject)
          }
        }

        const subResponse = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/subscriptions/current`,
          { method: 'GET', skipLogoutOn401: true }
        )

        if (subResponse.status === 401) {
          setCurrentSubscription(null)
        } else if (subResponse.ok) {
          const subData = await subResponse.json()
          if (subData && subData.status) {
            setCurrentSubscription({
              id: subData.id,
              planType: subData.plan?.type || subData.planType,
              status: subData.status,
              monthlyPrice: subData.plan?.price || subData.monthlyPrice || 0,
              currentPeriodStart: subData.currentPeriodStart,
              currentPeriodEnd: subData.nextBillingDate,
              daysUntilRenewal: 0,
              isActive: subData.status === 'active',
              isTrialing: subData.status === 'trialing',
              planDetails: subData.plan
            })
          } else {
            setCurrentSubscription(null)
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load subscription data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token, authenticatedFetch])

  const handleSelectPlan = async (planType: string) => {
    if (!token) {
      alert('You need to be signed in to select a plan.')
      return
    }

    if (!plans || !plans[planType]) {
      alert('Invalid plan selected.')
      return
    }

    const selectedPlan = plans[planType]
    const downpaymentAmount = selectedPlan.price

    try {
      setCreatingCheckout(planType)

      const payload = {
        selectedPlanCategory: planType,
        selectedPlanType: planType,
        selectedPlanName: selectedPlan.name,
        selectedPlanPrice: downpaymentAmount,
        selectedDownpaymentType: `downpayment_${planType}`,
        selectedDownpaymentName: `${selectedPlan.name} First Month`,
        selectedDownpaymentPrice: downpaymentAmount,
        planSelectionTimestamp: new Date().toISOString()
      }

      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/profile`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        alert('Plan selection failed. Status: ' + response.status)
        setCreatingCheckout(null)
        return
      }

      const queryParams = new URLSearchParams({
        planCategory: planType,
        subscriptionPlanType: planType,
        subscriptionPlanName: selectedPlan.name,
        subscriptionMonthlyPrice: selectedPlan.price.toString(),
        downpaymentPlanType: `downpayment_${planType}`,
        downpaymentName: `${selectedPlan.name} First Month`,
        downpaymentAmount: downpaymentAmount.toString(),
        brandSubscriptionPlanId: selectedPlan.id || '',
        stripePriceId: selectedPlan.stripePriceId || ''
      })

      router.push(`/checkout?${queryParams.toString()}`)
    } catch (error) {
      alert('Error saving plan selection: ' + (error instanceof Error ? error.message : String(error)))
      setCreatingCheckout(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><Clock className="h-3 w-3 mr-1" /> Processing</Badge>
      case 'payment_due':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><AlertCircle className="h-3 w-3 mr-1" /> Payment Due</Badge>
      case 'past_due':
        return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" /> Past Due</Badge>
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading subscription plans...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Head>
        <title>Subscription Plans - Fuse</title>
        <meta name="description" content="Choose your brand subscription plan" />
      </Head>

      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          {message && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-800">{message}</p>
            </div>
          )}

          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>500+ clinics powered</span>
              </div>
              <div className="w-px h-4 bg-border"></div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <span>HIPAA compliant</span>
              </div>
              <div className="w-px h-4 bg-border"></div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>Launch in 2 weeks</span>
              </div>
              <div className="w-px h-4 bg-border"></div>
              <Button
                variant="ghost"
                size="sm"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <AlertCircle className="w-4 h-4 mr-1" />
                Talk to expert
              </Button>
            </div>

            <h1 className="text-5xl font-bold text-foreground mb-6 leading-tight">
              Turn Your Clinic Into a
              <span className="text-foreground block">Telehealth Powerhouse</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              Your brand + Licensed physicians + Pharmacies =
              <span className="font-semibold text-foreground"> Recurring revenue</span>
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <XCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {router.query.success === 'true' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-green-700">Subscription created successfully! Welcome to Fuse Brand Partners.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
            {plans && Object.entries(plans)
              .filter(([key, plan]) => {
                // Hide Super Cheap plan unless the hack is activated
                if (plan.planType === 'supercheap' && !showSuperCheap) {
                  return false
                }
                return true
              })
              .map(([key, plan], index) => {
                const isCurrentPlan = currentSubscription?.planType === plan.planType && currentSubscription?.status === 'active'
                const isPopular = index === 0 // First plan is popular
                const Icon = index === 0 ? Building2 : Shield

                return (
                  <Card
                    key={key}
                    className={`relative group cursor-pointer transition-all duration-300 flex flex-col ${isPopular
                      ? 'shadow-xl scale-105 border-primary hover:shadow-2xl hover:scale-110 hover:border-primary/80'
                      : 'hover:shadow-xl hover:scale-105 hover:border-primary border-muted'
                      }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground font-medium">
                          MOST POPULAR
                        </Badge>
                      </div>
                    )}

                    <div className="absolute top-4 left-4">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Monthly
                      </Badge>
                    </div>

                    <CardHeader className="pt-12 pb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-5 w-5" />
                        <CardTitle className="text-xl font-semibold">{plan.name}</CardTitle>
                      </div>
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-[#825AD1]">
                          ${plan.price.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground"> / month</span>
                        <div className="text-xs text-muted-foreground mt-1">+ 1% transaction fee</div>
                      </div>
                    </CardHeader>

                    <CardContent className="flex flex-col h-full">
                      <ul className="space-y-3 mb-8 flex-grow">
                        {generateFeatureText(plan).map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className={`w-full transition-colors mt-auto ${isPopular
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
                          }`}
                        onClick={() => handleSelectPlan(plan.planType || key)}
                        disabled={!!creatingCheckout || isCurrentPlan}
                      >
                        {creatingCheckout === (plan.planType || key) ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                            Processing...
                          </>
                        ) : isCurrentPlan ? (
                          'Current Plan'
                        ) : (
                          <>
                            Get started
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
          </div>

          <div className="max-w-5xl mx-auto mt-16">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold mb-3">Why clinics choose Fuse</h2>
              <p className="text-muted-foreground">Everything you need to scale your telehealth practice</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8 items-stretch">
              <div className="relative group h-full">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-sky-500 rounded-2xl blur opacity-15 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-white border border-blue-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 h-full">
                  <div className="text-center h-full flex flex-col">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-foreground">Recurring Revenue</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-grow">
                      Build predictable monthly income that grows with your patient base
                    </p>
                    <div className="flex items-center justify-center text-xs font-medium text-blue-600 mt-auto">
                      <span>Monthly Recurring Revenue</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative group h-full">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-sky-500 rounded-2xl blur opacity-15 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-white border border-blue-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 h-full">
                  <div className="text-center h-full flex flex-col">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-foreground">1-2 Week Setup</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-grow">
                      From signup to treating your first patient in record time
                    </p>
                    <div className="flex items-center justify-center text-xs font-medium text-blue-600 mt-auto">
                      <span>Get started today</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative group h-full">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-sky-500 rounded-2xl blur opacity-15 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-white border border-blue-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 h-full">
                  <div className="text-center h-full flex flex-col">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-foreground">Zero Compliance Risk</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-grow">
                      Licensed physicians handle everything—you focus on growth
                    </p>
                    <div className="flex items-center justify-center text-xs font-medium text-blue-600 mt-auto">
                      <span>HIPAA compliant</span>
                      <Check className="w-3 h-3 ml-1" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative group h-full">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-sky-500 rounded-2xl blur opacity-15 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-white border border-blue-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 h-full">
                  <div className="text-center h-full flex flex-col">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-foreground">Transparent Pricing</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-grow">
                      Simple monthly fee + 1% transaction rate. No hidden costs or surprises
                    </p>
                    <div className="flex items-center justify-center text-xs font-medium text-blue-600 mt-auto">
                      <span>Industry standard rates</span>
                      <Check className="w-3 h-3 ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}