import type { AppProps } from 'next/app'
import Head from 'next/head'
import { Analytics } from "@vercel/analytics/next"
import { useRouter } from 'next/router'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AmplitudeProvider } from '@fuse/amplitude'
import { TenantProvider } from '@/contexts/TenantContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import "../styles/globals.css"
import { Toaster } from "sonner"

const publicPages = ['/signin', '/forgot-password']

function AmplitudeWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return (
    <AmplitudeProvider
      config={{
        apiKey: process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || '',
        appName: 'tenant',
        debug: process.env.NODE_ENV === 'development',
      }}
      user={user ? { id: user.id, role: user.role } : null}
    >
      {children}
    </AmplitudeProvider>
  )
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isPublicPage = publicPages.includes(router.pathname)

  return (
    <>
      <Head>
        <title>Tenant Portal</title>
        <meta name="description" content="Tenant management portal for clinic onboarding and management" />
        <meta name="generator" content="Next.js" />
      </Head>
      <ThemeProvider>
        <AuthProvider>
          <AmplitudeWrapper>
            <TenantProvider>
              <div className="font-sans">
              {isPublicPage ? (
                <Component {...pageProps} />
              ) : (
                <ProtectedRoute>
                  <Component {...pageProps} />
                </ProtectedRoute>
              )}
              <Toaster richColors position="top-right" />
              {process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true' && <Analytics />}
              </div>
            </TenantProvider>
          </AmplitudeWrapper>
        </AuthProvider>
      </ThemeProvider>
    </>
  )
}