import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { AmplitudeProvider } from '@fuse/amplitude'
import { ThemeProvider } from '../contexts/ThemeContext'

function AmplitudeWrapper({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()
    return (
        <AmplitudeProvider
            config={{
                apiKey: process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || '',
                appName: 'affiliate',
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
        <ThemeProvider>
            <HeroUIProvider>
                <ToastProvider />
                <AuthProvider>
                    <AmplitudeWrapper>
                        <Component {...pageProps} />
                    </AmplitudeWrapper>
                </AuthProvider>
            </HeroUIProvider>
        </ThemeProvider>
    )
}

export default MyApp

