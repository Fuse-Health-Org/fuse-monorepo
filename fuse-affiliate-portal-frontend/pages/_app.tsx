import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { AmplitudeProvider } from '@fuse/amplitude'
import { PostHogAnalyticsProvider } from '@fuse/posthog'
import { ThemeProvider } from '../contexts/ThemeContext'

function AmplitudeWrapper({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()
    return (
        <AmplitudeProvider
            config={{
                apiKey: process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || '',
                appName: 'affiliate',
                debug: process.env.NODE_ENV === 'development',
                sessionReplay: { sampleRate: 0.01 },
            }}
            user={user ? { id: user.id, role: user.role, clinicId: user.clinicId } : null}
        >
            {children}
        </AmplitudeProvider>
    )
}

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <ThemeProvider>
            <HeroUIProvider>
                <ToastProvider />
                <AuthProvider>
                    <PostHogAnalyticsProvider
                        config={{
                            apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
                            host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
                            enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== 'false',
                        }}
                    >
                        <AmplitudeWrapper>
                            <Component {...pageProps} />
                        </AmplitudeWrapper>
                    </PostHogAnalyticsProvider>
                </AuthProvider>
            </HeroUIProvider>
        </ThemeProvider>
    )
}

export default MyApp

