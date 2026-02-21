import { Search, MoreHorizontal, LogOut, Sun, Moon, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { TenantSelector } from "@/components/tenant-selector"
import { useState, useEffect } from "react"

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch { return null }
}

function formatCountdown(s: number): string {
  if (s <= 0) return 'Expired'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`
  return `${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`
}

export function Header() {
  const { user, token, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    const activeToken = localStorage.getItem('tenant_token') || token
    if (!activeToken) { setSecondsLeft(null); return }
    const expiry = getTokenExpiry(activeToken)
    if (!expiry) { setSecondsLeft(null); return }
    const update = () => {
      const remaining = Math.max(0, expiry - Math.floor(Date.now() / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) logout()
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [token])

  const isExpiringSoon = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 300
  const initials = (user?.name || user?.email || "Tenant Admin")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'TA'

  const displayName = user?.name || user?.email || 'Tenant Admin'

  return (
    <header className="border-b border-border bg-background px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search tenants, forms..."
              className="pl-10 pr-3 py-2 w-full bg-muted/50 border border-muted rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {secondsLeft !== null && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium tabular-nums border transition-colors ${
              secondsLeft === 0 ? 'bg-red-500/10 border-red-500/30 text-red-500'
              : isExpiringSoon ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
              : 'bg-muted/40 border-border/50 text-muted-foreground'}`}
              title="Time until your session expires">
              <Timer className="h-3 w-3 shrink-0" />
              {formatCountdown(secondsLeft)}
            </div>
          )}
          <TenantSelector />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="p-2"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>

          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>

          {/* User Profile */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">{initials}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{displayName}</span>
              {user?.organization && (
                <span className="text-xs text-muted-foreground leading-tight">{user.organization}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}