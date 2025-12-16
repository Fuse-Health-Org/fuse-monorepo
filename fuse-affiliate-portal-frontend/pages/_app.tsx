import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { AuthProvider } from '../contexts/AuthContext'

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <HeroUIProvider>
            <ToastProvider />
            <AuthProvider>
                <Component {...pageProps} />
            </AuthProvider>
        </HeroUIProvider>
    )
}

export default MyApp

