import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { ApiClient } from "@/lib/api"
import {
    BarChart3,
    Users,
    LogOut,
    ClipboardList,
    FileQuestion,
    Package,
    CreditCard,
    Link2,
} from "lucide-react"

const navigation = [
    { name: "Dashboard", icon: BarChart3, current: true, href: "/" },
    { name: "Requests", icon: ClipboardList, current: false, href: "/requests", badge: true },
    { name: "Patients", icon: Users, current: false, href: "/patients" },
    { name: "Medical Question Templates", icon: FileQuestion, current: false, href: "/forms" },
    { name: "Multi-Choice Forms", icon: Package, current: false, href: "/multi-choice-forms" },
    { name: "Brand Invitations", icon: Link2, current: false, href: "/brand-invitations" },
    { name: "Payouts", icon: CreditCard, current: false, href: "/payouts" },
]

export function Sidebar() {
    const { user, logout, authenticatedFetch } = useAuth()
    const router = useRouter()
    const [pendingCount, setPendingCount] = useState(0)

    useEffect(() => {
        if (user && user.role === 'doctor') {
            const apiClient = new ApiClient(authenticatedFetch);
            apiClient.getOrderStats()
                .then(response => {
                    if (response.success) {
                        setPendingCount(response.data.totalPending);
                    }
                })
                .catch(error => {
                    console.error('Failed to fetch order stats:', error);
                });

            // Refresh stats every 30 seconds
            const interval = setInterval(() => {
                apiClient.getOrderStats()
                    .then(response => {
                        if (response.success) {
                            setPendingCount(response.data.totalPending);
                        }
                    })
                    .catch(error => {
                        console.error('Failed to fetch order stats:', error);
                    });
            }, 30000);

            return () => clearInterval(interval);
        }
    }, [user, authenticatedFetch]);

    const renderSidebarItem = (item: { name: string; icon: any; current: boolean; href?: string; badge?: boolean }) => {
        const isActive = router.pathname === item.href

        return (
            <Link
                key={item.name}
                href={item.href || "#"}
                className={cn(
                    "group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
            >
                <div className="flex items-center">
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.name}
                </div>
                {item.badge && pendingCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        {pendingCount}
                    </span>
                )}
            </Link>
        )
    }

    return (
        <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
            {/* Logo */}
            <div className="p-6">
                <h1 className="text-xl font-bold text-sidebar-foreground">Fuse Doctor Portal</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1">
                {/* Main Navigation */}
                <div className="space-y-1">
                    {navigation.map((item) => renderSidebarItem(item))}
                </div>
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-sidebar-border">
                <div className="flex items-center justify-between space-x-3">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                                {user?.name?.charAt(0).toUpperCase() || 'D'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-sidebar-foreground truncate">
                                {user?.name || 'Doctor'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {user?.email || 'doctor@example.com'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
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

