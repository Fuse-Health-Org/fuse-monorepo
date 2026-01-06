import type { AppProps } from 'next/app'
import Head from 'next/head'
import { Analytics } from "@vercel/analytics/next"
import { useRouter } from 'next/router'
import { AuthProvider } from '@/contexts/AuthContext'
import { TenantProvider } from '@/contexts/TenantContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import "../styles/globals.css"
import { Toaster } from "sonner"

const publicPages = ['/signin']

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
        </AuthProvider>
      </ThemeProvider>
    </>
  )
}