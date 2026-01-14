import { ReactNode, createContext, useContext, useMemo } from 'react'
import { useRouter } from 'next/router'
import { UNPROTECTED_PATHS } from '@fuse/enums'

interface ProtectedRouteContextValue {
    isProtected: boolean
}

const ProtectedRouteContext = createContext<ProtectedRouteContextValue>({ isProtected: true })


interface ProviderProps {
    children: ReactNode
}

export function ProtectedRouteProvider({ children }: ProviderProps) {
    const router = useRouter()

    const value = useMemo(() => {
        const asPath = router.asPath.split('?')[0]
        const pathname = router.pathname

        const LOCAL_UNPROTECTED = [
            ...UNPROTECTED_PATHS,
            '/fuse-dashboard/my-products',
            '/fuse-dashboard/my-products/[...rest]',
        ] as const

        console.log('[ProtectedRouteProvider] inputs', { pathname, asPath })
        const isUnprotected = (pathname.includes('/fuse-dashboard/my-products') || asPath.includes('/fuse-dashboard/my-products')) || LOCAL_UNPROTECTED.some((pattern) => {
            const cleanPattern = (pattern as string).trim()
            console.log('[ProtectedRouteProvider] Checking pattern:', cleanPattern, {
                pathname,
                asPath,
            })

            if (!cleanPattern.includes('[')) {
                const match = cleanPattern === pathname || cleanPattern === asPath
                if (match) {
                    console.log('[ProtectedRouteProvider] Matched static pattern:', cleanPattern)
                }
                return match
            }

            const source = cleanPattern
                .replace(/\[\[\.\.\.(.+?)\]\]/g, '(?:.*)?')
                .replace(/\[\.\.\.(.+?)\]/g, '.+')
                .replace(/\[(.+?)\]/g, '[^/]+')

            const regex = new RegExp(`^${source}$`)
            const match = regex.test(pathname) || regex.test(asPath)
            if (match) {
                console.log('[ProtectedRouteProvider] Matched dynamic pattern:', cleanPattern)
            }
            return match
        })

        console.log('[ProtectedRouteProvider] Result', {
            pathname,
            asPath,
            isUnprotected,
        })

        return {
            isProtected: !isUnprotected,
        }
    }, [router.pathname, router.asPath])

    return <ProtectedRouteContext.Provider value={value}>{children}</ProtectedRouteContext.Provider>
}

export function useProtectedRoute() {
    return useContext(ProtectedRouteContext)
}
