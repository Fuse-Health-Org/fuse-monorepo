import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import { useProtectedRoute } from '../providers/ProtectedRouteProvider'
import { hasRole, getPrimaryRole } from '../lib/auth'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: string
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { isProtected } = useProtectedRoute()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!isProtected) {
      console.log('[ProtectedRoute] Unprotected route - skipping auth checks', {
        pathname: router.pathname,
        asPath: router.asPath,
      })
      setIsAuthorized(true)
      return
    }

    console.log('[ProtectedRoute] Protected route - checking auth', {
      pathname: router.pathname,
      asPath: router.asPath,
      userExists: Boolean(user),
      loading,
      requiredRole,
    })

    if (loading) return

    if (!user) {
      console.log('[ProtectedRoute] No user found, redirecting to /signin')
      router.push('/signin')
      return
    }

    if (requiredRole) {
      // Check using new role system
      const hasRequiredRole = hasRole(user, requiredRole as any) || getPrimaryRole(user) === requiredRole;
      if (!hasRequiredRole) {
        console.log('[ProtectedRoute] User lacks required role, redirecting to /signin')
        router.push('/signin')
        return
      }
    }

    setIsAuthorized(true)
  }, [user, loading, requiredRole, router, isProtected])

  if (!isProtected) {
    return <>{children}</>
  }

  if (loading || !isAuthorized) {
    return null
  }

  return <>{children}</>
}