import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/router"
import { useAuth } from "@/contexts/AuthContext"
import Layout from "@/components/Layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Monitor, Smartphone, Upload, Link as LinkIcon, Globe, Crown, ExternalLink, Trash2, Plus, ChevronDown, GripVertical, Pencil, Check, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { ToastManager } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

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

interface FooterCategoryUrl {
  label: string
  url: string
}

interface FooterCategory {
  name: string
  visible: boolean
  urls?: FooterCategoryUrl[]
}

const DEFAULT_FOOTER_CATEGORIES: FooterCategory[] = [
  { name: "Section 1", visible: true, urls: [] },
  { name: "Section 2", visible: true, urls: [] },
  { name: "Section 3", visible: true, urls: [] },
  { name: "Section 4", visible: true, urls: [] },
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
  footerColor?: string
  footerCategories?: FooterCategory[]
  socialMediaSection?: string
  footerDisclaimer?: string
  socialMediaLinks?: {
    instagram?: { enabled: boolean; url: string }
    facebook?: { enabled: boolean; url: string }
    twitter?: { enabled: boolean; url: string }
    tiktok?: { enabled: boolean; url: string }
    youtube?: { enabled: boolean; url: string }
  }
}

export default function PortalPage() {
  const router = useRouter()
  const { authenticatedFetch, subscription, user } = useAuth()
  const { toasts, dismiss, success, error } = useToast()
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop")
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingHero, setIsUploadingHero] = useState(false)
  const [logoInputMode, setLogoInputMode] = useState<"file" | "url">(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("portal-logo-input-mode")
      if (saved === "file" || saved === "url") return saved
    }
    return "file"
  })
  const [heroInputMode, setHeroInputMode] = useState<"file" | "url">("url")
  const logoFileInputRef = useRef<HTMLInputElement | null>(null)
  const heroFileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("portal-logo-input-mode", logoInputMode)
    }
  }, [logoInputMode])
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
    footerColor: "#000000",
    footerCategories: DEFAULT_FOOTER_CATEGORIES,
    socialMediaSection: "SOCIAL MEDIA",
    footerDisclaimer: "* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure or prevent any disease. The information provided on this site is for informational purposes only and is not intended as a substitute for advice from your physician or other health care professional.",
    socialMediaLinks: {
      instagram: { enabled: true, url: "" },
      facebook: { enabled: true, url: "" },
      twitter: { enabled: true, url: "" },
      tiktok: { enabled: true, url: "" },
      youtube: { enabled: true, url: "" },
    },
  })
  const [isTogglingActive, setIsTogglingActive] = useState(false)
  const [clinicSlug, setClinicSlug] = useState<string | null>(null)
  const [customDomain, setCustomDomain] = useState<string | null>(null)
  const [isCustomDomain, setIsCustomDomain] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())
  const [addingUrlToCategory, setAddingUrlToCategory] = useState<number | null>(null)
  const [newUrlLabel, setNewUrlLabel] = useState("")
  const [newUrlValue, setNewUrlValue] = useState("")
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null)
  const [editingUrl, setEditingUrl] = useState<{ categoryIndex: number; urlIndex: number } | null>(null)
  const [editingUrlLabel, setEditingUrlLabel] = useState("")
  const [editingUrlValue, setEditingUrlValue] = useState("")

  // Check if user has access to Portal based on tier config, custom features, or plan type
  const hasPortalAccess =
    subscription?.tierConfig?.hasCustomPortal ||
    subscription?.customFeatures?.hasCustomPortal ||
    (subscription?.plan?.type && PORTAL_ALLOWED_PLAN_TYPES.includes(subscription.plan.type))

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

  // Helper function to convert old format (boolean fields) to new format (array)
  const convertToFooterCategories = (data: any): FooterCategory[] => {
    // If footerCategories exists, use it (limit to 4 categories max)
    if (data.footerCategories && Array.isArray(data.footerCategories)) {
      return data.footerCategories.slice(0, 4)
    }
    
    // Otherwise, convert from section1-4 string fields
    const categories: FooterCategory[] = []
    const sectionFields = ['section1', 'section2', 'section3', 'section4']
    const defaultNames = ['Shop', 'Daily Health', 'Rest & Restore', 'Store']
    
    sectionFields.forEach((field, index) => {
      const sectionName = data[field]
      if (sectionName !== null && sectionName !== undefined) {
        // Section has a name, so it's visible
        categories.push({ name: sectionName, visible: true, urls: [] })
      } else if (sectionName === undefined) {
        // Field doesn't exist yet, use default
        categories.push({ name: defaultNames[index], visible: true, urls: [] })
      }
      // If sectionName is null, the section is hidden (don't add it)
    })
    
    return categories.length > 0 ? categories : DEFAULT_FOOTER_CATEGORIES
  }

  const loadSettings = async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/custom-website`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const footerCategories = convertToFooterCategories(data.data)
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
            footerColor: data.data.footerColor || settings.footerColor || "#000000",
            footerCategories: footerCategories,
            socialMediaSection: data.data.socialMediaSection || settings.socialMediaSection || "SOCIAL MEDIA",
            footerDisclaimer: data.data.footerDisclaimer || settings.footerDisclaimer,
            socialMediaLinks: data.data.socialMediaLinks || settings.socialMediaLinks,
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
      // Convert footerCategories to section1-4 fields
      const payload = {
        ...settings,
        section1: settings.footerCategories?.[0]?.visible ? settings.footerCategories[0].name : null,
        section2: settings.footerCategories?.[1]?.visible ? settings.footerCategories[1].name : null,
        section3: settings.footerCategories?.[2]?.visible ? settings.footerCategories[2].name : null,
        section4: settings.footerCategories?.[3]?.visible ? settings.footerCategories[3].name : null,
      }

      const response = await authenticatedFetch(`${API_URL}/custom-website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        success("Portal settings saved successfully!", "Settings Saved")
      } else {
        const errorData = await response.json().catch(() => ({}))
        error(
          errorData.message || "Failed to save settings",
          "Save Failed"
        )
      }
    } catch (err) {
      console.error("Error saving portal settings:", err)
      error(
        err instanceof Error ? err.message : "Error saving settings",
        "Error"
      )
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
        success(
          `Portal ${checked ? "activated" : "deactivated"} successfully!`,
          "Status Updated"
        )
      } else {
        const errorData = await response.json().catch(() => ({}))
        error(
          errorData.message || "Failed to toggle portal status",
          "Update Failed"
        )
      }
    } catch (err) {
      console.error("Error toggling portal status:", err)
      error(
        err instanceof Error ? err.message : "Error toggling portal status",
        "Error"
      )
    } finally {
      setIsTogglingActive(false)
    }
  }

  const handleDeleteFooterCategory = (index: number) => {
    const newCategories = settings.footerCategories?.filter((_, i) => i !== index) || []
    setSettings({ ...settings, footerCategories: newCategories })
  }

  const handleToggleFooterCategory = (index: number, checked: boolean) => {
    const newCategories = [...(settings.footerCategories || [])]
    newCategories[index] = { ...newCategories[index], visible: checked }
    setSettings({ ...settings, footerCategories: newCategories })
  }

  const handleUpdateCategoryName = (index: number, newName: string) => {
    const newCategories = [...(settings.footerCategories || [])]
    newCategories[index] = { ...newCategories[index], name: newName }
    setSettings({ ...settings, footerCategories: newCategories })
  }

  const handleAddFooterCategory = () => {
    if (!newCategoryName.trim()) return
    
    const newCategory: FooterCategory = {
      name: newCategoryName.trim(),
      visible: true,
      urls: []
    }
    
    const newCategories = [...(settings.footerCategories || []), newCategory]
    setSettings({ ...settings, footerCategories: newCategories })
    setNewCategoryName("")
    setIsAddingCategory(false)
  }

  const toggleCategoryExpanded = (index: number) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedCategories(newExpanded)
  }

  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  const handleAddUrlToCategory = (categoryIndex: number) => {
    if (!newUrlLabel.trim() || !newUrlValue.trim()) return
    
    // Allow internal links (starting with # or /) without full URL validation
    const isInternalLink = newUrlValue.trim().startsWith('#') || newUrlValue.trim().startsWith('/')
    if (!isInternalLink && !isValidUrl(newUrlValue.trim())) {
      error("Please enter a valid URL (must start with http://, https://, # or /)", "Invalid URL")
      return
    }

    const newCategories = [...(settings.footerCategories || [])]
    if (newCategories[categoryIndex]) {
      const newUrl: FooterCategoryUrl = {
        label: newUrlLabel.trim(),
        url: newUrlValue.trim()
      }
      newCategories[categoryIndex].urls = [...(newCategories[categoryIndex].urls || []), newUrl]
      setSettings({ ...settings, footerCategories: newCategories })
      setNewUrlLabel("")
      setNewUrlValue("")
      setAddingUrlToCategory(null)
    }
  }

  const handleStartEditUrl = (categoryIndex: number, urlIndex: number) => {
    const category = settings.footerCategories?.[categoryIndex]
    const urlItem = category?.urls?.[urlIndex]
    if (urlItem) {
      setEditingUrl({ categoryIndex, urlIndex })
      setEditingUrlLabel(urlItem.label)
      setEditingUrlValue(urlItem.url)
    }
  }

  const handleSaveEditUrl = () => {
    if (!editingUrl || !editingUrlLabel.trim() || !editingUrlValue.trim()) return
    
    // Allow internal links (starting with # or /) without full URL validation
    const isInternalLink = editingUrlValue.trim().startsWith('#') || editingUrlValue.trim().startsWith('/')
    if (!isInternalLink && !isValidUrl(editingUrlValue.trim())) {
      error("Please enter a valid URL (must start with http://, https://, # or /)", "Invalid URL")
      return
    }

    const newCategories = [...(settings.footerCategories || [])]
    if (newCategories[editingUrl.categoryIndex]?.urls?.[editingUrl.urlIndex]) {
      newCategories[editingUrl.categoryIndex].urls![editingUrl.urlIndex] = {
        label: editingUrlLabel.trim(),
        url: editingUrlValue.trim()
      }
      setSettings({ ...settings, footerCategories: newCategories })
    }
    setEditingUrl(null)
    setEditingUrlLabel("")
    setEditingUrlValue("")
  }

  const handleCancelEditUrl = () => {
    setEditingUrl(null)
    setEditingUrlLabel("")
    setEditingUrlValue("")
  }

  const handleDragStart = (index: number) => {
    setDraggedCategoryIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedCategoryIndex === null || draggedCategoryIndex === index) return

    const newCategories = [...(settings.footerCategories || [])]
    const draggedCategory = newCategories[draggedCategoryIndex]
    newCategories.splice(draggedCategoryIndex, 1)
    newCategories.splice(index, 0, draggedCategory)
    setSettings({ ...settings, footerCategories: newCategories })
    setDraggedCategoryIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedCategoryIndex(null)
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
                <CardTitle className="text-base font-semibold tracking-tight">Portal Title</CardTitle>
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
                <CardTitle className="text-base font-semibold tracking-tight">Portal Description</CardTitle>
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
                <CardTitle className="text-base font-semibold tracking-tight">Primary Color</CardTitle>
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
                <CardTitle className="text-base font-semibold tracking-tight">Choose a Font</CardTitle>
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
                <CardTitle className="text-base font-semibold tracking-tight">Logo</CardTitle>
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

                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploadingLogo}
                  className="hidden"
                />

                <div className="flex gap-2 mb-3">
                  <Button
                    variant={logoInputMode === "file" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setLogoInputMode("file")
                      // Open file selector immediately when clicking "Upload a file"
                      setTimeout(() => {
                        logoFileInputRef.current?.click()
                      }, 0)
                    }}
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

                {/* Hidden file input that opens when clicking "Upload a file" */}
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploadingLogo}
                  className="hidden"
                />

                {logoInputMode === "file" ? (
                  <div>
                    {isUploadingLogo && (
                      <p className="text-xs text-blue-600 mb-2">Uploading to S3...</p>
                    )}
                    <p className="text-xs text-muted-foreground">Accepted formats: PNG, JPG, SVG. Max size: 2MB</p>
                    <p className="text-xs text-muted-foreground mt-1">Click "Upload a file" above to select an image</p>
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
                <CardTitle className="text-base font-semibold tracking-tight">Hero Banner Image</CardTitle>
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

                <input
                  ref={heroFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleHeroImageUpload}
                  disabled={isUploadingHero}
                  className="hidden"
                />

                <div className="flex gap-2 mb-3">
                  <Button
                    variant={heroInputMode === "file" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setHeroInputMode("file")
                      // Open file selector immediately when clicking "Upload a file"
                      setTimeout(() => {
                        heroFileInputRef.current?.click()
                      }, 0)
                    }}
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

                {/* Hidden file input that opens when clicking "Upload a file" */}
                <input
                  ref={heroFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleHeroImageUpload}
                  disabled={isUploadingHero}
                  className="hidden"
                />

                {heroInputMode === "file" ? (
                  <div>
                    {isUploadingHero && (
                      <p className="text-xs text-blue-600 mb-2">Uploading to S3...</p>
                    )}
                    <p className="text-xs text-muted-foreground">Accepted formats: PNG, JPG, WebP. Max size: 5MB. Recommended: 1920x1080px or larger</p>
                    <p className="text-xs text-muted-foreground mt-1">Click "Upload a file" above to select an image</p>
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
                <CardTitle className="text-base font-semibold tracking-tight">Hero Title</CardTitle>
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
                <CardTitle className="text-base font-semibold tracking-tight">Hero Subtitle</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={settings.heroSubtitle}
                  onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                  placeholder="Enter hero subtitle"
                />
              </CardContent>
            </Card>

            {/* Footer Customization */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Footer</CardTitle>
                <CardDescription>Customize footer colors and visibility of footer sections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Footer Color */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Footer Background Color</label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={settings.footerColor || "#000000"}
                      onChange={(e) => setSettings({ ...settings, footerColor: e.target.value })}
                      className="w-20 h-10 cursor-pointer"
                    />
                    <Input
                      value={settings.footerColor || "#000000"}
                      onChange={(e) => setSettings({ ...settings, footerColor: e.target.value })}
                      placeholder="#000000"
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Footer Sections Visibility */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Footer Sections</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingCategory(true)}
                      className="h-8"
                      disabled={(settings.footerCategories || []).length >= 4}
                      title={(settings.footerCategories || []).length >= 4 ? "Maximum 4 sections allowed" : "Add Category"}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Category
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(settings.footerCategories || []).map((category, index) => {
                      const isExpanded = expandedCategories.has(index)
                      return (
                        <div 
                          key={index} 
                          className={`border rounded-md ${draggedCategoryIndex === index ? 'opacity-50' : ''}`}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                        >
                          <div 
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleCategoryExpanded(index)}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div
                                className="cursor-grab active:cursor-grabbing"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <ChevronDown 
                                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                              />
                              <input
                                type="text"
                                value={category.name}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleUpdateCategoryName(index, e.target.value)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1 flex-1"
                                placeholder="Section name"
                              />
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                                onClick={() => handleDeleteFooterCategory(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Switch
                                checked={category.visible}
                                onCheckedChange={(checked) => handleToggleFooterCategory(index, checked)}
                              />
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3 border-t bg-muted/30">
                              <div className="space-y-2 pt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-xs font-medium text-muted-foreground">
                                    URLs ({category.urls?.length || 0})
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setAddingUrlToCategory(index)
                                    }}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add URL
                                  </Button>
                                </div>
                                {addingUrlToCategory === index ? (
                                  <div className="space-y-2 p-2 bg-background rounded border">
                                    <Input
                                      value={newUrlLabel}
                                      onChange={(e) => setNewUrlLabel(e.target.value)}
                                      placeholder="Label (e.g., All Products)"
                                      className="text-xs"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault()
                                          document.getElementById(`url-input-${index}`)?.focus()
                                        } else if (e.key === "Escape") {
                                          setAddingUrlToCategory(null)
                                          setNewUrlLabel("")
                                          setNewUrlValue("")
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <Input
                                      id={`url-input-${index}`}
                                      value={newUrlValue}
                                      onChange={(e) => setNewUrlValue(e.target.value)}
                                      placeholder="https://example.com"
                                      className="text-xs"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault()
                                          handleAddUrlToCategory(index)
                                        } else if (e.key === "Escape") {
                                          setAddingUrlToCategory(null)
                                          setNewUrlLabel("")
                                          setNewUrlValue("")
                                        }
                                      }}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="h-7 text-xs flex-1"
                                        onClick={() => handleAddUrlToCategory(index)}
                                        disabled={!newUrlLabel.trim() || !newUrlValue.trim()}
                                      >
                                        Add
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => {
                                          setAddingUrlToCategory(null)
                                          setNewUrlLabel("")
                                          setNewUrlValue("")
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : null}
                                {(category.urls || []).length > 0 ? (
                                  <div className="space-y-2">
                                    {(category.urls || []).map((urlItem, urlIndex) => (
                                      <div key={urlIndex} className="p-2 bg-background rounded border">
                                        {editingUrl?.categoryIndex === index && editingUrl?.urlIndex === urlIndex ? (
                                          // Editing mode
                                          <div className="space-y-2">
                                            <Input
                                              value={editingUrlLabel}
                                              onChange={(e) => setEditingUrlLabel(e.target.value)}
                                              placeholder="Label"
                                              className="text-xs h-8"
                                              autoFocus
                                            />
                                            <Input
                                              value={editingUrlValue}
                                              onChange={(e) => setEditingUrlValue(e.target.value)}
                                              placeholder="URL (e.g., #bundles or https://...)"
                                              className="text-xs h-8"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  e.preventDefault()
                                                  handleSaveEditUrl()
                                                } else if (e.key === "Escape") {
                                                  handleCancelEditUrl()
                                                }
                                              }}
                                            />
                                            <div className="flex gap-1">
                                              <Button
                                                variant="default"
                                                size="sm"
                                                className="h-7 text-xs flex-1"
                                                onClick={handleSaveEditUrl}
                                                disabled={!editingUrlLabel.trim() || !editingUrlValue.trim()}
                                              >
                                                <Check className="h-3 w-3 mr-1" />
                                                Save
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs flex-1"
                                                onClick={handleCancelEditUrl}
                                              >
                                                <X className="h-3 w-3 mr-1" />
                                                Cancel
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          // View mode
                                          <div className="flex items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                              <div className="text-xs font-medium truncate">{urlItem.label}</div>
                                              <div className="text-xs text-muted-foreground truncate">{urlItem.url}</div>
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 hover:bg-blue-50 hover:text-blue-600"
                                              onClick={() => handleStartEditUrl(index, urlIndex)}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 hover:bg-red-50 hover:text-red-600"
                                              onClick={() => {
                                                const newCategories = [...(settings.footerCategories || [])]
                                                if (newCategories[index]) {
                                                  newCategories[index].urls = (newCategories[index].urls || []).filter((_, i) => i !== urlIndex)
                                                  setSettings({ ...settings, footerCategories: newCategories })
                                                }
                                              }}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  !addingUrlToCategory && (
                                    <div className="text-xs text-muted-foreground py-2">
                                      No URLs configured
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {isAddingCategory && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Enter category name"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddFooterCategory()
                            } else if (e.key === "Escape") {
                              setIsAddingCategory(false)
                              setNewCategoryName("")
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleAddFooterCategory}
                          disabled={!newCategoryName.trim()}
                        >
                          Add
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsAddingCategory(false)
                            setNewCategoryName("")
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Disclaimer Text */}
                <div className="space-y-2 pt-4 border-t">
                  <label className="text-sm font-medium">Footer Disclaimer Text</label>
                  <CardDescription className="text-xs">This text appears in the middle section of the footer</CardDescription>
                  <textarea
                    value={settings.footerDisclaimer || ""}
                    onChange={(e) => setSettings({ ...settings, footerDisclaimer: e.target.value })}
                    placeholder="Enter disclaimer text..."
                    className="w-full min-h-[100px] p-2 text-sm border rounded-md resize-y"
                    rows={4}
                  />
                </div>

                {/* Social Media Links */}
                <div className="space-y-3 pt-4 border-t">
                  <div>
                    <label className="text-sm font-medium">Social Media Links</label>
                    <CardDescription className="text-xs">Configure which social media icons appear and their links</CardDescription>
                  </div>
                  
                  {/* Social Media Section Title */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Section Title</label>
                    <Input
                      value={settings.socialMediaSection || "SOCIAL MEDIA"}
                      onChange={(e) => setSettings({ ...settings, socialMediaSection: e.target.value })}
                      placeholder="SOCIAL MEDIA"
                    />
                  </div>

                  {/* Instagram */}
                  <div className="flex items-center gap-3 p-2 border rounded-md">
                    <div className="flex items-center gap-2 w-24">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <span className="text-sm">Instagram</span>
                    </div>
                    <Input
                      value={settings.socialMediaLinks?.instagram?.url || ""}
                      onChange={(e) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          instagram: { ...settings.socialMediaLinks?.instagram, enabled: settings.socialMediaLinks?.instagram?.enabled ?? true, url: e.target.value }
                        }
                      })}
                      placeholder="https://instagram.com/..."
                      className="flex-1"
                    />
                    <Switch
                      checked={settings.socialMediaLinks?.instagram?.enabled ?? true}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          instagram: { ...settings.socialMediaLinks?.instagram, url: settings.socialMediaLinks?.instagram?.url || "", enabled: checked }
                        }
                      })}
                    />
                  </div>

                  {/* Facebook */}
                  <div className="flex items-center gap-3 p-2 border rounded-md">
                    <div className="flex items-center gap-2 w-24">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span className="text-sm">Facebook</span>
                    </div>
                    <Input
                      value={settings.socialMediaLinks?.facebook?.url || ""}
                      onChange={(e) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          facebook: { ...settings.socialMediaLinks?.facebook, enabled: settings.socialMediaLinks?.facebook?.enabled ?? true, url: e.target.value }
                        }
                      })}
                      placeholder="https://facebook.com/..."
                      className="flex-1"
                    />
                    <Switch
                      checked={settings.socialMediaLinks?.facebook?.enabled ?? true}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          facebook: { ...settings.socialMediaLinks?.facebook, url: settings.socialMediaLinks?.facebook?.url || "", enabled: checked }
                        }
                      })}
                    />
                  </div>

                  {/* Twitter/X */}
                  <div className="flex items-center gap-3 p-2 border rounded-md">
                    <div className="flex items-center gap-2 w-24">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span className="text-sm">X (Twitter)</span>
                    </div>
                    <Input
                      value={settings.socialMediaLinks?.twitter?.url || ""}
                      onChange={(e) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          twitter: { ...settings.socialMediaLinks?.twitter, enabled: settings.socialMediaLinks?.twitter?.enabled ?? true, url: e.target.value }
                        }
                      })}
                      placeholder="https://x.com/..."
                      className="flex-1"
                    />
                    <Switch
                      checked={settings.socialMediaLinks?.twitter?.enabled ?? true}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          twitter: { ...settings.socialMediaLinks?.twitter, url: settings.socialMediaLinks?.twitter?.url || "", enabled: checked }
                        }
                      })}
                    />
                  </div>

                  {/* TikTok */}
                  <div className="flex items-center gap-3 p-2 border rounded-md">
                    <div className="flex items-center gap-2 w-24">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                      </svg>
                      <span className="text-sm">TikTok</span>
                    </div>
                    <Input
                      value={settings.socialMediaLinks?.tiktok?.url || ""}
                      onChange={(e) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          tiktok: { ...settings.socialMediaLinks?.tiktok, enabled: settings.socialMediaLinks?.tiktok?.enabled ?? true, url: e.target.value }
                        }
                      })}
                      placeholder="https://tiktok.com/@..."
                      className="flex-1"
                    />
                    <Switch
                      checked={settings.socialMediaLinks?.tiktok?.enabled ?? true}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          tiktok: { ...settings.socialMediaLinks?.tiktok, url: settings.socialMediaLinks?.tiktok?.url || "", enabled: checked }
                        }
                      })}
                    />
                  </div>

                  {/* YouTube */}
                  <div className="flex items-center gap-3 p-2 border rounded-md">
                    <div className="flex items-center gap-2 w-24">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      <span className="text-sm">YouTube</span>
                    </div>
                    <Input
                      value={settings.socialMediaLinks?.youtube?.url || ""}
                      onChange={(e) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          youtube: { ...settings.socialMediaLinks?.youtube, enabled: settings.socialMediaLinks?.youtube?.enabled ?? true, url: e.target.value }
                        }
                      })}
                      placeholder="https://youtube.com/..."
                      className="flex-1"
                    />
                    <Switch
                      checked={settings.socialMediaLinks?.youtube?.enabled ?? true}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        socialMediaLinks: {
                          ...settings.socialMediaLinks,
                          youtube: { ...settings.socialMediaLinks?.youtube, url: settings.socialMediaLinks?.youtube?.url || "", enabled: checked }
                        }
                      })}
                    />
                  </div>
                </div>
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
                  <div>
                    <CardTitle className="text-base font-semibold tracking-tight">Your Brand Portal URL</CardTitle>
                    <CardDescription>Share this link with your patients to direct them to your portal</CardDescription>
                  </div>
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

                  {/* Preview Footer */}
                  <div
                    className="text-white p-4 text-xs"
                    style={{ backgroundColor: settings.footerColor || "#000000" }}
                  >
                    {/* 3-column grid layout matching actual footer */}
                    <div className="grid grid-cols-4 gap-3">
                      {/* Left Column - Clinic Name + Sections 1 & 2 */}
                      <div className="col-span-1">
                        <div className="font-bold text-sm mb-3 opacity-90">CLINIC NAME</div>
                        {(settings.footerCategories || [])
                          .filter((category) => category.visible)
                          .slice(0, 2)
                          .map((category, index) => (
                            <div key={index} className="mb-2">
                              <div className="font-semibold mb-1 opacity-90 text-[10px]">{category.name.toUpperCase()}</div>
                              {category.urls && category.urls.length > 0 && (
                                <div className="space-y-0.5">
                                  {category.urls.slice(0, 3).map((url, urlIndex) => (
                                    <div key={urlIndex} className="opacity-70 text-[8px]">{url.label}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>

                      {/* Middle Column - Disclaimer */}
                      <div className="col-span-2 px-2">
                        <div className="opacity-60 text-[7px] leading-relaxed line-clamp-6">
                          {settings.footerDisclaimer || "* These statements have not been evaluated by the Food and Drug Administration..."}
                        </div>
                      </div>

                      {/* Right Column - Language + Sections 3 & 4 + Social + Copyright */}
                      <div className="col-span-1 flex flex-col">
                        <div className="text-[8px] opacity-80 mb-2">🇺🇸 English | $ USD</div>
                        {(settings.footerCategories || [])
                          .filter((category) => category.visible)
                          .slice(2, 4)
                          .map((category, index) => (
                            <div key={index} className="mb-2">
                              <div className="font-semibold mb-1 opacity-90 text-[10px]">{category.name.toUpperCase()}</div>
                              {category.urls && category.urls.length > 0 && (
                                <div className="space-y-0.5">
                                  {category.urls.slice(0, 3).map((url, urlIndex) => (
                                    <div key={urlIndex} className="opacity-70 text-[8px]">{url.label}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        <div className="mb-2">
                          <div className="font-semibold mb-1 opacity-90 text-[10px]">{(settings.socialMediaSection || "SOCIAL MEDIA").toUpperCase()}</div>
                          <div className="flex gap-1 opacity-70">
                            {(settings.socialMediaLinks?.instagram?.enabled ?? true) && (
                              <div className="w-3 h-3 bg-white/30 rounded-full" title="Instagram"></div>
                            )}
                            {(settings.socialMediaLinks?.facebook?.enabled ?? true) && (
                              <div className="w-3 h-3 bg-white/30 rounded-full" title="Facebook"></div>
                            )}
                            {(settings.socialMediaLinks?.twitter?.enabled ?? true) && (
                              <div className="w-3 h-3 bg-white/30 rounded-full" title="X/Twitter"></div>
                            )}
                            {(settings.socialMediaLinks?.tiktok?.enabled ?? true) && (
                              <div className="w-3 h-3 bg-white/30 rounded-full" title="TikTok"></div>
                            )}
                            {(settings.socialMediaLinks?.youtube?.enabled ?? true) && (
                              <div className="w-3 h-3 bg-white/30 rounded-full" title="YouTube"></div>
                            )}
                          </div>
                        </div>
                        <div className="mt-auto opacity-60 text-[7px]">© 2026 CLINIC NAME</div>
                      </div>
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
                        {(() => {
                          if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
                            return `http://${clinicSlug}.localhost:3000`
                          }
                          if (isCustomDomain && customDomain) {
                            return `https://${customDomain}`
                          }
                          // Construct URL with clinic slug using production domain
                          return `https://${clinicSlug}.fusehealth.com`
                        })()}
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
                      let url: string
                      if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
                        url = `http://${clinicSlug}.localhost:3000`
                      } else if (isCustomDomain && customDomain) {
                        url = `https://${customDomain}`
                      } else {
                        // Construct URL with clinic slug using production domain
                        url = `https://${clinicSlug}.fusehealth.com`
                      }
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
      <ToastManager toasts={toasts} onDismiss={dismiss} />
    </Layout>
  )
}

