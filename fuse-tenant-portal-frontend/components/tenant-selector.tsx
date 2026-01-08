import { useState, useRef, useEffect } from "react"
import { ChevronDown, Building2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTenant } from "@/contexts/TenantContext"

export function TenantSelector() {
  const { tenants, selectedTenant, selectTenant, clearSelection, isLoading } = useTenant()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleTenantSelect = (tenant: any) => {
    selectTenant(tenant)
    setIsOpen(false)
  }

  const displayText = selectedTenant 
    ? selectedTenant.name 
    : tenants.length > 0 
      ? "All Tenants" 
      : "No Tenants"

  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        variant="outline" 
        size="sm" 
        className="text-muted-foreground bg-transparent min-w-[140px] justify-between"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
      >
        <span className="flex items-center gap-2">
          <Building2 className="h-3 w-3" />
          {displayText}
        </span>
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-background border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {/* All Tenants option */}
          <div 
            className="px-3 py-2 hover:bg-muted cursor-pointer border-b border-border"
            onClick={() => {
              clearSelection()
              setIsOpen(false)
            }}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">All Tenants</div>
                <div className="text-xs text-muted-foreground">View all clinics</div>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Loading tenants...
            </div>
          )}

          {/* No tenants state */}
          {!isLoading && tenants.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No tenants found
            </div>
          )}

          {/* Tenants list */}
          {!isLoading && tenants.map((tenant) => (
            <div 
              key={tenant.id}
              className={`px-3 py-2 hover:bg-muted cursor-pointer border-b border-border last:border-b-0 ${
                selectedTenant?.id === tenant.id ? 'bg-muted' : ''
              }`}
              onClick={() => handleTenantSelect(tenant)}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  {tenant.logo ? (
                    <img 
                      src={tenant.logo} 
                      alt={`${tenant.name} logo`} 
                      className="w-6 h-6 rounded object-cover"
                    />
                  ) : (
                    <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{tenant.name}</div>
                  {tenant.slug && (
                    <div className="text-xs text-purple-600 dark:text-purple-400 font-mono truncate">
                      /{tenant.slug}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">
                    {tenant.businessType || 'Clinic'}
                  </div>
                  {tenant.owner && (
                    <div className="flex items-center gap-1 mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate">
                        {tenant.owner.firstName} {tenant.owner.lastName}
                      </span>
                    </div>
                  )}
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                  tenant.active ? 'bg-green-500 dark:bg-green-400' : 'bg-gray-300 dark:bg-gray-600'
                }`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}