import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import {
  BarChart3,
  Users,
  Stethoscope,
  ShoppingCart,
  Package,
  Gift,
  Settings,
  ChevronDown,
  LogOut,
  Crown,
  Lock,
  CreditCard,
  TrendingUp,
  Workflow,
  FileText,
  UserCircle,
  Tag,
  Globe,
  UserPlus,
} from "lucide-react"
import Tutorial from "./ui/tutorial"

const navigation = [
  { name: "Overview", icon: BarChart3, current: true, href: "/" },
  { name: "Customers", icon: Users, current: false, href: "/customers" },
  { name: "Plans", icon: Crown, current: false, href: "/plans" },
]

const allOperations = [
  { name: "Programs", icon: Stethoscope, current: false, href: "/programs" },
  // { name: "Offerings", icon: Gift, current: false, href: "/offerings" },
  { name: "Products", icon: Package, current: false, href: "/products", id: "tutorial-step-3" },
  { name: "Orders", icon: ShoppingCart, current: false, href: "/orders" },
  { name: "Payouts", icon: CreditCard, current: false, href: "/payouts" },
  { name: "Analytics", icon: TrendingUp, current: false, href: "/analytics" },
  { name: "Sequences", icon: Workflow, current: false, href: "/sequences" },
  { name: "Templates", icon: FileText, current: false, href: "/templates" },
  { name: "Contacts", icon: UserCircle, current: false, href: "/contacts" },
  { name: "Tags", icon: Tag, current: false, href: "/tags" },
]

// const services: { name: string; icon: any; current: boolean; href?: string; hasSubmenu?: boolean; comingSoon?: boolean }[] = [
//   // Add services here when needed
// ]

