import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import { ToastManager } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { FormAnalytics } from '@/components/form-analytics-detail'
import {
    Plus,
    Edit,
    FileText,
    Crown,
    X,
    Filter,
    BarChart3,
    Search,
    Rocket,
    Star,
    ChevronDown,
    Info,
    Minus,
    Upload,
    GripVertical,
    Settings,
    Copy,
    Stethoscope,
} from 'lucide-react'

interface Program {
    id: string
    name: string
    portalDisplayName?: string
    nonMedicalServiceFee?: number
    productPricing?: Record<string, { nonMedicalServiceFee: number; monthlyDiscountPercent?: number; monthlyDiscountMonth1Only?: boolean; multiMonthPlans?: Array<{ months: number; discountPercent: number }> }> | null
    description?: string
    clinicId: string
    medicalTemplateId?: string // Always present on live programs — a program cannot go live without a teleform
    templateId?: string
    isActive: boolean
    isFeatured?: boolean
    featuredProductId?: string | null
    productOrder?: string[]
    heroImageUrl?: string | null
    hideAdditionalProducts?: boolean
    isTemplate?: boolean
    createdAt: string
    updatedAt: string
    medicalTemplate?: {
        id: string
        title: string
        description?: string
        formTemplateType: string
        medicalCompanySource?: 'fuse' | 'md-integrations' | 'beluga'
    }
    template?: {
        id: string
        name: string
        description?: string
    }
}

interface ProgramTemplate {
    id: string
    name: string
    description?: string
    medicalTemplateId?: string
    isActive: boolean
    createdAt: string
    medicalTemplate?: {
        id: string
        title: string
        description?: string
        formTemplateType: string
        medicalCompanySource?: 'fuse' | 'md-integrations' | 'beluga'
    }
}

type MedicationRoute = 'injectable' | 'oral' | 'nasal' | 'topical' | 'sublingual' | 'transdermal'

interface ProgramProduct {
    id: string
    name: string
    imageUrl?: string
    medicationRoute?: MedicationRoute
    /** Itemized cost components ($/mo) */
    productCost?: number
    shippingCost?: number
    telehealthCost?: number
    telehealthType?: 'async' | 'sync'
    /** Computed total COGS — falls back to sum of components if present */
    cogs?: number
}

/** Fallback platform fee if the subscription tier and /config/fees both fail to resolve */
const DEFAULT_PLATFORM_FEE_PERCENT = 0.15
/** Stripe standard card processing rate applied to every charge */
const STRIPE_FEE_PERCENT = 0.029
const STRIPE_FEE_FIXED = 0.30

const computeCogs = (p: ProgramProduct): number | undefined => {
    if (p.productCost !== undefined || p.shippingCost !== undefined || p.telehealthCost !== undefined) {
        return (p.productCost ?? 0) + (p.shippingCost ?? 0) + (p.telehealthCost ?? 0)
    }
    return p.cogs
}

function MoreProductsTooltip({ products }: { products: Array<{ id: string; name: string; medicationRoute?: string; productCost?: number; cogs?: number }> }) {
    const [visible, setVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const ref = useRef<HTMLSpanElement>(null)

    const show = useCallback(() => {
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        setCoords({ top: rect.top, left: rect.left + rect.width / 2 })
        setVisible(true)
    }, [])

    const hide = useCallback(() => setVisible(false), [])

    return (
        <span
            ref={ref}
            onMouseEnter={show}
            onMouseLeave={hide}
            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 cursor-default hover:text-foreground transition-colors"
        >
            +{products.length} more
            {visible && typeof document !== 'undefined' && createPortal(
                <div
                    style={{ position: 'fixed', top: coords.top, left: coords.left, transform: 'translate(-50%, calc(-100% - 8px))', zIndex: 9999 }}
                    className="min-w-[150px] rounded-lg border border-border bg-popover shadow-lg p-2 pointer-events-none"
                >
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
                    {products.map((p) => {
                        const price = p.productCost ?? p.cogs
                        return (
                            <div key={p.id} className="flex flex-col px-1.5 py-1">
                                <span className="text-xs font-medium text-foreground leading-snug">{p.name}</span>
                                {(p.medicationRoute || price !== undefined) && (
                                    <span className="text-[10px] text-muted-foreground leading-none mt-0.5 flex items-center gap-1">
                                        {p.medicationRoute && <>{p.medicationRoute.charAt(0).toUpperCase() + p.medicationRoute.slice(1)}</>}
                                        {p.medicationRoute && price !== undefined && <span className="text-muted-foreground/40">·</span>}
                                        {price !== undefined && <span>${price.toFixed(0)}/mo</span>}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>,
                document.body
            )}
        </span>
    )
}

function InfoTooltip({ text, subtext }: { text: string; subtext?: string }) {
    const [visible, setVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const iconRef = useRef<HTMLSpanElement>(null)

    const show = useCallback(() => {
        if (!iconRef.current) return
        const rect = iconRef.current.getBoundingClientRect()
        setCoords({ top: rect.bottom + 8, left: rect.left + rect.width / 2 })
        setVisible(true)
    }, [])

    const hide = useCallback(() => setVisible(false), [])

    return (
        <span ref={iconRef} onMouseEnter={show} onMouseLeave={hide} className="inline-flex items-center cursor-help">
            <Info className="h-3 w-3 text-muted-foreground/40" />
            {visible && typeof document !== 'undefined' && createPortal(
                <div
                    style={{ position: 'fixed', top: coords.top, left: coords.left, transform: 'translateX(-50%)', zIndex: 9999 }}
                    className="w-64 rounded-lg border border-border bg-popover px-3 py-2.5 text-xs text-muted-foreground shadow-lg pointer-events-none"
                >
                    <p>{text}</p>
                    {subtext && (
                        <>
                            <hr className="my-2 border-border" />
                            <p>{subtext}</p>
                        </>
                    )}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-border" />
                </div>,
                document.body
            )}
        </span>
    )
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

// Helper to get medical company display info
const getMedicalCompanyInfo = (source?: string) => {
    switch (source) {
        case 'fuse':
            return { label: 'Fuse', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: '💙' }
        case 'md-integrations':
            return { label: 'MD Integrations', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: '🏥' }
        case 'beluga':
            return { label: 'Beluga', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', icon: '🐋' }
        default:
            return { label: 'Not Set', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: '⚪' }
    }
}

const categoryKeywords: Record<string, string[]> = {
    weight_loss: ['weight', 'semaglutide', 'tirzepatide', 'glp', 'obesity', 'ozempic', 'wegovy', 'mounjaro'],
    longevity: ['longevity', 'nad', 'anti-aging', 'anti aging', 'aging', 'wellness'],
    hair_loss: ['hair', 'finasteride', 'minoxidil'],
    ed: ['ed', 'erectile', 'sildenafil', 'tadalafil', 'viagra', 'cialis'],
}

const categoryLabels: Record<string, string> = {
    all: 'All Categories',
    weight_loss: 'Weight Loss',
    longevity: 'Longevity',
    hair_loss: 'Hair Loss',
    ed: 'ED',
    other: 'Other',
}

// Shared color tokens — same palette used in both filter chips and table badges
const categoryColors: Record<string, { badge: string; activeChip: string; dot: string }> = {
    all:         { badge: '',                                activeChip: 'bg-background text-foreground shadow-sm',    dot: 'bg-slate-400' },
    weight_loss: { badge: 'bg-rose-100 text-rose-700',      activeChip: 'bg-rose-100 text-rose-700 shadow-sm',        dot: 'bg-rose-400' },
    longevity:   { badge: 'bg-teal-100 text-teal-700',      activeChip: 'bg-teal-100 text-teal-700 shadow-sm',        dot: 'bg-teal-400' },
    hair_loss:   { badge: 'bg-indigo-100 text-indigo-700',  activeChip: 'bg-indigo-100 text-indigo-700 shadow-sm',    dot: 'bg-indigo-400' },
    ed:          { badge: 'bg-blue-100 text-blue-700',      activeChip: 'bg-blue-100 text-blue-700 shadow-sm',        dot: 'bg-blue-400' },
    other:       { badge: 'bg-slate-100 text-slate-500',    activeChip: 'bg-slate-100 text-slate-500 shadow-sm',      dot: 'bg-slate-400' },
}

const inferProgramCategory = (program: Program): keyof typeof categoryLabels => {
    const haystack = `${program.name} ${program.description || ''} ${program.medicalTemplate?.title || ''}`.toLowerCase()
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some((keyword) => haystack.includes(keyword))) {
            return category as keyof typeof categoryLabels
        }
    }
    return 'other'
}


/** Canvas-based image crop — outputs a 400×400 JPEG blob ready for upload */
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.addEventListener('load', () => resolve(img))
        img.addEventListener('error', reject)
        img.src = imageSrc
    })
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 400, 400)
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Canvas produced empty blob')); return }
            resolve(blob)
        }, 'image/jpeg', 0.85)
    })
}

