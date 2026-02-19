import { Search, Sun, Moon, AlertTriangle, ArrowRight, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import Link from "next/link"
import { useState, useEffect } from "react"

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Expired'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

export function Header() {
  const { user, token, logout, hasActiveSubscription, isLoading, isSubscriptionLoading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    // Always read directly from localStorage so we catch overrideToken writes
    // even if React hasn't flushed the state update yet on first render
    const activeToken = localStorage.getItem('admin_token') || token
    if (!activeToken) {
      setSecondsLeft(null)
      return
    }

    const expiry = getTokenExpiry(activeToken)
    if (!expiry) {
      setSecondsLeft(null)
      return
    }

    const update = () => {
      const remaining = Math.max(0, expiry - Math.floor(Date.now() / 1000))
      setSecondsLeft(remaining)
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [token])

  // Only show banner when both auth AND subscription checks are complete
  const showSubscriptionBanner = !isLoading && !isSubscriptionLoading && !hasActiveSubscription

  const isExpiringSoon = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 300


  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      {/* Subscription Warning Banner */}
      {showSubscriptionBanner && (
        <div className="bg-amber-500 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-900" />
              <span className="font-medium text-amber-900">
                Your account features are limited. Please select a plan to unlock all features.
              </span>
            </div>
            <Link href="/plans">
              <Button 
                size="sm" 
                className="bg-amber-900 hover:bg-amber-950 text-white font-medium"
              >
                Choose a Plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="px-6 py-3 flex items-center justify-between">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input 
              type="search" 
              placeholder="Search..." 
              className="pl-10 bg-muted/30 border-border/50 h-9 rounded-lg text-sm transition-smooth focus:bg-card focus:border-primary/30" 
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-3">
          {/* Session Timer */}
          {secondsLeft !== null && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium tabular-nums border transition-colors ${
                secondsLeft === 0
                  ? 'bg-red-500/10 border-red-500/30 text-red-500'
                  : isExpiringSoon
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                  : 'bg-muted/40 border-border/50 text-muted-foreground'
              }`}
              title="Time until your session expires"
            >
              <Timer className="h-3 w-3 shrink-0" />
              {formatCountdown(secondsLeft)}
            </div>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50 transition-smooth"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4 text-muted-foreground/70" />
            ) : (
              <Sun className="h-4 w-4 text-muted-foreground/70" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}