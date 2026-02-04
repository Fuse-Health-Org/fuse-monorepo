import { Search, MoreHorizontal, ChevronDown, LogOut, Sun, Moon, AlertTriangle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import Link from "next/link"

export function Header() {
  const { user, logout, hasActiveSubscription, isLoading, isSubscriptionLoading } = useAuth()
  const { theme, toggleTheme } = useTheme()

  // Only show banner when both auth AND subscription checks are complete
  const showSubscriptionBanner = !isLoading && !isSubscriptionLoading && !hasActiveSubscription

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
        <div className="flex items-center space-x-2">
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