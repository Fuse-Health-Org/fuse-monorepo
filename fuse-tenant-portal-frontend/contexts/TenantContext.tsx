import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './AuthContext'

interface TenantOwner {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  businessType?: string
}

interface Tenant {
  id: string
  slug: string
  name: string
  logo: string
  businessType?: string
  active: boolean
  status: 'pending' | 'paid' | 'payment_due' | 'cancelled'
  owner?: TenantOwner
  createdAt: string
  updatedAt: string
}

interface TenantContextType {
  tenants: Tenant[]
  selectedTenant: Tenant | null
  isLoading: boolean
  error: string | null
  fetchTenants: () => Promise<void>
  selectTenant: (tenant: Tenant) => void
  clearSelection: () => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { token, user } = useAuth()

  // Load selected tenant from localStorage on mount
  useEffect(() => {
    const storedTenantId = localStorage.getItem('selected_tenant_id')
    if (storedTenantId && tenants.length > 0) {
      const tenant = tenants.find(t => t.id === storedTenantId)
      if (tenant) {
        setSelectedTenant(tenant)
      }
    }
  }, [tenants])

  // Fetch tenants when user is available
  useEffect(() => {
    if (user && token) {
      fetchTenants()
    }
  }, [user, token])

  const fetchTenants = async () => {
    if (!token) return

    setIsLoading(true)
    setError(null)

    try {
      // Request a higher limit to get all tenants (up to 100)
      const response = await fetch(`${API_BASE_URL}/tenants?limit=200`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTenants(data.data.tenants || [])
      } else {
        setError(data.message || 'Failed to fetch tenants')
      }
    } catch (error) {
      setError('Network error. Please try again.')
      console.error('Error fetching tenants:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    localStorage.setItem('selected_tenant_id', tenant.id)
  }

  const clearSelection = () => {
    setSelectedTenant(null)
    localStorage.removeItem('selected_tenant_id')
  }

  return (
    <TenantContext.Provider value={{
      tenants,
      selectedTenant,
      isLoading,
      error,
      fetchTenants,
      selectTenant,
      clearSelection
    }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}