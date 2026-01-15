import React from "react";
import { motion } from "framer-motion";
import { Button, Avatar, Card, CardBody, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";
import { getAvatarEmoji } from "../../lib/avatarUtils";

/**
 * MDI Dashboard - MD Integrations Portal
 * 
 * This dashboard uses MD Integrations API for:
 * - Patient management (synced with DoseSpot)
 * - Case/prescription management
 * - Clinician messaging
 * - Prescription status tracking
 */

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "lucide:layout-dashboard" },
  { id: "cases", label: "My Cases", icon: "lucide:file-text" },
  { id: "messages", label: "Messages", icon: "lucide:message-circle" },
  { id: "account", label: "Account", icon: "lucide:user" },
];

function MDISidebar({ 
  activeTab, 
  setActiveTab,
  isMobile = false,
}: { 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
  isMobile?: boolean;
}) {
  const { user, logout } = useAuth();

  return (
    <div className={`
      flex flex-col h-full bg-content1 border-r border-content3
      ${isMobile ? 'w-64' : 'w-64'}
    `}>
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-content3">
        <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
          <Icon icon="lucide:stethoscope" className="text-secondary" />
        </div>
        <div>
          <div className="font-semibold text-foreground">
            <span className="text-secondary">MDI</span> Portal
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200
              ${activeTab === item.id 
                ? 'bg-secondary/10 text-secondary' 
                : 'text-foreground-500 hover:bg-content2 hover:text-foreground'
              }
            `}
          >
            <Icon icon={item.icon} className="text-lg" />
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto bg-secondary text-white text-xs px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-content3">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar
            name={user?.firstName || user?.email || 'User'}
            size="sm"
            fallback={
              <span className="text-lg">{getAvatarEmoji(user)}</span>
            }
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {user?.firstName || 'User'}
            </div>
            <div className="text-xs text-foreground-400 truncate">
              {user?.email}
            </div>
          </div>
        </div>
        <Button
          variant="light"
          color="danger"
          size="sm"
          className="w-full mt-2"
          startContent={<Icon icon="lucide:log-out" />}
          onPress={logout}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function MDIDashboardContent() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">MD Integrations Dashboard</h1>
      <p className="text-foreground-500 mb-8">
        Telehealth prescriptions powered by MD Integrations
      </p>

      {/* Coming Soon Card */}
      <Card className="bg-content2">
        <CardBody className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
            <Icon icon="lucide:stethoscope" className="text-3xl text-secondary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
          <p className="text-foreground-500 max-w-md mx-auto mb-6">
            This dashboard will integrate with MD Integrations to provide telehealth 
            prescription services with licensed clinicians.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <FeatureCard
              icon="lucide:user-check"
              title="Patient Registration"
              description="Sync patient data with MD Integrations"
            />
            <FeatureCard
              icon="lucide:file-text"
              title="Case Management"
              description="Create and track prescription cases"
            />
            <FeatureCard
              icon="lucide:message-circle"
              title="Clinician Chat"
              description="Message with assigned clinicians"
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function MDICasesContent() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">My Cases</h1>
      <p className="text-foreground-500 mb-8">
        Track your prescription cases and their status
      </p>

      <Card className="bg-content2">
        <CardBody className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
            <Icon icon="lucide:file-text" className="text-3xl text-secondary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Cases Yet</h2>
          <p className="text-foreground-500 max-w-md mx-auto">
            Your prescription cases will appear here once you start using MD Integrations.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function MDIMessagesContent() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Messages</h1>
      <p className="text-foreground-500 mb-8">
        Communicate with your assigned clinicians
      </p>

      <Card className="bg-content2">
        <CardBody className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
            <Icon icon="lucide:message-circle" className="text-3xl text-secondary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Messages</h2>
          <p className="text-foreground-500 max-w-md mx-auto">
            Messages from clinicians will appear here.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function MDIAccountContent() {
  const { user } = useAuth();
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Account</h1>
      <p className="text-foreground-500 mb-8">
        Manage your account settings
      </p>

      <Card>
        <CardBody className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar
              name={user?.firstName || user?.email || 'User'}
              size="lg"
              fallback={
                <span className="text-2xl">{getAvatarEmoji(user)}</span>
              }
            />
            <div>
              <h2 className="text-lg font-semibold">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-foreground-500">{user?.email}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-content3">
              <div>
                <div className="font-medium">Email</div>
                <div className="text-sm text-foreground-500">{user?.email}</div>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-content3">
              <div>
                <div className="font-medium">Phone</div>
                <div className="text-sm text-foreground-500">{user?.phone || 'Not set'}</div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-4 rounded-lg bg-content1 border border-content3">
      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mb-3">
        <Icon icon={icon} className="text-xl text-secondary" />
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-foreground-500">{description}</p>
    </div>
  );
}

function MDIDashboardPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isMobileView, setIsMobileView] = React.useState(false);

  // Detect mobile view
  React.useEffect(() => {
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Close mobile menu when tab changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <MDIDashboardContent />;
      case "cases":
        return <MDICasesContent />;
      case "messages":
        return <MDIMessagesContent />;
      case "account":
        return <MDIAccountContent />;
      default:
        return <MDIDashboardContent />;
    }
  };

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
              <span className="text-secondary">MDI</span> Portal
            </div>
          </div>
          <Dropdown>
            <DropdownTrigger>
              <Avatar
                name={user?.firstName || user?.email || 'User'}
                className="cursor-pointer"
                size="sm"
                fallback={
                  <span className="text-xl">{getAvatarEmoji(user)}</span>
                }
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
              <DropdownItem key="profile" className="h-14 gap-2">
                <p className="font-semibold">{user?.firstName || 'User'}</p>
                <p className="text-sm text-foreground-500">{user?.email}</p>
              </DropdownItem>
              <DropdownItem 
                key="logout" 
                color="danger" 
                startContent={<Icon icon="lucide:log-out" />}
                onPress={logout}
              >
                Sign Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
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
          <MDISidebar activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobileView} />
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between h-16 border-b border-content3 bg-content1 px-6">
            <div className="text-lg font-medium text-foreground capitalize">
              {activeTab === "dashboard" ? "Dashboard" : navItems.find(n => n.id === activeTab)?.label || activeTab}
            </div>
            <div className="flex items-center gap-4">
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="light" className="gap-2">
                    <Avatar
                      name={user?.firstName || user?.email || 'User'}
                      size="sm"
                      fallback={
                        <span className="text-lg">{getAvatarEmoji(user)}</span>
                      }
                    />
                    <span className="hidden lg:inline">{user?.firstName || 'User'}</span>
                    <Icon icon="lucide:chevron-down" className="text-foreground-400" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="User menu">
                  <DropdownItem key="profile" className="h-14 gap-2">
                    <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
                    <p className="text-sm text-foreground-500">{user?.email}</p>
                  </DropdownItem>
                  <DropdownItem 
                    key="account" 
                    startContent={<Icon icon="lucide:user" />}
                    onPress={() => setActiveTab("account")}
                  >
                    Account Settings
                  </DropdownItem>
                  <DropdownItem 
                    key="logout" 
                    color="danger" 
                    startContent={<Icon icon="lucide:log-out" />}
                    onPress={logout}
                  >
                    Sign Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          {/* Content Area */}
          <motion.main
            className="flex-1 overflow-y-auto p-4 md:p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            key={activeTab}
          >
            {renderContent()}
          </motion.main>

          {/* Mobile Bottom Navigation */}
          <div className="md:hidden flex items-center justify-around border-t border-content3 bg-content1 h-16">
            {navItems.map((item) => (
              <Button
                key={item.id}
                isIconOnly
                variant="light"
                className={activeTab === item.id ? "text-secondary" : "text-foreground-500"}
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

export default function MDIDashboardRoute() {
  return <MDIDashboardPage />;
}
