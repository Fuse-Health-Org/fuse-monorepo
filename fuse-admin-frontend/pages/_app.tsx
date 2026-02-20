import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Analytics } from "@vercel/analytics/next"
import { useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AmplitudeProvider } from '@fuse/amplitude'
import { PostHogAnalyticsProvider } from '@fuse/posthog'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import { ToastManager } from '@/components/ui/toast'
import "../styles/globals.css"
import "react-image-crop/dist/ReactCrop.css"

// Pages that don't require authentication
const publicPages = ['/signin', '/signup', '/verify-email', '/terms', '/privacy', '/privacy-notice', '/forgot-password']

function AmplitudeWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return (
    <AmplitudeProvider
      config={{
        apiKey: process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || '',
        appName: 'admin',
        debug: process.env.NODE_ENV === 'development',
        sessionReplay: { sampleRate: 0.01 },
      }}
      user={user ? { id: user.id, role: user.role, clinicId: user.clinicId } : null}
    >
      {children}
    </AmplitudeProvider>
  )
}

export default function App({ Component, pageProps }: AppProps & { showToast?: (type: 'success' | 'error', message: string) => void }) {
  const router = useRouter()
  const isPublicPage = publicPages.includes(router.pathname)
  // Embedded pages (?embedded=1) skip ProtectedRoute so the auth loading
  // screen and full sidebar never flash inside the iframe.
  // useState+useEffect keeps server/client in sync (avoids hydration mismatch).
  const [isEmbedded, setIsEmbedded] = useState(false)
  useEffect(() => {
    setIsEmbedded(new URLSearchParams(window.location.search).get('embedded') === '1')
  }, [])

  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error'; message: string }>>([])

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 3000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const content = (
    <div className="font-sans">
      {isPublicPage || isEmbedded ? (
        <Component {...pageProps} showToast={showToast} />
      ) : (
        <ProtectedRoute>
          <Component {...pageProps} showToast={showToast} />
        </ProtectedRoute>
      )}
      {process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true' && <Analytics />}
    </div>
  )

  return (
    <>
      <Head>
        <title>Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for managing business operations" />
        <meta name="generator" content="Next.js" />
      </Head>
      <ThemeProvider>
        <AuthProvider>
          <PostHogAnalyticsProvider
            config={{
              apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
              host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
              enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== 'false',
            }}
          >
            <AmplitudeWrapper>
              {content}
              <ToastManager toasts={toasts} onDismiss={dismissToast} />
            </AmplitudeWrapper>
          </PostHogAnalyticsProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  )
}