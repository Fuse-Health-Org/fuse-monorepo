import React, { useState, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader, Button, Input, Spinner, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import { apiCall } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const FONT_OPTIONS = [
  { value: "Playfair Display", label: "Playfair Display", description: "Elegant serif font with a classic feel" },
  { value: "Inter", label: "Inter", description: "Modern sans-serif, clean and readable" },
  { value: "Georgia", label: "Georgia", description: "Traditional serif, professional look" },
  { value: "Poppins", label: "Poppins", description: "Geometric sans-serif, friendly and modern" },
  { value: "Merriweather", label: "Merriweather", description: "Readable serif designed for screens" },
  { value: "Roboto", label: "Roboto", description: "Versatile sans-serif, neutral and clean" },
  { value: "Lora", label: "Lora", description: "Balanced serif with calligraphic roots" },
  { value: "Open Sans", label: "Open Sans", description: "Humanist sans-serif, excellent legibility" },
];

interface PortalSettings {
  clinicName: string;
  clinicSlug: string;
  portalTitle: string;
  portalDescription: string;
  primaryColor: string;
  fontFamily: string;
  logo: string;
  heroImageUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  isActive: boolean;
  parentClinicSlug?: string;
  parentClinicCustomDomain?: string;
}

export function AffiliateBranding() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [logoInputMode, setLogoInputMode] = useState<"file" | "url">("url");
  const [heroInputMode, setHeroInputMode] = useState<"file" | "url">("url");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);

  const [settings, setSettings] = useState<PortalSettings>({
    clinicName: "",
    clinicSlug: "",
    portalTitle: "Welcome to Our Portal",
    portalDescription: "Your trusted healthcare partner. Browse our products and services below.",
    primaryColor: "#000000",
    fontFamily: "Playfair Display",
    logo: "",
    heroImageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80",
    heroTitle: "Your Daily Health, Simplified",
    heroSubtitle: "All-in-one nutritional support in one simple drink",
    isActive: false,
  });

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const response = await apiCall("/affiliate/clinic", { method: "GET" });

      if (response.success) {
        const data = response.data?.data || response.data;
        const clinic = data?.clinic || {};
        const customWebsite = data?.customWebsite || {};

        console.log('🔧 [AffiliateBranding] DEPLOYED v2 - Loading settings:', {
          customWebsiteLogo: customWebsite.logo,
          clinicLogo: clinic.logo,
          usingLogo: customWebsite.logo || "(empty - no fallback)"
        });

        setSettings({
          clinicName: clinic.name || "",
          clinicSlug: clinic.slug || "",
          portalTitle: customWebsite.portalTitle || settings.portalTitle,
          portalDescription: customWebsite.portalDescription || settings.portalDescription,
          primaryColor: customWebsite.primaryColor || clinic.defaultFormColor || settings.primaryColor,
          fontFamily: customWebsite.fontFamily || settings.fontFamily,
          // Don't fallback to clinic.logo - show only what affiliate has set in their CustomWebsite
          // Parent logo fallback only applies on patient-facing landing page, not admin branding page
          logo: customWebsite.logo || "",
          heroImageUrl: customWebsite.heroImageUrl || settings.heroImageUrl,
          heroTitle: customWebsite.heroTitle || settings.heroTitle,
          heroSubtitle: customWebsite.heroSubtitle || settings.heroSubtitle,
          isActive: customWebsite.isActive ?? clinic.isActive ?? false,
          parentClinicSlug: user?.clinic?.parentClinicSlug || "",
          parentClinicCustomDomain: user?.clinic?.parentClinicCustomDomain || "",
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      showToast('error', 'Failed to load portal settings');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user, loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiCall("/affiliate/clinic", {
        method: "PUT",
        body: JSON.stringify({
          name: settings.clinicName,
          logo: settings.logo,
          defaultFormColor: settings.primaryColor,
          portalTitle: settings.portalTitle,
          portalDescription: settings.portalDescription,
          primaryColor: settings.primaryColor,
          fontFamily: settings.fontFamily,
          heroImageUrl: settings.heroImageUrl,
          heroTitle: settings.heroTitle,
          heroSubtitle: settings.heroSubtitle,
          isActive: settings.isActive,
        }),
      });

      if (response.success) {
        showToast('success', 'Portal settings saved successfully!');
      } else {
        showToast('error', response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    setIsTogglingActive(true);
    try {
      const response = await apiCall("/affiliate/clinic", {
        method: "PUT",
        body: JSON.stringify({ isActive: checked }),
      });

      if (response.success) {
        setSettings({ ...settings, isActive: checked });
        showToast('success', checked ? 'Portal activated!' : 'Portal deactivated');
      } else {
        showToast('error', 'Failed to toggle portal status');
      }
    } catch (error) {
      console.error("Error toggling portal:", error);
      showToast('error', 'Failed to toggle portal status');
    } finally {
      setIsTogglingActive(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      // Get auth token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;

      const response = await fetch(`${API_URL}/custom-website/upload-logo`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.logoUrl) {
          setSettings({ ...settings, logo: data.data.logoUrl });
          showToast('success', 'Logo uploaded successfully!');
        }
      } else if (response.status === 401) {
        showToast('error', 'Session expired. Please sign in again.');
        // Optionally redirect to signin
        window.location.href = '/signin';
      } else if (response.status === 403) {
        showToast('error', 'Access denied. You do not have permission to upload logos.');
      } else {
        showToast('error', 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      showToast('error', 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingHero(true);
    try {
      const formData = new FormData();
      formData.append('heroImage', file);

      // Get auth token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;

      const response = await fetch(`${API_URL}/custom-website/upload-hero`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.heroImageUrl) {
          setSettings({ ...settings, heroImageUrl: data.data.heroImageUrl });
          showToast('success', 'Hero image uploaded successfully!');
        }
      } else if (response.status === 401) {
        showToast('error', 'Session expired. Please sign in again.');
        // Optionally redirect to signin
        window.location.href = '/signin';
      } else if (response.status === 403) {
        showToast('error', 'Access denied. You do not have permission to upload images.');
      } else {
        showToast('error', 'Failed to upload hero image');
      }
    } catch (error) {
      console.error('Error uploading hero image:', error);
      showToast('error', 'Failed to upload hero image');
    } finally {
      setIsUploadingHero(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Main portal URL using parent clinic's custom domain (removing 'app.' prefix)
  const mainPortalUrl = settings.clinicSlug && settings.parentClinicCustomDomain
    ? `${settings.clinicSlug}.${settings.parentClinicCustomDomain.replace(/^app\./, '')}`
    : '';

  // Fallback portal URL using parent clinic slug
  const fallbackPortalUrl = settings.clinicSlug && settings.parentClinicSlug
    ? `${settings.clinicSlug}.${settings.parentClinicSlug}.fusehealth.com`
    : '';

  // Admin portal URLs
  const adminPortalUrl = settings.parentClinicCustomDomain
    ? `admin.${settings.parentClinicCustomDomain.replace(/^app\./, '')}`
    : '';

  const fallbackAdminPortalUrl = settings.parentClinicSlug
    ? `admin.${settings.parentClinicSlug}.fusehealth.com`
    : '';

  const handlePreviewMain = () => {
    if (mainPortalUrl) {
      window.open(`https://${mainPortalUrl}`, '_blank');
    }
  };

  const handlePreviewFallback = () => {
    if (fallbackPortalUrl) {
      window.open(`https://${fallbackPortalUrl}`, '_blank');
    }
  };

  const handlePreviewAdmin = () => {
    if (adminPortalUrl) {
      window.open(`https://${adminPortalUrl}`, '_blank');
    }
  };

  const handlePreviewFallbackAdmin = () => {
    if (fallbackAdminPortalUrl) {
      window.open(`https://${fallbackAdminPortalUrl}`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portal Customization</h1>
        <p className="text-muted-foreground">Customize your patient-facing landing page</p>
      </div>

      {/* Custom Website Activation Toggle */}
      <Card className={settings.isActive ? 'border-green-200 bg-green-50/30' : ''}>
        <CardBody className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${settings.isActive ? 'bg-green-100' : 'bg-content2'}`}>
                <Icon
                  icon="lucide:globe"
                  className={`text-2xl ${settings.isActive ? 'text-green-600' : 'text-muted-foreground'}`}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Custom Website</h3>
                <p className="text-sm text-muted-foreground">
                  {settings.isActive
                    ? "Your custom landing page is live and visible to visitors"
                    : "Enable to show your custom landing page to visitors"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${settings.isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                {settings.isActive ? "Activated" : "Deactivated"}
              </span>
              <Switch
                isSelected={settings.isActive}
                onValueChange={handleToggleActive}
                isDisabled={isTogglingActive}
                classNames={{
                  wrapper: settings.isActive ? "bg-green-600" : "",
                }}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-4">
          {/* Portal Title */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Portal Title</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <Input
                value={settings.portalTitle}
                onChange={(e) => setSettings({ ...settings, portalTitle: e.target.value })}
                placeholder="Enter portal title"
                variant="bordered"
              />
            </CardBody>
          </Card>

          {/* Portal Description */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Portal Description</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <textarea
                className="w-full p-3 border border-content3 rounded-lg text-sm min-h-[80px] resize-none bg-background text-foreground"
                value={settings.portalDescription}
                onChange={(e) => setSettings({ ...settings, portalDescription: e.target.value })}
                placeholder="Enter portal description"
              />
            </CardBody>
          </Card>

          {/* Primary Color */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Primary Color</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <div
                  className="w-10 h-10 rounded border border-content3"
                  style={{ backgroundColor: settings.primaryColor }}
                />
                <Input
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  placeholder="#000000"
                  className="w-28"
                  variant="bordered"
                />
              </div>
            </CardBody>
          </Card>

          {/* Font Selection */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Choose a Font</h3>
              <p className="text-xs text-muted-foreground">Previews update in real-time</p>
            </CardHeader>
            <CardBody className="pt-0 space-y-3">
              <select
                className="w-full p-3 border border-content3 rounded-lg text-sm bg-background text-foreground"
                value={settings.fontFamily}
                onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {FONT_OPTIONS.find((f) => f.value === settings.fontFamily)?.description}
              </p>

              {/* Font Preview */}
              <div className="p-4 border border-content3 rounded-lg bg-content1">
                <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                <h3
                  className="text-xl font-semibold mb-1"
                  style={{ fontFamily: settings.fontFamily }}
                >
                  {settings.portalTitle || "Sample Title"}
                </h3>
                <p
                  className="text-sm text-muted-foreground"
                  style={{ fontFamily: settings.fontFamily }}
                >
                  We're looking for talented professionals to join our growing team. Apply today and start your journey with us!
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Logo</h3>
              <p className="text-xs text-muted-foreground">Upload your brand logo (recommended: 200x60px)</p>
            </CardHeader>
            <CardBody className="pt-0 space-y-3">
              {settings.logo && (
                <div className="p-4 bg-content1 rounded-lg flex flex-col items-center gap-3">
                  <img
                    src={settings.logo}
                    alt="Logo preview"
                    className="h-12 object-contain max-w-[200px]"
                  />
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    onPress={async () => {
                      try {
                        const response = await apiCall("/affiliate/clinic", {
                          method: "PUT",
                          body: JSON.stringify({ logo: "" }),
                        });
                        if (response.success) {
                          setSettings({ ...settings, logo: "" });
                          showToast('success', 'Logo removed successfully');
                        } else {
                          showToast('error', 'Failed to remove logo');
                        }
                      } catch (error) {
                        console.error('Error removing logo:', error);
                        showToast('error', 'Failed to remove logo');
                      }
                    }}
                  >
                    <Icon icon="lucide:trash-2" className="w-4 h-4 mr-1" />
                    Clear Logo
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={logoInputMode === "file" ? "solid" : "bordered"}
                  onPress={() => setLogoInputMode("file")}
                >
                  <Icon icon="lucide:upload" className="w-4 h-4 mr-2" />
                  Upload a file
                </Button>
                <Button
                  size="sm"
                  variant={logoInputMode === "url" ? "solid" : "bordered"}
                  onPress={() => setLogoInputMode("url")}
                >
                  <Icon icon="lucide:link" className="w-4 h-4 mr-2" />
                  Enter URL
                </Button>
              </div>

              {logoInputMode === "file" ? (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="w-full p-2 border border-content3 rounded-lg text-sm"
                  />
                  {isUploadingLogo && (
                    <p className="text-xs text-primary mt-2">Uploading...</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Accepted formats: PNG, JPG, SVG. Max size: 2MB</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={settings.logo}
                    onChange={(e) => setSettings({ ...settings, logo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    variant="bordered"
                    className="flex-1"
                  />
                  <Button
                    variant="bordered"
                    size="sm"
                    onPress={() => setSettings({ ...settings, logo: "" })}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Hero Image */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Hero Banner Image</h3>
              <p className="text-xs text-muted-foreground">Large viewport image displayed at the top of your landing page (recommended: 1920x1080px)</p>
            </CardHeader>
            <CardBody className="pt-0 space-y-3">
              {settings.heroImageUrl && (
                <div className="rounded-lg overflow-hidden border border-content3">
                  <img
                    src={settings.heroImageUrl}
                    alt="Hero preview"
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={heroInputMode === "file" ? "solid" : "bordered"}
                  onPress={() => setHeroInputMode("file")}
                >
                  <Icon icon="lucide:upload" className="w-4 h-4 mr-2" />
                  Upload a file
                </Button>
                <Button
                  size="sm"
                  variant={heroInputMode === "url" ? "solid" : "bordered"}
                  onPress={() => setHeroInputMode("url")}
                >
                  <Icon icon="lucide:link" className="w-4 h-4 mr-2" />
                  Enter URL
                </Button>
              </div>

              {heroInputMode === "file" ? (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleHeroImageUpload}
                    disabled={isUploadingHero}
                    className="w-full p-2 border border-content3 rounded-lg text-sm"
                  />
                  {isUploadingHero && (
                    <p className="text-xs text-primary mt-2">Uploading...</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Accepted formats: PNG, JPG, WebP. Max size: 5MB</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={settings.heroImageUrl}
                    onChange={(e) => setSettings({ ...settings, heroImageUrl: e.target.value })}
                    placeholder="https://example.com/hero-image.jpg"
                    variant="bordered"
                    className="flex-1"
                  />
                  <Button
                    variant="bordered"
                    size="sm"
                    onPress={() => setSettings({ ...settings, heroImageUrl: "" })}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Hero Title */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Hero Title</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <Input
                value={settings.heroTitle}
                onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                placeholder="Enter hero title"
                variant="bordered"
              />
            </CardBody>
          </Card>

          {/* Hero Subtitle */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Hero Subtitle</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <Input
                value={settings.heroSubtitle}
                onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                placeholder="Enter hero subtitle"
                variant="bordered"
              />
            </CardBody>
          </Card>

          {/* Save Button */}
          <Button
            color="primary"
            className="w-full"
            onPress={handleSave}
            isLoading={saving}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Live Preview Panel */}
        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between w-full">
                <h3 className="text-sm font-medium">Live Preview</h3>
                <div className="flex gap-1 p-1 bg-content2 rounded-lg">
                  <Button
                    size="sm"
                    variant={previewMode === "desktop" ? "solid" : "light"}
                    onPress={() => setPreviewMode("desktop")}
                  >
                    <Icon icon="lucide:monitor" className="w-4 h-4 mr-1" />
                    Desktop
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode === "mobile" ? "solid" : "light"}
                    onPress={() => setPreviewMode("mobile")}
                  >
                    <Icon icon="lucide:smartphone" className="w-4 h-4 mr-1" />
                    Mobile
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <div
                className={`bg-white border border-content3 rounded-lg overflow-hidden shadow-sm ${previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""
                  }`}
                style={{ fontFamily: settings.fontFamily }}
              >
                {/* Preview Header */}
                <div className="border-b bg-white p-3 flex items-center justify-between">
                  {settings.logo ? (
                    <img src={settings.logo} alt="Logo" className="h-6 object-contain" />
                  ) : (
                    <span className="font-bold text-sm" style={{ color: settings.primaryColor }}>
                      {settings.clinicName || "BRAND"}
                    </span>
                  )}
                  <button
                    className="px-3 py-1 rounded text-white text-xs font-medium"
                    style={{ backgroundColor: settings.primaryColor }}
                  >
                    Apply Now
                  </button>
                </div>

                {/* Preview Hero */}
                <div
                  className="relative h-64 bg-cover bg-center flex items-center justify-center"
                  style={{ backgroundImage: `url(${settings.heroImageUrl})` }}
                >
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="relative z-10 text-center text-white px-4">
                    <h2
                      className="text-2xl font-bold mb-2"
                      style={{ fontFamily: settings.fontFamily }}
                    >
                      {settings.heroTitle}
                    </h2>
                    <p className="text-sm opacity-90 mb-4">{settings.heroSubtitle}</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        className="px-4 py-2 rounded text-white text-sm font-medium"
                        style={{ backgroundColor: settings.primaryColor }}
                      >
                        View All Products →
                      </button>
                      <button className="px-4 py-2 rounded text-white text-sm font-medium bg-white/10 border border-white">
                        Learn More →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview Content */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2 text-gray-900">{settings.portalTitle}</h3>
                  <p className="text-sm text-gray-600 mb-4">{settings.portalDescription}</p>

                  {/* Sample Product Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-2">
                        <div
                          className="h-20 rounded mb-2"
                          style={{ backgroundColor: `${settings.primaryColor}20` }}
                        />
                        <div className="h-3 bg-gray-200 rounded w-3/4 mb-1" />
                        <div className="h-2 bg-gray-100 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Portal URLs Display */}
      {(mainPortalUrl || fallbackPortalUrl || adminPortalUrl || fallbackAdminPortalUrl) && (
        <div className="space-y-3">
          {/* Main Portal URL */}
          {mainPortalUrl && (
            <Card>
              <CardBody className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Icon icon="lucide:link" className="text-xl text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground mb-1">Your Portal URL</h3>
                      <p className="text-sm font-mono text-muted-foreground truncate mb-1">
                        {mainPortalUrl}
                      </p>
                      <p className="text-xs text-warning flex items-center gap-1">
                        <Icon icon="lucide:alert-circle" className="text-sm" />
                        <span>May not work unless the brand configured wildcard DNS (*.{settings.parentClinicCustomDomain?.replace(/^app\./, '')})</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    color="primary"
                    variant="flat"
                    onPress={handlePreviewMain}
                    startContent={<Icon icon="lucide:external-link" className="text-lg" />}
                  >
                    Preview
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Portal Fallback URL */}
          {fallbackPortalUrl && (
            <Card>
              <CardBody className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-full bg-default/10">
                      <Icon icon="lucide:link-2" className="text-xl text-default-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground mb-1">Portal Fallback URL</h3>
                      <p className="text-sm font-mono text-muted-foreground truncate mb-1">
                        {fallbackPortalUrl}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Use this if the main URL doesn't work
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="bordered"
                    onPress={handlePreviewFallback}
                    startContent={<Icon icon="lucide:external-link" className="text-lg" />}
                  >
                    Preview
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Affiliate Admin Portal */}
          {adminPortalUrl && (
            <Card>
              <CardBody className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-full bg-success/10">
                      <Icon icon="lucide:shield" className="text-xl text-success-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground mb-1">Affiliate Admin Portal</h3>
                      <p className="text-sm font-mono text-muted-foreground truncate mb-1">
                        {adminPortalUrl}
                      </p>
                      <p className="text-xs text-warning flex items-center gap-1">
                        <Icon icon="lucide:alert-circle" className="text-sm" />
                        <span>May not work unless the brand configured wildcard DNS (*.{settings.parentClinicCustomDomain?.replace(/^app\./, '')})</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    color="success"
                    variant="flat"
                    onPress={handlePreviewAdmin}
                    startContent={<Icon icon="lucide:external-link" className="text-lg" />}
                  >
                    Preview
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Fallback Affiliate Admin Portal */}
          {fallbackAdminPortalUrl && (
            <Card>
              <CardBody className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-full bg-default/10">
                      <Icon icon="lucide:shield-check" className="text-xl text-default-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground mb-1">Fallback Affiliate Admin Portal</h3>
                      <p className="text-sm font-mono text-muted-foreground truncate mb-1">
                        {fallbackAdminPortalUrl}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Use this if the main admin URL doesn't work
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="bordered"
                    onPress={handlePreviewFallbackAdmin}
                    startContent={<Icon icon="lucide:external-link" className="text-lg" />}
                  >
                    Preview
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] max-w-md animate-slide-in-right ${toast.type === 'success' ? 'bg-success-500' :
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
    </div>
  );
}
