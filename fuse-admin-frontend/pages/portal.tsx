import { useState, useEffect } from "react"
import { useRouter } from "next/router"
import { useAuth } from "@/contexts/AuthContext"
import Layout from "@/components/Layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Monitor, Smartphone, Upload, Link as LinkIcon, Globe, Crown, ExternalLink } from "lucide-react"
import { Switch } from "@/components/ui/switch"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

// Plan types that have access to Portal customization
const PORTAL_ALLOWED_PLAN_TYPES = ['standard', 'professional', 'enterprise']

const FONT_OPTIONS = [
  { value: "Playfair Display", label: "Playfair Display", description: "Elegant serif font with a classic feel" },
  { value: "Inter", label: "Inter", description: "Modern sans-serif, clean and readable" },
  { value: "Georgia", label: "Georgia", description: "Traditional serif, professional look" },
  { value: "Poppins", label: "Poppins", description: "Geometric sans-serif, friendly and modern" },
  { value: "Merriweather", label: "Merriweather", description: "Readable serif designed for screens" },
  { value: "Roboto", label: "Roboto", description: "Versatile sans-serif, neutral and clean" },
  { value: "Lora", label: "Lora", description: "Balanced serif with calligraphic roots" },
  { value: "Open Sans", label: "Open Sans", description: "Humanist sans-serif, excellent legibility" },
]

interface PortalSettings {
  portalTitle: string
  portalDescription: string
  primaryColor: string
  fontFamily: string
  logo: string
  heroImageUrl: string
  heroTitle: string
  heroSubtitle: string
  isActive: boolean
}

