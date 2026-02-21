import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Icon } from "@iconify/react";

const navigation = [
    { name: "Analytics", icon: "lucide:bar-chart-3", href: "/analytics" },
    { name: "Revenue", icon: "lucide:dollar-sign", href: "/revenue" },
    { name: "Payouts", icon: "lucide:credit-card", href: "/payouts" },
    { name: "Products", icon: "lucide:package", href: "/products" },
    { name: "Branding", icon: "lucide:palette", href: "/branding" },
    { name: "Settings", icon: "lucide:settings", href: "/settings" },
];

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

export function Sidebar() {
    const { user, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('auth-token');
        if (!token) { setSecondsLeft(null); return; }
        const expiry = getTokenExpiry(token);
        if (!expiry) { setSecondsLeft(null); return; }
        const update = () => {
            const remaining = Math.max(0, expiry - Math.floor(Date.now() / 1000));
            setSecondsLeft(remaining);
            if (remaining === 0) signOut();
        };
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, []);

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

            {/* Session Timer */}
            {secondsLeft !== null && (
                <div className="px-4 pb-2">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium tabular-nums border ${
                        secondsLeft === 0 ? 'bg-danger-100 border-danger-300 text-danger'
                        : secondsLeft <= 300 ? 'bg-warning-100 border-warning-300 text-warning-700'
                        : 'bg-default-100 border-default-300 text-default-600'}`}
                        title="Time until your session expires">
                        <Icon icon="lucide:timer" className="h-3 w-3 shrink-0" />
                        {formatCountdown(secondsLeft)}
                    </div>
                </div>
            )}

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
                    <div className="flex items-center gap-1">
                        <button
                            onClick={toggleTheme}
                            className="p-1 text-foreground-400 hover:text-foreground hover:bg-content2 rounded flex-shrink-0"
                            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                        >
                            <Icon 
                                icon={theme === 'light' ? 'lucide:moon' : 'lucide:sun'} 
                                className="h-4 w-4" 
                            />
                        </button>
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
        </div>
    );
}
