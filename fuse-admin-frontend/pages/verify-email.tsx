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
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading')
  const [message, setMessage] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [showResendForm, setShowResendForm] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resendMessage, setResendMessage] = useState('')
  const router = useRouter()
  const { token: queryToken } = router.query

  useEffect(() => {
    // Wait for router to be ready before checking query params
    if (!router.isReady) return

    if (!queryToken || typeof queryToken !== 'string') {
      setStatus('invalid')
      setMessage('Invalid verification link')
      return
    }

    verifyEmail(queryToken)
  }, [router.isReady, queryToken])

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
    if (!resendEmail) {
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
        body: JSON.stringify({ email: resendEmail }),
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
        <title>Email Verification - Fuse</title>
        <meta name="description" content="Verify your email address" />
      </Head>
      
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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

                {status === 'success' && !isLoggingIn && (
                  <Button 
                    onClick={() => router.push('/')}
                    className="w-full"
                  >
                    Go to Dashboard
                  </Button>
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}