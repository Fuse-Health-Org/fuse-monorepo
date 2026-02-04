import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button, Card, CardBody } from '@heroui/react'
import { Icon } from '@iconify/react'
import { extractClinicSlugFromDomain } from '../lib/clinic-utils'
import { apiCall } from '../lib/api'

interface Clinic {
  id: string
  name: string
  slug: string
  logo: string
  defaultFormColor?: string
}

export default function VerifyEmail() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading')
  const [message, setMessage] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [loadingClinic, setLoadingClinic] = useState(true)
  const router = useRouter()
  const { token: queryToken } = router.query

  // Load clinic from domain (for custom domains and subdomains)
  useEffect(() => {
    const loadClinicFromDomain = async () => {
      setLoadingClinic(true)
      try {
        const domainInfo = await extractClinicSlugFromDomain()

        if (domainInfo.hasClinicSubdomain && domainInfo.clinicSlug) {
          console.log('🏥 Loading clinic from domain:', domainInfo.clinicSlug)

          const result = await apiCall(`/clinic/by-slug/${domainInfo.clinicSlug}`)

          if (result.success && result.data) {
            const clinicData = result.data.data || result.data
            setClinic(clinicData)
            console.log('✅ Loaded clinic data:', clinicData)
          }
        }
      } catch (err) {
        console.error('❌ Error loading clinic:', err)
      } finally {
        setLoadingClinic(false)
      }
    }

    loadClinicFromDomain()
  }, [])

  useEffect(() => {
    if (!queryToken || typeof queryToken !== 'string') {
      setStatus('invalid')
      setMessage('Invalid verification link')
      return
    }

    verifyEmail(queryToken)
  }, [queryToken])

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
          // Message is already set from backend
        } else if (data.token && data.user) {
          // Regular user - store token and auto-login
          localStorage.setItem('auth-token', data.token)

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
        return <Icon icon="eos-icons:loading" className="text-6xl text-blue-600" />
      case 'success':
        return <Icon icon="mdi:check-circle" className="text-6xl text-green-600" />
      case 'error':
      case 'invalid':
        return <Icon icon="mdi:close-circle" className="text-6xl text-red-600" />
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
        <title>Email Verification{clinic ? ` - ${clinic.name}` : ' - Fuse Health'}</title>
        <meta name="description" content="Verify your email address" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-6"
        >
          {/* Logo/Header */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex justify-center mb-4"
            >
              {clinic?.logo ? (
                <img
                  src={clinic.logo}
                  alt={clinic.name}
                  className="w-20 h-20 object-contain rounded-2xl shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Icon icon="mdi:office-building" className="text-3xl text-white" />
                </div>
              )}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            >
              {clinic?.name || 'Fuse Health'}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-gray-600 dark:text-gray-400 mt-2"
            >
              Email Verification
            </motion.p>
          </div>

          {/* Verification Status */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white dark:bg-gray-800 shadow-xl">
              <CardBody className="p-8">
                <div className="text-center space-y-6">
                  {/* Status Icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
                    className="flex justify-center"
                  >
                    {getStatusIcon()}
                  </motion.div>

                  {/* Status Message */}
                  <div className="space-y-2">
                    <h3 className={`text-xl font-bold ${getStatusColor()}`}>
                      {status === 'loading' && 'Verifying your email...'}
                      {status === 'success' && 'Account Activated!'}
                      {status === 'error' && 'Verification Failed'}
                      {status === 'invalid' && 'Invalid Link'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {message}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {status === 'success' && isLoggingIn && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2">
                        <Icon icon="eos-icons:loading" className="text-xl" />
                        Logging you in and redirecting to dashboard...
                      </div>
                    )}

                    {status === 'success' && !isLoggingIn && requiresApproval && (
                      <Button
                        onClick={() => router.push('/signin')}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold"
                        size="lg"
                      >
                        Return to Home
                      </Button>
                    )}

                    {status === 'success' && !isLoggingIn && !requiresApproval && (
                      <Button
                        onClick={() => router.push('/')}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold"
                        size="lg"
                      >
                        Go to Dashboard
                      </Button>
                    )}

                    {(status === 'error' || status === 'invalid') && (
                      <div className="space-y-3">
                        <Button
                          onClick={handleResendEmail}
                          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold"
                          size="lg"
                        >
                          Request New Verification Email
                        </Button>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Or{' '}
                          <Link href="/signin" className="text-blue-600 hover:text-blue-700 font-medium">
                            sign in
                          </Link>{' '}
                          if you already have an account
                        </p>
                      </div>
                    )}

                    {status === 'loading' && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Please wait while we verify your email address...
                      </p>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-sm text-gray-500 dark:text-gray-400"
          >
            {clinic ? (
              <p>Powered by Fuse Health</p>
            ) : (
              <p>© {new Date().getFullYear()} Fuse Health. All rights reserved.</p>
            )}
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}
