import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { AmplitudeProvider } from '@fuse/amplitude'
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
        console.log('🔍 [AFFILIATE CHECK] Starting affiliate subdomain check...');
        const domainInfo = await extractAffiliateSlugFromDomain()
        
        console.log('🔍 [AFFILIATE CHECK] Domain info extracted:', domainInfo);
        
        if (domainInfo.hasAffiliateSubdomain && domainInfo.affiliateSlug) {
          console.log('👤 [AFFILIATE CHECK] Affiliate subdomain detected:', domainInfo)
          
          // Get affiliate info to verify it exists
          console.log('🔍 [AFFILIATE CHECK] Fetching affiliate info for slug:', domainInfo.affiliateSlug);
          const result = await apiCall(`/public/affiliate/by-slug/${domainInfo.affiliateSlug}`)
          
          console.log('🔍 [AFFILIATE CHECK] API response:', result);
          console.log('🔍 [AFFILIATE CHECK] result.data:', result.data);
          console.log('🔍 [AFFILIATE CHECK] result.data.data:', result.data?.data);
          
          // Handle both result.data and result.data.data (depending on how apiCall wraps the response)
          const affiliateData = result.data?.clinicId ? result.data : result.data?.data;
          console.log('🔍 [AFFILIATE CHECK] affiliateData:', affiliateData);
          
          if (result.success && affiliateData?.clinicId) {
            const affiliateId = affiliateData.clinicId
            const affiliateUserId = affiliateData.id
            console.log('✅ [AFFILIATE CHECK] Affiliate found with clinicId:', affiliateId, 'userId:', affiliateUserId);
            console.log('✅ [AFFILIATE CHECK] Full affiliateData:', JSON.stringify(affiliateData, null, 2));
            
            // Store affiliateId (clinicId) in localStorage for likes and order creation
            if (typeof window !== 'undefined') {
              console.log('💾 [AFFILIATE CHECK] Attempting to save to localStorage...');
              console.log('💾 [AFFILIATE CHECK] Value to save:', affiliateId);
              localStorage.setItem('affiliateId', affiliateId)
              console.log('✅ [AFFILIATE CHECK] localStorage.setItem completed');
              
              // Verify it was saved
              const savedId = localStorage.getItem('affiliateId');
              console.log('✅ [AFFILIATE CHECK] Verification - Read back from localStorage:', savedId);
              console.log('✅ [AFFILIATE CHECK] Match?', savedId === affiliateId);
              
              // List all keys in localStorage
              console.log('🗂️ [AFFILIATE CHECK] All localStorage keys:', Object.keys(localStorage));
            }
            
            // Check if user is authenticated and is the affiliate
            const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
            if (token) {
              try {
                const userResult = await apiCall('/auth/me')
                if (userResult.success && userResult.data?.id === affiliateUserId) {
                  // User is the affiliate, redirect to affiliate portal
                  const affiliatePortalUrl = process.env.NEXT_PUBLIC_AFFILIATE_PORTAL_URL || 'http://localhost:3005'
                  console.log('🔄 [AFFILIATE CHECK] Redirecting affiliate to portal:', affiliatePortalUrl)
                  window.location.href = affiliatePortalUrl
                  return
                }
              } catch (err) {
                // User not authenticated or not the affiliate, continue with patient portal
                console.log('ℹ️ [AFFILIATE CHECK] User is not the affiliate, continuing with patient portal')
              }
            }
            // If user is not authenticated or not the affiliate, they can browse the patient portal
            // The affiliateId is stored and will be used when creating orders (backend will detect it from hostname)
          } else {
            console.warn('⚠️ [AFFILIATE CHECK] Affiliate not found or API failed:', result);
          }
        } else {
          console.log('ℹ️ [AFFILIATE CHECK] No affiliate subdomain detected');
          // Clear affiliateId if not on affiliate subdomain
          if (typeof window !== 'undefined') {
            localStorage.removeItem('affiliateId')
            console.log('🗑️ [AFFILIATE CHECK] Cleared affiliateId from localStorage');
          }
        }
      } catch (error) {
        console.error('❌ [AFFILIATE CHECK] Error checking affiliate subdomain:', error)
      }
    }

    checkAffiliateSubdomain()
  }, [router])

  return null
}

function AmplitudeWrapper({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()
    return (
        <AmplitudeProvider
            config={{
                apiKey: process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || '',
                appName: 'patient',
                debug: process.env.NODE_ENV === 'development',
            }}
            user={user ? { id: user.id, role: user.role, clinicId: user.clinicId } : null}
        >
            {children}
        </AmplitudeProvider>
    )
}

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <HeroUIProvider>
            <ToastProvider />
            <AuthProvider>
                <AmplitudeWrapper>
                    <ProtectedRouteProvider>
                        <AffiliateRedirectHandler />
                        <Component {...pageProps} />
                    </ProtectedRouteProvider>
                </AmplitudeWrapper>
            </AuthProvider>
        </HeroUIProvider>
    )
}

export default MyApp