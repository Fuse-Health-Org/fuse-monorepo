import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Building2, User, Mail, Phone, MapPin, Globe } from 'lucide-react'

interface FormData {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  companyName: string
  businessType: string
  website: string
  phoneNumber: string
  address: string
  city: string
  state: string
  zipCode: string
}

export default function SignUp() {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    businessType: '',
    website: '',
    phoneNumber: '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const router = useRouter()
  const [invitationInfo, setInvitationInfo] = useState<any>(null)
  const [loadingInvitation, setLoadingInvitation] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  // Load invitation information if invitation parameter exists
  useEffect(() => {
    const loadInvitation = async () => {
      const invitationSlug = router.query.invitation as string
      if (!invitationSlug) return

      // Fixed MDI link - no need to fetch from API
      if (invitationSlug === "mdi") {
        setInvitationInfo({
          invitationType: "mdi",
          patientPortalDashboardFormat: "md-integrations",
        })
        setLoadingInvitation(false)
        return
      }

      // Doctor invitation - fetch from API
      setLoadingInvitation(true)
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const response = await fetch(`${apiUrl}/brand-invitations/${invitationSlug}`)
        const data = await response.json()

        if (response.ok && data.success) {
          setInvitationInfo(data.data.invitation)
        } else {
          setError(data.message || 'Invalid invitation link')
        }
      } catch (error) {
        setError('Failed to load invitation information')
      } finally {
        setLoadingInvitation(false)
      }
    }

    if (router.isReady) {
      loadInvitation()
    }
  }, [router.isReady, router.query.invitation])

  // Password strength validation
  const validatePasswordStrength = (password: string): number => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Update password strength in real-time
    if (field === 'password') {
      setPasswordStrength(validatePasswordStrength(value))
    }
  }

  const validateForm = (): string | null => {
    // Required fields validation
    const requiredFields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'companyName', 'businessType', 'phoneNumber']

    for (const field of requiredFields) {
      if (!formData[field as keyof FormData]) {
        return `${field.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase())} is required`
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address'
    }

    // Password strength validation
    if (passwordStrength < 4) {
      return 'Password must contain at least 8 characters, including uppercase, lowercase, numbers, and special characters'
    }

    // Password confirmation
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match'
    }

    // Terms agreement validation
    if (!agreedToTerms || !agreedToPrivacy) {
      return 'You must agree to the Terms of Service and Privacy Policy'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate form
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          role: 'brand',
          phoneNumber: formData.phoneNumber,
          clinicName: formData.companyName,
          businessType: formData.businessType,
          website: formData.website,
          ...(router.query.invitation && { invitationSlug: router.query.invitation as string })
        }),
      })

      const data = await response.json()

      console.log('Signup response:', { status: response.status, data })

      if (response.ok && data.success) {
        // Show success message and redirect to dashboard
        router.push('/?message=Account created successfully! Welcome to Fuse.')
      } else {
        // Handle different types of errors
        let errorMessage = 'Signup failed'

        if (response.status === 409) {
          errorMessage = 'An account with this email already exists. Please use a different email or try signing in.'
        } else if (data.message) {
          errorMessage = data.message
        }

        console.log('Setting error:', errorMessage)
        setError(errorMessage)
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
      // Clear passwords for security
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
    }
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return 'bg-red-500'
    if (passwordStrength === 3) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 2) return 'Weak'
    if (passwordStrength === 3) return 'Good'
    return 'Strong'
  }

  const passwordsMatch = formData.password === formData.confirmPassword || formData.confirmPassword === ''

  return (
    <>
      <Head>
        <title>Brand Sign Up - Fuse</title>
        <meta name="description" content="Create your brand partner account" />
      </Head>

      <div className="h-screen bg-background overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto space-y-6 p-4 py-8">
          {/* Logo/Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Fuse</h1>
            <p className="text-muted-foreground">Create your brand partner account</p>
          </div>

          {/* Invitation Info Banner */}
          {loadingInvitation && (
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Loading invitation information...</p>
              </CardContent>
            </Card>
          )}

          {invitationInfo && !loadingInvitation && (
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <h3 className="font-semibold text-foreground">
                      {invitationInfo.invitationType === 'doctor' 
                        ? `Invited by ${invitationInfo.doctor?.firstName || ''} ${invitationInfo.doctor?.lastName || ''}`
                        : 'Invited by MD Integrations'}
                    </h3>
                  </div>
                  {invitationInfo.clinic && (
                    <p className="text-sm text-muted-foreground">
                      You'll be connected to <strong>{invitationInfo.clinic.name}</strong>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Your brand will be automatically configured to use {invitationInfo.patientPortalDashboardFormat === 'md-integrations' ? 'MD Integrations' : 'Fuse'} as the doctor portal.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sign Up Form */}
          <Card className="bg-card border-border">
            <CardHeader className="space-y-1">
              <CardTitle className="text-center">Brand Partner Sign Up</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-sm font-medium text-foreground">
                      First Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="John"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-sm font-medium text-foreground">
                      Last Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Smith"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Business Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="john@company.com"
                      required
                    />
                  </div>
                </div>

                {/* Company Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="companyName" className="text-sm font-medium text-foreground">
                      Company Name *
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="companyName"
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Acme Healthcare Solutions"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="businessType" className="text-sm font-medium text-foreground">
                      Business Type *
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <select
                        id="businessType"
                        value={formData.businessType}
                        onChange={(e) => handleInputChange('businessType', e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        required
                      >
                        <option value="" disabled>Select type</option>
                        <option value="clinic">Medical Clinic</option>
                        <option value="telehealth">Telehealth Provider</option>
                        <option value="wellness">Wellness Center</option>
                        <option value="pharmacy">Pharmacy</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="website" className="text-sm font-medium text-foreground">
                      Website
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="website"
                        type="text"
                        value={formData.website}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="company.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-2">
                  <label htmlFor="phoneNumber" className="text-sm font-medium text-foreground">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="+1 (555) 123-4567"
                      required
                    />
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-2">
                  <label htmlFor="address" className="text-sm font-medium text-foreground">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="123 Business St"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="city" className="text-sm font-medium text-foreground">
                      City
                    </label>
                    <input
                      id="city"
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="San Francisco"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="state" className="text-sm font-medium text-foreground">
                      State
                    </label>
                    <input
                      id="state"
                      type="text"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="CA"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="zipCode" className="text-sm font-medium text-foreground">
                      ZIP Code
                    </label>
                    <input
                      id="zipCode"
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => handleInputChange('zipCode', e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="94105"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Create a strong password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Password Strength:</span>
                      <span className={`font-medium ${passwordStrength <= 2 ? 'text-red-600' : passwordStrength === 3 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {getPasswordStrengthText()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                        style={{ width: `${(passwordStrength / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className={`w-full px-3 py-2 pr-10 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring ${passwordsMatch ? 'border-input' : 'border-red-500'
                        }`}
                      placeholder="Confirm your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!passwordsMatch && (
                    <p className="text-xs text-red-600">Passwords do not match</p>
                  )}
                </div>

                {/* Terms and Privacy Checkboxes */}
                <div className="space-y-3 pt-4">
                  <div className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="terms" className="text-sm text-foreground">
                      I agree to the{' '}
                      <Link href="/terms" className="text-primary hover:underline">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link href="/privacy" className="text-primary hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>

                  <div className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      id="privacy"
                      checked={agreedToPrivacy}
                      onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                      className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="privacy" className="text-sm text-foreground">
                      I acknowledge that I have read and understand the{' '}
                      <Link href="/privacy-notice" className="text-primary hover:underline">
                        Privacy Notice
                      </Link>{' '}
                      regarding the use and disclosure of business information
                    </label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !agreedToTerms || !agreedToPrivacy}
                >
                  {isLoading ? 'Creating account...' : 'Create Brand Account'}
                </Button>

                {/* Error Message - Moved to bottom for better visibility */}
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md mt-4">
                    {error}
                  </div>
                )}
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/signin" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}