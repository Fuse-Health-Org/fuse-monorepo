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
    <header className="border-b border-border bg-background">
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

      <div className="px-6 py-4 flex items-center justify-between">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search Treatments" className="pl-10 bg-muted/50 border-muted" />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" className="text-muted-foreground bg-transparent">
            Last 30 d
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>

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
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.firstName?.charAt(0).toUpperCase() || 'A'}
                {user?.lastName?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-sm font-medium">
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || 'Admin User'
              }
            </span>
            <button
              //@ts-ignore
              onClick={logout}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}