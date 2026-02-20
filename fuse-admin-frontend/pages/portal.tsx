import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import ReactCrop, { type Crop as RCCrop, type PixelCrop, makeAspectCrop, centerCrop } from "react-image-crop"
import { useRouter } from "next/router"
import { useAuth } from "@/contexts/AuthContext"
import Layout from "@/components/Layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Monitor, Smartphone, Upload, Link as LinkIcon, Globe, Crown, ExternalLink, Trash2, Plus, ChevronDown, GripVertical, Pencil, Check, X, RotateCcw, Copy, AlertCircle, CheckCircle2, Loader2, Type, ImageIcon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { ToastManager } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

// Aspect ratio presets for logo crop
const LOGO_ASPECT_PRESETS = [
  { label: "Square", ratio: 1,    outputW: 400, outputH: 400,  description: "App icon / avatar" },
  { label: "Standard", ratio: 3,  outputW: 600, outputH: 200,  description: "Horizontal wordmark" },
  { label: "Wide", ratio: 5,      outputW: 800, outputH: 160,  description: "Wide banner logo" },
  { label: "Landscape", ratio: 16/9, outputW: 640, outputH: 360, description: "16:9 image" },
] as const

type LogoAspectPreset = typeof LOGO_ASPECT_PRESETS[number]

/**
 * Crops a logo by loading a fresh Image (avoiding browser CORS-cache poisoning
 * that taints the canvas when the same URL was previously loaded without crossOrigin).
 *
 * - data: URLs (new file uploads) are read as-is — no CORS needed.
 * - Remote URLs (existing S3 logos) get a cache-busting param + crossOrigin="anonymous".
 *
 * displayW/H = rendered dimensions of the img element in the crop dialog,
 * used to convert react-image-crop's display-pixel coordinates to natural image pixels.
 */
async function cropLogoToBlob(
  src: string,
  displayCrop: PixelCrop,
  outputW: number,
  outputH: number,
  displayW: number,
  displayH: number,
): Promise<Blob> {
  const isDataUrl = src.startsWith("data:")
  const loadSrc = isDataUrl
    ? src
    : `${src}${src.includes("?") ? "&" : "?"}_t=${Date.now()}`

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    if (!isDataUrl) image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = loadSrc
  })

  const scaleX = img.naturalWidth / displayW
  const scaleY = img.naturalHeight / displayH
  const canvas = document.createElement("canvas")
  canvas.width = outputW
  canvas.height = outputH
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(
    img,
    displayCrop.x * scaleX,
    displayCrop.y * scaleY,
    displayCrop.width * scaleX,
    displayCrop.height * scaleY,
    0, 0, outputW, outputH,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => { if (!blob) { reject(new Error("Canvas produced empty blob")); return }; resolve(blob) },
      "image/png", 1.0,
    )
  })
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

// Build a properly-centered crop rectangle for a given aspect ratio and image dimensions.
// react-image-crop requires explicit coordinates — changing the `aspect` prop alone is not enough.
function makeCenteredAspectCrop(ratio: number, imgW: number, imgH: number): RCCrop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, ratio, imgW, imgH),
    imgW,
    imgH,
  )
}

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

// Google Fonts families that need to be loaded (Georgia is a system font, skip it)
const GOOGLE_FONT_FAMILIES: Record<string, string> = {
  "Playfair Display": "Playfair+Display:wght@400;600;700",
  "Inter": "Inter:wght@400;500;600;700",
  "Poppins": "Poppins:wght@400;500;600;700",
  "Merriweather": "Merriweather:wght@400;700",
  "Roboto": "Roboto:wght@400;500;700",
  "Lora": "Lora:wght@400;600;700",
  "Open Sans": "Open+Sans:wght@400;500;600;700",
}

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
  backgroundColor: string
  navFooterColor: string
  defaultFormColor?: string
  fontFamily: string
  navDisplayMode: "brandName" | "logo"
  navBrandName: string
  logo: string
  heroImageUrl: string
  heroTitle: string
  heroSubtitle: string
  isActive: boolean
  footerColor?: string
  footerCategories?: FooterCategory[]
  socialMediaSection?: string
  useDefaultDisclaimer?: boolean
  footerDisclaimer?: string
  socialMediaLinks?: {
    instagram?: { enabled: boolean; url: string }
    facebook?: { enabled: boolean; url: string }
    twitter?: { enabled: boolean; url: string }
    tiktok?: { enabled: boolean; url: string }
    youtube?: { enabled: boolean; url: string }
  }
}