const configuration = [
  { name: "Portal", icon: Globe, current: false, href: "/portal" },
  { name: "Affiliates", icon: UserPlus, current: false, href: "/affiliates" },
  { name: "Settings", icon: Settings, current: false, href: "/settings" },
]

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function Sidebar() {
  const { user, logout, hasActiveSubscription, refreshSubscription, authenticatedFetch, subscription } = useAuth()
  const router = useRouter()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [runTutorial, setRunTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState<number>(0)

  // Filter out Sequences, Templates, Contacts, and Tags in production
  const operations = allOperations.filter(item => {
    if (process.env.NODE_ENV === 'production') {
      return !['Sequences', 'Templates', 'Contacts', 'Tags'].includes(item.name)
    }
    return true
  })

  // Check if user has access to analytics based on tier or custom features
  const hasAccessToAnalytics =
    subscription?.customFeatures?.hasAccessToAnalytics ||
    subscription?.tierConfig?.hasAccessToAnalytics ||
    false;

  // Check if user has access to Portal (Standard tier or higher, or custom feature override)
  // Plan types hierarchy: starter < standard < professional
  const PORTAL_ALLOWED_PLAN_TYPES = ['standard', 'professional', 'enterprise'];
  const hasAccessToPortal =
    subscription?.customFeatures?.hasCustomPortal ||
    subscription?.tierConfig?.hasCustomPortal ||
    (subscription?.plan?.type && PORTAL_ALLOWED_PLAN_TYPES.includes(subscription.plan.type));

  // Check if user has access to Programs based on tier or custom features
  const hasAccessToPrograms =
    subscription?.customFeatures?.hasPrograms ||
    subscription?.tierConfig?.hasPrograms ||
    false;
  const fetchSubscriptionBasicInfo = async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/brand-subscriptions/basic-info`, {
        method: "GET",
        skipLogoutOn401: true,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log("data.data", data.data);
          const needsTutorial = data.data.tutorialFinished === false && data.data.status === "active" && data.data.stripeCustomerId !== null;
          console.log("needsTutorial", needsTutorial);

          // Set tutorial step from DB, default to 0 if not set
          const step = data.data.tutorialStep || 0;
          setTutorialStep(step);

          // If tutorial needs to run and we're at step 0 or 1, redirect to settings page
          // because those steps' target elements are on the settings page
          if (needsTutorial && step <= 1 && router.pathname !== '/settings') {
            console.log("📍 Tutorial step", step, "requires settings page, redirecting...");
            router.push('/settings');
            // Don't start tutorial yet - it will start after redirect when this runs again
            return;
          }

          // Add small delay to ensure page elements are rendered before starting tutorial
          if (needsTutorial) {
            setTimeout(() => {
              setRunTutorial(true);
            }, 500);
          } else {
            setRunTutorial(false);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching subscription basic info:", error);
    }
  };

  useEffect(() => {
    fetchSubscriptionBasicInfo()
  }, [router.pathname])

  const handleRefreshSubscription = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await refreshSubscription()
    } catch (error) {
      console.error('Error refreshing subscription:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Helper function to check if a navigation item should be disabled
  const isItemDisabled = (itemName: string) => {
    // Plans page is always accessible
    if (itemName === 'Plans') return false

    // Analytics requires specific access
    if (itemName === 'Analytics') {
      return !hasAccessToAnalytics
    }

    // Portal requires Standard tier or higher
    if (itemName === 'Portal') {
      return !hasAccessToPortal
    }

    // Programs requires specific access
    if (itemName === 'Programs') {
      return !hasAccessToPrograms
    }

    // If no active subscription, disable everything except Plans and Settings
    if (!hasActiveSubscription) {
      return itemName !== 'Settings'
    }

    return false
  }

  // Helper function to handle clicks on disabled items
  const handleDisabledClick = (e: React.MouseEvent, itemName: string) => {
    e.preventDefault()

    // Analytics requires upgrade - redirect to plans page
    if (itemName === 'Analytics' && !hasAccessToAnalytics) {
      router.push('/plans?message=Upgrade your plan to access Analytics.')
      return
    }

    // Portal requires Standard tier or higher - redirect to plans page
    if (itemName === 'Portal' && !hasAccessToPortal) {
      router.push('/plans?message=Upgrade to Standard or higher to access Portal customization.')
      return
    }

    // Programs requires specific access - redirect to plans page
    if (itemName === 'Programs' && !hasAccessToPrograms) {
      router.push('/plans?message=Upgrade your plan to access Programs.')
      return
    }

    if (!hasActiveSubscription && itemName !== 'Plans' && itemName !== 'Settings') {
      // Redirect to settings instead of plans for subscription management
      router.push('/settings?tab=subscription&message=Please subscribe to access this feature.')
    }
  }

  // Helper function to render a sidebar item
  const renderSidebarItem = (item: { name: string; icon: any; current: boolean; href?: string; hasSubmenu?: boolean, id?: string, comingSoon?: boolean }, _section: string) => {
    const isActive = router.pathname === item.href
    const disabled = isItemDisabled(item.name)
    const isHovered = hoveredItem === item.name

    return (
      <div key={item.name} className="relative" id={item.id}>
        {item.comingSoon ? (
          <div
            className={cn(
              "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all cursor-not-allowed opacity-60"
            )}
          >
            <div className="flex items-center flex-1">
              <item.icon className="mr-3 h-4 w-4 opacity-50" />
              <span className="opacity-75">{item.name}</span>
            </div>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              Coming Soon
            </span>
          </div>
        ) : disabled ? (
          <div
            className={cn(
              "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer",
              (item.name === 'Analytics' && !hasAccessToAnalytics) || (item.name === 'Portal' && !hasAccessToPortal) || (item.name === 'Programs' && !hasAccessToPrograms)
                ? "opacity-70 text-muted-foreground/70 hover:bg-sidebar-accent/20 hover:opacity-80"
                : "opacity-60 grayscale text-muted-foreground/60 hover:bg-sidebar-accent/30 hover:opacity-70",
              isActive
                ? "bg-sidebar-accent/50 text-sidebar-accent-foreground/70"
                : ""
            )}
            onClick={(e) => handleDisabledClick(e, item.name)}
            onMouseEnter={() => setHoveredItem(item.name)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <div className="flex items-center">
              <item.icon className={cn(
                "mr-3 h-4 w-4",
                (item.name === 'Analytics' && !hasAccessToAnalytics) || (item.name === 'Portal' && !hasAccessToPortal) || (item.name === 'Programs' && !hasAccessToPrograms) ? "opacity-70" : "opacity-50"
              )} />
              <span className={cn(
                (item.name === 'Analytics' && !hasAccessToAnalytics) || (item.name === 'Portal' && !hasAccessToPortal) || (item.name === 'Programs' && !hasAccessToPrograms) ? "opacity-90" : "opacity-75"
              )}>{item.name}</span>
            </div>
            {(item.name === 'Analytics' && !hasAccessToAnalytics) || (item.name === 'Portal' && !hasAccessToPortal) || (item.name === 'Programs' && !hasAccessToPrograms) ? (
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 border border-orange-200 font-medium">
                Upgrade
              </span>
            ) : (
              <Lock className="ml-auto h-3 w-3 text-muted-foreground/50" />
            )}
          </div>
        ) : (
          <Link
            href={item.href || "#"}
            className={cn(
              "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            onClick={(e) => {
              if (disabled) {
                handleDisabledClick(e, item.name);
                return;
              }

              // If tutorial is running and Products tab is the current tutorial target,
              // convert the click to a Next button click instead
              if (runTutorial && item.id === 'tutorial-step-3') {
                // Check if there's a Joyride tooltip visible (tutorial is active)
                const joyrideTooltip = document.querySelector('[class*="__floater"]');
                if (joyrideTooltip) {
                  e.preventDefault();
                  console.log('📍 Tutorial active - converting Products click to Next button click');
                  // Click the Next/Continue button in the Joyride tooltip
                  setTimeout(() => {
                    const nextButton = document.querySelector('button[data-action="primary"]') as HTMLButtonElement;
                    if (nextButton) {
                      console.log('✅ Clicking Next button');
                      nextButton.click();
                    } else {
                      console.log('⚠️ Next button not found');
                    }
                  }, 50);
                  return;
                }
              }
            }}
          >
            <div className="flex items-center">
              <item.icon className="mr-3 h-4 w-4" />
              {item.name}
            </div>
            {item.hasSubmenu && <ChevronDown className="ml-auto h-4 w-4" />}
          </Link>
        )}

        {/* Tooltip for disabled items */}
        {disabled && isHovered && (
          <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg z-50 whitespace-nowrap">
            {item.name === 'Analytics' && !hasAccessToAnalytics
              ? '✨ Upgrade to access Analytics'
              : item.name === 'Portal' && !hasAccessToPortal
                ? '✨ Upgrade to Standard to customize your Portal'
                : item.name === 'Programs' && !hasAccessToPrograms
                  ? '✨ Upgrade to access Programs'
                  : 'Subscription Required'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden">
      <Tutorial runTutorial={runTutorial} setRunTutorial={setRunTutorial} initialStep={tutorialStep} />
      {/* Logo */}
      <div className="p-6 flex-shrink-0">
        <h1 className="text-xl font-bold text-sidebar-foreground">Fuse</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {/* Main Navigation */}
        <div className="space-y-1">
          {(hasActiveSubscription ? navigation.filter((item) => item.name !== 'Plans') : navigation).map((item) =>
            renderSidebarItem(item, 'navigation')
          )}
        </div>

        {/* Operations Section */}
        <div className="pt-6">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Operations</h3>
          {process.env.NODE_ENV !== 'production' && (
            <div className="px-3 mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                ⚠️ Testing Mode
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Sequences, Templates, Contacts, and Tags are being tested and won't be available in production.
              </p>
            </div>
          )}
          <div className="space-y-1">
            {operations.map((item) => renderSidebarItem(item, 'operations'))}
          </div>
        </div>

        {/* Services Section */}
        {/* <div className="pt-6">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Services</h3>
          <div className="space-y-1">
            {services.map((item) => renderSidebarItem(item, 'services'))}
          </div>
        </div> */}

        {/* Configuration Section */}
        <div className="pt-6">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Configuration
          </h3>
          <div className="space-y-1">
            {configuration.map((item) => renderSidebarItem(item, 'configuration'))}
          </div>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border flex-shrink-0">
        <div className="flex items-center justify-between space-x-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name || 'Admin User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || 'admin@example.com'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshSubscription}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded"
              title="Refresh subscription status"
              aria-label="Refresh subscription status"
            >
              <CreditCard className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => logout()}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}