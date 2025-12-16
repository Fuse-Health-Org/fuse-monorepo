import React, { useState, useEffect, useCallback } from "react";
import { Button, Avatar, Badge } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import { useChat } from "../hooks/useChat";
import { apiCall } from "../lib/api";
import { motion } from "framer-motion";
import { getAvatarEmoji } from "../lib/avatarUtils";

interface User {
  id: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  firstName?: string;
  lastName?: string;
  clinicId?: string;
}

interface Clinic {
  id: string;
  name: string;
  slug: string;
  logo: string;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user?: User | null;
  hasTickets?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, user, hasTickets = false }) => {
  const router = useRouter();
  const [clinic, setClinic] = React.useState<Clinic | null>(null);
  const [loadingClinic, setLoadingClinic] = React.useState(false);
  const [loadingLogo, setLoadingLogo] = React.useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Get auth token
  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    setAuthToken(token);
  }, []);

  // Load initial unread count
  useEffect(() => {
    const loadUnreadCount = async () => {
      console.log('🔍 Sidebar - Loading unread count for user:', user);
      console.log('🔍 Sidebar - Auth token:', authToken);
      if (!authToken || !user) return;
      try {
        const response = await apiCall('/patient/chat/unread-count', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        console.log('🔍 Sidebar - Unread count response:', response);
        if (response.success && response.data) {
          setUnreadMessagesCount(response.data.data.unreadCount || 0);
        }
      } catch (error) {
        console.error('[Sidebar] Error loading unread count:', error);
      }
    };

    loadUnreadCount();
  }, [authToken, user]);

  // Handle unread count updates from WebSocket
  const handleUnreadCountUpdate = useCallback((data: { unreadCount: number }) => {
    console.log('[Sidebar] 🔔 Unread count update:', data.unreadCount);
    setUnreadMessagesCount(data.unreadCount);
  }, []);

  // Connect to WebSocket for real-time updates
  const { connect, disconnect } = useChat({
    onUnreadCountUpdate: handleUnreadCountUpdate
  });

  useEffect(() => {
    if (authToken) {
      connect(authToken);
    }

    return () => {
      disconnect();
    };
  }, [authToken, connect, disconnect]);

  // Function to preload logo image
  const preloadLogoImage = (logoUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!logoUrl) {
        resolve(); // No logo to load
        return;
      }

      const img = new Image();
      img.onload = () => {
        console.log('✅ Sidebar logo image loaded successfully:', logoUrl);
        resolve();
      };
      img.onerror = () => {
        console.log('⚠️ Sidebar logo image failed to load:', logoUrl);
        resolve(); // Still resolve so UI doesn't hang
      };
      img.src = logoUrl;
    });
  };

  // Load clinic data if user has a clinicId
  React.useEffect(() => {
    const loadClinicData = async () => {
      console.log('🔍 Sidebar - User object:', user);
      console.log('🔍 Sidebar - User clinicId:', user?.clinicId);

      if (!user?.clinicId) {
        console.log('❌ Sidebar - No clinicId found, showing default branding');
        setClinic(null);
        return;
      }

      setLoadingClinic(true);
      try {
        console.log('🏥 Loading clinic data for clinicId:', user.clinicId);
        const result = await apiCall(`/clinic/${user.clinicId}`);
        if (result.success && result.data && result.data.data) {
          const clinicData = result.data.data as Clinic;
          console.log('✅ Loaded clinic data for sidebar:', clinicData);

          // Preload logo image before showing final UI
          if (clinicData.logo) {
            setLoadingLogo(true);
            console.log('🖼️ Sidebar - Starting logo preload...');
            await preloadLogoImage(clinicData.logo);
            setLoadingLogo(false);
          }

          setClinic(clinicData);
        } else {
          console.error('❌ Failed to load clinic data for sidebar:', result);
          setClinic(null);
        }
      } catch (error) {
        console.error('❌ Error loading clinic data for sidebar:', error);
        setClinic(null);
      } finally {
        setLoadingClinic(false);
      }
    };

    loadClinicData();
  }, [user?.clinicId]);

  const baseNavItems = [
    { id: "dashboard", label: "Dashboard", icon: "lucide:layout-dashboard" },
    // { id: "offerings", label: "Offerings", icon: "lucide:list-checks" }, // Hidden
    { id: "treatments", label: "Treatments", icon: "lucide:pill" },
    { id: "messenger", label: "Messenger", icon: "lucide:message-square" },
    { id: "account", label: "Account", icon: "lucide:user" },
  ];

  // Add Branding item for doctors
  const navItems = user?.role === 'doctor'
    ? [
      ...baseNavItems.slice(0, 3), // dashboard, treatments, messenger
      { id: "branding", label: "Branding", icon: "lucide:palette" },
      ...baseNavItems.slice(3), // account
    ]
    : baseNavItems;

  return (
    <motion.div
      className="w-56 bg-content1 border-r border-content3 flex flex-col h-full"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Logo */}
      <div className="p-4 border-b border-content3">
        <div className="flex items-center gap-3">
          {loadingClinic || loadingLogo ? (
            // Loading state (including logo loading)
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="h-5 bg-gray-200 rounded w-24"></div>
            </div>
          ) : clinic ? (
            // Clinic branding
            <>
              <Avatar
                src={clinic.logo || undefined}
                icon={!clinic.logo ? <Icon icon="lucide:building" className="text-lg" /> : undefined}
                className="w-8 h-8"
                classNames={{
                  base: clinic.logo ? "" : "bg-primary-100",
                  icon: "text-primary-600"
                }}
              />
              <div className="font-semibold text-lg text-foreground">
                {clinic.name}
              </div>
            </>
          ) : (
            // Default branding
            <div className="font-semibold text-lg text-foreground">
              <span className="text-primary">Fuse</span> Health
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id} className="relative">
              <Button
                variant="flat"
                color={activeTab === item.id ? "primary" : "default"}
                className={`w-full justify-start ${activeTab === item.id ? "bg-primary-50" : "bg-transparent"
                  } transition-all duration-200`}
                startContent={
                  <Icon
                    icon={item.icon}
                    className={`text-lg ${activeTab === item.id ? "text-primary" : "text-foreground-500"
                      }`}
                  />
                }
                onPress={() => setActiveTab(item.id)}
              >
                <span className={activeTab === item.id ? "font-medium" : ""}>
                  {item.label}
                </span>
              </Button>
              {item.id === 'messenger' && unreadMessagesCount > 0 && (
                <div className="absolute top-1.5 right-3 z-10">
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-danger rounded-full">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                </div>
              )}
            </li>
          ))}

          {/* Shop Button */}
          <li>
            <Button
              variant="flat"
              color="default"
              className="w-full justify-start bg-transparent transition-all duration-200"
              startContent={
                <Icon
                  icon="lucide:shopping-bag"
                  className="text-lg text-foreground-500"
                />
              }
              onPress={() => router.push('/')}
            >
              <span>Shop</span>
            </Button>
          </li>
        </ul>
      </nav>

      {/* User Profile - Added at bottom */}
      <div className="mt-auto p-3 border-t border-content3">
        <div className="flex items-center gap-3 py-2">
          <Avatar
            name={user?.firstName || user?.email || 'User'}
            size="sm"
            fallback={
              <span className="text-xl">{getAvatarEmoji(user)}</span>
            }
          />
          <div className="flex-1">
            <p className="font-medium text-sm">
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || "User"
              }
            </p>
            <p className="text-xs text-foreground-500 capitalize">
              {user?.role || "User"}
            </p>
          </div>
        </div>
      </div>

    </motion.div>
  );
};