/** Returns black or white depending on which contrasts better against the given hex background. */
function getContrastColor(hex: string): string {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return "#ffffff"
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? "#000000" : "#ffffff"
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
  const [isResettingFooter, setIsResettingFooter] = useState(false)
  const [isResettingSocialMedia, setIsResettingSocialMedia] = useState(false)
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

  // Logo crop dialog state (unified — react-image-crop for all modes)
  const [logoCropOpen, setLogoCropOpen] = useState(false)
  const [logoCropSrc, setLogoCropSrc] = useState("")
  // Original file data URL kept in memory so "Edit Image" always re-opens the full source, not the cropped S3 version
  const [logoOriginalSrc, setLogoOriginalSrc] = useState<string | null>(null)
  const [logoCropApplying, setLogoCropApplying] = useState(false)
  const [logoCropPreset, setLogoCropPreset] = useState<LogoAspectPreset>(LOGO_ASPECT_PRESETS[1])
  const [logoCropIsCustom, setLogoCropIsCustom] = useState(true)
  const [logoCrop, setLogoCrop] = useState<RCCrop>({ unit: "%", x: 5, y: 5, width: 90, height: 90 })
  const [logoCropPixels, setLogoCropPixels] = useState<PixelCrop | null>(null)
  const logoCropImgRef = useRef<HTMLImageElement | null>(null)
  
  // Primary color gradient state
  const DEFAULT_GRADIENT_STOPS = [
    { color: "#FF751F", position: 0 },
    { color: "#B11FFF", position: 100 },
  ]

  const [primaryColorMode, setPrimaryColorMode] = useState<"solid" | "gradient">("solid")
  const [primaryGradientStops, setPrimaryGradientStops] = useState<Array<{ color: string; position: number }>>(
    DEFAULT_GRADIENT_STOPS.map((s) => ({ ...s }))
  )
  
  // Form color gradient state
  const [formColorMode, setFormColorMode] = useState<"solid" | "gradient">("solid")
  const [formGradientStops, setFormGradientStops] = useState<Array<{ color: string; position: number }>>(
    DEFAULT_GRADIENT_STOPS.map((s) => ({ ...s }))
  )

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("portal-logo-input-mode", logoInputMode)
    }
  }, [logoInputMode])
  const [settings, setSettings] = useState<PortalSettings>({
    portalTitle: "Welcome to Our Portal",
    portalDescription: "Your trusted healthcare partner. Browse our products and services below.",
    primaryColor: "#000000",
    backgroundColor: "#FFFFFF",
    navFooterColor: "#000000",
    defaultFormColor: "",
    fontFamily: "Playfair Display",
    navDisplayMode: "brandName",
    navBrandName: "",
    logo: "",
    heroImageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80",
    heroTitle: "Your Daily Health, Simplified",
    heroSubtitle: "All-in-one nutritional support in one simple drink",
    isActive: true,
    footerColor: "#000000",
    footerCategories: DEFAULT_FOOTER_CATEGORIES,
    socialMediaSection: "SOCIAL MEDIA",
    useDefaultDisclaimer: true,
    footerDisclaimer: "",
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
  const [clinicName, setClinicName] = useState<string | null>(null)
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
  const [defaultDisclaimer, setDefaultDisclaimer] = useState<string>("")

  // Vanity domain state
  const [vanityDomainInput, setVanityDomainInput] = useState("")
  const [isActivatingDomain, setIsActivatingDomain] = useState(false)
  const [domainError, setDomainError] = useState<string | null>(null)
  const [isRemovingDomain, setIsRemovingDomain] = useState(false)
  const [copiedCname, setCopiedCname] = useState(false)

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
  
  // Detect if primaryColor is a gradient and set mode accordingly
  useEffect(() => {
    if (settings.primaryColor?.includes("linear-gradient")) {
      setPrimaryColorMode("gradient")
      // Parse gradient stops from CSS if possible
      try {
        const match = settings.primaryColor.match(/linear-gradient\(90deg,\s*(.+)\)/)
        if (match && match[1]) {
          const stops = match[1].split(",").map((stop) => {
            const parts = stop.trim().split(" ")
            const color = parts[0]
            const position = parseFloat(parts[1]) || 0
            return { color, position }
          })
          if (stops.length >= 2) {
            setPrimaryGradientStops(stops)
          }
        }
      } catch (e) {
        console.error("Error parsing primary gradient:", e)
      }
    } else if (settings.primaryColor) {
      setPrimaryColorMode("solid")
    }
  }, [settings.primaryColor])
  
  // Detect if defaultFormColor is a gradient and set mode accordingly
  useEffect(() => {
    if (settings.defaultFormColor?.includes("linear-gradient")) {
      setFormColorMode("gradient")
      // Parse gradient stops from CSS if possible
      try {
        const match = settings.defaultFormColor.match(/linear-gradient\(90deg,\s*(.+)\)/)
        if (match && match[1]) {
          const stops = match[1].split(",").map((stop) => {
            const parts = stop.trim().split(" ")
            const color = parts[0]
            const position = parseFloat(parts[1]) || 0
            return { color, position }
          })
          if (stops.length >= 2) {
            setFormGradientStops(stops)
          }
        }
      } catch (e) {
        console.error("Error parsing gradient:", e)
      }
    } else if (settings.defaultFormColor) {
      setFormColorMode("solid")
    }
  }, [settings.defaultFormColor])

  // Load Google Font into the admin page whenever the selected font changes
  useEffect(() => {
    const family = GOOGLE_FONT_FAMILIES[settings.fontFamily]
    if (!family) return // system font (e.g. Georgia), no need to fetch
    const id = "portal-preview-google-font"
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement("link")
      link.id = id
      link.rel = "stylesheet"
      document.head.appendChild(link)
    }
    link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
  }, [settings.fontFamily])

  useEffect(() => {
    if (hasPortalAccess) {
      loadSettings()
      loadDefaultDisclaimer()
      // Fetch clinic slug, custom domain, and default form color
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
              // Load defaultFormColor from clinic settings
              if (data.data.defaultFormColor) {
                setSettings(prev => ({ ...prev, defaultFormColor: data.data.defaultFormColor }))
              }
              // Capture clinic name for the nav preview
              if (data.data.name) setClinicName(data.data.name)
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
            backgroundColor: data.data.backgroundColor || settings.backgroundColor || "#FFFFFF",
            navFooterColor: data.data.navFooterColor || data.data.footerColor || settings.navFooterColor || "#000000",
            defaultFormColor: data.data.defaultFormColor || settings.defaultFormColor || "",
            fontFamily: data.data.fontFamily || settings.fontFamily,
            navDisplayMode: (data.data.navDisplayMode as "brandName" | "logo") || "brandName",
            navBrandName: data.data.navBrandName || "",
            logo: data.data.logo || settings.logo,
            heroImageUrl: data.data.heroImageUrl || settings.heroImageUrl,
            heroTitle: data.data.heroTitle || settings.heroTitle,
            heroSubtitle: data.data.heroSubtitle || settings.heroSubtitle,
            isActive: data.data.isActive ?? true,
            footerColor: data.data.footerColor || settings.footerColor || "#000000",
            footerCategories: footerCategories,
            socialMediaSection: data.data.socialMediaSection || settings.socialMediaSection || "SOCIAL MEDIA",
            useDefaultDisclaimer: data.data.useDefaultDisclaimer ?? true,
            footerDisclaimer: data.data.footerDisclaimer || "",
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

  const loadDefaultDisclaimer = async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/website-builder-configs`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.defaultFooterDisclaimer) {
          setDefaultDisclaimer(data.data.defaultFooterDisclaimer)
        }
      }
    } catch (error) {
      console.error("Error loading default disclaimer:", error)
    }
  }

  const handleSave = async () => {
    // Validate primary color gradient if using linear gradient
    if (settings.primaryColor?.includes("linear-gradient")) {
      const gradientMatch = settings.primaryColor.match(/linear-gradient\(90deg,\s*(.+)\)/)
      if (gradientMatch && gradientMatch[1]) {
        const stops = gradientMatch[1].split(",")
        for (const stop of stops) {
          const colorMatch = stop.trim().match(/^(#[0-9A-Fa-f]+)/)
          if (colorMatch) {
            const hexColor = colorMatch[1]
            if (!/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
              error(`Invalid primary color gradient "${hexColor}". Please ensure all colors are complete 6-character hex codes (e.g., #FF751F)`, "Invalid Color")
              return
            }
          }
        }
      }
    }
    
    // Validate form color gradient if using linear gradient
    if (settings.defaultFormColor?.includes("linear-gradient")) {
      const gradientMatch = settings.defaultFormColor.match(/linear-gradient\(90deg,\s*(.+)\)/)
      if (gradientMatch && gradientMatch[1]) {
        const stops = gradientMatch[1].split(",")
        for (const stop of stops) {
          const colorMatch = stop.trim().match(/^(#[0-9A-Fa-f]+)/)
          if (colorMatch) {
            const hexColor = colorMatch[1]
            if (!/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
              error(`Invalid form color gradient "${hexColor}". Please ensure all colors are complete 6-character hex codes (e.g., #FF751F)`, "Invalid Color")
              return
            }
          }
        }
      }
    }

    setIsSaving(true)
    try {
      // Save portal settings (CustomWebsite)
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

      // Also save defaultFormColor to clinic/organization settings
      if (settings.defaultFormColor) {
        await authenticatedFetch(`${API_URL}/organization/update`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultFormColor: settings.defaultFormColor }),
        })
      }

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

  const handleActivateDomain = async () => {
    const domain = vanityDomainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")
    if (!domain) return
    setDomainError(null)
    setIsActivatingDomain(true)
    try {
      const response = await authenticatedFetch(`${API_URL}/organization`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: domain, isCustomDomain: true }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setCustomDomain(domain)
        setIsCustomDomain(true)
        setVanityDomainInput("")
        success("Vanity domain activated successfully!", "Domain Activated")
      } else {
        setDomainError(data.message || "Failed to activate domain. Please try again.")
      }
    } catch (err) {
      setDomainError("An error occurred. Please try again.")
    } finally {
      setIsActivatingDomain(false)
    }
  }

  const handleRemoveDomain = async () => {
    if (!confirm("Are you sure you want to remove your custom domain? Your portal will revert to the default Fuse Health URL.")) return
    setIsRemovingDomain(true)
    try {
      const response = await authenticatedFetch(`${API_URL}/organization`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCustomDomain: false }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        const prev = customDomain || ""
        setCustomDomain(null)
        setIsCustomDomain(false)
        setVanityDomainInput(prev)
        setDomainError(null)
        success("Custom domain removed.", "Domain Removed")
      } else {
        error(data.message || "Failed to remove domain.", "Error")
      }
    } catch (err) {
      error("An error occurred. Please try again.", "Error")
    } finally {
      setIsRemovingDomain(false)
    }
  }

  const handleCopyCname = () => {
    if (!clinicSlug) return
    navigator.clipboard.writeText(`${clinicSlug}.fuse.health`)
    setCopiedCname(true)
    setTimeout(() => setCopiedCname(false), 2000)
  }

  const handleResetFooter = async () => {
    if (!confirm("Are you sure you want to reset the footer section to default values? This will clear all footer categories and links.")) {
      return
    }

    setIsResettingFooter(true)
    try {
      const response = await authenticatedFetch(`${API_URL}/custom-website/reset-footer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          // Update settings with the reset values
          setSettings({
            ...settings,
            footerColor: data.data.footerColor,
            footerCategories: data.data.footerCategories,
            useDefaultDisclaimer: data.data.useDefaultDisclaimer,
            footerDisclaimer: data.data.footerDisclaimer,
          })
          success("Footer section reset to defaults successfully!", "Footer Reset")
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        error(
          errorData.message || "Failed to reset footer section",
          "Reset Failed"
        )
      }
    } catch (err) {
      console.error("Error resetting footer section:", err)
      error(
        err instanceof Error ? err.message : "Error resetting footer section",
        "Error"
      )
    } finally {
      setIsResettingFooter(false)
    }
  }

  const handleResetSocialMedia = async () => {
    if (!confirm("Are you sure you want to reset the social media section to default values? This will clear all social media links.")) {
      return
    }

    setIsResettingSocialMedia(true)
    try {
      const response = await authenticatedFetch(`${API_URL}/custom-website/reset-social-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          // Update settings with the reset values
          setSettings({
            ...settings,
            socialMediaSection: data.data.socialMediaSection,
            socialMediaLinks: data.data.socialMediaLinks,
          })
          success("Social media section reset to defaults successfully!", "Social Media Reset")
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        error(
          errorData.message || "Failed to reset social media section",
          "Reset Failed"
        )
      }
    } catch (err) {
      console.error("Error resetting social media section:", err)
      error(
        err instanceof Error ? err.message : "Error resetting social media section",
        "Error"
      )
    } finally {
      setIsResettingSocialMedia(false)
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

  const handleLogoEditExisting = async () => {
    if (!settings.logo) return

    // If we still have the original data URL in memory (uploaded this session), use it directly.
    // Otherwise fetch through our backend proxy so the browser never touches the S3 URL
    // with crossOrigin — which would fail if the bucket doesn't have CORS headers set up.
    let src = logoOriginalSrc
    if (!src) {
      try {
        const resp = await authenticatedFetch(`${API_URL}/custom-website/logo-proxy`)
        if (resp.ok) {
          const blob = await resp.blob()
          src = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target?.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        }
      } catch (e) {
        console.error("Failed to load logo via proxy:", e)
      }
    }

    // Last-resort: use the S3 URL directly (works if CORS is configured on the bucket)
    if (!src) src = settings.logo

    setLogoCropSrc(src)
    setLogoCropIsCustom(true)
    setLogoCrop({ unit: "%", x: 5, y: 5, width: 90, height: 90 })
    setLogoCropPixels(null)
    setLogoCropOpen(true)
  }

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      const dataUrl = reader.result as string
      setLogoOriginalSrc(dataUrl)   // remember the original so Edit Image can re-open it
      setLogoCropSrc(dataUrl)
      setLogoCropIsCustom(true)
      setLogoCrop({ unit: "%", x: 5, y: 5, width: 90, height: 90 })
      setLogoCropPixels(null)
      setLogoCropOpen(true)
    })
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleLogoCropApply = async () => {
    if (!logoCropPixels || !logoCropImgRef.current) return
    setLogoCropApplying(true)
    const displayW = logoCropImgRef.current.width
    const displayH = logoCropImgRef.current.height
    const naturalW = logoCropImgRef.current.naturalWidth
    const naturalH = logoCropImgRef.current.naturalHeight
    try {
      let outputW: number, outputH: number
      if (logoCropIsCustom) {
        // Scale selection to natural image pixels, guarantee ≥800px on the longer side
        const scaleX = naturalW / displayW
        const scaleY = naturalH / displayH
        const nw = logoCropPixels.width * scaleX
        const nh = logoCropPixels.height * scaleY
        const MIN = 800
        if (nw >= nh) {
          outputW = Math.max(MIN, Math.round(nw))
          outputH = Math.round(outputW * nh / nw)
        } else {
          outputH = Math.max(MIN, Math.round(nh))
          outputW = Math.round(outputH * nw / nh)
        }
      } else {
        outputW = logoCropPreset.outputW
        outputH = logoCropPreset.outputH
      }
      const blob = await cropLogoToBlob(logoCropSrc, logoCropPixels, outputW, outputH, displayW, displayH)
      const formData = new FormData()
      formData.append("logo", blob, `logo-${logoCropIsCustom ? "custom" : logoCropPreset.label.toLowerCase()}.png`)
      setIsUploadingLogo(true)
      const response = await authenticatedFetch(`${API_URL}/custom-website/upload-logo`, {
        method: "POST",
        body: formData,
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.logoUrl) {
          setSettings((prev) => ({ ...prev, logo: data.data.logoUrl }))
        }
        setLogoCropApplying(false)
        setIsUploadingLogo(false)
        setLogoCropOpen(false)
        setLogoCropSrc("")
      } else {
        error("Failed to upload logo")
        setLogoCropApplying(false)
        setIsUploadingLogo(false)
      }
    } catch (err) {
      console.error("Logo crop/upload error:", err)
      // If canvas is tainted (remote image without CORS), prompt the user to upload the file directly
      if (err instanceof Error && (err.message.includes("tainted") || err.message.includes("cross-origin") || err.message.includes("SecurityError"))) {
        error("Could not re-crop the existing image. Please use 'Use new image' to upload your logo file directly.")
      } else {
        error("Something went wrong. Please try again or upload a new file.")
      }
      setLogoCropApplying(false)
      setIsUploadingLogo(false)
    }
  }

  const handleLogoCloseDialog = () => {
    setLogoCropOpen(false)
    setLogoCropSrc("")
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
      {/* Sticky save bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold leading-tight">Portal Customization</h1>
          <p className="text-xs text-muted-foreground">Customize your patient-facing landing page</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="shrink-0">
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Settings Panel */}
          <div className="space-y-6">

            {/* ── Section: Brand Identity ───────────────────── */}
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">Brand Identity</h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Logo Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold tracking-tight">Logo Section</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Hidden file input — always present so logo uploads still work for intake forms */}
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={handleLogoFileSelect}
                  className="hidden"
                />

                {/* Option cards — mutually exclusive committed choice */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, navDisplayMode: "brandName" })}
                    className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 py-5 px-3 text-center transition-all ${
                      settings.navDisplayMode === "brandName"
                        ? "border-foreground bg-foreground/5"
                        : "border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/30"
                    }`}
                  >
                    {settings.navDisplayMode === "brandName" && (
                      <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-foreground">
                        <Check className="h-2.5 w-2.5 text-background" />
                      </span>
                    )}
                    <Type className={`w-5 h-5 ${settings.navDisplayMode === "brandName" ? "text-foreground" : "text-muted-foreground"}`} />
                    <span className={`text-xs font-semibold ${settings.navDisplayMode === "brandName" ? "text-foreground" : "text-muted-foreground"}`}>
                      Brand Name
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, navDisplayMode: "logo" })}
                    className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 py-5 px-3 text-center transition-all ${
                      settings.navDisplayMode === "logo"
                        ? "border-foreground bg-foreground/5"
                        : "border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/30"
                    }`}
                  >
                    {settings.navDisplayMode === "logo" && (
                      <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-foreground">
                        <Check className="h-2.5 w-2.5 text-background" />
                      </span>
                    )}
                    <ImageIcon className={`w-5 h-5 ${settings.navDisplayMode === "logo" ? "text-foreground" : "text-muted-foreground"}`} />
                    <span className={`text-xs font-semibold ${settings.navDisplayMode === "logo" ? "text-foreground" : "text-muted-foreground"}`}>
                      Logo
                    </span>
                  </button>
                </div>

                {/* Brand Name mode */}
                {settings.navDisplayMode === "brandName" && (
                  <div className="space-y-2">
                    <Input
                      value={settings.navBrandName}
                      onChange={(e) => setSettings({ ...settings, navBrandName: e.target.value })}
                      placeholder="Your brand here"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Leave blank to display your registered business name. Does not affect intake forms.
                    </p>
                  </div>
                )}

                {/* Logo mode */}
                {settings.navDisplayMode === "logo" && (
                  <div className="space-y-3">
                    {/* Logo preview with hover-edit overlay */}
                    {settings.logo ? (
                      <div className="group relative rounded-lg bg-muted/30 border border-border flex items-center justify-center min-h-[80px] overflow-hidden">
                        <img
                          src={settings.logo}
                          alt="Logo preview"
                          className="max-h-16 max-w-full object-contain px-4 py-3"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleLogoEditExisting}
                            className="flex items-center gap-1.5 bg-white/90 hover:bg-white text-neutral-800 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit image
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSettings({ ...settings, logo: "" }); setLogoOriginalSrc(null) }}
                            className="flex items-center gap-1 bg-white/20 hover:bg-red-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setLogoInputMode("file"); logoFileInputRef.current?.click() }}
                        className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground hover:text-primary"
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-xs font-medium">Click to upload your logo</span>
                      </button>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => settings.logo ? handleLogoEditExisting() : logoFileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploadingLogo ? "Uploading…" : settings.logo ? "Edit logo" : "Upload a file"}
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

                    {logoInputMode === "url" && (
                      <Input
                        value={settings.logo}
                        onChange={(e) => setSettings({ ...settings, logo: e.target.value })}
                        placeholder="https://example.com/logo.png"
                      />
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      PNG, JPG, WebP or SVG. Also appears in intake forms.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Colors — 2×2 grid: Nav/Footer | Background (top) · Brand | Form (bottom) */}
            <div className="grid grid-cols-2 gap-4">

              {/* Nav & Footer Color */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold tracking-tight">Nav &amp; Footer</CardTitle>
                  <CardDescription>Navigation bar &amp; footer background</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="relative w-full h-12 rounded-lg border border-input overflow-hidden cursor-pointer"
                      style={{ backgroundColor: settings.navFooterColor || "#000000" }}>
                      <input
                        type="color"
                        value={settings.navFooterColor || "#000000"}
                        onChange={(e) => setSettings({ ...settings, navFooterColor: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <Input
                      value={settings.navFooterColor || ""}
                      onChange={(e) => { const v = e.target.value; if (v === "" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) setSettings({ ...settings, navFooterColor: v }) }}
                      placeholder="#000000"
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Background Color */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold tracking-tight">Background Color</CardTitle>
                  <CardDescription>Page &amp; section background</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="relative w-full h-12 rounded-lg border border-input overflow-hidden cursor-pointer"
                      style={{ backgroundColor: settings.backgroundColor || "#FFFFFF" }}>
                      <input
                        type="color"
                        value={settings.backgroundColor || "#FFFFFF"}
                        onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <Input
                      value={settings.backgroundColor || ""}
                      onChange={(e) => { const v = e.target.value; if (v === "" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) setSettings({ ...settings, backgroundColor: v }) }}
                      placeholder="#FFFFFF"
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Button Color */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold tracking-tight">Button Color</CardTitle>
                  <CardDescription>Buttons, headers &amp; CTAs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Solid / Gradient segmented control */}
                  <div className="flex p-0.5 bg-muted rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setPrimaryColorMode("solid")
                        setPrimaryGradientStops(DEFAULT_GRADIENT_STOPS.map((s) => ({ ...s })))
                        setSettings({ ...settings, primaryColor: primaryGradientStops[0]?.color || "#000000" })
                      }}
                      className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                        primaryColorMode === "solid"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Solid
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrimaryColorMode("gradient")
                        if (!settings.primaryColor?.includes("linear-gradient")) {
                          const defaultGradient = `linear-gradient(90deg, ${primaryGradientStops.map((s) => `${s.color} ${s.position}%`).join(", ")})`
                          setSettings({ ...settings, primaryColor: defaultGradient })
                        }
                      }}
                      className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                        primaryColorMode === "gradient"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Gradient
                    </button>
                  </div>
                  {primaryColorMode === "solid" ? (
                    <div className="space-y-2">
                      <div className="relative w-full h-12 rounded-lg border border-input overflow-hidden cursor-pointer"
                        style={{ backgroundColor: settings.primaryColor || "#000000" }}>
                        <input
                          type="color"
                          value={settings.primaryColor || "#000000"}
                          onChange={(e) => { setPrimaryColorMode("solid"); setSettings({ ...settings, primaryColor: e.target.value }) }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </div>
                      <Input
                        value={settings.primaryColor || ""}
                        onChange={(e) => { const v = e.target.value; if (v === "" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) setSettings({ ...settings, primaryColor: v }) }}
                        placeholder="#000000"
                        className="font-mono text-sm"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="h-12 rounded-lg border border-input"
                        style={{ background: `linear-gradient(90deg, ${primaryGradientStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` }} />
                      <div className="space-y-1.5">
                        {primaryGradientStops.map((stop, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="relative w-7 h-7 rounded border border-input shrink-0 cursor-pointer overflow-hidden" style={{ backgroundColor: stop.color }}>
                              <input type="color" value={stop.color}
                                onChange={(e) => {
                                  const newStops = [...primaryGradientStops]; newStops[index].color = e.target.value; setPrimaryGradientStops(newStops)
                                  setSettings({ ...settings, primaryColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                            </div>
                            <Input value={stop.color}
                              onChange={(e) => {
                                const newStops = [...primaryGradientStops]; newStops[index].color = e.target.value; setPrimaryGradientStops(newStops)
                                setSettings({ ...settings, primaryColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                              }}
                              className="font-mono text-xs flex-1" placeholder="#000000" />
                            <Input type="number" min="0" max="100" value={stop.position}
                              onChange={(e) => {
                                const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                                const newStops = [...primaryGradientStops]; newStops[index].position = v; setPrimaryGradientStops(newStops)
                                setSettings({ ...settings, primaryColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                              }}
                              className="w-12 text-center text-xs shrink-0" />
                            <span className="text-xs text-muted-foreground shrink-0">%</span>
                            {primaryGradientStops.length > 2 && (
                              <button type="button" onClick={() => {
                                const newStops = primaryGradientStops.filter((_, i) => i !== index); setPrimaryGradientStops(newStops)
                                setSettings({ ...settings, primaryColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                              }} className="text-muted-foreground hover:text-destructive shrink-0 transition-colors">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => {
                          const newStops = [...primaryGradientStops, { color: "#10B981", position: 50 }]; setPrimaryGradientStops(newStops)
                          setSettings({ ...settings, primaryColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                        }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <Plus className="h-3 w-3" />Add stop
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Form Color */}
              <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold tracking-tight">Form Color</CardTitle>
                <CardDescription>Intake form buttons &amp; accents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Solid / Gradient segmented control */}
                <div className="flex p-0.5 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setFormColorMode("solid")
                      setFormGradientStops(DEFAULT_GRADIENT_STOPS.map((s) => ({ ...s })))
                      setSettings({ ...settings, defaultFormColor: formGradientStops[0]?.color || "#0EA5E9" })
                    }}
                    className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                      formColorMode === "solid"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Solid
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormColorMode("gradient")
                      if (!settings.defaultFormColor?.includes("linear-gradient")) {
                        const defaultGradient = `linear-gradient(90deg, ${formGradientStops.map((s) => `${s.color} ${s.position}%`).join(", ")})`
                        setSettings({ ...settings, defaultFormColor: defaultGradient })
                      }
                    }}
                    className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                      formColorMode === "gradient"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Gradient
                  </button>
                </div>
                {formColorMode === "solid" ? (
                  <div className="space-y-2">
                    <div className="relative w-full h-12 rounded-lg border border-input overflow-hidden cursor-pointer"
                      style={{ backgroundColor: settings.defaultFormColor || "#0EA5E9" }}>
                      <input
                        type="color"
                        value={settings.defaultFormColor || "#0EA5E9"}
                        onChange={(e) => { setFormColorMode("solid"); setSettings({ ...settings, defaultFormColor: e.target.value }) }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <Input
                      value={settings.defaultFormColor || ""}
                      onChange={(e) => { const v = e.target.value; if (v === "" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) setSettings({ ...settings, defaultFormColor: v }) }}
                      placeholder="#0EA5E9"
                      className="font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="h-12 rounded-lg border border-input"
                      style={{ background: `linear-gradient(90deg, ${formGradientStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` }} />
                    <div className="space-y-1.5">
                      {formGradientStops.map((stop, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="relative w-7 h-7 rounded border border-input shrink-0 cursor-pointer overflow-hidden" style={{ backgroundColor: stop.color }}>
                            <input type="color" value={stop.color}
                              onChange={(e) => {
                                const newStops = [...formGradientStops]; newStops[index].color = e.target.value; setFormGradientStops(newStops)
                                setSettings({ ...settings, defaultFormColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                          </div>
                          <Input value={stop.color}
                            onChange={(e) => {
                              const newStops = [...formGradientStops]; newStops[index].color = e.target.value; setFormGradientStops(newStops)
                              setSettings({ ...settings, defaultFormColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                            }}
                            className="font-mono text-xs flex-1" placeholder="#0EA5E9" />
                          <Input type="number" min="0" max="100" value={stop.position}
                            onChange={(e) => {
                              const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                              const newStops = [...formGradientStops]; newStops[index].position = v; setFormGradientStops(newStops)
                              setSettings({ ...settings, defaultFormColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                            }}
                            className="w-12 text-center text-xs shrink-0" />
                          <span className="text-xs text-muted-foreground shrink-0">%</span>
                          {formGradientStops.length > 2 && (
                            <button type="button" onClick={() => {
                              const newStops = formGradientStops.filter((_, i) => i !== index); setFormGradientStops(newStops)
                              setSettings({ ...settings, defaultFormColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                            }} className="text-muted-foreground hover:text-destructive shrink-0 transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => {
                        const newStops = [...formGradientStops, { color: "#10B981", position: 50 }]; setFormGradientStops(newStops)
                        setSettings({ ...settings, defaultFormColor: `linear-gradient(90deg, ${newStops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(", ")})` })
                      }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <Plus className="h-3 w-3" />Add stop
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            </div>{/* end 2×2 color grid */}

            {/* Title, Description & Typography — consolidated */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold tracking-tight">Content & Typography</CardTitle>
                <CardDescription>Landing page headline, supporting text, and font</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Title</label>
                    <textarea
                      rows={2}
                      value={settings.heroTitle}
                      onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.target as HTMLTextAreaElement).value.includes("\n")) {
                          e.preventDefault()
                        }
                      }}
                      placeholder="Enter title"
                      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 resize-none leading-snug"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Description</label>
                    <textarea
                      rows={2}
                      value={settings.heroSubtitle}
                      onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.target as HTMLTextAreaElement).value.includes("\n")) {
                          e.preventDefault()
                        }
                      }}
                      placeholder="Enter description"
                      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 resize-none leading-snug"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Font</label>
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 px-2.5 py-1.5 border border-input bg-background text-foreground rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      value={settings.fontFamily}
                      onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-muted-foreground shrink-0 w-6 text-center" style={{ fontFamily: settings.fontFamily }}>
                      Aa
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Section: Homepage Hero ───────────────────── */}
            <div className="flex items-center gap-3 pt-2">
              <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">Homepage Hero</h2>
              <div className="flex-1 h-px bg-border" />
            </div>

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

            {/* ── Section: Footer & Social ─────────────────── */}
            <div className="flex items-center gap-3 pt-2">
              <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">Footer & Social</h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Footer Links */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold tracking-tight">Footer Links</CardTitle>
                    <CardDescription>Navigation sections shown in the footer</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleResetFooter} disabled={isResettingFooter} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsAddingCategory(true)} disabled={(settings.footerCategories || []).length >= 4} className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
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
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold tracking-tight">Disclaimer</CardTitle>
                <CardDescription>Legal text displayed in the footer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Use default disclaimer</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Set by your organization</p>
                  </div>
                  <Switch
                    checked={settings.useDefaultDisclaimer ?? true}
                    onCheckedChange={(checked) => setSettings({ ...settings, useDefaultDisclaimer: checked })}
                  />
                </div>
                {!settings.useDefaultDisclaimer && (
                  <div className="space-y-1.5">
                    <textarea
                      value={settings.footerDisclaimer || ""}
                      onChange={(e) => setSettings({ ...settings, footerDisclaimer: e.target.value })}
                      placeholder="Enter your custom disclaimer text…"
                      className="w-full min-h-[120px] p-3 text-sm border border-input bg-background text-foreground rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      rows={5}
                    />
                    <p className="text-[11px] text-muted-foreground text-right">{(settings.footerDisclaimer || "").length} characters</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Social Media */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold tracking-tight">Social Media</CardTitle>
                    <CardDescription>Icons &amp; links shown in the footer</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleResetSocialMedia} disabled={isResettingSocialMedia} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {([
                  {
                    key: "instagram", label: "Instagram",
                    icon: <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />,
                    placeholder: "instagram.com/yourbrand",
                  },
                  {
                    key: "facebook", label: "Facebook",
                    icon: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />,
                    placeholder: "facebook.com/yourbrand",
                  },
                  {
                    key: "twitter", label: "X (Twitter)",
                    icon: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
                    placeholder: "x.com/yourbrand",
                  },
                  {
                    key: "tiktok", label: "TikTok",
                    icon: <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />,
                    placeholder: "tiktok.com/@yourbrand",
                  },
                  {
                    key: "youtube", label: "YouTube",
                    icon: <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />,
                    placeholder: "youtube.com/@yourbrand",
                  },
                ] as { key: keyof NonNullable<typeof settings.socialMediaLinks>; label: string; icon: React.ReactNode; placeholder: string }[]).map(({ key, label, icon, placeholder }) => {
                  const platform = settings.socialMediaLinks?.[key]
                  const isEnabled = platform?.enabled ?? true
                  return (
                    <div key={key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${isEnabled ? "border-border bg-background" : "border-border/50 bg-muted/30"}`}>
                      <svg className={`w-4 h-4 shrink-0 transition-opacity ${isEnabled ? "opacity-80" : "opacity-30"}`} viewBox="0 0 24 24" fill="currentColor">{icon}</svg>
                      <span className={`text-xs font-medium w-20 shrink-0 transition-opacity ${isEnabled ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                      <Input
                        value={platform?.url || ""}
                        onChange={(e) => setSettings({ ...settings, socialMediaLinks: { ...settings.socialMediaLinks, [key]: { ...platform, enabled: isEnabled, url: e.target.value } } })}
                        placeholder={placeholder}
                        disabled={!isEnabled}
                        className={`flex-1 h-8 text-xs transition-opacity ${!isEnabled ? "opacity-40" : ""}`}
                      />
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, socialMediaLinks: { ...settings.socialMediaLinks, [key]: { ...platform, url: platform?.url || "", enabled: checked } } })}
                      />
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* ── Section: Domain & Publishing ─────────────── */}
            <div className="flex items-center gap-3 pt-2">
              <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">Domain & Publishing</h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Your Portal URL Section */}
            <Card id="brand-portal-url-section">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-full bg-primary/10">
                      <LinkIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium mb-1">
                        {typeof window !== 'undefined' && window.location.hostname.includes('localhost')
                          ? 'Your Portal URL (Local)'
                          : 'Your Portal URL'}
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

            {/* Custom Vanity Domain Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold tracking-tight">Custom Domain</CardTitle>
                </div>
                <CardDescription>Connect your own domain and control portal visibility</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCustomDomain && customDomain ? (
                  /* ── Activated state ── */
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-green-800">Vanity Domain Activated</p>
                        <p className="text-xs font-mono text-green-700 mt-0.5 truncate">{customDomain}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(`https://${customDomain}`, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Preview Site
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={handleRemoveDomain}
                        disabled={isRemovingDomain}
                      >
                        {isRemovingDomain ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Input + DNS setup state ── */
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Your Domain</label>
                      <Input
                        value={vanityDomainInput}
                        onChange={(e) => { setVanityDomainInput(e.target.value); setDomainError(null) }}
                        placeholder="shop.yourbrand.com"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">Enter your domain without <span className="font-mono">https://</span></p>
                    </div>

                    {vanityDomainInput.trim() && (
                      <>
                        {/* DNS Record Table */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                            <p className="text-xs font-medium text-amber-700">Add this DNS record with your domain registrar before activating:</p>
                          </div>
                          <div className="rounded-lg border overflow-hidden text-xs">
                            <div className="grid grid-cols-3 bg-muted/60 px-3 py-2 border-b font-medium text-muted-foreground">
                              <span>Type</span>
                              <span>Name / Host</span>
                              <span>Value / Points To</span>
                            </div>
                            <div className="grid grid-cols-3 px-3 py-3 items-center gap-x-2">
                              <span className="font-semibold text-foreground">CNAME</span>
                              <span className="font-mono text-foreground truncate">
                                {(() => {
                                  const d = vanityDomainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")
                                  const parts = d.split(".")
                                  return parts.length > 2 ? parts.slice(0, -2).join(".") : "@"
                                })()}
                              </span>
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="font-mono text-foreground truncate">{clinicSlug ? `${clinicSlug}.fuse.health` : "…"}</span>
                                <button
                                  onClick={handleCopyCname}
                                  title="Copy value"
                                  className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {copiedCname ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            DNS changes can take up to 24–48 hours to propagate. Click <strong>Activate</strong> once your DNS is configured.
                          </p>
                        </div>

                        {domainError && (
                          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">{domainError}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const slug = clinicSlug
                              if (slug) window.open(`https://${slug}.fuse.health`, "_blank")
                            }}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={handleActivateDomain}
                            disabled={isActivatingDomain || !vanityDomainInput.trim()}
                          >
                            {isActivatingDomain ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Activating…
                              </>
                            ) : (
                              "Activate"
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Portal visibility toggle */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Portal Visibility</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {settings.isActive
                          ? "Your portal is live and visible to patients"
                          : "Your portal is hidden from patients"}
                      </p>
                    </div>
                    <Switch
                      checked={settings.isActive}
                      onCheckedChange={handleToggleActive}
                      disabled={isTogglingActive}
                      className="data-[state=checked]:bg-green-600 flex-shrink-0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Live Preview Panel — sticky as user scrolls */}
          <div className="sticky top-[60px] self-start space-y-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold tracking-tight">Portal Preview</CardTitle>
                    <CardDescription>Live preview of your patient-facing portal</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {clinicSlug && (
                      <button
                        type="button"
                        onClick={() => {
                          let url: string
                          if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
                            url = `http://${clinicSlug}.localhost:3000`
                          } else if (isCustomDomain && customDomain) {
                            url = `https://${customDomain}`
                          } else {
                            url = `https://${clinicSlug}.fusehealth.com`
                          }
                          window.open(url, '_blank', 'noopener,noreferrer')
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Preview
                      </button>
                    )}
                    <div className="flex gap-1 p-1 bg-muted rounded-lg">
                      <button
                        type="button"
                        onClick={() => setPreviewMode("desktop")}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          previewMode === "desktop"
                            ? "bg-white text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                        Desktop
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode("mobile")}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          previewMode === "mobile"
                            ? "bg-white text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        Mobile
                      </button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`border rounded-lg overflow-hidden shadow-sm ${previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""
                    }`}
                  style={{ fontFamily: settings.fontFamily, backgroundColor: settings.backgroundColor || "#FFFFFF" }}
                >
                  {/* Preview Header — mirrors live portal structure */}
                  {(() => {
                    const navTextColor = getContrastColor(settings.navFooterColor || "#000000")
                    const isGradientBtn = settings.primaryColor?.includes("linear-gradient")
                    return (
                      <div className="px-3 flex items-center justify-between" style={{ backgroundColor: settings.navFooterColor || "#000000", height: "40px" }}>
                        {/* Left: brand name or logo */}
                        {settings.navDisplayMode === "logo" && settings.logo ? (
                          <img src={settings.logo} alt="Nav logo" className="max-h-5 max-w-[72px] object-contain" />
                        ) : (
                          <span className="font-semibold text-[11px] tracking-tight" style={{ fontFamily: settings.fontFamily, color: navTextColor }}>
                            {settings.navBrandName || clinicName || "Business Name"}
                          </span>
                        )}

                        {/* Center: nav links */}
                        <div className="flex items-center gap-3">
                          {["Products", "How It Works", "Contact"].map((label) => (
                            <span key={label} className="text-[9px] font-medium" style={{ color: navTextColor, opacity: 0.85 }}>
                              {label}
                            </span>
                          ))}
                        </div>

                        {/* Right: Login + Order now */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-medium" style={{ color: navTextColor, opacity: 0.85 }}>Login</span>
                          {isGradientBtn ? (
                            <span style={{ background: settings.primaryColor, padding: "1.5px", borderRadius: "6px", display: "inline-flex" }}>
                              <span style={{ borderRadius: "4.5px", color: settings.primaryColor?.match(/#[0-9A-Fa-f]{6}/)?.[0] || "#000", backgroundColor: "white", fontSize: "9px", fontWeight: 500, padding: "2px 7px" }}>
                                Order now
                              </span>
                            </span>
                          ) : (
                            <span style={{ border: `1.5px solid ${settings.primaryColor}`, color: settings.primaryColor, backgroundColor: "transparent", borderRadius: "5px", fontSize: "9px", fontWeight: 500, padding: "2px 7px" }}>
                              Order now
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Preview Hero */}
                  <div
                    className="relative h-80 bg-cover bg-center flex items-center justify-center"
                    style={{ backgroundImage: `url(${settings.heroImageUrl})` }}
                  >
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative z-10 text-center text-white px-4">
                      <h2
                        className="text-2xl font-bold mb-2 whitespace-pre-line"
                        style={{ fontFamily: settings.fontFamily }}
                      >
                        {settings.heroTitle}
                      </h2>
                      <p className="text-sm opacity-90 mb-4 whitespace-pre-line">{settings.heroSubtitle}</p>
                      <div className="flex gap-2 justify-center">
                        <button
                          style={{
                            background: settings.primaryColor,
                            color: getContrastColor(settings.primaryColor?.match(/#[0-9A-Fa-f]{6}/)?.[0] || (settings.primaryColor?.includes('linear-gradient') ? '#000' : settings.primaryColor) || "#000000"),
                            padding: "0.375rem 0.875rem",
                            border: "none",
                            borderRadius: "0.375rem",
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          View all products
                        </button>
                        <button
                          style={{
                            backgroundColor: "white",
                            color: "#1f2937",
                            padding: "0.375rem 0.875rem",
                            border: "none",
                            borderRadius: "0.375rem",
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Learn More
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Top Programs — matches live portal section below hero */}
                  <div className="px-5 py-4" style={{ backgroundColor: settings.backgroundColor || "#FFFFFF" }}>
                    <h3 className="text-sm font-bold mb-3" style={{ fontFamily: settings.fontFamily, color: getContrastColor(settings.backgroundColor || "#FFFFFF") }}>Top Programs</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="rounded-lg overflow-hidden border border-border/50">
                          <div
                            className="h-14"
                            style={{
                              background: settings.primaryColor?.includes("linear-gradient")
                                ? settings.primaryColor
                                : `${settings.primaryColor}25`,
                              opacity: settings.primaryColor?.includes("linear-gradient") ? 0.35 : 1,
                            }}
                          />
                          <div className="p-1.5">
                            <div className="h-2 bg-gray-200 rounded w-3/4 mb-1" />
                            <div className="h-1.5 bg-gray-100 rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview Footer */}
                  <div
                    className="p-4 text-xs"
                    style={{ backgroundColor: settings.navFooterColor || "#000000", color: getContrastColor(settings.navFooterColor || "#000000") }}
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
                          {settings.useDefaultDisclaimer
                            ? (defaultDisclaimer || "Loading default disclaimer...")
                            : (settings.footerDisclaimer || "No custom disclaimer set")}
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

          </>
        )}
      </div>
      <ToastManager toasts={toasts} onDismiss={dismiss} />

      {/* ── Logo Crop Dialog ── */}
      {logoCropOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl ring-1 ring-border overflow-hidden flex flex-col">

            {/* Header */}
            <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Crop Logo</h3>
              <button
                onClick={handleLogoCloseDialog}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Aspect ratio chips */}
            <div className="px-5 pt-3 pb-2 flex items-center gap-1">
              <button
                onClick={() => {
                  setLogoCropIsCustom(true)
                  // Reset to a full-image free selection
                  setLogoCrop({ unit: "%", x: 5, y: 5, width: 90, height: 90 })
                  setLogoCropPixels(null)
                }}
                className={`text-[11px] font-medium px-3 py-1 rounded-full border transition-all ${
                  logoCropIsCustom
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                Free
              </button>
              {([
                { label: "1:1", preset: LOGO_ASPECT_PRESETS[0] },
                { label: "3:1", preset: LOGO_ASPECT_PRESETS[1] },
                { label: "5:1", preset: LOGO_ASPECT_PRESETS[2] },
                { label: "16:9", preset: LOGO_ASPECT_PRESETS[3] },
              ] as const).map(({ label, preset }) => {
                const isActive = !logoCropIsCustom && logoCropPreset.label === preset.label
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (isActive) {
                        // Clicking the active ratio returns to Free
                        setLogoCropIsCustom(true)
                        setLogoCrop({ unit: "%", x: 5, y: 5, width: 90, height: 90 })
                        setLogoCropPixels(null)
                      } else {
                        setLogoCropIsCustom(false)
                        setLogoCropPreset(preset)
                        setLogoCropPixels(null)
                        // Use image dimensions if the img is already mounted, else fall back
                        const img = logoCropImgRef.current
                        if (img && img.naturalWidth) {
                          setLogoCrop(makeCenteredAspectCrop(preset.ratio, img.width, img.height))
                        } else {
                          setLogoCrop({ unit: "%", x: 5, y: 5, width: 90, height: 90 })
                        }
                      }
                    }}
                    className={`text-[11px] font-medium px-3 py-1 rounded-full border transition-all ${
                      isActive
                        ? "bg-foreground text-background border-foreground"
                        : "text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Crop canvas — neutral background works for both light and dark logos */}
            <div className="bg-muted/60 flex items-center justify-center overflow-auto border-y border-border" style={{ minHeight: 280, maxHeight: 440 }}>
              {logoCropSrc && (
                <ReactCrop
                  crop={logoCrop}
                  onChange={(c) => setLogoCrop(c)}
                  onComplete={(px) => setLogoCropPixels(px)}
                  aspect={logoCropIsCustom ? undefined : logoCropPreset.ratio}
                >
                  <img
                    ref={logoCropImgRef}
                    src={logoCropSrc}
                    alt="Crop preview"
                    onLoad={() => {
                      // Always start in Free mode regardless of any previous state
                      setLogoCropIsCustom(true)
                      setLogoCrop({ unit: "%", x: 5, y: 5, width: 90, height: 90 })
                      setLogoCropPixels(null)
                    }}
                    style={{ maxHeight: 440, maxWidth: "100%", display: "block" }}
                  />
                </ReactCrop>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { handleLogoCloseDialog(); logoFileInputRef.current?.click() }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Use different image
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogoCloseDialog}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={logoCropApplying || !logoCropPixels}
                  onClick={handleLogoCropApply}
                >
                  {logoCropApplying ? "Saving…" : "Done"}
                </Button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </Layout>
  )
}