export default function Programs() {
    const [programs, setPrograms] = useState<Program[]>([])
    const [templates, setTemplates] = useState<ProgramTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showTemplatesModal, setShowTemplatesModal] = useState(false)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [tutorialStep, setTutorialStep] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [programView, setProgramView] = useState<'all' | 'live' | 'shortlist'>('live')
    const [categoryFilter, setCategoryFilter] = useState<keyof typeof categoryLabels>('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set())
    const [bulkUpdating, setBulkUpdating] = useState(false)
    const [templateProductsByTemplateId, setTemplateProductsByTemplateId] = useState<Record<string, ProgramProduct[]>>({})

    const [quickEditLoading, setQuickEditLoading] = useState(false)
    const [quickEditSaving, setQuickEditSaving] = useState(false)
    const [quickEditErrors, setQuickEditErrors] = useState<{ name?: string; price?: string }>({})
    const [duplicating, setDuplicating] = useState<string | null>(null) // programId being duplicated
    const [quickEditProgramId, setQuickEditProgramId] = useState<string | null>(null)
    const [quickEditName, setQuickEditName] = useState('')
    const [quickEditPortalDisplayName, setQuickEditPortalDisplayName] = useState('')
    const [quickEditProducts, setQuickEditProducts] = useState<ProgramProduct[]>([])
    
    const [quickEditProductFees, setQuickEditProductFees] = useState<Record<string, number>>({})
    const [quickEditMonthlyDiscounts, setQuickEditMonthlyDiscounts] = useState<Record<string, number>>({})
    const [quickEditMultiMonthPlans, setQuickEditMultiMonthPlans] = useState<Record<string, Array<{ months: number; discountPercent: number }>>>({})
    const [expandedMultiMonth, setExpandedMultiMonth] = useState<Record<string, boolean>>({})
    const [quickEditFeaturedProductId, setQuickEditFeaturedProductId] = useState<string | null>(null)
    const [topChoiceError, setTopChoiceError] = useState(false)
    const topChoiceErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    // newlyPromotedId — the product ID that just became Top Choice; cleared after ~800ms for ring animation
    const [newlyPromotedId, setNewlyPromotedId] = useState<string | null>(null)
    const newlyPromotedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prevFeaturedIdRef = useRef<string | null>(null)
    // Drag-and-drop — pointer events + FLIP animation
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const draggingIdRef = useRef<string | null>(null)
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const prevTopPositions = useRef<Record<string, number>>({})
    const flipPending = useRef(false)
    const flipDuration = useRef(220) // ms — bumped to 380 for Top Choice promotions
    const [expandedCostBreakdowns, setExpandedCostBreakdowns] = useState<Record<string, boolean>>({})
    const [platformFeePercent, setPlatformFeePercent] = useState<number>(DEFAULT_PLATFORM_FEE_PERCENT)
    const [merchantServiceFeePercent, setMerchantServiceFeePercent] = useState<number>(0.02) // 2% system default; overridden by API
    const [quickEditProductImagePreviews, setQuickEditProductImagePreviews] = useState<Record<string, string>>({})
    const [quickEditProductImageFiles, setQuickEditProductImageFiles] = useState<Record<string, File>>({})
    const [quickEditImageUploadProductId, setQuickEditImageUploadProductId] = useState<string | null>(null)
    const quickEditFileInputRef = useRef<HTMLInputElement>(null)
    // Intake form display mode — 'all' shows every product equally, 'top-choice-first' highlights the featured product
    // and groups the rest under an "Additional options" section
    const [quickEditHideAdditionalProducts, setQuickEditHideAdditionalProducts] = useState(true)
    // Program-level hero image (saved on backend)
    const [quickEditProgramHeroImageUrl, setQuickEditProgramHeroImageUrl] = useState<string>('')
    const quickEditProgramFileInputRef = useRef<HTMLInputElement>(null)
    // Unified program modal (Program · Form Structure · Analytics tabs)
    const [programModal, setProgramModal] = useState<{ programId: string; programName: string; medicalTemplateId?: string; tab: 'program' | 'form' | 'analytics' } | null>(null)
    const [analyticsEnabledForms, setAnalyticsEnabledForms] = useState<{ id: string; productId: string }[]>([])
    const [analyticsFormStepLabels, setAnalyticsFormStepLabels] = useState<string[]>([])
    const [analyticsLoading, setAnalyticsLoading] = useState(false)

    // Crop dialog state
    const [cropDialogOpen, setCropDialogOpen] = useState(false)
    const [cropDialogProductId, setCropDialogProductId] = useState<string | null>(null)
    const [cropImageSrc, setCropImageSrc] = useState('')
    const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
    const [cropZoom, setCropZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [cropApplying, setCropApplying] = useState(false)
    const { token, user, subscription } = useAuth()
    const router = useRouter()
    const { toasts, dismiss, success: toastSuccess, error: toastError } = useToast()

    // All brand admins have access to Programs regardless of tier config
    const hasAccessToPrograms = true

    // Resolve platform fee and merchant fee from subscription API response
    useEffect(() => {
        // merchantServiceFeePercent is resolved server-side (brand override > tier default > 2%)
        // and returned as a whole number (e.g. 2 = 2%)
        const resolvedMerchant = (subscription as any)?.merchantServiceFeePercent
        if (resolvedMerchant != null) {
            setMerchantServiceFeePercent(Number(resolvedMerchant) / 100)
        }

        const tierFee = subscription?.tierConfig?.fuseFeePercent
        if (tierFee != null) {
            // fuseFeePercent is stored as a whole number (e.g. 5 = 5%), convert to decimal
            setPlatformFeePercent(Number(tierFee) / 100)
            return
        }
        if (!token) return
        fetch(`${API_URL}/config/fees`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (data?.success && data.data?.platformFeePercent != null) {
                    setPlatformFeePercent(Number(data.data.platformFeePercent) / 100)
                }
            })
            .catch(() => { /* keep default */ })
    }, [subscription, token])

    // Redirect if user doesn't have programs access
    useEffect(() => {
        // Wait for subscription to be loaded before checking access
        if (subscription !== null && !hasAccessToPrograms) {
            router.replace('/plans?message=Upgrade your plan to access Programs.')
        }
    }, [subscription, hasAccessToPrograms, router])

    useEffect(() => {
        if (hasAccessToPrograms) {
            fetchPrograms()
            fetchTemplates()
            fetchTemplateProductsMap()
        }
    }, [token, hasAccessToPrograms])

    useEffect(() => {
        setSelectedProgramIds((prev) => {
            const validIds = new Set(programs.map((p) => p.id))
            const next = new Set(Array.from(prev).filter((id) => validIds.has(id)))
            return next
        })
    }, [programs])

    // Track tutorial step for disabling buttons
    useEffect(() => {
        const checkTutorialStep = () => {
            const step = (window as any).__tutorialCurrentStep;
            setTutorialStep(step ?? null);
        };

        // Check immediately
        checkTutorialStep();

        // Poll for changes
        const interval = setInterval(checkTutorialStep, 200);

        return () => clearInterval(interval);
    }, [])

    const fetchPrograms = async () => {
        if (!token) return

        try {
            setLoading(true)
            const response = await fetch(`${API_URL}/programs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    setPrograms(data.data)
                } else {
                    setError(data.message || 'Failed to load programs')
                }
            } else {
                setError('Failed to load programs')
            }
        } catch (err) {
            console.error('Error fetching programs:', err)
            setError('Failed to load programs')
        } finally {
            setLoading(false)
        }
    }

    const fetchTemplates = async () => {
        if (!token) return

        try {
            const response = await fetch(`${API_URL}/program-templates`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    setTemplates(data.data)
                }
            }
        } catch (err) {
            console.error('Error fetching program templates:', err)
        }
    }

    const fetchTemplateProductsMap = async () => {
        if (!token) return

        try {
            const response = await fetch(`${API_URL}/questionnaires/templates/product-forms`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (!response.ok) return
            const data = await response.json()
            if (!data.success || !Array.isArray(data.data)) return

            const map: Record<string, ProgramProduct[]> = {}
            data.data.forEach((template: any) => {
                const products = (template.formProducts || [])
                    .map((fp: any) => fp?.product)
                    .filter((product: any) => !!product?.id)
                    .map((product: any) => ({
                        id: product.id,
                        name: product.name,
                        imageUrl: product.imageUrl
                    }))
                map[template.id] = products
            })

            setTemplateProductsByTemplateId(map)
        } catch (err) {
            console.error('Error fetching template product map:', err)
        }
    }

    const handleCreateFromTemplate = async (templateId: string) => {
        // Navigate to create page with templateId query param
        router.push(`/programs/create?templateId=${templateId}`)
    }

    const handleUseTemplate = async (templateId: string) => {
        try {
            const response = await fetch(`${API_URL}/programs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    templateId: templateId
                })
            })

            const data = await response.json()

            if (response.ok && data.success) {
                // Refresh programs list to show the new program
                await fetchPrograms()
                setError('✅ Program created from template successfully!')
                setTimeout(() => setError(null), 3000)

                // If tutorial is running on step 3 (Use Template), advance the tutorial
                const tutorialAdvance = (window as any).__tutorialAdvance;
                const tutorialStep = (window as any).__tutorialCurrentStep;
                if (tutorialAdvance && tutorialStep === 3) {
                    console.log('📍 Tutorial active - advancing after program creation');
                    setTimeout(() => {
                        tutorialAdvance();
                    }, 500);
                }
            } else {
                setError(data.message || 'Failed to create program from template')
            }
        } catch (err) {
            console.error('Error creating program from template:', err)
            setError('Failed to create program from template')
        }
    }

    const handleToggleProgramSelection = (programId: string) => {
        setSelectedProgramIds((prev) => {
            const next = new Set(prev)
            if (next.has(programId)) {
                next.delete(programId)
            } else {
                next.add(programId)
            }
            return next
        })
    }

    const updateProgramActiveStatus = async (programId: string, isActive: boolean) => {
        const response = await fetch(`${API_URL}/programs/${programId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isActive })
        })

        const data = await response.json()
        if (!response.ok || !data.success) {
            throw new Error(data.message || data.error || 'Failed to update program status')
        }
        return data.data
    }

    const handleBulkStatusUpdate = async (isActive: boolean) => {
        if (selectedProgramIds.size === 0 || bulkUpdating) return

        const affectedIds = Array.from(selectedProgramIds).filter((id) => {
            const p = programs.find((prog) => prog.id === id)
            return p ? p.isActive !== isActive : false
        })

        // Optimistic update — UI changes immediately
        setPrograms((prev) => prev.map((program) => affectedIds.includes(program.id) ? { ...program, isActive } : program))
        setSelectedProgramIds(new Set())

        try {
            setBulkUpdating(true)
            await Promise.all(affectedIds.map((programId) => updateProgramActiveStatus(programId, isActive)))
            toastSuccess(
                isActive
                    ? `${affectedIds.length} program${affectedIds.length > 1 ? 's' : ''} activated`
                    : `${affectedIds.length} program${affectedIds.length > 1 ? 's' : ''} deactivated`,
                'Changes saved'
            )
        } catch (err) {
            // Roll back on failure
            setPrograms((prev) => prev.map((program) => affectedIds.includes(program.id) ? { ...program, isActive: !isActive } : program))
            console.error('Error updating programs:', err)
            toastError('Failed to update one or more programs. Changes have been reverted.')
        } finally {
            setBulkUpdating(false)
        }
    }

    /** Returns true if the program is ready to go live (has custom name + at least one product fee > 0) */
    const isProgramReadyToActivate = (program: Program) => {
        const hasName = !!(program.portalDisplayName?.trim())
        const pricing = program.productPricing
        const hasPrice = pricing
            ? Object.values(pricing).some((p) => (p.nonMedicalServiceFee ?? 0) > 0)
            : (program.nonMedicalServiceFee ?? 0) > 0
        return hasName && hasPrice
    }

    const handleSingleStatusUpdate = async (programId: string, isActive: boolean) => {
        // Optimistic update — UI changes immediately
        setPrograms((prev) => prev.map((program) => program.id === programId ? { ...program, isActive } : program))

        try {
            await updateProgramActiveStatus(programId, isActive)
            toastSuccess(
                isActive ? 'Program activated' : 'Program deactivated',
                'Changes saved'
            )
        } catch (err) {
            // Roll back on failure
            setPrograms((prev) => prev.map((program) => program.id === programId ? { ...program, isActive: !isActive } : program))
            console.error('Error updating program:', err)
            toastError('Failed to update program. Changes have been reverted.')
        }
    }

    const handleToggleFeatured = async (programId: string) => {
        const program = programs.find((p) => p.id === programId)
        if (!program) return

        const currentlyFeatured = program.isFeatured ?? false
        const featuredCount = programs.filter((p) => p.isFeatured).length

        if (!currentlyFeatured && featuredCount >= 3) {
            toastError('You can only feature up to 3 programs. Unfeature one first.')
            return
        }

        const newValue = !currentlyFeatured

        // Optimistic update
        setPrograms((prev) => prev.map((p) => p.id === programId ? { ...p, isFeatured: newValue } : p))

        try {
            const response = await fetch(`${API_URL}/programs/${programId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFeatured: newValue }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) {
                setPrograms((prev) => prev.map((p) => p.id === programId ? { ...p, isFeatured: currentlyFeatured } : p))
                toastError(data.error || 'Failed to update featured status')
            } else {
                toastSuccess(newValue ? 'Program featured' : 'Program unfeatured', 'Changes saved')
            }
        } catch {
            setPrograms((prev) => prev.map((p) => p.id === programId ? { ...p, isFeatured: currentlyFeatured } : p))
            toastError('Failed to update featured status')
        }
    }

    const handleDuplicateProgram = async (program: Program) => {
        if (!token) return
        setDuplicating(program.id)
        try {
            const res = await fetch(`${API_URL}/programs/${program.id}/duplicate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Duplicate failed')
            const copy: Program = { ...data.data, medicalTemplate: program.medicalTemplate }
            setPrograms((prev) => [...prev, copy])
            toastSuccess('Program duplicated', 'Set a custom name and price to activate it.')
            openProgramModal(copy, 'program')
        } catch (err) {
            console.error(err)
            toastError('Failed to duplicate program.')
        } finally {
            setDuplicating(null)
        }
    }

    // Position 0 always defines the Top Choice — sync featured ID whenever the product order changes
    useEffect(() => {
        const newTopId = quickEditProducts[0]?.id ?? null
        if (newTopId === prevFeaturedIdRef.current) return
        // Only flash if a *different* product took the top spot (not the initial modal load)
        if (newTopId !== null && prevFeaturedIdRef.current !== null) {
            setNewlyPromotedId(newTopId)
            if (newlyPromotedTimerRef.current) clearTimeout(newlyPromotedTimerRef.current)
            newlyPromotedTimerRef.current = setTimeout(() => setNewlyPromotedId(null), 900)
        }
        prevFeaturedIdRef.current = newTopId
        setQuickEditFeaturedProductId(newTopId)
    }, [quickEditProducts])

    // FLIP animation: after each render triggered by a drag reorder, animate cards from old positions to new
    useLayoutEffect(() => {
        if (!flipPending.current) return
        flipPending.current = false
        const prev = prevTopPositions.current
        const timers: ReturnType<typeof setTimeout>[] = []
        Object.entries(cardRefs.current).forEach(([id, el]) => {
            if (!el || prev[id] === undefined) return
            const delta = prev[id] - el.getBoundingClientRect().top
            if (Math.abs(delta) < 1) return
            const dur = flipDuration.current
            el.style.transition = 'none'
            el.style.transform = `translateY(${delta}px)`
            el.getBoundingClientRect() // force reflow
            el.style.transition = `transform ${dur}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
            el.style.transform = 'translateY(0)'
            timers.push(setTimeout(() => { el.style.transition = ''; el.style.transform = '' }, dur + 10))
        })
        prevTopPositions.current = {}
        flipDuration.current = 220 // reset to default after each use
        return () => timers.forEach(clearTimeout)
    })

    const triggerReorder = (fromId: string, toId: string) => {
        // Snapshot positions before state update
        Object.entries(cardRefs.current).forEach(([id, el]) => {
            if (el) prevTopPositions.current[id] = el.getBoundingClientRect().top
        })
        flipPending.current = true
        setQuickEditProducts((prev) => {
            const next = [...prev]
            const fromIdx = next.findIndex((p) => p.id === fromId)
            const toIdx = next.findIndex((p) => p.id === toId)
            if (fromIdx === -1 || toIdx === -1) return prev
            const [item] = next.splice(fromIdx, 1)
            next.splice(toIdx, 0, item)
            return next
        })
    }

    const loadAnalyticsForModal = async (programId: string, medicalTemplateId?: string) => {
        setAnalyticsLoading(true)
        setAnalyticsEnabledForms([])
        setAnalyticsFormStepLabels([])
        try {
            let templateId = medicalTemplateId
            if (!templateId) {
                const progRes = await fetch(`${API_URL}/programs/${programId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                const progData = await progRes.json()
                templateId = progData?.data?.medicalTemplateId
            }
            if (!templateId) return
            const tRes = await fetch(`${API_URL}/questionnaires/templates/product-forms`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const tData = await tRes.json()
            const template = tData?.success && Array.isArray(tData.data)
                ? tData.data.find((t: any) => t.id === templateId)
                : null
            if (!template?.formProducts?.length) return
            const forms: { id: string; productId: string }[] = []
            for (const fp of template.formProducts) {
                if (!fp.product?.id) continue
                try {
                    const fRes = await fetch(`${API_URL}/admin/tenant-product-forms?productId=${fp.product.id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    })
                    if (fRes.ok) {
                        const fData = await fRes.json()
                        if (Array.isArray(fData?.data)) {
                            forms.push(...fData.data.map((f: any) => ({ id: f.id, productId: f.productId })))
                        }
                    }
                } catch { /* skip */ }
            }
            setAnalyticsEnabledForms(forms)
        } catch { /* show empty state */ } finally {
            setAnalyticsLoading(false)
        }
    }

    const openProgramModal = async (program: { id: string; name: string; medicalTemplateId?: string }, tab: 'program' | 'form' | 'analytics') => {
        if (!token) return
        setProgramModal({ programId: program.id, programName: program.name, medicalTemplateId: program.medicalTemplateId, tab })
        setQuickEditErrors({}) // clear validation errors on every open
        if (tab === 'analytics') loadAnalyticsForModal(program.id, program.medicalTemplateId)
        // Always initialize quick edit state so Program tab is ready
        initQuickEdit(program.id)
    }

    const switchProgramModalTab = (tab: 'program' | 'form' | 'analytics') => {
        if (!programModal) return
        setProgramModal(prev => prev ? { ...prev, tab } : null)
        if (tab === 'analytics' && analyticsEnabledForms.length === 0 && !analyticsLoading) {
            loadAnalyticsForModal(programModal.programId, programModal.medicalTemplateId)
        }
    }

    const initQuickEdit = async (programId: string) => {
        setQuickEditProgramId(programId)
        setQuickEditLoading(true)
        setQuickEditProducts([])
        setExpandedCostBreakdowns({})
        setExpandedMultiMonth({})
        setQuickEditMultiMonthPlans({})
        setQuickEditMonthlyDiscounts({})
        setQuickEditFeaturedProductId(null)
        prevFeaturedIdRef.current = null
        if (newlyPromotedTimerRef.current) clearTimeout(newlyPromotedTimerRef.current)
        setNewlyPromotedId(null)
        revokeProductImagePreviews(quickEditProductImagePreviews)
        setQuickEditProductImagePreviews({})
        setQuickEditProductImageFiles({})
        setQuickEditImageUploadProductId(null)
        setQuickEditProgramHeroImageUrl('')
        setQuickEditHideAdditionalProducts(true)

        try {
            const response = await fetch(`${API_URL}/programs/${programId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await response.json()
            if (!response.ok || !data.success || !data.data) {
                throw new Error(data.message || data.error || 'Failed to load program details')
            }

            const program = data.data
            setQuickEditName(program.name || '')
            setQuickEditPortalDisplayName(program.portalDisplayName || '')
            setQuickEditProgramHeroImageUrl(program.heroImageUrl || '')
            setQuickEditHideAdditionalProducts(program.hideAdditionalProducts ?? true)
            const medicalTemplateId = program.medicalTemplateId
            if (medicalTemplateId) {
                const templatesResponse = await fetch(`${API_URL}/questionnaires/templates/product-forms`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (templatesResponse.ok) {
                    const templatesData = await templatesResponse.json()
                    if (templatesData.success && Array.isArray(templatesData.data)) {
                        const matchingTemplate = templatesData.data.find((template: any) => template.id === medicalTemplateId)
                        const rawProducts: ProgramProduct[] = (matchingTemplate?.formProducts || [])
                            .map((fp: any) => fp?.product)
                            .filter((product: any) => !!product?.id)
                            .map((product: any) => ({
                                id: product.id,
                                name: product.name,
                                imageUrl: product.imageUrl,
                                medicationRoute: product.medicationRoute ?? product.route ?? undefined,
                                cogs: product.cogs ?? product.price ?? undefined,
                            }))
                        // Apply saved product order
                        const savedOrder = program.productOrder ?? []
                        const products = savedOrder.length
                            ? [...rawProducts].sort((a, b) => {
                                const ai = savedOrder.indexOf(a.id)
                                const bi = savedOrder.indexOf(b.id)
                                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
                            })
                            : rawProducts
                        // Auto-select first product as Top Choice if none saved
                        setQuickEditFeaturedProductId(program.featuredProductId ?? products[0]?.id ?? null)
                        setQuickEditProducts(products)
                        const existingPricing: Record<string, { nonMedicalServiceFee: number; monthlyDiscountPercent?: number; multiMonthPlans?: Array<{ months: number; discountPercent: number }> }> = program.productPricing || {}
                        const legacyFee = parseFloat(program.nonMedicalServiceFee) || 0
                        const initialFees: Record<string, number> = {}
                        const initialPlans: Record<string, Array<{ months: number; discountPercent: number }>> = {}
                        const initialMonthlyDiscounts: Record<string, number> = {}
                        const initialExpandedMultiMonth: Record<string, boolean> = {}
                        products.forEach((p) => {
                            const pricing = existingPricing[p.id]
                            initialFees[p.id] = pricing?.nonMedicalServiceFee ?? legacyFee
                            initialPlans[p.id] = pricing?.multiMonthPlans ?? []
                            initialMonthlyDiscounts[p.id] = pricing?.monthlyDiscountPercent ?? 0
                            initialExpandedMultiMonth[p.id] = (pricing?.multiMonthPlans?.length ?? 0) > 0
                        })
                        setQuickEditProductFees(initialFees)
                        setQuickEditMultiMonthPlans(initialPlans)
                        setQuickEditMonthlyDiscounts(initialMonthlyDiscounts)
                        setExpandedMultiMonth(initialExpandedMultiMonth)
                    }
                }
            }
        } catch (err) {
            console.error('Error loading quick edit data:', err)
            setError('Failed to load quick edit data')
        } finally {
            setQuickEditLoading(false)
        }
    }

    const handleSaveQuickEdit = async () => {
        if (!token || !quickEditProgramId) return

        // Client-side uniqueness check for custom name
        const newDisplayName = quickEditPortalDisplayName.trim()
        if (newDisplayName) {
            const conflict = programs.find(
                (p) => p.id !== quickEditProgramId &&
                    p.portalDisplayName?.toLowerCase() === newDisplayName.toLowerCase()
            )
            if (conflict) {
                setQuickEditErrors((prev) => ({ ...prev, name: `"${newDisplayName}" is already used by another program. Choose a different name.` }))
                return
            }
        }

        // Clear any prior errors
        setQuickEditErrors({})

        if (!quickEditName.trim()) {
            setError('Program name is required')
            return
        }

        try {
            setQuickEditSaving(true)

            const response = await fetch(`${API_URL}/programs/${quickEditProgramId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: quickEditName.trim(),
                    portalDisplayName: quickEditPortalDisplayName.trim() || null,
                    featuredProductId: quickEditFeaturedProductId ?? null,
                    productOrder: quickEditProducts.map((p) => p.id),
                    productPricing: Object.fromEntries(
                        Object.entries(quickEditProductFees).map(([id, fee]) => [
                            id,
                            {
                                                nonMedicalServiceFee: fee,
                                                                                monthlyDiscountPercent: quickEditMonthlyDiscounts[id] ?? 0,
                                                                                monthlyDiscountMonth1Only: true,
                                                                                multiMonthPlans: (quickEditMultiMonthPlans[id] ?? []).filter(p => p.months > 0),
                            },
                        ])
                    ),
                    nonMedicalServiceFee: Math.max(...Object.values(quickEditProductFees), 0),
                    hasPatientPortal: true,
                    patientPortalPrice: 0,
                    hasBmiCalculator: true,
                    bmiCalculatorPrice: 0,
                    hasProteinIntakeCalculator: true,
                    proteinIntakeCalculatorPrice: 0,
                    hasCalorieDeficitCalculator: true,
                    calorieDeficitCalculatorPrice: 0,
                    hasEasyShopping: true,
                    easyShoppingPrice: 0,
                    hideAdditionalProducts: quickEditHideAdditionalProducts,
                })
            })

            const data = await response.json()
            if (!response.ok || !data.success) {
                // Surface name uniqueness errors inline in the modal
                if (data.code === 'DUPLICATE_NAME') {
                    setQuickEditErrors((prev) => ({ ...prev, name: data.error }))
                    return
                }
                throw new Error(data.message || data.error || 'Failed to save quick edit changes')
            }

            setPrograms((prev) =>
                prev.map((program) =>
                        program.id === quickEditProgramId
                        ? {
                            ...program,
                            name: quickEditName.trim(),
                            portalDisplayName: quickEditPortalDisplayName.trim() || undefined,
                            featuredProductId: quickEditFeaturedProductId,
                            productOrder: quickEditProducts.map((p) => p.id),
                            productPricing: Object.fromEntries(
                                Object.entries(quickEditProductFees).map(([id, fee]) => [
                                    id,
                                    {
                                        nonMedicalServiceFee: fee,
                                        monthlyDiscountPercent: quickEditMonthlyDiscounts[id] ?? 0,
                                        monthlyDiscountMonth1Only: true,
                                        multiMonthPlans: (quickEditMultiMonthPlans[id] ?? []).filter(p => p.months > 0),
                                    },
                                ])
                            ),
                            nonMedicalServiceFee: Math.max(...Object.values(quickEditProductFees), 0),
                        }
                        : program
                )
            )
            // Upload pending program hero image if set
            if (quickEditProductImageFiles['__program__'] && quickEditProgramId) {
                try {
                    const heroForm = new FormData()
                    heroForm.append('image', quickEditProductImageFiles['__program__'])
                    await fetch(`${API_URL}/programs/${quickEditProgramId}/upload-image`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: heroForm,
                    })
                } catch {
                    // Non-fatal
                }
            }
            // Upload any pending product images (brand-scoped in S3 via the backend)
            const imageEntries = Object.entries(quickEditProductImageFiles).filter(([id]) => id !== '__program__')
            for (const [productId, imageFile] of imageEntries) {
                try {
                    const formData = new FormData()
                    formData.append('image', imageFile)
                    await fetch(`${API_URL}/products/${productId}/upload-image`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData,
                    })
                } catch {
                    // Non-fatal: image upload failure shouldn't block the save
                }
            }
            revokeProductImagePreviews(quickEditProductImagePreviews)
            setQuickEditProductImagePreviews({})
            setQuickEditProductImageFiles({})
            setQuickEditProgramHeroImageUrl('')
            setProgramModal(null)
            setQuickEditProgramId(null)
            setError('✅ Program updated successfully!')
            setTimeout(() => setError(null), 3000)
        } catch (err) {
            console.error('Error saving quick edit:', err)
            setError('Failed to save quick edit changes')
        } finally {
            setQuickEditSaving(false)
        }
    }

    const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml', 'application/pdf']
    const MAX_IMAGE_SIZE = 1 * 1024 * 1024 // 1 MB

    const revokeProductImagePreviews = (previews: Record<string, string>) => {
        Object.values(previews).forEach((url) => {
            if (url) URL.revokeObjectURL(url)
        })
    }

    const handleProductImageSelect = (productId: string, file: File) => {
        if (file.size > MAX_IMAGE_SIZE) {
            toastError('Image too large', `"${file.name}" is ${(file.size / 1024).toFixed(0)} KB. Max allowed is 1 MB.`)
            return
        }
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            toastError('Unsupported format', 'Allowed: PNG, JPG, WebP, GIF, AVIF, SVG.')
            return
        }
        // Load image as data URL, then open the crop dialog
        const reader = new FileReader()
        reader.onload = () => {
            setCropImageSrc(reader.result as string)
            setCropDialogProductId(productId)
            setCropPosition({ x: 0, y: 0 })
            setCropZoom(1)
            setCroppedAreaPixels(null)
            setCropDialogOpen(true)
        }
        reader.readAsDataURL(file)
    }

    const handleCropApply = async () => {
        if (!croppedAreaPixels || !cropDialogProductId || !cropImageSrc) return
        try {
            setCropApplying(true)
            const blob = await getCroppedImg(cropImageSrc, croppedAreaPixels)
            // Revoke previous preview URL to avoid memory leaks
            if (quickEditProductImagePreviews[cropDialogProductId]) {
                URL.revokeObjectURL(quickEditProductImagePreviews[cropDialogProductId])
            }
            const previewUrl = URL.createObjectURL(blob)
            const file = new File([blob], 'product-image.jpg', { type: 'image/jpeg' })
            setQuickEditProductImageFiles((prev) => ({ ...prev, [cropDialogProductId]: file }))
            setQuickEditProductImagePreviews((prev) => ({ ...prev, [cropDialogProductId]: previewUrl }))
            setCropDialogOpen(false)
            setCropImageSrc('')
            setCropDialogProductId(null)
        } catch {
            toastError('Crop failed', 'Could not process the image. Please try again.')
        } finally {
            setCropApplying(false)
        }
    }

    // Filter out templates that the brand has already used
    const unusedTemplates = templates.filter(template =>
        template.isActive && !programs.some(program => program.templateId === template.id)
    )

    // Filter programs by category + search + view
    const filteredPrograms = programs.filter(program => {
        if (categoryFilter === 'all') return true
        return inferProgramCategory(program) === categoryFilter
    }).filter(program => {
        if (!searchQuery.trim()) return true
        const query = searchQuery.toLowerCase()
        return (
            program.name.toLowerCase().includes(query) ||
            program.description?.toLowerCase().includes(query) ||
            program.medicalTemplate?.title.toLowerCase().includes(query)
        )
    }).filter(program => {
        if (programView === 'all') {
            if (statusFilter === 'active') return program.isActive
            if (statusFilter === 'inactive') return !program.isActive
            return true
        }
        if (programView === 'live') return program.isActive
        return !program.isActive
    }).sort((a, b) => {
        // In All Programs view, active programs always float to the top
        if (programView === 'all') {
            if (a.isActive && !b.isActive) return -1
            if (!a.isActive && b.isActive) return 1
        }
        return 0
    })

    const liveProgramsCount = programs.filter((p) => p.isActive).length
    const draftProgramsCount = programs.filter((p) => !p.isActive).length
    const shortlistCount = programs.filter((p) => !p.isActive).length
    const categoryCounts = {
        weight_loss: programs.filter((p) => inferProgramCategory(p) === 'weight_loss').length,
        longevity: programs.filter((p) => inferProgramCategory(p) === 'longevity').length,
        hair_loss: programs.filter((p) => inferProgramCategory(p) === 'hair_loss').length,
        ed: programs.filter((p) => inferProgramCategory(p) === 'ed').length,
        other: programs.filter((p) => inferProgramCategory(p) === 'other').length,
    }
    const visibleProgramIds = filteredPrograms.map((program) => program.id)
    const allVisibleSelected = visibleProgramIds.length > 0 && visibleProgramIds.every((id) => selectedProgramIds.has(id))

    // For Live Programs view: featured programs are pinned to the top
    const featuredPrograms = programView === 'live' ? filteredPrograms.filter((p) => p.isFeatured) : []
    const nonFeaturedPrograms = programView === 'live' ? filteredPrograms.filter((p) => !p.isFeatured) : filteredPrograms
    const featuredCount = programs.filter((p) => p.isFeatured).length

    const getProgramProducts = (program: Program): ProgramProduct[] => {
        if (!program.medicalTemplateId) return []
        return templateProductsByTemplateId[program.medicalTemplateId] || []
    }

    // Show upgrade required message if user doesn't have access
    if (subscription !== null && !hasAccessToPrograms) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center h-96 gap-6">
                    <div className="p-4 rounded-full bg-amber-100">
                        <Crown className="h-12 w-12 text-amber-600" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Upgrade Required</h2>
                        <p className="text-muted-foreground mb-4">
                            Programs feature is available on higher tier plans.
                        </p>
                        <Button onClick={() => router.push('/plans')}>
                            View Plans
                        </Button>
                    </div>
                </div>
            </Layout>
        )
    }

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading programs...</p>
                    </div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <Head>
                <title>Programs - Fuse Admin</title>
            </Head>
            <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="flex flex-col gap-6 mb-8">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h1 className="text-2xl font-semibold">Programs</h1>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Launch and manage the peptides and telehealth services your brand sells.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {templates.length > 0 && (
                                    <Button
                                        onClick={() => setShowTemplatesModal(true)}
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <FileText className="h-4 w-4" />
                                        Start from Template
                                    </Button>
                                )}
                                <Button
                                    onClick={() => setProgramView('all')}
                                    className="flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Program
                                </Button>
                            </div>
                        </div>

                        {programs.length === 0 && (
                            <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-6">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                                        <Rocket className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-lg font-semibold mb-1">Get your first program live</h2>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            This is the one place where you choose what you sell and how you price it.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                            <div className="p-3 rounded-lg border bg-card">
                                                <p className="text-xs text-muted-foreground mb-1">Step 1</p>
                                                <p className="text-sm font-medium">Choose peptides & teleform</p>
                                            </div>
                                            <div className="p-3 rounded-lg border bg-card">
                                                <p className="text-xs text-muted-foreground mb-1">Step 2</p>
                                                <p className="text-sm font-medium">Set COGS and pricing</p>
                                            </div>
                                            <div className="p-3 rounded-lg border bg-card">
                                                <p className="text-xs text-muted-foreground mb-1">Step 3</p>
                                                <p className="text-sm font-medium">Review and publish</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm text-muted-foreground">Programs are created and managed by your tenant administrator.</p>
                                            {templates.length > 0 && (
                                                <Button variant="outline" onClick={() => setShowTemplatesModal(true)}>
                                                    Use Best-Practice Template
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="rounded-xl border bg-card p-4">
                                <p className="text-xs text-muted-foreground">Total Programs</p>
                                <p className="text-2xl font-semibold mt-1">{programs.length}</p>
                            </div>
                            <div className="rounded-xl border bg-card p-4">
                                <p className="text-xs text-muted-foreground">Live Programs</p>
                                <p className="text-2xl font-semibold mt-1">{liveProgramsCount}</p>
                            </div>
                            <div className="rounded-xl border bg-card p-4">
                                <p className="text-xs text-muted-foreground">Shortlist</p>
                                <p className="text-2xl font-semibold mt-1">{draftProgramsCount}</p>
                            </div>
                            <div className="rounded-xl border bg-card p-4">
                                <p className="text-xs text-muted-foreground">Ready to Activate</p>
                                <p className="text-2xl font-semibold mt-1">{shortlistCount}</p>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div
                            className={`mb-6 p-4 border rounded-md ${error.includes('✅')
                                ? 'bg-background border-border text-foreground'
                                : 'bg-destructive/10 border-destructive/30 text-destructive text-sm'
                                }`}
                        >
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border flex flex-col lg:flex-row lg:items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by program or teleform..."
                                    className="w-full h-10 pl-9 pr-3 border border-input rounded-md bg-background text-sm"
                                />
                            </div>

                            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                                {[
                                    { key: 'live', label: 'Live Programs' },
                                    { key: 'all', label: 'All Programs' },
                                    { key: 'shortlist', label: 'Shortlist' }
                                ].map((view) => (
                                    <button
                                        key={view.key}
                                        onClick={() => setProgramView(view.key as 'all' | 'live' | 'shortlist')}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${programView === view.key
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        {view.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {programView === 'all' && (
                            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground mr-1">Status</span>
                                {([
                                    { key: 'all', label: 'All', count: programs.length },
                                    { key: 'active', label: 'Active', count: programs.filter(p => p.isActive).length },
                                    { key: 'inactive', label: 'Inactive', count: programs.filter(p => !p.isActive).length },
                                ] as { key: 'all' | 'active' | 'inactive'; label: string; count: number }[]).map((s) => (
                                    <button
                                        key={s.key}
                                        onClick={() => setStatusFilter(s.key)}
                                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${statusFilter === s.key
                                            ? s.key === 'active'
                                                ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                                                : s.key === 'inactive'
                                                    ? 'bg-slate-100 text-slate-600 shadow-sm'
                                                    : 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                        }`}
                                    >
                                        {s.label}
                                        <span className={`ml-1.5 text-xs tabular-nums opacity-60`}>{s.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                                {[
                                    { key: 'all', label: categoryLabels.all, count: programs.length },
                                    { key: 'weight_loss', label: categoryLabels.weight_loss, count: categoryCounts.weight_loss },
                                    { key: 'longevity', label: categoryLabels.longevity, count: categoryCounts.longevity },
                                    { key: 'hair_loss', label: categoryLabels.hair_loss, count: categoryCounts.hair_loss },
                                    { key: 'ed', label: categoryLabels.ed, count: categoryCounts.ed },
                                    { key: 'other', label: categoryLabels.other, count: categoryCounts.other },
                                ].map((category) => (
                                    <button
                                        key={category.key}
                                        onClick={() => setCategoryFilter(category.key as keyof typeof categoryLabels)}
                                        className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${categoryFilter === category.key
                                            ? (categoryColors[category.key]?.activeChip ?? 'bg-background text-foreground shadow-sm')
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        {category.label}
                                        <span className={`ml-1.5 text-xs tabular-nums ${categoryFilter === category.key ? 'opacity-60' : 'opacity-50'}`}>
                                            {category.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                                Showing {filteredPrograms.length} of {programs.length}
                            </span>
                            {selectedProgramIds.size > 0 && (() => {
                                const selectedPrograms = programs.filter((p) => selectedProgramIds.has(p.id))
                                const hasInactive = selectedPrograms.some((p) => !p.isActive)
                                const hasActive = selectedPrograms.some((p) => p.isActive)
                                return (
                                    <>
                                        <span className="text-sm text-muted-foreground">|</span>
                                        <span className="text-sm font-medium">{selectedProgramIds.size} selected</span>
                                        {programView === 'all' && hasInactive && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleBulkStatusUpdate(true)}
                                                disabled={bulkUpdating}
                                                className="h-8"
                                            >
                                                Activate ({selectedPrograms.filter((p) => !p.isActive).length})
                                            </Button>
                                        )}
                                        {(programView === 'all' ? hasActive : true) && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleBulkStatusUpdate(false)}
                                                disabled={bulkUpdating}
                                                className="h-8"
                                            >
                                                Deactivate ({programView === 'live' ? selectedProgramIds.size : selectedPrograms.filter((p) => p.isActive).length})
                                            </Button>
                                        )}
                                    </>
                                )
                            })()}
                        </div>

                        {filteredPrograms.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px]">
                                    <thead className="bg-muted/40">
                                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                            {(programView === 'all' || programView === 'live') && (
                                                <th className="px-4 py-3 font-medium">
                                                    <input
                                                        type="checkbox"
                                                        checked={allVisibleSelected}
                                                        onChange={() => {
                                                            setSelectedProgramIds((prev) => {
                                                                const next = new Set(prev)
                                                                if (allVisibleSelected) {
                                                                    visibleProgramIds.forEach((id) => next.delete(id))
                                                                } else {
                                                                    visibleProgramIds.forEach((id) => next.add(id))
                                                                }
                                                                return next
                                                            })
                                                        }}
                                                        className="rounded border-gray-300"
                                                        aria-label="Select all visible programs"
                                                    />
                                                </th>
                                            )}
                                            {programView === 'live'
                                                ? <th className="px-4 py-3 font-medium">Name</th>
                                                : <th className="px-4 py-3 font-medium">Program</th>
                                            }
                                            <th className="px-4 py-3 font-medium">Category</th>
                                            <th className="px-4 py-3 font-medium">Products</th>
                                            {programView !== 'live' && <th className="px-4 py-3 font-medium">Teleform</th>}
                                            {programView === 'live'
                                                ? <th className="px-4 py-3 font-medium">Program</th>
                                                : <th className="px-4 py-3 font-medium">Updated</th>
                                            }
                                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPrograms.map((program, index) => {
                                            const isFirstCardInTutorial = index === 0 && (tutorialStep === 3 || tutorialStep === 4)
                                            const products = getProgramProducts(program)

                                            return (
                                                <tr
                                                    key={program.id}
                                                    id={index === 0 ? 'first-program-card' : undefined}
                                                    data-program-index={index}
                                                    onClick={() => openProgramModal(program, 'program')}
                                                    className="group border-t border-border hover:bg-muted/40 cursor-pointer transition-colors duration-150"
                                                >
                                                    {(programView === 'all' || programView === 'live') && (
                                                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedProgramIds.has(program.id)}
                                                                onChange={() => handleToggleProgramSelection(program.id)}
                                                                className="rounded border-gray-300"
                                                                aria-label={`Select ${program.name}`}
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-4 max-w-[220px]">
                                                        {programView === 'live' ? (
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                {program.portalDisplayName ? (
                                                                    <p className="font-medium truncate">{program.portalDisplayName}</p>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground border border-dashed border-border">
                                                                        + Add website name
                                                                    </span>
                                                                )}
                                                                {!isProgramReadyToActivate(program) && (() => {
                                                                    const items: string[] = []
                                                                    if (!program.portalDisplayName?.trim()) items.push('Custom website name')
                                                                    const pricing = program.productPricing
                                                                    const hasPrice = pricing
                                                                        ? Object.values(pricing).some((p) => (p.nonMedicalServiceFee ?? 0) > 0)
                                                                        : (program.nonMedicalServiceFee ?? 0) > 0
                                                                    if (!hasPrice) items.push('Non-medical fee (at least one product)')
                                                                    return (
                                                                        <span className="relative flex-shrink-0 cursor-help group/setup-tip" onClick={(e) => e.stopPropagation()}>
                                                                            <Info className="h-3.5 w-3.5 text-red-400 group-hover/setup-tip:text-red-500 transition-colors" />
                                                                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 opacity-0 group-hover/setup-tip:opacity-100 transition-opacity duration-150 z-50">
                                                                                <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2.5 text-left">
                                                                                    <p className="text-[11px] font-semibold text-foreground mb-1.5">Not visible to patients yet</p>
                                                                                    <p className="text-[10px] text-muted-foreground mb-2">Complete the following to go live:</p>
                                                                                    <ul className="space-y-1">
                                                                                        {items.map((item) => (
                                                                                            <li key={item} className="flex items-start gap-1.5 text-[10px] text-red-500 font-medium">
                                                                                                <span className="mt-0.5 flex-shrink-0">•</span>
                                                                                                {item}
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                                <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45 mx-auto -mt-1" />
                                                                            </div>
                                                                        </span>
                                                                    )
                                                                })()}
                                                            </div>
                                                        ) : (
                                                            <p className="font-medium truncate">{program.name}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${categoryColors[inferProgramCategory(program)]?.dot ?? 'bg-slate-400'}`} />
                                                            {categoryLabels[inferProgramCategory(program)]}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {products.length > 0 ? (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                {products.slice(0, 2).map((product) => {
                                                                                    const productPrice = product.productCost ?? product.cogs
                                                                                    return (
                                                                                        <span key={product.id} className="inline-flex flex-col px-2 py-1 rounded border border-border bg-background shadow-sm">
                                                                                            <span className="text-xs text-foreground font-medium leading-snug">{product.name}</span>
                                                                                            <span className={`text-[10px] font-medium leading-none mt-0.5 flex items-center gap-1 ${
                                                                                                product.medicationRoute === 'injectable' ? 'text-blue-500/70' :
                                                                                                product.medicationRoute === 'oral' ? 'text-emerald-500/70' :
                                                                                                product.medicationRoute === 'nasal' ? 'text-violet-500/70' :
                                                                                                product.medicationRoute === 'topical' ? 'text-amber-500/70' :
                                                                                                product.medicationRoute === 'sublingual' ? 'text-pink-500/70' :
                                                                                                product.medicationRoute === 'transdermal' ? 'text-orange-500/70' :
                                                                                                'text-muted-foreground/60'
                                                                                            }`}>
                                                                                                {product.medicationRoute && (
                                                                                                    <>{product.medicationRoute.charAt(0).toUpperCase() + product.medicationRoute.slice(1)}</>
                                                                                                )}
                                                                                                {product.medicationRoute && productPrice !== undefined && (
                                                                                                    <span className="text-muted-foreground/40">·</span>
                                                                                                )}
                                                                                                {productPrice !== undefined && (
                                                                                                    <span className="text-muted-foreground/70">${productPrice.toFixed(0)}/mo</span>
                                                                                                )}
                                                                                            </span>
                                                                                        </span>
                                                                                    )
                                                                                })}
                                                                {products.length > 2 && (
                                                                    <MoreProductsTooltip products={products.slice(2)} />
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">No products linked</span>
                                                        )}
                                                    </td>
                                                    {programView !== 'live' && (
                                                        <td className="px-4 py-4 text-sm">
                                                            {program.medicalTemplate?.title || 'Not selected'}
                                                        </td>
                                                    )}
                                                    {programView === 'live' ? (
                                                        <td className="px-4 py-4 text-sm text-muted-foreground truncate max-w-[180px]">
                                                            {program.name}
                                                        </td>
                                                    ) : (
                                                        <td className="px-4 py-4 text-sm text-muted-foreground">
                                                            {new Date(program.updatedAt).toLocaleDateString()}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex justify-end items-center gap-2">
                                                            {(programView === 'all' || programView === 'shortlist') && (
                                                                program.isActive ? (
                                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                        Active
                                                                    </span>
                                                                ) : (
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleSingleStatusUpdate(program.id, true)}
                                                                        disabled={isFirstCardInTutorial}
                                                                        className="h-8"
                                                                    >
                                                                        Activate
                                                                    </Button>
                                                                )
                                                            )}

                                                            {/* Duplicate button — all views */}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={(e) => { e.stopPropagation(); handleDuplicateProgram(program) }}
                                                                disabled={duplicating === program.id || isFirstCardInTutorial}
                                                                title="Duplicate this program"
                                                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                                            >
                                                                {duplicating === program.id
                                                                    ? <span className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                                                                    : <Copy className="h-3.5 w-3.5" />
                                                                }
                                                            </Button>

                                                            {programView === 'live' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => !isFirstCardInTutorial && handleToggleFeatured(program.id)}
                                                                        title={program.isFeatured ? 'Remove from featured' : featuredCount >= 3 ? 'Max 3 featured — unfeature another first' : 'Feature this program'}
                                                                        disabled={isFirstCardInTutorial || (!program.isFeatured && featuredCount >= 3)}
                                                                        className="p-1.5 rounded hover:bg-muted transition-colors duration-150 disabled:opacity-30"
                                                                    >
                                                                        <Star className={`h-4 w-4 transition-colors ${program.isFeatured ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground hover:text-amber-400'}`} />
                                                                    </button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            if (isFirstCardInTutorial) return
                                                                            openProgramModal(program, 'form')
                                                                        }}
                                                                        disabled={isFirstCardInTutorial}
                                                                        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
                                                                        title="Form Structure"
                                                                    >
                                                                        <FileText className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            if (isFirstCardInTutorial) return
                                                                            openProgramModal(program, 'analytics')
                                                                        }}
                                                                        disabled={isFirstCardInTutorial}
                                                                        className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-150"
                                                                        title="View Analytics"
                                                                    >
                                                                        <BarChart3 className="h-3 w-3" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-16 text-center">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                                    <Filter className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-base font-medium mb-1">No programs match these filters</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Clear a filter or create a new program.
                                </p>
                                <div className="flex items-center justify-center gap-2">
                                    <Button
                                        onClick={() => {
                                            setProgramView('all')
                                            setSearchQuery('')
                                            setCategoryFilter('all')
                                            setSelectedProgramIds(new Set())
                                        }}
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <X className="h-4 w-4" />
                                        Clear Filters
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {unusedTemplates.length > 0 && (
                        <div className="mt-10">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold">Catalog Opportunities</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Add additional products and services quickly with these templates.
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {unusedTemplates.map((template, index) => (
                                    <div
                                        key={template.id}
                                        id={index === 0 ? 'first-program-template' : undefined}
                                        className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl shadow-sm border-2 border-dashed border-purple-200 dark:border-purple-800 p-6 hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                                                    <FileText className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-lg font-semibold">{template.name}</h3>
                                                        <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                                                            Template
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {template.description && (
                                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                                {template.description}
                                            </p>
                                        )}

                                        {template.medicalTemplate && (
                                            <div className="mb-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <FileText className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-xs font-medium text-muted-foreground">Teleform</span>
                                                </div>
                                                <p className="text-sm font-medium">{template.medicalTemplate.title}</p>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 pt-4 border-t border-purple-200 dark:border-purple-800">
                                            <Button
                                                size="sm"
                                                onClick={() => handleUseTemplate(template.id)}
                                                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Use Template
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    if (index === 0 && tutorialStep === 3) {
                                                        e.stopPropagation()
                                                        return
                                                    }
                                                    handleCreateFromTemplate(template.id)
                                                }}
                                                disabled={index === 0 && tutorialStep === 3}
                                                className="border-purple-200 dark:border-purple-800"
                                            >
                                                <Edit className="h-3 w-3 mr-1" />
                                                Customize
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Unified Program Modal (Program · Form Structure · Analytics) ── */}
                    {programModal && (
                        <div
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                            onClick={() => setProgramModal(null)}
                        >
                            <div
                                className="w-full max-w-2xl h-[85vh] bg-card rounded-2xl shadow-2xl ring-1 ring-black/10 overflow-hidden flex flex-col"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold text-foreground truncate max-w-[240px]">{quickEditPortalDisplayName.trim() || programModal.programName}</span>
                                        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                                            {([
                                                { id: 'program', label: 'Program', icon: <Settings className="h-3 w-3" /> },
                                                { id: 'form', label: 'Form Structure', icon: <FileText className="h-3 w-3" /> },
                                                { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-3 w-3" /> },
                                            ] as const).map(({ id, label, icon }) => (
                                                <button
                                                    key={id}
                                                    onClick={() => switchProgramModalTab(id)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                                                        programModal.tab === id
                                                            ? 'bg-background shadow-sm text-foreground'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                >
                                                    {icon}
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={() => setProgramModal(null)} className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0">
                                        <X className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                </div>

                                {/* Tab: Program */}
                                {programModal.tab === 'program' && (
                                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">

                                {/* Custom Website Name — hero section */}
                                {!quickEditLoading && (() => {
                                    // Always read from position 0 — no useEffect timing delay
                                    const topChoiceProduct = quickEditProducts[0]
                                    const topChoicePreview = topChoiceProduct ? quickEditProductImagePreviews[topChoiceProduct.id] : undefined
                                    const hasCustomImage = !!(quickEditProductImagePreviews['__program__'] || quickEditProgramHeroImageUrl)
                                    const programDisplayImageUrl = quickEditProductImagePreviews['__program__'] || quickEditProgramHeroImageUrl || topChoicePreview || topChoiceProduct?.imageUrl || ''
                                    return (
                                        <div className="px-6 py-5 bg-gradient-to-b from-muted/40 to-card shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] border-b border-border/60">
                                            <div className="flex items-start gap-4">
                                                {/* Program hero image — hover to upload */}
                                                <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        title="Click to set a custom program hero image"
                                                        onClick={() => quickEditProgramFileInputRef.current?.click()}
                                                        className="relative w-16 h-16 rounded-xl flex-shrink-0 group/pgimg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                    >
                                                        {programDisplayImageUrl ? (
                                                            <img
                                                                src={programDisplayImageUrl}
                                                                alt="Program image"
                                                                className="w-16 h-16 rounded-xl object-cover border-2 border-border"
                                                            />
                                                        ) : (
                                                            <div className="w-16 h-16 rounded-xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center gap-1">
                                                                <Upload className="h-4 w-4 text-muted-foreground/40" />
                                                                <span className="text-[8px] font-medium text-muted-foreground/40 text-center leading-tight uppercase tracking-wide">Program<br/>Image</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 rounded-xl bg-black/55 opacity-0 group-hover/pgimg:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
                                                            <Upload className="h-3.5 w-3.5 text-white" />
                                                            <span className="text-[9px] font-bold text-white/90 uppercase tracking-wide">Edit</span>
                                                        </div>
                                                    </button>
                                                    {/* Source indicator badge below image */}
                                                    {programDisplayImageUrl && (
                                                        <span className={`text-[8px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${hasCustomImage ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-muted border-border text-muted-foreground/50'}`}>
                                                            {hasCustomImage ? 'Custom' : 'Auto'}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Name label + input */}
                                                <div className="flex-1 min-w-0 space-y-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-sm font-semibold text-foreground">
                                                            Custom Website Name
                                                        </label>
                                                    </div>
                                                    <input
                                                        value={quickEditPortalDisplayName}
                                                        onChange={(e) => {
                                                            setQuickEditPortalDisplayName(e.target.value)
                                                            if (quickEditErrors.name) setQuickEditErrors((prev) => ({ ...prev, name: undefined }))
                                                        }}
                                                        className={`w-full h-11 px-3.5 border-2 rounded-lg bg-background text-sm font-medium outline-none focus:ring-2 transition-all duration-150 placeholder:text-muted-foreground/35 ${
                                                            quickEditErrors.name
                                                                ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                                                                : 'border-violet-300/60 focus:border-violet-500 focus:ring-violet-100'
                                                        }`}
                                                        placeholder="e.g. Lose Weight Fast with GLP-1"
                                                        autoFocus
                                                    />
                                                    {quickEditErrors.name && (
                                                        <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                                                            <span>⚠</span> {quickEditErrors.name}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-3">
                                                        <p className="text-[11px] text-muted-foreground/50 leading-none flex-1 min-w-0 truncate">
                                                            Internal: <span className="text-muted-foreground/70">{quickEditName}</span>
                                                        </p>
                                                        {hasCustomImage && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (quickEditProductImagePreviews['__program__']) {
                                                                        URL.revokeObjectURL(quickEditProductImagePreviews['__program__'])
                                                                        setQuickEditProductImagePreviews((prev) => { const n = { ...prev }; delete n['__program__']; return n })
                                                                        setQuickEditProductImageFiles((prev) => { const n = { ...prev }; delete n['__program__']; return n })
                                                                    }
                                                                    setQuickEditProgramHeroImageUrl('')
                                                                }}
                                                                className="flex-shrink-0 text-[10px] text-muted-foreground/40 hover:text-destructive transition-colors"
                                                            >
                                                                Reset to auto
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Hidden file input for program hero image */}
                                            <input
                                                ref={quickEditProgramFileInputRef}
                                                type="file"
                                                className="hidden"
                                                accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleProductImageSelect('__program__', file)
                                                    e.target.value = ''
                                                }}
                                            />
                                        </div>
                                    )
                                })()}

                                <div className="p-6 space-y-6 flex-1">
                                    {quickEditLoading ? (
                                        <div className="py-16 text-center">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                            <p className="text-sm text-muted-foreground">Loading program details...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                {/* Patient intake display toggle — above section header */}
                                                {quickEditProducts.length > 1 && (
                                                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 border border-border/50 mb-4">
                                                        <span className="text-[11px] text-muted-foreground">How patients see these products</span>
                                                        <div className="flex items-center gap-1 bg-background rounded-md p-0.5 border border-border/60 shadow-sm">
                                                            <button
                                                                type="button"
                                                                onClick={() => setQuickEditHideAdditionalProducts(false)}
                                                                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-150 ${!quickEditHideAdditionalProducts ? 'bg-background text-foreground shadow-md ring-2 ring-border/60' : 'text-muted-foreground hover:text-foreground'}`}
                                                            >
                                                                View all options
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setQuickEditHideAdditionalProducts(true)}
                                                                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-150 ${quickEditHideAdditionalProducts ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                            >
                                                                Highlight main option
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Section header */}
                                                <div className="mb-4">
                                                    <h3 className="text-sm font-semibold">Product Pricing</h3>
                                                    {quickEditErrors.price && (
                                                        <p className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-1">
                                                            <span>⚠</span> {quickEditErrors.price}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground mt-0.5">Set your monthly fee. We'll show the patient price and your estimated profit.</p>
                                                </div>

                                                {quickEditProducts.length > 0 ? (() => {
                                                    // In "top-choice-first" mode, the featured product is always displayed first,
                                                    // followed by an "Additional options" divider, then the remaining products.
                                                    const featuredFirst = quickEditHideAdditionalProducts
                                                        ? [
                                                            ...quickEditProducts.filter(p => p.id === quickEditFeaturedProductId),
                                                            ...quickEditProducts.filter(p => p.id !== quickEditFeaturedProductId),
                                                          ]
                                                        : quickEditProducts
                                                    return (
                                                    <div className="space-y-3">
                                                        {featuredFirst.map((product, productIndex) => {
                                                        // Insert the "Additional options" divider before the second product in top-choice-first mode
                                                        const showDivider = quickEditHideAdditionalProducts && productIndex === 1 && featuredFirst.length > 1
                                                            const fee = quickEditProductFees[product.id] ?? 0
                                                            const monthlyDiscount = quickEditMonthlyDiscounts[product.id] ?? 0
                                                            const totalCost = computeCogs(product)
                                                            const patientTotal = (totalCost ?? 0) + fee
                                                            const platformFee = Math.round(fee * platformFeePercent * 100) / 100
                                                            const stripeFeeMonthly = Math.round((patientTotal * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED) * 100) / 100
                                                            const telehealthCost = product.telehealthCost ?? 0
                                                            const recurringProfit = Math.round((fee - platformFee - stripeFeeMonthly) * 100) / 100
                                                            const month1Profit = Math.round((fee - platformFee - telehealthCost - stripeFeeMonthly) * 100) / 100
                                                            const hasCost = totalCost !== undefined
                                                            // Monthly discount cap: ensure mo 1 profit > $0 after platform fee
                                                            const minFeeRequired = telehealthCost > 0
                                                                ? (telehealthCost / (1 - platformFeePercent)) + 0.01
                                                                : 0.01
                                                            const maxDiscountPercent = patientTotal > 0 && fee > minFeeRequired
                                                                ? Math.max(0, Math.floor(((fee - minFeeRequired) / patientTotal) * 10000) / 100)
                                                                : 0
                                                            const clampedMonthlyDiscount = Math.min(monthlyDiscount, maxDiscountPercent)
                                                            const discountedMonthlyTotal = patientTotal * (1 - clampedMonthlyDiscount / 100)
                                                            const discountedMonthlyFee = Math.max(0, discountedMonthlyTotal - (totalCost ?? 0))
                                                            const discountedMonthlyPlatformFee = Math.round(discountedMonthlyFee * platformFeePercent * 100) / 100
                                                            const discountedMonthlyStripeFee = Math.round((discountedMonthlyTotal * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED) * 100) / 100
                                                            // Mo 1: discounted profit; ongoing: full recurring profit
                                                            const discountedMonth1Profit = Math.round((discountedMonthlyFee - discountedMonthlyPlatformFee - telehealthCost - discountedMonthlyStripeFee) * 100) / 100

                                                            return (
                                                                        <>
                                                                        {/* Additional options separator */}
                                                                        {showDivider && (
                                                                            <div className="relative pt-5 pb-1">
                                                                                {/* Shadow that visually "closes" the top-choice section above */}
                                                                                <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-muted/50 to-transparent pointer-events-none" />
                                                                                <div className="flex items-center gap-3">
                                                                                    <h3 className="text-sm font-semibold text-foreground/70">Additional hidden options</h3>
                                                                                    <div className="flex-1 h-px bg-border" />
                                                                                </div>
                                                                                <p className="text-xs text-muted-foreground mt-1.5">Hidden behind a toggle on the intake form until the patient asks to see more.</p>
                                                                            </div>
                                                                        )}
                                                                        <div
                                                                            key={product.id}
                                                                            ref={(el) => { cardRefs.current[product.id] = el }}
                                                                            className={`flex flex-col transition-opacity duration-75 ${quickEditHideAdditionalProducts && product.id !== quickEditFeaturedProductId ? 'opacity-60 hover:opacity-100' : ''}`}
                                                                            onPointerEnter={() => {
                                                                                if (!draggingIdRef.current || draggingIdRef.current === product.id) return
                                                                                triggerReorder(draggingIdRef.current, product.id)
                                                                            }}
                                                                        >
                                                                        <div className={`group border rounded-xl overflow-hidden bg-card transition-all duration-300 ${draggingId === product.id ? 'border-violet-300/60 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.18)] ring-2 ring-violet-400/25 scale-[1.008]' : newlyPromotedId === product.id ? 'border-amber-300/70 shadow-[0_0_0_3px_rgba(251,191,36,0.25)] ring-0' : quickEditFeaturedProductId === product.id ? 'border-amber-200/40 shadow-[0_0_0_2px_rgba(251,191,36,0.08),0_1px_4px_rgba(0,0,0,0.04)]' : 'border-border shadow-sm hover:shadow-md hover:border-border/80'}`}>
                                                                            {/* Product header */}
                                                                            <div className={`flex items-center gap-3 px-4 py-3 border-b transition-colors ${quickEditFeaturedProductId === product.id ? 'bg-muted/10 border-b-border' : 'bg-muted/10 border-b-border'}`}>
                                                                                {/* Drag handle */}
                                                                                <div
                                                                                    className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors -ml-1 select-none"
                                                                                    onPointerDown={(e) => {
                                                                                        e.preventDefault()
                                                                                        draggingIdRef.current = product.id
                                                                                        setDraggingId(product.id)
                                                                                        document.body.style.cursor = 'grabbing'
                                                                                        const handlePointerUp = () => {
                                                                                            draggingIdRef.current = null
                                                                                            setDraggingId(null)
                                                                                            document.body.style.cursor = ''
                                                                                            document.removeEventListener('pointerup', handlePointerUp)
                                                                                        }
                                                                                        document.addEventListener('pointerup', handlePointerUp)
                                                                                    }}
                                                                                >
                                                                                    <GripVertical className="h-4 w-4" />
                                                                                </div>
                                                                                {/* Clickable image thumbnail — click to upload */}
                                                                                <button
                                                                                    type="button"
                                                                                    title="Click to upload product image"
                                                                                    onClick={() => {
                                                                                        setQuickEditImageUploadProductId(product.id)
                                                                                        quickEditFileInputRef.current?.click()
                                                                                    }}
                                                                                    className="relative w-8 h-8 rounded-md flex-shrink-0 group/img focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                                                >
                                                                                    {(quickEditProductImagePreviews[product.id] || product.imageUrl) ? (
                                                                                        <img
                                                                                            src={quickEditProductImagePreviews[product.id] || product.imageUrl}
                                                                                            alt={product.name}
                                                                                            className="w-8 h-8 rounded-md object-cover border border-border"
                                                                                        />
                                                                                    ) : (
                                                                                        <div className="w-8 h-8 rounded-md bg-muted border border-dashed border-border flex items-center justify-center">
                                                                                            <Upload className="h-3 w-3 text-muted-foreground/50" />
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="absolute inset-0 rounded-md bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                                        <Upload className="h-3 w-3 text-white" />
                                                                                    </div>
                                                                                </button>
                                                                                <div className="flex flex-col flex-1 min-w-0">
                                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                                        <span className="text-sm font-semibold truncate">{product.name}</span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setQuickEditImageUploadProductId(product.id)
                                                                                                quickEditFileInputRef.current?.click()
                                                                                            }}
                                                                                            className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground/50 hover:text-primary transition-colors cursor-pointer"
                                                                                            title="Upload product image (PNG, JPG, WebP, GIF, AVIF, SVG, PDF · max 1 MB)"
                                                                                        >
                                                                                            <Upload className="h-2.5 w-2.5" />
                                                                                            {quickEditProductImageFiles[product.id]
                                                                                                ? <span className="max-w-[80px] truncate text-primary/70">{quickEditProductImageFiles[product.id].name}</span>
                                                                                                : 'Upload image'
                                                                                            }
                                                                                        </button>
                                                                                        {quickEditProductImageFiles[product.id] && (
                                                                                            <button
                                                                                                type="button"
                                                                                                title="Remove uploaded image"
                                                                                                onClick={() => {
                                                                                                    if (quickEditProductImagePreviews[product.id]) {
                                                                                                        URL.revokeObjectURL(quickEditProductImagePreviews[product.id])
                                                                                                    }
                                                                                                    setQuickEditProductImageFiles((prev) => { const n = { ...prev }; delete n[product.id]; return n })
                                                                                                    setQuickEditProductImagePreviews((prev) => { const n = { ...prev }; delete n[product.id]; return n })
                                                                                                }}
                                                                                                className="flex-shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
                                                                                            >
                                                                                                <X className="h-2.5 w-2.5" />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                    {(product.medicationRoute || product.productCost !== undefined || product.cogs !== undefined) && (() => {
                                                                                        const productPrice = product.productCost ?? product.cogs
                                                                                        return (
                                                                                            <span className={`text-[10px] font-medium leading-none mt-0.5 flex items-center gap-1 ${
                                                                                                product.medicationRoute === 'injectable' ? 'text-blue-500/70' :
                                                                                                product.medicationRoute === 'oral' ? 'text-emerald-500/70' :
                                                                                                product.medicationRoute === 'nasal' ? 'text-violet-500/70' :
                                                                                                product.medicationRoute === 'topical' ? 'text-amber-500/70' :
                                                                                                product.medicationRoute === 'sublingual' ? 'text-pink-500/70' :
                                                                                                product.medicationRoute === 'transdermal' ? 'text-orange-500/70' :
                                                                                                'text-muted-foreground/60'
                                                                                            }`}>
                                                                                                {product.medicationRoute && (
                                                                                                    <>{product.medicationRoute.charAt(0).toUpperCase() + product.medicationRoute.slice(1)}</>
                                                                                                )}
                                                                                                {product.medicationRoute && productPrice !== undefined && (
                                                                                                    <span className="text-muted-foreground/40">·</span>
                                                                                                )}
                                                                                                {productPrice !== undefined && (
                                                                                                    <span className="text-muted-foreground/70">${productPrice.toFixed(0)}/mo</span>
                                                                                                )}
                                                                                            </span>
                                                                                        )
                                                                                    })()}
                                                                                </div>
                                                                                {/* Monthly / Multi-month toggle */}
                                                                                <div className="flex-shrink-0 flex items-center bg-muted rounded-lg p-0.5 text-[10px] font-medium">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setExpandedMultiMonth((prev) => ({ ...prev, [product.id]: false }))}
                                                                                        className={`px-2 py-1 rounded-md transition-all duration-150 ${!expandedMultiMonth[product.id] ? 'bg-background text-foreground shadow-md ring-2 ring-border/60' : 'text-muted-foreground hover:text-foreground'}`}
                                                                                    >
                                                                                        Standard
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setExpandedMultiMonth((prev) => ({ ...prev, [product.id]: true }))
                                                                                            setQuickEditMultiMonthPlans((prev) => {
                                                                                                const existing = prev[product.id] ?? []
                                                                                                if (existing.length === 0) {
                                                                                                    return { ...prev, [product.id]: [{ months: 3, discountPercent: 0 }] }
                                                                                                }
                                                                                                return prev
                                                                                            })
                                                                                        }}
                                                                                        className={`px-2 py-1 rounded-md transition-all duration-150 ${expandedMultiMonth[product.id] ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                                                    >
                                                                                        Custom
                                                                                    </button>
                                                                                </div>

                                                                                {/* Top Choice selector */}
                                                                                {(() => {
                                                                                    const isFeatured = quickEditFeaturedProductId === product.id
                                                                                    return (
                                                                                        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                                                                                            <button
                                                                                                type="button"
                                                                                                title={isFeatured ? 'Main Option — select another product to change' : 'Set as Main Option: this product is recommended at the end of the intake form and its image represents the entire program'}
                                                                                                onClick={() => {
                                                                                                    if (isFeatured) {
                                                                                                        // Block deselection — show error instead
                                                                                                        if (topChoiceErrorTimer.current) clearTimeout(topChoiceErrorTimer.current)
                                                                                                        setTopChoiceError(true)
                                                                                                        topChoiceErrorTimer.current = setTimeout(() => setTopChoiceError(false), 3000)
                                                                                    } else {
                                                                                        setTopChoiceError(false)
                                                                                        if (topChoiceErrorTimer.current) clearTimeout(topChoiceErrorTimer.current)
                                                                                        // Snapshot positions — use a longer, more deliberate animation for this intentional action
                                                                                        Object.entries(cardRefs.current).forEach(([id, el]) => {
                                                                                            if (el) prevTopPositions.current[id] = el.getBoundingClientRect().top
                                                                                        })
                                                                                        flipDuration.current = 380
                                                                                        flipPending.current = true
                                                                                        setQuickEditProducts((prev) => {
                                                                                            const idx = prev.findIndex((p) => p.id === product.id)
                                                                                            if (idx <= 0) return prev
                                                                                            const next = [...prev]
                                                                                            const [item] = next.splice(idx, 1)
                                                                                            next.unshift(item)
                                                                                            return next
                                                                                        })
                                                                                    }
                                                                                                }}
                                                                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all duration-150 ${
                                                                                                    isFeatured
                                                                                                        ? topChoiceError
                                                                                                            ? 'bg-red-50 border border-red-300 text-red-600 shadow-sm animate-[wiggle_0.3s_ease-in-out]'
                                                                                                            : 'bg-amber-50 border border-amber-300 text-amber-600 shadow-sm'
                                                                                                        : 'text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-50/60 border border-transparent'
                                                                                                }`}
                                                                                            >
                                                                                                {isFeatured ? <span>{topChoiceError ? 'Main Option' : 'Main Option'}</span> : <Star className="h-3 w-3" />}
                                                                                            </button>
                                                                                            {isFeatured && topChoiceError && (
                                                                                                <span className="text-[9px] text-red-500 font-medium leading-none whitespace-nowrap">
                                                                                                    Pick another first
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    )
                                                                                })()}
                                                                            </div>

                                                                            {/* Fee + stats */}
                                                                            <div className="px-4 pt-4 pb-3 space-y-3">
                                                                                {/* Fee input — large hero (monthly mode) or compact row (multi-month mode) */}
                                                                                <div className="space-y-1.5">
                                                                                    {!expandedMultiMonth[product.id] ? (
                                                                                        /* Standard mode: compact violet fee row + stat row */
                                                                                        <>
                                                                            <div className="flex items-end gap-2 bg-muted/40 border border-border/60 rounded-lg px-2.5 py-1.5">
                                                                                <div className="flex-1 flex items-end gap-2 min-w-0">
                                                                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide flex-shrink-0 h-7 flex items-center">Monthly</span>
                                                                                <div className="flex flex-col flex-shrink-0">
                                                                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold leading-none mb-0.5">
                                                                                        Non-medical fee
                                                                                        <InfoTooltip text="Per telehealth regulations, brands may only charge for non-medical services. This fee covers: Patient Portal, BMI Calculator, Protein Intake Calculator, Calorie Deficit Calculator, and Easy Shopping." />
                                                                                    </span>
                                                                                    <div className="relative w-28">
                                                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-violet-400 text-xs font-medium">$</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            min="0"
                                                                                            step="0.01"
                                                                                            value={fee === 0 ? '' : fee}
                                                                                            onChange={(e) => {
                                                                                                const val = parseFloat(e.target.value) || 0
                                                                                                setQuickEditProductFees((prev) => ({ ...prev, [product.id]: val }))
                                                                                                if (val > 0 && quickEditErrors.price) setQuickEditErrors((prev) => ({ ...prev, price: undefined }))
                                                                                            }}
                                                                                            className="w-full h-7 pl-5 pr-2 text-xs font-semibold border-2 border-violet-300/60 rounded-md bg-background outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all duration-150"
                                                                                            placeholder="0.00"
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                                </div>
                                                                                <div className="h-8 w-px bg-violet-200/50 flex-shrink-0 mx-3 self-end mb-0.5" />
                                                                                {/* Stats */}
                                                                                <div className="flex items-end gap-6 flex-shrink-0">
                                                                                                    <div className="flex flex-col min-w-[96px]">
                                                                                                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground leading-none mb-0.5">
                                                                                                            Customer pays
                                                                                                            <InfoTooltip
                                                                                                                text="Estimated based on the selected plan. Actual cost may vary depending on the patient's state, the type of telehealth consultation required, and what their licensed provider prescribes."
                                                                                                                subtext="All prescribing decisions are made solely by the treating physician."
                                                                                                            />
                                                                                                        </span>
                                                                                                        <span className="text-xs font-semibold text-foreground leading-none h-7 flex items-center">${hasCost ? patientTotal.toFixed(2) : fee.toFixed(2)}/mo</span>
                                                                                                    </div>
                                                                                                    <div className="flex flex-col min-w-[110px]">
                                                                                                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground leading-none mb-0.5">
                                                                                                            Your profit
                                                                                                            <InfoTooltip
                                                                                                                text="This is an estimate. Actual profit can vary based on state telehealth laws, pharmacy availability, and shipping costs by region."
                                                                                                                subtext="Month 1 typically includes a telehealth consultation fee. Future months may or may not require a new consult depending on prescription length, clinical judgment, and state telehealth laws, so profits can vary throughout the program."
                                                                                                            />
                                                                                                        </span>
                                                                                                        <span className="text-xs font-semibold text-emerald-600 leading-none h-7 flex items-center">
                                                                                                            ≈ ${recurringProfit.toFixed(2)}/mo
                                                                                                            {telehealthCost > 0 && <span className="text-[10px] font-normal text-muted-foreground ml-1">(≈ ${month1Profit.toFixed(2)} mo 1)</span>}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </>
                                                                                    ) : (
                                                                                        /* Multi-month mode: compact fee row in same style as pre-pay rows */
                                                                                        <>
                                                                                        <div className="flex items-end gap-2 bg-muted/40 border border-border/60 rounded-lg px-2.5 py-1.5">
                                                                                            <div className="flex-1 flex items-end gap-2 min-w-0">
                                                                                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide flex-shrink-0 h-7 flex items-center">Monthly</span>
                                                                                            <div className="flex flex-col flex-shrink-0">
                                                                                                <span className="text-[10px] text-muted-foreground font-semibold leading-none mb-0.5">Non-medical fee</span>
                                                                                                <div className="relative w-20">
                                                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-violet-400 text-xs font-medium">$</span>
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        min="0"
                                                                                                        step="0.01"
                                                                                                        value={fee === 0 ? '' : fee}
                                                                                                        onChange={(e) => {
                                                                                                            const val = parseFloat(e.target.value) || 0
                                                                                                            setQuickEditProductFees((prev) => ({ ...prev, [product.id]: val }))
                                                                                                        }}
                                                                                                        className="w-full h-7 pl-5 pr-2 text-xs font-semibold border-2 border-violet-300/60 rounded-md bg-background outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all duration-150"
                                                                                                        placeholder="0.00"
                                                                                                    />
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex flex-col flex-shrink-0">
                                                                                                <span className="text-[10px] text-muted-foreground leading-none mb-0.5">Mo 1 discount</span>
                                                                                                <div className="relative w-16">
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        min="0"
                                                                                                        max={maxDiscountPercent}
                                                                                                        step="1"
                                                                                                        value={monthlyDiscount === 0 ? '' : monthlyDiscount}
                                                                                                        onChange={(e) => {
                                                                                                            const raw = parseFloat(e.target.value) || 0
                                                                                                            const val = Math.min(raw, maxDiscountPercent)
                                                                                                            setQuickEditMonthlyDiscounts((prev) => ({ ...prev, [product.id]: val }))
                                                                                                        }}
                                                                                                        placeholder="0"
                                                                                                        className={`w-full h-7 pl-2 pr-5 text-xs font-medium border rounded-md bg-background outline-none transition-colors ${monthlyDiscount >= maxDiscountPercent && monthlyDiscount > 0 ? 'border-amber-400 focus:border-amber-500' : 'border-input focus:border-violet-400'}`}
                                                                                                    />
                                                                                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                                                                                                </div>
                                                                                                {monthlyDiscount >= maxDiscountPercent && monthlyDiscount > 0 && (
                                                                                                    <span className="text-[9px] text-amber-500 leading-none mt-0.5">Max</span>
                                                                                                )}
                                                                                            </div>
                                                                                            </div>
                                                                                            <div className="h-8 w-px bg-border/40 flex-shrink-0 mx-3 self-end mb-0.5" />
                                                                                            {/* Stats */}
                                                                                            <div className="flex items-end gap-6 flex-shrink-0">
                                                                                                <div className="flex flex-col min-w-[96px]">
                                                                                                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground leading-none mb-0.5">
                                                                                                        Customer pays
                                                                                                        <InfoTooltip
                                                                                                            text="Estimated based on the selected plan. Actual cost may vary depending on the patient's state, the type of telehealth consultation required, and what their licensed provider prescribes."
                                                                                                            subtext="All prescribing decisions are made solely by the treating physician."
                                                                                                        />
                                                                                                    </span>
                                                                                                    {clampedMonthlyDiscount > 0 ? (
                                                                                                        <div className="h-7 flex flex-col justify-center leading-tight">
                                                                                                            <span className="text-xs font-semibold text-foreground">${(hasCost ? discountedMonthlyTotal : discountedMonthlyFee).toFixed(2)} <span className="text-[9px] font-normal text-amber-500">mo 1</span></span>
                                                                                                            <span className="text-[10px] text-muted-foreground">${(hasCost ? patientTotal : fee).toFixed(2)}/mo after</span>
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <span className="text-xs font-semibold text-foreground leading-none h-7 flex items-center">${(hasCost ? patientTotal : fee).toFixed(2)}/mo</span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <div className="flex flex-col min-w-[110px]">
                                                                                                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground leading-none mb-0.5">
                                                                                                        Your profit
                                                                                                        <InfoTooltip
                                                                                                            text="This is an estimate. Actual profit can vary based on state telehealth laws, pharmacy availability, and shipping costs by region."
                                                                                                            subtext="Month 1 typically includes a telehealth consultation fee. Future months may or may not require a new consult depending on prescription length, clinical judgment, and state telehealth laws, so profits can vary throughout the program."
                                                                                                        />
                                                                                                    </span>
                                                                                                    {clampedMonthlyDiscount > 0 ? (
                                                                                                        <div className="h-7 flex flex-col justify-center leading-tight">
                                                                                                            <span className="text-xs font-semibold text-emerald-600">≈ ${discountedMonth1Profit.toFixed(2)} <span className="text-[9px] font-normal text-amber-500">mo 1</span></span>
                                                                                                            <span className="text-[10px] text-muted-foreground">≈ ${recurringProfit.toFixed(2)}/mo after</span>
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <span className="text-xs font-semibold text-emerald-600 leading-none h-7 flex items-center">
                                                                                                            ≈ ${recurringProfit.toFixed(2)}/mo
                                                                                                            {telehealthCost > 0 && <span className="text-[10px] font-normal text-muted-foreground ml-1">(≈ ${month1Profit.toFixed(2)} mo 1)</span>}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                        </>
                                                                                    )}
                                                                                </div>

                                                                                {expandedMultiMonth[product.id] && (() => {
                                                                                    const plans = quickEditMultiMonthPlans[product.id] ?? []
                                                                                    const updatePlan = (index: number, field: 'months' | 'discountPercent', value: number) => {
                                                                                        setQuickEditMultiMonthPlans((prev) => {
                                                                                            const updated = [...(prev[product.id] ?? [])]
                                                                                            updated[index] = { ...updated[index], [field]: value }
                                                                                            return { ...prev, [product.id]: updated }
                                                                                        })
                                                                                    }
                                                                                    const removePlan = (index: number) => {
                                                                                        setQuickEditMultiMonthPlans((prev) => {
                                                                                            const updated = [...(prev[product.id] ?? [])]
                                                                                            updated.splice(index, 1)
                                                                                            if (updated.length === 0) setExpandedMultiMonth((prev2) => ({ ...prev2, [product.id]: false }))
                                                                                            return { ...prev, [product.id]: updated }
                                                                                        })
                                                                                    }
                                                                                    const addPlan = () => {
                                                                                        setQuickEditMultiMonthPlans((prev) => ({
                                                                                            ...prev,
                                                                                            [product.id]: [...(prev[product.id] ?? []), { months: 6, discountPercent: 0 }]
                                                                                        }))
                                                                                    }
                                                                                    return (
                                                                                        <div className="mt-2 space-y-1.5">
                                                                                            {plans.map((plan, index) => {
                                                                                                const clampedPlanDiscount = Math.min(plan.discountPercent, maxDiscountPercent)
                                                                                                const discountedMonthlyTotal = (fee + (totalCost ?? 0)) * (1 - clampedPlanDiscount / 100)
                                                                                                const customerPaysUpfront = discountedMonthlyTotal * plan.months
                                                                                                const effectiveFee = Math.max(0, discountedMonthlyTotal - (totalCost ?? 0))
                                                                                                const profitTotal = Math.max(0, effectiveFee * (1 - platformFeePercent)) * plan.months
                                                                                                const atPlanMax = plan.discountPercent >= maxDiscountPercent && plan.discountPercent > 0
                                                                                                return (
                                                                                                    <div key={index} className="relative flex items-end gap-2 bg-muted/30 border border-border/50 rounded-lg px-2.5 py-1.5">
                                                                                                        {/* X button — top right corner */}
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => removePlan(index)}
                                                                                                            className="absolute top-1.5 right-1.5 p-0.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                                                                        >
                                                                                                            <X className="h-3.5 w-3.5" />
                                                                                                        </button>
                                                                                                        <div className="flex-1 flex items-end gap-2 min-w-0">
                                                                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide flex-shrink-0 h-7 flex items-center">Pre-pay</span>
                                                                                                        <select
                                                                                                            value={plan.months}
                                                                                                            onChange={(e) => updatePlan(index, 'months', parseInt(e.target.value))}
                                                                                                            className="h-7 px-1.5 text-xs font-medium border border-input rounded-md bg-background outline-none focus:border-violet-400 transition-colors flex-shrink-0"
                                                                                                        >
                                                                                                            {[2,3,4,6,9,12].map(m => (
                                                                                                                <option key={m} value={m}>{m} months</option>
                                                                                                            ))}
                                                                                                        </select>
                                                                                                        <div className="flex flex-col flex-shrink-0">
                                                                                                            <span className="text-[10px] text-muted-foreground leading-none mb-0.5">Discount</span>
                                                                                                            <div className="relative w-20">
                                                                                                                <input
                                                                                                                    type="number"
                                                                                                                    min="0"
                                                                                                                    max={maxDiscountPercent}
                                                                                                                    step="1"
                                                                                                                    value={plan.discountPercent === 0 ? '' : plan.discountPercent}
                                                                                                                    onChange={(e) => {
                                                                                                                        const raw = parseFloat(e.target.value) || 0
                                                                                                                        updatePlan(index, 'discountPercent', Math.min(raw, maxDiscountPercent))
                                                                                                                    }}
                                                                                                                    placeholder="0"
                                                                                                                    className={`w-full h-7 pl-2 pr-5 text-xs font-medium border rounded-md bg-background outline-none transition-colors ${atPlanMax ? 'border-amber-400 focus:border-amber-500' : 'border-input focus:border-violet-400'}`}
                                                                                                                />
                                                                                                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                                                                                                            </div>
                                                                                                            {atPlanMax && (
                                                                                                                <span className="text-[9px] text-amber-500 leading-none mt-0.5">Max discount</span>
                                                                                                            )}
                                                                                                        </div>
                                                                                                        </div>
                                                                                                        <div className="h-8 w-px bg-border/40 flex-shrink-0 mx-3 self-end mb-0.5" />
                                                                                                        {/* Stats */}
                                                                                                        <div className="flex items-end gap-6 flex-shrink-0">
                                                                                                        <div className="flex flex-col min-w-[96px]">
                                                                                                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground leading-none mb-0.5">
                                                                                                                Customer pays
                                                                                                                <InfoTooltip
                                                                                                                    text="Estimated based on the selected plan. Actual cost may vary depending on the patient's state, the type of telehealth consultation required, and what their licensed provider prescribes."
                                                                                                                    subtext="All prescribing decisions are made solely by the treating physician."
                                                                                                                />
                                                                                                            </span>
                                                                                                            <span className="text-xs font-semibold text-foreground leading-none h-7 flex items-center">${customerPaysUpfront.toFixed(2)}</span>
                                                                                                        </div>
                                                                                                        <div className="flex flex-col min-w-[110px]">
                                                                                                            <span className="text-[10px] text-muted-foreground leading-none mb-0.5">Your profit</span>
                                                                                                            <span className="text-xs font-semibold text-emerald-600 leading-none h-7 flex items-center">≈ ${profitTotal.toFixed(2)}</span>
                                                                                                        </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )
                                                                                            })}
                                                                                                        {plans.length < 2 && (
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                onClick={addPlan}
                                                                                                                className="flex items-center gap-1 py-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                                                                                            >
                                                                                                                <Plus className="h-2.5 w-2.5" />
                                                                                                                Add another option
                                                                                                            </button>
                                                                                                        )}
                                                                                        </div>
                                                                                    )
                                                                                })()}

                                                                            </div>

                                                                        {/* View full breakdown toggle — inside the card */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setExpandedCostBreakdowns((prev) => ({ ...prev, [product.id]: !prev[product.id] }))}
                                                                            className="flex items-center justify-center gap-1.5 w-full py-2 border-t border-border/40 text-[11px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
                                                                        >
                                                                            {expandedCostBreakdowns[product.id]
                                                                                ? <><Minus className="h-2.5 w-2.5" />Hide breakdown</>
                                                                                : <><Plus className="h-2.5 w-2.5" />View full breakdown</>
                                                                            }
                                                                        </button>

                                                                        {expandedCostBreakdowns[product.id] && (<div className="border-t border-border/40 bg-muted/20 overflow-hidden">

                                                                                {(() => {
                                                                                    const isCustomMode = expandedMultiMonth[product.id]
                                                                                    const plans = isCustomMode ? (quickEditMultiMonthPlans[product.id] ?? []) : []
                                                                                    const monthlyTotal = fee + (totalCost ?? 0)

                                                                                    // Fixed 3-slot layout: Monthly | Prepay 1 | Prepay 2
                                                                                    // Slots are always in the same position regardless of how many plans are configured.
                                                                                    const buildPlanCol = (p: { months: number; discountPercent: number }) => {
                                                                                        const discountedTotal = monthlyTotal * (1 - p.discountPercent / 100)
                                                                                        // Stripe charges once on the full prepay amount; amortise to per-month for profit calc
                                                                                        const stripeFeeMo = ((discountedTotal * p.months) * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED) / p.months
                                                                                        const merchantFeeMo = discountedTotal * merchantServiceFeePercent
                                                                                        return { label: `${p.months}-Month`, months: p.months, discountedTotal, effectiveFee: Math.max(0, discountedTotal - (totalCost ?? 0)), stripeFeeMo, merchantFeeMo, active: true }
                                                                                    }
                                                                                    const EMPTY = { label: '', months: 0, discountedTotal: 0, effectiveFee: 0, stripeFeeMo: 0, merchantFeeMo: 0, active: false }
                                                                                    const dataCols = [
                                                                                        { label: 'Monthly', months: 1, discountedTotal: monthlyTotal, effectiveFee: fee, stripeFeeMo: monthlyTotal * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED, merchantFeeMo: monthlyTotal * merchantServiceFeePercent, active: true },
                                                                                        plans[0] ? buildPlanCol(plans[0]) : EMPTY,
                                                                                        plans[1] ? buildPlanCol(plans[1]) : EMPTY,
                                                                                    ]
                                                                                    // Always 4-col grid: label + 3 fixed data columns
                                                                                    const GRID = 'grid grid-cols-[1fr_1fr_1fr_1fr] gap-x-2'
                                                                                    // Number of active data columns (Monthly is always 1, plus any prepay plans)
                                                                                    const activeCount = dataCols.filter(c => c.active).length
                                                                                    // Separator: line only under label + active data columns
                                                                                    const RowSep = ({ opacity = 'border-border/25' }: { opacity?: string }) => (
                                                                                        <div className={GRID}>
                                                                                            {[0,1,2,3].map(i => (
                                                                                                <div key={i} className={i < activeCount + 1 ? `border-b ${opacity} h-px` : ''} />
                                                                                            ))}
                                                                                        </div>
                                                                                    )

                                                                                    return (
                                                                                        <div className="relative">
                                                                                            {/* ── VERTICAL COLUMN SEPARATORS ──────────────── */}
                                                                                            {/* Always: divider after label col (before Monthly) */}
                                                                                            <div className="absolute inset-y-0 left-1/4 border-l border-border/25 pointer-events-none" />
                                                                                            {/* Only if Prepay 1 is active */}
                                                                                            {activeCount >= 2 && <div className="absolute inset-y-0 left-2/4 border-l border-border/25 pointer-events-none" />}
                                                                                            {/* Only if Prepay 2 is active */}
                                                                                            {activeCount >= 3 && <div className="absolute inset-y-0 left-3/4 border-l border-border/25 pointer-events-none" />}

                                                                                            {/* ── COLUMN HEADERS ─────────────────────────── */}
                                                                                            <div className={`${GRID} px-4 pt-3 pb-2 border-b border-border/40`}>
                                                                                                <div />
                                                                                                {dataCols.map((col, i) => (
                                                                                                    <div key={i} className="text-center">
                                                                                                        {col.active && (
                                                                                                            <>
                                                                                                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{col.label}</div>
                                                                                                                {col.months !== 1 && monthlyTotal > col.discountedTotal && (
                                                                                                                    <div className="mt-0.5">
                                                                                                                        <span className="text-[9px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-semibold">
                                                                                                                            {Math.round((1 - col.discountedTotal / monthlyTotal) * 100)}% off
                                                                                                                        </span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>

                                                                                            {/* ── REVENUE ────────────────────────────────── */}
                                                                                            <div className="px-4 pt-2.5 pb-0.5">
                                                                                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/35">Revenue</span>
                                                                                            </div>
                                                                                            <RowSep />
                                                                                            <div className={`${GRID} px-4 py-2`}>
                                                                                                <span className="text-[11px] text-foreground font-semibold flex items-center gap-1">
                                                                                                    Customer pays
                                                                                                    <InfoTooltip
                                                                                                        text="This is an estimate. The patient's actual cost may vary based on their state of residence, the type of telehealth consultation required (asynchronous or synchronous), and the specific treatment their licensed provider prescribes."
                                                                                                        subtext="All prescribing decisions are made solely by the treating physician."
                                                                                                    />
                                                                                                </span>
                                                                                                {dataCols.map((c, i) => (
                                                                                                    <div key={i} className="text-center">
                                                                                                        {c.active && (
                                                                                                            <>
                                                                                                <div className="text-[14px] font-bold leading-tight text-foreground">
                                                                                                    {c.months === 1 ? `$${c.discountedTotal.toFixed(2)}` : `$${(c.discountedTotal * c.months).toFixed(2)}`}
                                                                                                </div>
                                                                                                                <div className="text-[9px] text-muted-foreground/50 mt-0.5">
                                                                                                                    {c.months === 1 ? 'est. per month' : `upfront · saves $${((monthlyTotal - c.discountedTotal) * c.months).toFixed(2)}`}
                                                                                                                </div>
                                                                                                            </>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>

                                                                                            {/* ── DEDUCTIONS ─────────────────────────────── */}
                                                                                            <RowSep opacity="border-border/40" />
                                                                                            <div className="px-4 pt-2 pb-0.5">
                                                                                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/35">Deductions</span>
                                                                                            </div>

                                                                                            {/* Medication + shipping */}
                                                                                            {hasCost && (() => {
                                                                                                const medCost = product.productCost ?? 0
                                                                                                const shipCost = product.shippingCost ?? 0
                                                                                                const teleCost = product.telehealthCost ?? 0
                                                                                                return (
                                                                                                    <>
                                                                                                        <RowSep />
                                                                                                        <div className={`${GRID} px-4 py-1.5`}>
                                                                                                            <span className="text-[11px] text-muted-foreground">Medication + shipping</span>
                                                                                                            {dataCols.map((c, i) => (
                                                                                                                <span key={i} className="text-[11px] font-medium text-center text-muted-foreground">
                                                                                                                    {c.active ? (c.months === 1 ? `−$${(medCost + shipCost).toFixed(2)}/mo` : `−$${((medCost + shipCost) * c.months).toFixed(2)}`) : ''}
                                                                                                                </span>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                        {teleCost > 0 && (
                                                                                                            <>
                                                                                                                <RowSep opacity="border-border/20" />
                                                                                                                <div className={`${GRID} px-4 py-1`}>
                                                                                                                    <span className="text-[10px] text-muted-foreground/50 italic">Telehealth consult (mo. 1)</span>
                                                                                                                    {dataCols.map((c, i) => (
                                                                                                                        <span key={i} className="text-[10px] text-muted-foreground/50 text-center italic">
                                                                                                                            {c.active ? `−$${teleCost.toFixed(2)}` : ''}
                                                                                                                        </span>
                                                                                                                    ))}
                                                                                                                </div>
                                                                                                            </>
                                                                                                        )}
                                                                                                    </>
                                                                                                )
                                                                                            })()}

                                                                                            {/* Stripe processing fee */}
                                                                                            <RowSep />
                                                                                            <div className={`${GRID} px-4 py-1.5`}>
                                                                                                <span className="text-[11px] text-muted-foreground">
                                                                                                    Stripe <span className="text-muted-foreground/50 text-[10px]">(2.9% + $0.30)</span>
                                                                                                </span>
                                                                                                {dataCols.map((c, i) => (
                                                                                                    <span key={i} className="text-[11px] font-medium text-center text-muted-foreground">
                                                                                                        {c.active ? (c.months === 1 ? `−$${c.stripeFeeMo.toFixed(2)}/mo` : `−$${(c.stripeFeeMo * c.months).toFixed(2)}`) : ''}
                                                                                                    </span>
                                                                                                ))}
                                                                                            </div>

                                                                                            {/* Merchant service fee */}
                                                                                            <RowSep />
                                                                                            <div className={`${GRID} px-4 py-1.5`}>
                                                                                                <span className="text-[11px] text-muted-foreground">
                                                                                                    Merchant fee <span className="text-muted-foreground/50 text-[10px]">({(merchantServiceFeePercent * 100 % 1 === 0 ? (merchantServiceFeePercent * 100).toFixed(0) : (merchantServiceFeePercent * 100).toFixed(1))}%)</span>
                                                                                                </span>
                                                                                                {dataCols.map((c, i) => (
                                                                                                    <span key={i} className="text-[11px] font-medium text-center text-muted-foreground">
                                                                                                        {c.active ? (c.months === 1 ? `−$${c.merchantFeeMo.toFixed(2)}/mo` : `−$${(c.merchantFeeMo * c.months).toFixed(2)}`) : ''}
                                                                                                    </span>
                                                                                                ))}
                                                                                            </div>

                                                                                            {/* Platform fee */}
                                                                                            {platformFeePercent > 0 && (
                                                                                                <>
                                                                                                    <RowSep />
                                                                                                    <div className={`${GRID} px-4 py-1.5`}>
                                                                                                        <span className="text-[11px] text-muted-foreground">
                                                                                                            Profit share <span className="text-muted-foreground/50 text-[10px]">({(platformFeePercent * 100).toFixed(0)}%)</span>
                                                                                                        </span>
                                                                                                        {dataCols.map((c, i) => {
                                                                                                            const pfee = Math.round(c.effectiveFee * platformFeePercent * 100) / 100
                                                                                                            return (
                                                                                                            <span key={i} className="text-[11px] font-medium text-center text-muted-foreground">
                                                                                                                {c.active ? (c.months === 1 ? `−$${pfee.toFixed(2)}/mo` : `−$${(pfee * c.months).toFixed(2)}`) : ''}
                                                                                                            </span>
                                                                                                            )
                                                                                                        })}
                                                                                                    </div>
                                                                                                </>
                                                                                            )}

                                                                                            {/* ── YOUR PROFIT (net) ──────────────────────── */}
                                                                                            <RowSep opacity="border-border/60" />
                                                                                            <div className={`${GRID} px-4 py-3 bg-emerald-50/50 dark:bg-emerald-950/20`}>
                                                                                                <div>
                                                                                                    <div className="text-[9px] font-bold uppercase tracking-widest text-foreground">Your profit</div>
                                                                                                    <div className="text-[9px] text-muted-foreground/40 mt-0.5">after all fees</div>
                                                                                                </div>
                                                                                                {dataCols.map((c, i) => {
                                                                                                    if (!c.active) return <div key={i} />
                                                                                                    const profit = Math.max(0, c.effectiveFee * (1 - platformFeePercent) - c.merchantFeeMo - c.stripeFeeMo)
                                                                                                    return (
                                                                                                        <div key={i} className="text-center">
                                                                                                            <div className="text-[14px] font-bold leading-tight text-foreground">
                                                                                                                {c.months === 1 ? `$${profit.toFixed(2)}` : `$${(profit * c.months).toFixed(2)}`}
                                                                                                            </div>
                                                                                                            <div className="text-[9px] text-muted-foreground/50 mt-0.5">
                                                                                                                {c.months === 1 ? 'per month' : 'total'}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    )
                                                                                                })}
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                })()}
                                                                        </div>)}

                                                                        </div>{/* end card */}
                                                                        </div>{/* end draggable wrapper */}
                                                                        </>
                                                            )
                                                        })}
                                                    </div>
                                                    )
                                                })() : (
                                                    <p className="text-xs text-muted-foreground text-center py-6">No products detected for this program yet.</p>
                                                )}

                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="sticky bottom-0 bg-card border-t border-border px-6 pt-3 pb-4 flex flex-col gap-2">
                                    {(() => {
                                        const missingName = !quickEditPortalDisplayName.trim()
                                        const missingFees = Object.values(quickEditProductFees).some((f) => !f || f === 0)
                                        if (!missingName && !missingFees) return null
                                        return (
                                            <div className="flex flex-col items-end gap-0.5">
                                                {missingName && (
                                                    <span className="text-[11px] font-medium text-red-500 leading-tight">* Add name required</span>
                                                )}
                                                {missingFees && (
                                                    <span className="text-[11px] font-medium text-red-500 leading-tight">** Add non-medical fee to every product</span>
                                                )}
                                            </div>
                                        )
                                    })()}
                                    <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (quickEditSaving) return
                                            revokeProductImagePreviews(quickEditProductImagePreviews)
                                            setQuickEditProductImagePreviews({})
                                            setQuickEditProductImageFiles({})
                                            setQuickEditProgramHeroImageUrl('')
                                            setProgramModal(null)
                                            setQuickEditProgramId(null)
                                        }}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSaveQuickEdit}
                                        disabled={quickEditLoading || quickEditSaving || !quickEditName.trim()}
                                        className="flex-1"
                                    >
                                        {quickEditSaving ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                    </div>
                                </div>

                                {/* Hidden file input for product image upload */}
                                <input
                                    ref={quickEditFileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml,application/pdf"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file && quickEditImageUploadProductId) {
                                            handleProductImageSelect(quickEditImageUploadProductId, file)
                                        }
                                        e.target.value = ''
                                    }}
                                />
                                    </div>
                                )}

                                {/* Tab: Form Structure */}
                                {programModal.tab === 'form' && (
                                    <iframe
                                        src={`/programs/${programModal.programId}?tab=form&embedded=1`}
                                        className="flex-1 w-full border-0"
                                        title="Form Structure"
                                    />
                                )}

                                {/* Tab: Analytics */}
                                {programModal.tab === 'analytics' && (
                                    <div className="overflow-y-auto flex-1 min-h-0 p-6">
                                        {analyticsLoading ? (
                                            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading analytics…</div>
                                        ) : analyticsEnabledForms.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                                                <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
                                                <p className="text-sm font-medium text-foreground">No form data available</p>
                                                <p className="text-xs text-muted-foreground">This program's forms haven't been published yet.</p>
                                            </div>
                                        ) : (
                                            <FormAnalytics
                                                formId={analyticsEnabledForms[0].id}
                                                formStepLabels={analyticsFormStepLabels}
                                            />
                                        )}
                                    </div>
                                )}

                            </div>
                        </div>
                    )}

                    {/* ── Product Image Crop Dialog ── */}
                    {cropDialogOpen && createPortal(
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                            <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl ring-1 ring-black/10 overflow-hidden flex flex-col">
                                {/* Header */}
                                <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold">Frame your product image</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">Drag to reposition · scroll or slide to zoom</p>
                                    </div>
                                    <button
                                        onClick={() => { setCropDialogOpen(false); setCropImageSrc(''); setCropDialogProductId(null) }}
                                        className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0"
                                    >
                                        <X className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                </div>

                                {/* Cropper canvas — 1 : 1 square */}
                                <div className="relative bg-neutral-950" style={{ height: 300 }}>
                                    {cropImageSrc && (
                                        <Cropper
                                            image={cropImageSrc}
                                            crop={cropPosition}
                                            zoom={cropZoom}
                                            aspect={1}
                                            onCropChange={setCropPosition}
                                            onZoomChange={setCropZoom}
                                            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                                            showGrid={true}
                                            cropShape="rect"
                                            style={{
                                                cropAreaStyle: {
                                                    border: '2px solid rgba(255,255,255,0.85)',
                                                    borderRadius: 10,
                                                },
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Zoom slider */}
                                <div className="px-5 pt-4 pb-1 flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground select-none">−</span>
                                    <input
                                        type="range"
                                        min={1}
                                        max={3}
                                        step={0.01}
                                        value={cropZoom}
                                        onChange={(e) => setCropZoom(Number(e.target.value))}
                                        className="flex-1 h-1.5 cursor-pointer accent-primary"
                                    />
                                    <span className="text-xs text-muted-foreground select-none">+</span>
                                </div>
                                <p className="px-5 pb-3 text-[10px] text-muted-foreground/50">Output: 400 × 400 px · JPEG · optimised for fast page loads</p>

                                {/* Actions */}
                                <div className="px-5 pb-5 flex gap-2">
                                    <button
                                        onClick={() => { setCropDialogOpen(false); setCropImageSrc(''); setCropDialogProductId(null) }}
                                        className="flex-1 h-9 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                                    >
                                        Retake
                                    </button>
                                    <button
                                        onClick={handleCropApply}
                                        disabled={cropApplying || !croppedAreaPixels}
                                        className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {cropApplying ? 'Applying…' : 'Apply crop'}
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* Templates Modal */}
                    {showTemplatesModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card rounded-2xl shadow-2xl">
                                <div className="sticky top-0 bg-card border-b border-border p-6 z-10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-semibold text-foreground">
                                                Select a Program Template
                                            </h2>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Start with a pre-configured template and customize it for your clinic
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowTemplatesModal(false)}
                                            className="p-2 rounded-full hover:bg-muted transition-colors"
                                        >
                                            <X className="h-5 w-5 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-6">
                                    {templates.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {templates.map((template) => (
                                                <div
                                                    key={template.id}
                                                    className="bg-muted/50 rounded-xl border border-border p-5 hover:border-primary hover:shadow-md transition-all cursor-pointer"
                                                    onClick={() => handleCreateFromTemplate(template.id)}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                                            <Stethoscope className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-lg font-semibold text-foreground mb-1">
                                                                {template.name}
                                                            </h3>
                                                            {template.description && (
                                                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                                                    {template.description}
                                                                </p>
                                                            )}
                                                            {template.medicalTemplate && (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                        <FileText className="h-3 w-3" />
                                                                        <span>{template.medicalTemplate.title}</span>
                                                                    </div>
                                                                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${getMedicalCompanyInfo(template.medicalTemplate.medicalCompanySource).color}`}>
                                                                        <span>{getMedicalCompanyInfo(template.medicalTemplate.medicalCompanySource).icon}</span>
                                                                        {getMedicalCompanyInfo(template.medicalTemplate.medicalCompanySource).label}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="mt-3">
                                                                <Badge variant={template.isActive ? "default" : "secondary"} className="text-xs">
                                                                    {template.isActive ? "Active" : "Inactive"}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Stethoscope className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                            <p>No templates available</p>
                                        </div>
                                    )}
                                </div>

                                <div className="sticky bottom-0 bg-card border-t border-border p-6">
                                    <Button
                                        onClick={() => setShowTemplatesModal(false)}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <ToastManager toasts={toasts} onDismiss={dismiss} />
        </Layout>
    )
}
