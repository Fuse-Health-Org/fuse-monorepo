import React, { useState, useEffect } from "react";
import { Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Select, SelectItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { getAvatarEmoji } from "../lib/avatarUtils";
import { getPrimaryRole, hasRole } from "../lib/auth";
import { apiCall } from "../lib/api";
import { DashboardSelector } from "./DashboardSelector";

interface Patient {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const primaryRole = getPrimaryRole(user);
  const isSuperAdmin = hasRole(user, "superAdmin");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  // Check if currently impersonating from the user object (set by backend in JWT)
  // The user object will have impersonating: true if the JWT was created during impersonation
  const isImpersonating = user?.impersonating === true;

  // Load patients list if superAdmin and NOT impersonating
  useEffect(() => {
    if (isSuperAdmin && !isImpersonating) {
      loadPatients();
    }
  }, [isSuperAdmin, isImpersonating]);

  const loadPatients = async () => {
    try {
      const result = await apiCall("/admin/patients/list");
      console.log("📋 Patients API response:", result);
      if (result.success && result.data?.data?.patients) {
        setPatients(result.data.data.patients);
        console.log("✅ Loaded patients:", result.data.data.patients.length);
      } else if (result.success && result.data?.patients) {
        // Fallback in case structure changes
        setPatients(result.data.patients);
        console.log("✅ Loaded patients (fallback):", result.data.patients.length);
      }
    } catch (error) {
      console.error("Failed to load patients:", error);
    }
  };

  const handleImpersonate = async (patientId: string) => {
    if (!patientId) return;

    try {
      console.log("🎭 Starting impersonation for patient:", patientId);
      const result = await apiCall("/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ userId: patientId }),
      });

      console.log("🎭 Impersonation API result:", result);

      if (result.success && result.data?.data?.token) {
        const token = result.data.data.token;
        console.log("🎭 Got impersonation token, reloading...");

        // Replace token with impersonation token
        localStorage.setItem("auth-token", token);

        // Reload the page to fetch impersonated user data
        window.location.reload();
      } else {
        console.error("❌ Impersonation failed - no token in response:", result);
        alert("Failed to impersonate user. Check console for details.");
      }
    } catch (error) {
      console.error("❌ Failed to impersonate:", error);
      alert("Failed to impersonate user: " + error);
    }
  };

  const handleExitImpersonation = async () => {
    try {
      console.log("🚪 Exiting impersonation...");
      const result = await apiCall("/admin/exit-impersonation", {
        method: "POST",
      });

      console.log("🚪 Exit impersonation result:", result);

      if (result.success && result.data?.data?.token) {
        const token = result.data.data.token;
        console.log("🚪 Got admin token, reloading...");

        // Restore original token
        localStorage.setItem("auth-token", token);

        // Reload to restore original user
        window.location.reload();
      } else {
        console.error("❌ Exit impersonation failed - no token in response:", result);
        alert("Failed to exit impersonation. Check console for details.");
      }
    } catch (error) {
      console.error("❌ Failed to exit impersonation:", error);
      alert("Failed to exit impersonation: " + error);
    }
  };

  return (
    <>
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-warning-100 border-b border-warning-300 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:eye" className="text-warning-700" />
            <span className="text-sm font-medium text-warning-900">
              Viewing as: {user?.firstName} {user?.lastName} ({user?.email})
            </span>
          </div>
          <Button
            size="sm"
            color="warning"
            variant="flat"
            onPress={handleExitImpersonation}
            startContent={<Icon icon="lucide:log-out" />}
          >
            Exit Impersonation
          </Button>
        </div>
      )}

      <motion.header
        className="h-16 border-b border-content3 bg-content1 flex items-center justify-between px-6"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Welcome Message */}
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
            </h2>
            <p className="text-sm text-foreground-600 capitalize">
              {primaryRole || 'patient'} Dashboard
            </p>
          </div>
        </div>

        {/* SuperAdmin Impersonation Selector */}
        {isSuperAdmin && !isImpersonating && (
          <div className="flex items-center gap-2">
            <Icon icon="lucide:user-cog" className="text-primary" />
            <Select
              placeholder="Impersonate patient..."
              className="w-64"
              size="sm"
              selectedKeys={selectedPatientId ? [selectedPatientId] : []}
              onSelectionChange={(keys) => {
                const selectedKey = Array.from(keys)[0] as string;
                if (selectedKey) {
                  setSelectedPatientId(selectedKey);
                  handleImpersonate(selectedKey);
                }
              }}
            >
              {patients.map((patient) => (
                <SelectItem key={patient.id}>
                  {patient.firstName && patient.lastName
                    ? `${patient.firstName} ${patient.lastName} (${patient.email})`
                    : patient.email}
                </SelectItem>
              ))}
            </Select>
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* Dashboard Selector - Switch between Fuse and MDI dashboards */}
          <DashboardSelector />
          {/* User Profile Dropdown */}
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                name={user?.firstName || user?.email || 'User'}
                className="cursor-pointer transition-transform hover:scale-105"
                size="sm"
                fallback={
                  <span className="text-2xl">{getAvatarEmoji(user)}</span>
                }
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem key="profile" className="h-14 gap-2">
                <p className="font-semibold">Signed in as</p>
                <p className="font-semibold">{user?.email}</p>
              </DropdownItem>
              <DropdownItem key="settings" startContent={<Icon icon="lucide:settings" />}>
                Settings
              </DropdownItem>
              <DropdownItem key="help" startContent={<Icon icon="lucide:help-circle" />}>
                Help & Support
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                startContent={<Icon icon="lucide:log-out" />}
                onPress={signOut}
              >
                Sign Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </motion.header>
    </>
  );
};