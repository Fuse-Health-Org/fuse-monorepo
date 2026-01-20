import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { AuthProvider } from '../contexts/AuthContext'
import { ThemeProvider } from '../contexts/ThemeContext'

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <ThemeProvider>
            <HeroUIProvider>
                <ToastProvider />
                <AuthProvider>
                    <Component {...pageProps} />
                </AuthProvider>
            </HeroUIProvider>
        </ThemeProvider>
    )
}

export default MyApp

