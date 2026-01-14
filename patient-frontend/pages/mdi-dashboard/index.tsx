import React from "react";
import { motion } from "framer-motion";
import { Button, Avatar, Card, CardBody } from "@heroui/react";
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
function MDIDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState("dashboard");

  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="flex items-center justify-between h-16 border-b border-content3 bg-content1 px-6">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-lg text-foreground">
              <span className="text-secondary">MDI</span> Portal
            </div>
            <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded-full">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              as="a"
              href="/fuse-dashboard"
              variant="flat"
              size="sm"
              startContent={<Icon icon="lucide:arrow-left" />}
            >
              Back to Fuse Dashboard
            </Button>
            <Avatar
              name={user?.firstName || user?.email || 'User'}
              className="cursor-pointer"
              size="sm"
              fallback={
                <span className="text-xl">{getAvatarEmoji(user)}</span>
              }
            />
          </div>
        </div>

        {/* Main Content */}
        <motion.main
          className="flex-1 overflow-y-auto p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
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

            {/* Quick Links */}
            <div className="mt-8 flex gap-4 justify-center">
              <Button
                as="a"
                href="/fuse-dashboard"
                variant="bordered"
                startContent={<Icon icon="lucide:layout-dashboard" />}
              >
                Use Fuse Dashboard
              </Button>
            </div>
          </div>
        </motion.main>
      </div>
    </ProtectedRoute>
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

export default function MDIDashboardRoute() {
  return <MDIDashboardPage />;
}
