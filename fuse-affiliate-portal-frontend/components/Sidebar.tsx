import React from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import { Icon } from "@iconify/react";

const navigation = [
    { name: "Analytics", icon: "lucide:bar-chart-3", href: "/analytics" },
    { name: "Revenue", icon: "lucide:dollar-sign", href: "/revenue" },
    { name: "Branding", icon: "lucide:palette", href: "/branding" },
];

export function Sidebar() {
    const { user, signOut } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut();
    };

    const isActive = (href: string) => {
        return router.pathname === href;
    };

    const getDisplayName = () => {
        if (user?.firstName) {
            return user.firstName;
        }
        return user?.email?.split("@")[0] || "Affiliate";
    };

    const getInitials = () => {
        if (user?.firstName) {
            return user.firstName.charAt(0).toUpperCase();
        }
        return user?.email?.charAt(0).toUpperCase() || "A";
    };

    return (
        <div className="w-64 bg-content1 border-r border-divider flex flex-col">
            {/* Logo */}
            <div className="p-6">
                <h1 className="text-xl font-bold text-foreground">Fuse Affiliate Portal</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1">
                <div className="space-y-1">
                    {navigation.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <button
                                key={item.name}
                                onClick={() => router.push(item.href)}
                                className={`
                                    w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                                    ${active
                                        ? "bg-primary text-primary-foreground"
                                        : "text-foreground hover:bg-content2"
                                    }
                                `}
                            >
                                <Icon icon={item.icon} className="mr-3 h-4 w-4" />
                                {item.name}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-divider">
                <div className="flex items-center justify-between space-x-3">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-primary-foreground">
                                {getInitials()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {getDisplayName()}
                            </p>
                            <p className="text-xs text-foreground-400 truncate">
                                {user?.email || 'affiliate@example.com'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-1 text-foreground-400 hover:text-foreground hover:bg-content2 rounded flex-shrink-0"
                        title="Logout"
                        aria-label="Logout"
                    >
                        <Icon icon="lucide:log-out" className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
