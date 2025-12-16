import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { AuthProvider } from '../contexts/AuthContext'
import { ProtectedRouteProvider } from '../providers/ProtectedRouteProvider'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { extractAffiliateSlugFromDomain } from '../lib/affiliate-utils'
import { apiCall } from '../lib/api'

function AffiliateRedirectHandler() {
  const router = useRouter()

  useEffect(() => {
    const checkAffiliateSubdomain = async () => {
      try {
        const domainInfo = await extractAffiliateSlugFromDomain()
        
        if (domainInfo.hasAffiliateSubdomain && domainInfo.affiliateSlug) {
          console.log('👤 Affiliate subdomain detected:', domainInfo)
          
          // Get affiliate info to verify it exists
          const result = await apiCall(`/public/affiliate/by-slug/${domainInfo.affiliateSlug}`)
          
          if (result.success && result.data?.id) {
            const affiliateId = result.data.id
            // Store affiliateId in localStorage for order creation
            if (typeof window !== 'undefined') {
              localStorage.setItem('affiliateId', affiliateId)
              console.log('✅ Stored affiliateId:', affiliateId)
            }
            
            // Check if user is authenticated and is the affiliate
            const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
            if (token) {
              try {
                const userResult = await apiCall('/auth/me')
                if (userResult.success && userResult.data?.id === affiliateId) {
                  // User is the affiliate, redirect to affiliate portal
                  const affiliatePortalUrl = process.env.NEXT_PUBLIC_AFFILIATE_PORTAL_URL || 'http://localhost:3005'
                  console.log('🔄 Redirecting affiliate to portal:', affiliatePortalUrl)
                  window.location.href = affiliatePortalUrl
                  return
                }
              } catch (err) {
                // User not authenticated or not the affiliate, continue with patient portal
                console.log('ℹ️ User is not the affiliate, continuing with patient portal')
              }
            }
            // If user is not authenticated or not the affiliate, they can browse the patient portal
            // The affiliateId is stored and will be used when creating orders (backend will detect it from hostname)
          }
        } else {
          // Clear affiliateId if not on affiliate subdomain
          if (typeof window !== 'undefined') {
            localStorage.removeItem('affiliateId')
          }
        }
      } catch (error) {
        console.error('❌ Error checking affiliate subdomain:', error)
      }
    }

    checkAffiliateSubdomain()
  }, [router])

  return null
}

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <HeroUIProvider>
            <ToastProvider />
            <AuthProvider>
                <ProtectedRouteProvider>
                    <AffiliateRedirectHandler />
                    <Component {...pageProps} />
                </ProtectedRouteProvider>
            </AuthProvider>
        </HeroUIProvider>
    )
}

export default MyApp