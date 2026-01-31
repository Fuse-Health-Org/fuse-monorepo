import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2, Stethoscope } from 'lucide-react'

export default function VerifyEmail() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading')
    const [message, setMessage] = useState('')
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const router = useRouter()
    const { token: queryToken } = router.query

    useEffect(() => {
        if (!queryToken || typeof queryToken !== 'string') {
            setStatus('invalid')
            setMessage('Invalid verification link')
            return
        }

        verifyEmail(queryToken)
    }, [queryToken])

    const [requiresApproval, setRequiresApproval] = useState(false)

    const verifyEmail = async (token: string) => {
        try {
            setStatus('loading')

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const response = await fetch(`${apiUrl}/auth/verify-email?token=${token}`)
            const data = await response.json()

            if (response.ok && data.success) {
                setStatus('success')
                setMessage(data.message || 'Account activated successfully!')

                // Check if this is a doctor who needs approval
                if (data.requiresApproval) {
                    // Doctor verified email but needs approval - don't auto-login
                    setIsLoggingIn(false)
                    setRequiresApproval(true)
                    // Message is already set from backend, show link to signin page
                } else if (data.token && data.user) {
                    // Regular user or approved doctor - store token and auto-login
                    localStorage.setItem('doctor_token', data.token)
                    localStorage.setItem('doctor_user', JSON.stringify(data.user))

                    setIsLoggingIn(true)

                    // Redirect to dashboard after a short delay with full page reload to refresh auth context
                    setTimeout(() => {
                        window.location.href = '/'
                    }, 2000)
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
        // This would require implementing a resend verification email endpoint
        // For now, redirect to signup
        router.push('/signup')
    }

    const getStatusIcon = () => {
        switch (status) {
            case 'loading':
                return <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
            case 'success':
                return <CheckCircle className="h-16 w-16 text-green-600" />
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
                <title>Email Verification - Doctor Portal</title>
                <meta name="description" content="Verify your email address" />
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
                                    {status === 'error' && 'Verification Failed'}
                                    {status === 'invalid' && 'Invalid Link'}
                                </h3>
                                <p className="text-muted-foreground">
                                    {message}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                {status === 'success' && isLoggingIn && (
                                    <div className="text-sm text-muted-foreground">
                                        Logging you in and redirecting to dashboard...
                                    </div>
                                )}

                                {status === 'success' && !isLoggingIn && requiresApproval && (
                                    <Button
                                        onClick={() => router.push('/signin')}
                                        className="w-full"
                                    >
                                        Go to Sign In
                                    </Button>
                                )}

                                {status === 'success' && !isLoggingIn && !requiresApproval && (
                                    <Button
                                        onClick={() => router.push('/')}
                                        className="w-full"
                                    >
                                        Go to Dashboard
                                    </Button>
                                )}

                                {(status === 'error' || status === 'invalid') && (
                                    <div className="space-y-2">
                                        <Button
                                            onClick={handleResendEmail}
                                            className="w-full"
                                        >
                                            Request New Verification Email
                                        </Button>
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
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    )
}