export default function PortalPage() {
  const router = useRouter()
  const { authenticatedFetch, subscription, user } = useAuth()
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop")
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingHero, setIsUploadingHero] = useState(false)
  const [logoInputMode, setLogoInputMode] = useState<"file" | "url">("url")
  const [heroInputMode, setHeroInputMode] = useState<"file" | "url">("url")
  const [settings, setSettings] = useState<PortalSettings>({
    portalTitle: "Welcome to Our Portal",
    portalDescription: "Your trusted healthcare partner. Browse our products and services below.",
    primaryColor: "#000000",
    fontFamily: "Playfair Display",
    logo: "",
    heroImageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80",
    heroTitle: "Your Daily Health, Simplified",
    heroSubtitle: "All-in-one nutritional support in one simple drink",
    isActive: true,
  })
  const [isTogglingActive, setIsTogglingActive] = useState(false)
  const [clinicSlug, setClinicSlug] = useState<string | null>(null)
  const [customDomain, setCustomDomain] = useState<string | null>(null)
  const [isCustomDomain, setIsCustomDomain] = useState(false)

  // Check if user has access to Portal based on their subscription plan
  const hasPortalAccess = subscription?.plan?.type && PORTAL_ALLOWED_PLAN_TYPES.includes(subscription.plan.type)

  // Redirect if user doesn't have portal access
  useEffect(() => {
    // Wait for subscription to be loaded before checking access
    if (subscription !== null && !hasPortalAccess) {
      router.replace('/plans?message=Upgrade to Standard or higher to access Portal customization.')
    }
  }, [subscription, hasPortalAccess, router])

  useEffect(() => {
    if (hasPortalAccess) {
      loadSettings()
      // Fetch clinic slug and custom domain info
      const fetchClinicData = async () => {
        if (!user?.clinicId) return
        try {
          const response = await authenticatedFetch(`${API_URL}/clinic/${user.clinicId}`)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data) {
              if (data.data.slug) {
                setClinicSlug(data.data.slug)
              }
              if (data.data.isCustomDomain && data.data.customDomain) {
                setIsCustomDomain(true)
                setCustomDomain(data.data.customDomain)
              }
            }
          }
        } catch (error) {
          console.error("Error fetching clinic:", error)
        }
      }
      fetchClinicData()
    }
  }, [hasPortalAccess, user?.clinicId])

  const loadSettings = async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/custom-website`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setSettings({
            portalTitle: data.data.portalTitle || settings.portalTitle,
            portalDescription: data.data.portalDescription || settings.portalDescription,
            primaryColor: data.data.primaryColor || settings.primaryColor,
            fontFamily: data.data.fontFamily || settings.fontFamily,
            logo: data.data.logo || settings.logo,
            heroImageUrl: data.data.heroImageUrl || settings.heroImageUrl,
            heroTitle: data.data.heroTitle || settings.heroTitle,
            heroSubtitle: data.data.heroSubtitle || settings.heroSubtitle,
            isActive: data.data.isActive ?? true,
          })
        }
      }
    } catch (error) {
      console.error("Error loading portal settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await authenticatedFetch(`${API_URL}/custom-website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        alert("Portal settings saved successfully!")
      } else {
        alert("Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving portal settings:", error)
      alert("Error saving settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (checked: boolean) => {
    setIsTogglingActive(true)
    try {
      const response = await authenticatedFetch(`${API_URL}/custom-website/toggle-active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: checked }),
      })

      if (response.ok) {
        setSettings({ ...settings, isActive: checked })
      } else {
        alert("Failed to toggle portal status")
      }
    } catch (error) {
      console.error("Error toggling portal status:", error)
      alert("Error toggling portal status")
    } finally {
      setIsTogglingActive(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)

      const response = await authenticatedFetch(`${API_URL}/custom-website/upload-logo`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.logoUrl) {
          setSettings({ ...settings, logo: data.data.logoUrl })
        }
      } else {
        alert('Failed to upload logo')
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Error uploading logo')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingHero(true)
    try {
      const formData = new FormData()
      formData.append('heroImage', file)

      const response = await authenticatedFetch(`${API_URL}/custom-website/upload-hero`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.heroImageUrl) {
          setSettings({ ...settings, heroImageUrl: data.data.heroImageUrl })
        }
      } else {
        alert('Failed to upload hero image')
      }
    } catch (error) {
      console.error('Error uploading hero image:', error)
      alert('Error uploading hero image')
    } finally {
      setIsUploadingHero(false)
    }
  }

  // Show upgrade required message if user doesn't have access
  if (subscription !== null && !hasPortalAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96 gap-6">
          <div className="p-4 rounded-full bg-amber-100">
            <Crown className="h-12 w-12 text-amber-600" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Upgrade Required</h2>
            <p className="text-muted-foreground mb-4">
              Portal customization is available on Standard plan and above.
            </p>
            <Button onClick={() => router.push('/plans')}>
              View Plans
            </Button>
          </div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Portal Customization</h1>
          <p className="text-muted-foreground">Customize your patient-facing landing page</p>
        </div>

        {/* Custom Website Activation Toggle */}
        <Card className={`mb-6 ${settings.isActive ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${settings.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Globe className={`h-6 w-6 ${settings.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Custom Website</h3>
                  <p className="text-sm text-muted-foreground">
                    {settings.isActive
                      ? "Your custom landing page is live and visible to visitors"
                      : "Enable to show your custom landing page to visitors"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${settings.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                  {settings.isActive ? "Activated" : "Deactivated"}
                </span>
                <Switch
                  checked={settings.isActive}
                  onCheckedChange={handleToggleActive}
                  disabled={isTogglingActive}
                  className="data-[state=checked]:bg-green-600"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Panel */}
          <div className="space-y-4">
            {/* Portal Title */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Portal Title</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={settings.portalTitle}
                  onChange={(e) => setSettings({ ...settings, portalTitle: e.target.value })}
                  placeholder="Enter portal title"
                />
              </CardContent>
            </Card>

            {/* Portal Description */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Portal Description</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full p-3 border rounded-md text-sm min-h-[80px] resize-none"
                  value={settings.portalDescription}
                  onChange={(e) => setSettings({ ...settings, portalDescription: e.target.value })}
                  placeholder="Enter portal description"
                />
              </CardContent>
            </Card>

            {/* Primary Color */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Primary Color</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                  />
                  <div
                    className="w-10 h-10 rounded border"
                    style={{ backgroundColor: settings.primaryColor }}
                  />
                  <Input
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    placeholder="#000000"
                    className="w-28"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Font Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Choose a Font</CardTitle>
                <CardDescription>Previews update in real-time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  className="w-full p-3 border rounded-md text-sm"
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
                <div className="p-4 border rounded-md bg-muted/30">
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
                    We're looking for talented professionals to join our growing team. Apply today and start your
                    journey with us!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Logo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Logo</CardTitle>
                <CardDescription>Upload your brand logo (recommended: 200x60px)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {settings.logo && (
                  <div className="mb-3 p-4 bg-muted/30 rounded-lg flex items-center justify-center">
                    <img
                      src={settings.logo}
                      alt="Logo preview"
                      className="h-12 object-contain max-w-[200px]"
                    />
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <Button
                    variant={logoInputMode === "file" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLogoInputMode("file")}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload a file
                  </Button>
                  <Button
                    variant={logoInputMode === "url" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLogoInputMode("url")}
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Enter URL
                  </Button>
                </div>

                {logoInputMode === "file" ? (
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                    />
                    {isUploadingLogo && (
                      <p className="text-xs text-blue-600 mt-2">Uploading to S3...</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">Accepted formats: PNG, JPG, SVG. Max size: 2MB</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={settings.logo}
                      onChange={(e) => setSettings({ ...settings, logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSettings({ ...settings, logo: "" })}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hero Image */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Hero Banner Image</CardTitle>
                <CardDescription>Large viewport image displayed at the top of your landing page (recommended: 1920x1080px)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {settings.heroImageUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden border">
                    <img
                      src={settings.heroImageUrl}
                      alt="Hero preview"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <Button
                    variant={heroInputMode === "file" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHeroInputMode("file")}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload a file
                  </Button>
                  <Button
                    variant={heroInputMode === "url" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHeroInputMode("url")}
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Enter URL
                  </Button>
                </div>

                {heroInputMode === "file" ? (
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleHeroImageUpload}
                      disabled={isUploadingHero}
                    />
                    {isUploadingHero && (
                      <p className="text-xs text-blue-600 mt-2">Uploading to S3...</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">Accepted formats: PNG, JPG, WebP. Max size: 5MB. Recommended: 1920x1080px or larger</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={settings.heroImageUrl}
                      onChange={(e) => setSettings({ ...settings, heroImageUrl: e.target.value })}
                      placeholder="https://example.com/hero-image.jpg"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSettings({ ...settings, heroImageUrl: "" })}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hero Title */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Hero Title</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={settings.heroTitle}
                  onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                  placeholder="Enter hero title"
                />
              </CardContent>
            </Card>

            {/* Hero Subtitle */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Hero Subtitle</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={settings.heroSubtitle}
                  onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                  placeholder="Enter hero subtitle"
                />
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button onClick={handleSave} className="w-full" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          {/* Live Preview Panel */}
          <div className="space-y-4">
            <Card className="sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Live Preview</CardTitle>
                  <div className="flex gap-1 p-1 bg-muted rounded-lg">
                    <Button
                      variant={previewMode === "desktop" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setPreviewMode("desktop")}
                    >
                      <Monitor className="w-4 h-4 mr-1" />
                      Desktop
                    </Button>
                    <Button
                      variant={previewMode === "mobile" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setPreviewMode("mobile")}
                    >
                      <Smartphone className="w-4 h-4 mr-1" />
                      Mobile
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`bg-white border rounded-lg overflow-hidden shadow-sm ${previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""
                    }`}
                  style={{ fontFamily: settings.fontFamily }}
                >
                  {/* Preview Header */}
                  <div className="border-b bg-white p-3 flex items-center justify-between">
                    {settings.logo ? (
                      <img src={settings.logo} alt="Logo" className="h-6 object-contain" />
                    ) : (
                      <span className="font-bold text-sm" style={{ color: settings.primaryColor }}>
                        {settings.portalTitle?.split(" ")[0] || "BRAND"}
                      </span>
                    )}
                    <Button
                      size="sm"
                      style={{ backgroundColor: settings.primaryColor }}
                      className="text-white text-xs"
                    >
                      Apply Now
                    </Button>
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
                        <Button
                          size="sm"
                          style={{ backgroundColor: settings.primaryColor }}
                          className="text-white"
                        >
                          View All Products →
                        </Button>
                        <Button size="sm" variant="outline" className="bg-white/10 border-white text-white">
                          Learn More →
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Preview Content */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2">{settings.portalTitle}</h3>
                    <p className="text-sm text-gray-600 mb-4">{settings.portalDescription}</p>

                    {/* Sample Product Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="border rounded-lg p-2">
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
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Portal Preview URL */}
        {clinicSlug && (
          <>
            {/* Local Development Preview */}
            {typeof window !== 'undefined' && window.location.hostname.includes('localhost') && (
              <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Local Development Mode: Preview your portal on localhost</span>
              </div>
            )}

            <Card className="mt-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-full bg-primary/10">
                      <LinkIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium mb-1">
                        {typeof window !== 'undefined' && window.location.hostname.includes('localhost')
                          ? 'Your Brand Portal URL (Local)'
                          : 'Your Brand Portal URL'}
                      </h3>
                      <p className="text-sm font-mono text-muted-foreground truncate">
                        {typeof window !== 'undefined' && window.location.hostname.includes('localhost')
                          ? `http://${clinicSlug}.localhost:3000`
                          : isCustomDomain && customDomain
                            ? `https://${customDomain}`
                            : `https://${clinicSlug}.yourdomain.com`}
                      </p>
                      {typeof window !== 'undefined' && window.location.hostname.includes('localhost') && (
                        <p className="text-xs text-blue-600 mt-1">
                          This is your patient-facing portal URL for local testing
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const isLocal = typeof window !== 'undefined' && window.location.hostname.includes('localhost')
                      const url = isLocal
                        ? `http://${clinicSlug}.localhost:3000`
                        : isCustomDomain && customDomain
                          ? `https://${customDomain}`
                          : `https://${clinicSlug}.yourdomain.com`
                      window.open(url, '_blank')
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  )
}

