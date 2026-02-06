import React from "react";
import { motion } from "framer-motion";
import { Button, Avatar, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";
import { getAvatarEmoji } from "../../lib/avatarUtils";
import { DashboardSelector } from "../../components/DashboardSelector";

/**
 * Beluga Dashboard - Beluga Health Portal (Placeholder)
 * 
 * This dashboard will use Beluga API for:
 * - Patient management
 * - Prescription management
 * - Provider messaging
 * - Treatment tracking
 * 
 * Currently a placeholder until Beluga API integration is complete.
 */

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "lucide:layout-dashboard" },
  { id: "treatments", label: "Treatments", icon: "lucide:pill" },
  { id: "messages", label: "Messages", icon: "lucide:message-circle" },
  { id: "account", label: "Account", icon: "lucide:user" },
];

function BelugaSidebar({ 
  activeTab, 
  setActiveTab,
  isMobile = false,
}: { 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
  isMobile?: boolean;
}) {
  const { user, signOut } = useAuth();

  return (
    <div className={`
      ${isMobile ? 'w-full' : 'w-64'} 
      h-full bg-content1 border-r border-content3 flex flex-col
    `}>
      {/* Logo */}
      <div className="p-4 border-b border-content3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
            <Icon icon="lucide:activity" className="text-white text-lg" />
          </div>
          <span className="font-semibold text-lg">
            <span className="text-teal-500">Beluga</span> Health
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "flat" : "light"}
            className={`w-full justify-start gap-3 ${
              activeTab === item.id 
                ? "bg-teal-500/10 text-teal-600" 
                : "text-foreground-600"
            }`}
            onPress={() => setActiveTab(item.id)}
            startContent={<Icon icon={item.icon} className="text-lg" />}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-content3">
        <div className="flex items-center gap-3 mb-3">
          <Avatar
            name={user?.firstName || user?.email || 'User'}
            size="sm"
            fallback={<span className="text-lg">{getAvatarEmoji(user)}</span>}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-foreground-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="light"
          className="w-full justify-start text-danger"
          startContent={<Icon icon="lucide:log-out" />}
          onPress={signOut}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function BelugaDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Close mobile menu when tab changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  const renderPlaceholderContent = (title: string, icon: string, description: string) => (
    <Card>
      <CardBody className="p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
          <Icon icon={icon} className="text-teal-500 text-2xl" />
        </div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-foreground-500 mb-4">{description}</p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-sm">
          <Icon icon="lucide:clock" />
          Pending Beluga API Integration
        </div>
      </CardBody>
    </Card>
  );

  return (
    <ProtectedRoute>
      <div className="flex flex-col md:flex-row h-screen bg-background">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between h-16 border-b border-content3 bg-content1 px-4">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              onPress={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Icon icon={isMobileMenuOpen ? "lucide:x" : "lucide:menu"} className="text-lg" />
            </Button>
            <div className="font-semibold text-lg text-foreground">
              <span className="text-teal-500">Beluga</span> Health
            </div>
          </div>
          <Avatar
            name={user?.firstName || user?.email || 'User'}
            className="cursor-pointer"
            size="sm"
            fallback={<span className="text-xl">{getAvatarEmoji(user)}</span>}
          />
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 bg-overlay/50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Hidden on mobile unless menu is open */}
        <div className={`
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 fixed md:relative z-50 h-full transition-transform duration-300 ease-in-out
          md:h-screen md:flex md:flex-col
        `}>
          <BelugaSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between h-16 border-b border-content3 bg-content1 px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold">
                {navItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <DashboardSelector />
              <Avatar
                name={user?.firstName || user?.email || 'User'}
                className="cursor-pointer"
                size="sm"
                fallback={<span className="text-xl">{getAvatarEmoji(user)}</span>}
              />
            </div>
          </div>

          {/* Content Area */}
          <motion.main
            className="flex-1 overflow-y-auto p-4 md:p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === "dashboard" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="lucide:activity" className="text-teal-500 text-3xl" />
                  </div>
                  <h1 className="text-2xl font-bold mb-2">Welcome to Beluga Health</h1>
                  <p className="text-foreground-500 max-w-md mx-auto">
                    Your personalized telehealth dashboard powered by Beluga.
                  </p>
                </div>

                <Card className="border border-teal-500/20">
                  <CardBody className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon icon="lucide:construction" className="text-amber-500 text-xl" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Coming Soon</h3>
                        <p className="text-sm text-foreground-500">
                          The Beluga Health dashboard is currently under development. 
                          Once the Beluga API integration is complete, you'll be able to:
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-foreground-500">
                          <li className="flex items-center gap-2">
                            <Icon icon="lucide:check-circle" className="text-teal-500" />
                            View your prescriptions and treatment plans
                          </li>
                          <li className="flex items-center gap-2">
                            <Icon icon="lucide:check-circle" className="text-teal-500" />
                            Chat with your Beluga healthcare provider
                          </li>
                          <li className="flex items-center gap-2">
                            <Icon icon="lucide:check-circle" className="text-teal-500" />
                            Track your order and shipment status
                          </li>
                          <li className="flex items-center gap-2">
                            <Icon icon="lucide:check-circle" className="text-teal-500" />
                            Manage your treatment subscriptions
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {activeTab === "treatments" && (
              <div className="max-w-4xl mx-auto">
                {renderPlaceholderContent(
                  "Treatments",
                  "lucide:pill",
                  "Your Beluga treatments and prescriptions will appear here once the integration is complete."
                )}
              </div>
            )}

            {activeTab === "messages" && (
              <div className="max-w-4xl mx-auto">
                {renderPlaceholderContent(
                  "Messages",
                  "lucide:message-circle",
                  "Chat with your Beluga healthcare provider. This feature will be available once the Beluga messaging API is integrated."
                )}
              </div>
            )}

            {activeTab === "account" && (
              <div className="max-w-4xl mx-auto">
                <Card>
                  <CardBody className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-content2">
                        <Avatar
                          name={user?.firstName || user?.email || 'User'}
                          size="lg"
                          fallback={<span className="text-2xl">{getAvatarEmoji(user)}</span>}
                        />
                        <div>
                          <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                          <p className="text-sm text-foreground-500">{user?.email}</p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground-500">
                        Additional account settings will be available once the Beluga integration is complete.
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}
          </motion.main>

          {/* Mobile Bottom Navigation */}
          <div className="md:hidden flex items-center justify-around border-t border-content3 bg-content1 h-16">
            {navItems.map((item) => (
              <Button
                key={item.id}
                isIconOnly
                variant="light"
                className={activeTab === item.id ? "text-teal-500" : "text-foreground-500"}
                onPress={() => setActiveTab(item.id)}
                aria-label={item.label}
              >
                <Icon icon={item.icon} className="text-xl" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function BelugaDashboardRoute() {
  return <BelugaDashboardPage />;
}
