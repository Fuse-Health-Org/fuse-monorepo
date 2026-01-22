import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import Layout from "../components/Layout";
import { Spinner, Card, CardBody, CardHeader, Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import Head from "next/head";
import { apiCall } from "../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface AffiliateSettings {
  clinicName: string;
  clinicSlug: string;
  isCustomDomain: boolean;
  customDomain: string;
  parentClinicSlug?: string;
  parentClinicCustomDomain?: string;
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<AffiliateSettings>({
    clinicName: "",
    clinicSlug: "",
    isCustomDomain: false,
    customDomain: "",
    parentClinicSlug: "",
    parentClinicCustomDomain: "",
  });

  // Password change states
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const isAffiliate = useMemo(() => {
    if (!user) return false;
    return user.role === "affiliate" || user.userRoles?.affiliate === true;
  }, [user]);

  // Check if user needs onboarding
  const needsOnboarding = useMemo(() => {
    if (!user || !isAffiliate) return false;
    const hasNoClinic = !user.clinicId;
    const hasPlaceholderSlug = user.clinic?.slug?.startsWith('affiliate-');
    const isClinicInactive = user.clinic && !user.clinic.isActive;
    return hasNoClinic || hasPlaceholderSlug || isClinicInactive;
  }, [user, isAffiliate]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }
    if (!authLoading && user && !isAffiliate) {
      router.push("/signin?error=Access denied. Affiliate role required.");
      return;
    }
    if (!authLoading && user && isAffiliate && needsOnboarding) {
      router.push("/onboarding");
      return;
    }
  }, [user, authLoading, isAffiliate, needsOnboarding, router]);

  const loadSettings = useCallback(async () => {
    try {
      const response = await apiCall("/affiliate/clinic", { method: "GET" });

      if (response.success) {
        const data = response.data?.data || response.data;
        const clinic = data?.clinic || {};
        const parentClinic = data?.parentClinic || {};

        console.log('🔧 [AffiliateSettings] Loading settings:', {
          clinicName: clinic.name,
          clinicSlug: clinic.slug,
          isCustomDomain: clinic.isCustomDomain,
          customDomain: clinic.customDomain,
          parentClinicSlug: parentClinic.slug,
          parentClinicCustomDomain: parentClinic.customDomain,
        });

        setSettings({
          clinicName: clinic.name || "",
          clinicSlug: clinic.slug || "",
          isCustomDomain: clinic.isCustomDomain || false,
          customDomain: clinic.customDomain || "",
          parentClinicSlug: parentClinic.slug || "",
          parentClinicCustomDomain: parentClinic.customDomain || "",
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      showToast('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user && isAffiliate && !needsOnboarding) {
      loadSettings();
    }
  }, [user, isAffiliate, needsOnboarding, loadSettings]);


  const handleSave = async () => {
    // Validate slug
    if (!settings.clinicSlug || settings.clinicSlug.trim().length < 3) {
      showToast('error', 'Affiliate slug must be at least 3 characters long');
      return;
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(settings.clinicSlug)) {
      showToast('error', 'Slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    // Validate custom domain if selected
    if (settings.isCustomDomain) {
      const trimmedDomain = settings.customDomain.trim();

      // Check if domain is empty or too short
      if (!trimmedDomain || trimmedDomain.length < 3) {
        showToast('error', `Please enter a valid custom domain (e.g., ${defaultAffiliateDomain})`);
        return;
      }

      // Validate domain format (should be subdomain.domain.com)
      const domainParts = trimmedDomain.split('.');
      if (domainParts.length < 2) {
        showToast('error', `Please enter a valid subdomain (e.g., ${defaultAffiliateDomain})`);
        return;
      }
    }

    setSaving(true);
    try {
      const response = await apiCall("/affiliate/clinic", {
        method: "PUT",
        body: JSON.stringify({
          name: settings.clinicName,
          slug: settings.clinicSlug,
          isCustomDomain: settings.isCustomDomain,
          customDomain: settings.isCustomDomain ? settings.customDomain : null,
        }),
      });

      if (response.success) {
        showToast('success', 'Settings saved successfully!');
        // Reload settings to get updated data
        await loadSettings();
      } else {
        const errorMessage = (response as any).message || response.error || 'Failed to save settings';
        showToast('error', errorMessage);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setIsChangingPassword(true);

    // Validation
    if (!passwordData.currentPassword) {
      showToast('error', 'Current password is required');
      setIsChangingPassword(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      showToast('error', 'New password must be at least 8 characters long');
      setIsChangingPassword(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('error', "Passwords don't match");
      setIsChangingPassword(false);
      return;
    }

    try {
      const response = await apiCall("/users/profile", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword.trim(),
          newPassword: passwordData.newPassword.trim(),
        }),
      });

      if (response.success) {
        showToast('success', 'Password changed successfully!');
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const errorMessage = (response as any).message || response.error || 'Failed to change password';
        showToast('error', errorMessage);
      }
    } catch (error) {
      console.error("Error changing password:", error);
      showToast('error', 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || !isAffiliate) {
    return null;
  }

  // Get the base domain for CNAME
  // Affiliate domain structure: affiliateslug.parentslug.fusehealth.com
  const isStaging = process.env.NEXT_PUBLIC_IS_STAGING === 'true';
  const baseDomain = isStaging ? 'fusehealthstaging.xyz' : 'fusehealth.com';
  
  // Subdomain format: {affiliate-slug}.{parent-slug}.fusehealth.com
  const subdomainUrl = settings.clinicSlug && settings.parentClinicSlug
    ? `${settings.clinicSlug}.${settings.parentClinicSlug}.${baseDomain}` 
    : `affiliate-slug.brand-slug.${baseDomain}`;
  
  // CNAME value is the same as subdomain
  const cnameValue = subdomainUrl;
  
  // Default custom domain: {affiliate-slug}.{parent-slug}.com
  const defaultAffiliateDomain = settings.clinicSlug && settings.parentClinicSlug
    ? `${settings.clinicSlug}.${settings.parentClinicSlug}.com`
    : 'affiliate.brand.com';

  return (
    <Layout>
      <Head>
        <title>Settings - Fuse Affiliate Portal</title>
      </Head>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your affiliate portal settings and custom domain</p>
        </div>

        {/* Clinic Name */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-base font-semibold">Clinic Name</h3>
            <p className="text-xs text-muted-foreground">Your clinic's display name</p>
          </CardHeader>
          <CardBody className="pt-0">
            <Input
              value={settings.clinicName}
              onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })}
              placeholder="Enter clinic name"
              variant="bordered"
            />
          </CardBody>
        </Card>

        {/* Affiliate Slug */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-base font-semibold">Affiliate Slug</h3>
            <p className="text-xs text-muted-foreground">
              Your unique identifier - updates domain configuration below automatically
            </p>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2">
              <Input
                value={settings.clinicSlug}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  
                  // If custom domain is enabled and we have parent slug, update the custom domain too
                  let newCustomDomain = settings.customDomain;
                  if (settings.isCustomDomain && settings.parentClinicSlug && settings.customDomain) {
                    // Extract the domain part (everything after the first dot)
                    const domainParts = settings.customDomain.split('.');
                    if (domainParts.length >= 2) {
                      // Rebuild with new affiliate slug: {new-slug}.{rest-of-domain}
                      const restOfDomain = domainParts.slice(1).join('.');
                      newCustomDomain = `${value}.${restOfDomain}`;
                    }
                  }
                  
                  setSettings({ 
                    ...settings, 
                    clinicSlug: value,
                    customDomain: newCustomDomain
                  });
                }}
                placeholder="your-affiliate-slug"
                variant="bordered"
              />
              <div className="flex items-start gap-2 p-2 bg-primary-50 border border-primary-200 rounded-lg">
                <Icon icon="lucide:info" className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-primary-800">
                  <p className="font-medium mb-1">Preview URLs (save to confirm):</p>
                  <p>• Subdomain: <code className="font-mono bg-white px-1 py-0.5 rounded">{settings.clinicSlug || 'affiliate'}.{settings.parentClinicSlug || 'brand'}.{baseDomain}</code></p>
                  <p>• Custom: <code className="font-mono bg-white px-1 py-0.5 rounded">{settings.clinicSlug || 'affiliate'}.{settings.parentClinicSlug || 'brand'}.com</code></p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Domain Configuration */}
        <Card>
          <CardHeader className="pb-4">
            <h3 className="text-xl font-semibold">Domain Configuration</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose how visitors will access your affiliate portal
            </p>
          </CardHeader>
          <CardBody className="pt-0 space-y-4">
            {/* Domain Type Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Subdomain Card */}
              <div
                className={`cursor-pointer transition-all duration-200 border-2 rounded-lg p-4 ${
                  !settings.isCustomDomain
                    ? 'border-primary bg-primary/5'
                    : 'border-content3 hover:border-primary/50'
                }`}
                onClick={() => {
                  setSettings({ ...settings, isCustomDomain: false });
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${
                    !settings.isCustomDomain
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-content2 text-muted-foreground'
                  }`}>
                    <Icon icon="lucide:link" className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Subdomain</h4>
                    <p className="text-xs text-muted-foreground">
                      Use {settings.clinicSlug || 'affiliate'}.{settings.parentClinicSlug || 'brand'}.{baseDomain}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className={`w-3 h-3 rounded-full border-2 ${
                    !settings.isCustomDomain
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}>
                    {!settings.isCustomDomain && (
                      <div className="w-1 h-1 bg-white rounded-full m-0.5"></div>
                    )}
                  </div>
                  <span className="text-xs font-medium">
                    {subdomainUrl}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Quick setup, no additional configuration required
                </p>
              </div>

              {/* Custom Domain Card */}
              <div
                className={`cursor-pointer transition-all duration-200 border-2 rounded-lg p-4 ${
                  settings.isCustomDomain
                    ? 'border-primary bg-primary/5'
                    : 'border-content3 hover:border-primary/50'
                }`}
                onClick={() => {
                  setSettings({
                    ...settings,
                    isCustomDomain: true,
                    // Only set customDomain if it doesn't exist, using the new slug format
                    customDomain: settings.customDomain || (settings.clinicSlug && settings.parentClinicSlug
                      ? `${settings.clinicSlug}.${settings.parentClinicSlug}.com`
                      : "")
                  });
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${
                    settings.isCustomDomain
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-content2 text-muted-foreground'
                  }`}>
                    <Icon icon="lucide:globe" className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Custom Domain</h4>
                    <p className="text-xs text-muted-foreground">
                      Use {settings.clinicSlug || 'affiliate'}.{settings.parentClinicSlug || 'brand'}.com
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className={`w-3 h-3 rounded-full border-2 ${
                    settings.isCustomDomain
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}>
                    {settings.isCustomDomain && (
                      <div className="w-1 h-1 bg-white rounded-full m-0.5"></div>
                    )}
                  </div>
                  <span className="text-xs font-medium">
                    {defaultAffiliateDomain}
                  </span>
                </div>
                {settings.isCustomDomain && (
                  <div className="space-y-2 mt-3">
                    <Input
                      value={defaultAffiliateDomain}
                      onChange={(e) => {
                        setSettings({ ...settings, customDomain: e.target.value });
                      }}
                      placeholder={defaultAffiliateDomain}
                      variant="bordered"
                      size="sm"
                      className="w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <p className="text-xs text-muted-foreground">
                      Subdomain of brand's custom domain - DNS configuration required
                    </p>
                  </div>
                )}
                {!settings.isCustomDomain && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Requires DNS configuration and domain verification
                  </p>
                )}
              </div>
            </div>

            {/* CNAME Alert - Always show when custom domain is selected */}
            {settings.isCustomDomain && (
              <div className="p-4 border-2 border-warning-300 bg-gradient-to-br from-warning-50 to-warning-100/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-warning-500 rounded-lg flex-shrink-0">
                    <Icon icon="lucide:alert-triangle" className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-warning-900 mb-2">
                      Important: CNAME Configuration
                    </h4>
                    <p className="text-sm text-warning-800 mb-3">
                      Your CNAME is unique and must be assigned to your domain. Configure your DNS provider with:
                    </p>
                    <div className="bg-white border border-warning-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-default-500 uppercase">CNAME Record:</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${defaultAffiliateDomain} -> ${cnameValue}`);
                            showToast('success', 'CNAME copied to clipboard!');
                          }}
                          className="p-1 rounded-md hover:bg-default-100 text-default-400 hover:text-default-600 transition-colors"
                          title="Copy CNAME"
                        >
                          <Icon icon="lucide:copy" className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="flex gap-2">
                          <span className="font-medium text-default-600 min-w-[60px]">Host:</span>
                          <code className="font-mono text-warning-900 bg-warning-50 px-2 py-0.5 rounded flex-1">
                            {defaultAffiliateDomain}
                          </code>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-medium text-default-600 min-w-[60px]">Points to:</span>
                          <code className="font-mono text-warning-900 bg-warning-50 px-2 py-0.5 rounded flex-1 break-all">
                            {cnameValue}
                          </code>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-warning-700 mt-2">
                      <Icon icon="lucide:info" className="inline h-3 w-3 mr-1" />
                      DNS changes can take up to 48 hours to propagate.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Password Change Section */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-base font-semibold">Change Password</h3>
            <p className="text-xs text-muted-foreground">Update your password to keep your account secure</p>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-4">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                label="Current Password"
                placeholder="Enter your current password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                variant="bordered"
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="focus:outline-none"
                  >
                    <Icon
                      icon={showCurrentPassword ? "lucide:eye-off" : "lucide:eye"}
                      className="text-default-400"
                    />
                  </button>
                }
                isDisabled={isChangingPassword}
              />
              
              <Input
                type={showNewPassword ? "text" : "password"}
                label="New Password"
                placeholder="Enter your new password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                variant="bordered"
                description="Must be at least 8 characters long"
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="focus:outline-none"
                  >
                    <Icon
                      icon={showNewPassword ? "lucide:eye-off" : "lucide:eye"}
                      className="text-default-400"
                    />
                  </button>
                }
                isDisabled={isChangingPassword}
              />
              
              <Input
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm New Password"
                placeholder="Confirm your new password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                variant="bordered"
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="focus:outline-none"
                  >
                    <Icon
                      icon={showConfirmPassword ? "lucide:eye-off" : "lucide:eye"}
                      className="text-default-400"
                    />
                  </button>
                }
                isDisabled={isChangingPassword}
              />
              
              <Button
                color="primary"
                onPress={handleChangePassword}
                isLoading={isChangingPassword}
                isDisabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                startContent={<Icon icon="lucide:lock" className="h-5 w-5" />}
              >
                {isChangingPassword ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            color="primary"
            size="lg"
            onPress={handleSave}
            isLoading={saving}
            startContent={<Icon icon="lucide:save" className="h-5 w-5" />}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] max-w-md animate-slide-in-right ${
              toast.type === 'success' ? 'bg-success-500' :
              toast.type === 'error' ? 'bg-danger-500' :
              'bg-primary-500'
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                icon={
                  toast.type === 'success' ? 'lucide:check-circle' :
                  toast.type === 'error' ? 'lucide:alert-circle' :
                  'lucide:info'
                }
                width={20}
                className="flex-shrink-0 mt-0.5"
              />
              <p className="text-sm flex-1">{toast.message}</p>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                <Icon icon="lucide:x" width={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

