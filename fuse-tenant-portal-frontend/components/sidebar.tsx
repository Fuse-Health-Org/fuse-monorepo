import { cn } from "@/lib/utils"
import { useRouter } from "next/router"
import { useAuth } from "@/contexts/AuthContext"
import {
  BarChart3,
  FileText,
  LogOut,
  Building2,
  Package,
  Users,
  Settings,
  DollarSign,
  MessageSquare,
  Shield,
  UserCheck,
  CreditCard,
} from "lucide-react"

const navigation = [
  { name: "Overview", icon: BarChart3, href: "/" },
  { name: "Products", icon: Package, href: "/products" },
  { name: "Forms", icon: FileText, href: "/forms" },
  { name: "Client Management", icon: Users, href: "/client-management" },
  { name: "Doctor Applications", icon: UserCheck, href: "/doctor-applications" },
  { name: "Tier Management", icon: Settings, href: "/tier-management" },
  { name: "Global Fees", icon: DollarSign, href: "/global-fees" },
  { name: "Payouts Tracking", icon: CreditCard, href: "/payouts" },
  { name: "Audit Logs", icon: Shield, href: "/audit-logs" },
  { name: "Support", icon: MessageSquare, href: "/support" },
]

export function Sidebar() {
  const router = useRouter()
  const { user, logout } = useAuth()
  
  return (
    <div className="w-72 bg-white border-r border-[#E5E7EB] flex flex-col shadow-sm">
      {/* Logo */}
      <div className="p-8 pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-2xl flex items-center justify-center shadow-sm">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#1F2937]">Tenant Portal</h1>
            <p className="text-sm text-[#9CA3AF]">Clinic Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-5 py-4 space-y-2">
        {/* Main Navigation */}
        <div className="space-y-1.5">
          <p className="px-3 text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
            Main Menu
          </p>
          {navigation.map((item) => {
            const isActive = router.pathname === item.href
            return (
              <a
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-4 py-3 text-[15px] font-medium rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-[#4FA59C] text-white shadow-sm"
                    : "text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#1F2937]",
                )}
              >
                <item.icon className={cn(
                  "mr-3 h-5 w-5 transition-all",
                  isActive ? "text-white" : "text-[#6B7280] group-hover:text-[#4FA59C]"
                )} />
                {item.name}
              </a>
            )
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-5 border-t border-[#E5E7EB] bg-[#F9FAFB]">
        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between space-x-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-sm font-semibold text-white">
                  {user?.name?.charAt(0).toUpperCase() || 'T'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1F2937] truncate">
                  {user?.name || 'Tenant User'}
                </p>
                <p className="text-xs text-[#9CA3AF] truncate">
                  {user?.organization || 'Organization'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEF2F2] rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}