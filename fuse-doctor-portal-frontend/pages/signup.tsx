import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Stethoscope, User, Mail, Phone, MapPin } from 'lucide-react'
import { US_STATES } from '@fuse/enums'

interface FormData {
    firstName: string
    lastName: string
    email: string
    password: string
    confirmPassword: string
    phoneNumber: string
    npiNumber: string
    licensedStates: string[]
}

export default function SignUp() {
    const [formData, setFormData] = useState<FormData>({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phoneNumber: '',
        npiNumber: '',
        licensedStates: []
    })
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [passwordStrength, setPasswordStrength] = useState(0)
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { user } = useAuth()
    const router = useRouter()

    // Redirect if already authenticated
    useEffect(() => {
        if (user) {
            router.push('/')
        }
    }, [user, router])

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

    const toggleState = (stateCode: string) => {
        setFormData(prev => {
            const currentStates = prev.licensedStates || []
            const newStates = currentStates.includes(stateCode)
                ? currentStates.filter(code => code !== stateCode)
                : [...currentStates, stateCode]
            
            return {
                ...prev,
                licensedStates: newStates
            }
        })
    }

    const validateForm = (): string | null => {
        // Required fields validation
        const requiredFields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'phoneNumber', 'npiNumber']

        for (const field of requiredFields) {
            const value = formData[field as keyof FormData]
            if (!value || (typeof value === 'string' && value.trim() === '')) {
                return `${field.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase())} is required`
            }
        }

        // NPI number validation (must be exactly 10 digits)
        if (!/^\d{10}$/.test(formData.npiNumber.trim())) {
            return 'NPI number must be exactly 10 digits'
        }

        // License coverage validation
        if (!formData.licensedStates || formData.licensedStates.length === 0) {
            return 'You must select at least one state where you are licensed to prescribe'
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
        if (!agreedToTerms) {
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
            
            const signupData = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                password: formData.password,
                role: 'doctor',
                phoneNumber: formData.phoneNumber,
                npiNumber: formData.npiNumber,
                doctorLicenseStatesCoverage: formData.licensedStates
            }
            
            const response = await fetch(`${apiUrl}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(signupData),
            })

            const data = await response.json()

            if (response.ok && data.success) {
                // Use the message from backend which includes email verification info
                const message = encodeURIComponent(data.message || 'Account created successfully! Please check your email to verify your account.')
                router.push(`/signin?message=${message}`)
            } else {
                let errorMessage = 'Signup failed'

                if (response.status === 409) {
                    errorMessage = 'An account with this email already exists. Please use a different email or try signing in.'
                } else if (response.status === 400 && data.message === 'Validation failed') {
                    // More detailed error for validation failures
                    if (data.errors && data.errors.length > 0) {
                        const errorDetails = data.errors.map((err: any) => err.message).join(', ')
                        errorMessage = `Validation failed: ${errorDetails}`
                    } else {
                        errorMessage = 'Please check all required fields: First Name, Last Name, Email, Phone Number, and Password (must be at least 8 characters with uppercase, lowercase, number, and special character)'
                    }
                } else if (data.message) {
                    errorMessage = data.message
                }

                setError(errorMessage)
            }
        } catch (error) {
            setError('Network error. Please try again.')
        } finally {
            setIsLoading(false)
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
                <title>Doctor Sign Up - Fuse</title>
                <meta name="description" content="Create your doctor account" />
            </Head>

            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-2xl space-y-6">
                    {/* Logo/Header */}
                    <div className="text-center">
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                                <Stethoscope className="h-6 w-6 text-primary-foreground" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Doctor Portal</h1>
                        <p className="text-muted-foreground">Create your doctor account</p>
                    </div>

                    {/* Sign Up Form */}
                    <Card className="bg-card border-border">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-center">Doctor Sign Up</CardTitle>
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
                                        Email *
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                            className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                            placeholder="doctor@example.com"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Phone Number */}
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

                                {/* NPI Number */}
                                <div className="space-y-2">
                                    <label htmlFor="npiNumber" className="text-sm font-medium text-foreground">
                                        NPI Number *
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            id="npiNumber"
                                            type="text"
                                            value={formData.npiNumber}
                                            onChange={(e) => {
                                                // Only allow digits
                                                const value = e.target.value.replace(/\D/g, '').slice(0, 10)
                                                handleInputChange('npiNumber', value)
                                            }}
                                            className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                            placeholder="1234567890"
                                            maxLength={10}
                                            pattern="\d{10}"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        10-digit National Provider Identifier for healthcare providers
                                    </p>
                                </div>

                                {/* License Coverage */}
                                <div className="space-y-2">
                                    <label htmlFor="licenseCoverage" className="text-sm font-medium text-foreground flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        License Coverage *
                                    </label>
                                    <div className="border border-input rounded-md p-4 max-h-64 overflow-y-auto bg-background">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                            {US_STATES.map((state) => (
                                                <label
                                                    key={state.key}
                                                    className="flex items-center space-x-2 cursor-pointer hover:bg-muted p-2 rounded text-sm"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.licensedStates.includes(state.key)}
                                                        onChange={() => toggleState(state.key)}
                                                        className="w-4 h-4 text-primary border-input rounded focus:ring-primary"
                                                    />
                                                    <span className="text-foreground">
                                                        {state.key} - {state.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Select all states where you hold an active medical license ({formData.licensedStates.length} selected)
                                    </p>
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

                                {/* Terms Checkbox */}
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
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isLoading || !agreedToTerms || !formData.npiNumber || formData.npiNumber.length !== 10 || formData.licensedStates.length === 0}
                                >
                                    {isLoading ? 'Creating account...' : 'Create Doctor Account'}
                                </Button>

                                {/* Error Message */}
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

