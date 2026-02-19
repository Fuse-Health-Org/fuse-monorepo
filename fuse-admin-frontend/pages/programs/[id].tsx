import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import { FormAnalytics } from '@/components/form-analytics-detail'
import {
    ArrowLeft,
    FileText,
    Check,
    Search,
    Package,
    DollarSign,
    Sparkles,
    Copy,
    Pill,
    X,
    Settings2,
    ExternalLink,
    AlertTriangle,
    BarChart3,
    TrendingUp,
    Users,
    Edit,
    GripVertical
} from 'lucide-react'

interface TemplateProduct {
    id: string
    name: string
    imageUrl?: string
    price?: number
    placeholderSig?: string
    pharmacyWholesaleCost?: number
    slug?: string
}

interface MedicalTemplate {
    id: string
    title: string
    description?: string
    formTemplateType: string
    createdAt: string
    user?: {
        id: string
        email: string
        firstName?: string
        lastName?: string
    }
    formProducts?: {
        id: string
        productId: string
        product?: TemplateProduct
    }[]
}

interface EnabledForm {
    id: string
    productId: string
    globalFormStructureId?: string
}

// Configuration for individual product programs
interface IndividualProductProgram {
    productId: string
    programName: string
    hasPatientPortal: boolean
    patientPortalPrice: number
    hasBmiCalculator: boolean
    bmiCalculatorPrice: number
    hasProteinIntakeCalculator: boolean
    proteinIntakeCalculatorPrice: number
    hasCalorieDeficitCalculator: boolean
    calorieDeficitCalculatorPrice: number
    hasEasyShopping: boolean
    easyShoppingPrice: number
    // If this individual program already exists in DB, store its ID
    existingProgramId?: string
}

interface ProductPricingDraft {
    sellPrice: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export default function ProgramEditor() {
    const router = useRouter()
    const { id } = router.query
    const isCreateMode = id === 'create'

    const { token, user, isLoading: authLoading } = useAuth()
    // Only start in loading state if we know we're in edit mode (router ready and not create)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [medicalTemplateId, setMedicalTemplateId] = useState<string | null>(null)
    const [isActive, setIsActive] = useState(true)
    const [frontendDisplayProductId, setFrontendDisplayProductId] = useState<string | null>(null)

    // Non-medical services state
    const [hasPatientPortal, setHasPatientPortal] = useState(false)
    const [patientPortalPrice, setPatientPortalPrice] = useState(0)
    const [hasBmiCalculator, setHasBmiCalculator] = useState(false)
    const [bmiCalculatorPrice, setBmiCalculatorPrice] = useState(0)
    const [hasProteinIntakeCalculator, setHasProteinIntakeCalculator] = useState(false)
    const [proteinIntakeCalculatorPrice, setProteinIntakeCalculatorPrice] = useState(0)
    const [hasCalorieDeficitCalculator, setHasCalorieDeficitCalculator] = useState(false)
    const [calorieDeficitCalculatorPrice, setCalorieDeficitCalculatorPrice] = useState(0)
    const [hasEasyShopping, setHasEasyShopping] = useState(false)
    const [easyShoppingPrice, setEasyShoppingPrice] = useState(0)
    const [defaultShippingCost, setDefaultShippingCost] = useState(9.99)
    const [defaultFacilitationFee, setDefaultFacilitationFee] = useState(12)
    const [platformRetainedPercent, setPlatformRetainedPercent] = useState(5)
    const [includePlatformRetainedInCogs, setIncludePlatformRetainedInCogs] = useState(true)
    const [productPricingDrafts, setProductPricingDrafts] = useState<Record<string, ProductPricingDraft>>({})


    // Step state for creation flow
    const [currentStep, setCurrentStep] = useState(1)

    // Teleforms
    const [templates, setTemplates] = useState<MedicalTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(true)
    const [templateSearch, setTemplateSearch] = useState('')

    // Selected template details (for edit mode display)
    const [selectedTemplateDetails, setSelectedTemplateDetails] = useState<MedicalTemplate | null>(null)
    
    // Clinic info for building form URLs
    const [clinicSlug, setClinicSlug] = useState<string | null>(null)

    // Form steps ordering
    interface FormStep {
        id: string
        icon: string
        label: string
        locked: boolean
    }

    const DEFAULT_FORM_STEPS: FormStep[] = [
        { id: 'medical', icon: '🩺', label: 'Medical Questions', locked: false },
        { id: 'account', icon: '👤', label: 'Create Account', locked: false },
        { id: 'productSelection', icon: '🛒', label: 'Product Selection', locked: false },
        { id: 'payment', icon: '💳', label: 'Payment & Checkout', locked: true }
    ]

    const mapStepOrderToSteps = (stepOrder?: string[] | null): FormStep[] => {
        if (!Array.isArray(stepOrder) || stepOrder.length === 0) return DEFAULT_FORM_STEPS

        const stepMap = new Map(DEFAULT_FORM_STEPS.map((step) => [step.id, step]))
        const normalized = stepOrder
            .map((stepId) => stepMap.get(stepId))
            .filter((step): step is FormStep => !!step)

        const included = new Set(normalized.map((step) => step.id))
        const missing = DEFAULT_FORM_STEPS.filter((step) => !included.has(step.id))
        const merged = [...normalized, ...missing]

        const payment = merged.find((step) => step.id === 'payment')
        const withoutPayment = merged.filter((step) => step.id !== 'payment')

        return payment ? [...withoutPayment, payment] : [...withoutPayment, DEFAULT_FORM_STEPS[3]]
    }
    
    const [isEditingSteps, setIsEditingSteps] = useState(false)
    const [formSteps, setFormSteps] = useState<FormStep[]>(DEFAULT_FORM_STEPS)
    const [savedFormSteps, setSavedFormSteps] = useState<FormStep[]>(DEFAULT_FORM_STEPS)
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [savingStepOrder, setSavingStepOrder] = useState(false)
    const [clinicCustomDomain, setClinicCustomDomain] = useState<string | null>(null)
    const [dashboardPrefix, setDashboardPrefix] = useState<string>('/fuse-dashboard')
    
    // Enabled forms for each product
    const [enabledForms, setEnabledForms] = useState<EnabledForm[]>([])
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
    
    // Track which products are activated for this clinic (have TenantProduct entries)
    const [activatedProductIds, setActivatedProductIds] = useState<Set<string>>(new Set())
    const [activatingProductId, setActivatingProductId] = useState<string | null>(null)

    // Program mode: 'unified' = one program for all products, 'per_product' = unique program per product
    const [programMode, setProgramMode] = useState<'unified' | 'per_product'>('unified')
    
    // Individual product program configurations (when mode is 'per_product')
    const [individualProductPrograms, setIndividualProductPrograms] = useState<Record<string, IndividualProductProgram>>({})
    
    // Warning dialog for switching to unified mode
    const [showUnifiedWarning, setShowUnifiedWarning] = useState(false)
    
    // Modal state for configuring individual product program
    const [configModalOpen, setConfigModalOpen] = useState(false)
    const [configModalProductId, setConfigModalProductId] = useState<string | null>(null)
    const [configModalData, setConfigModalData] = useState<IndividualProductProgram | null>(null)

    // Tab state — Form and Analytics only (Details and Services managed in tenant portal)
    const [activeTab, setActiveTab] = useState<'form' | 'analytics'>('form')

    // When embedded in an iframe (embedded=1), strip all outer chrome.
    // Must use useState+useEffect so server and client both start with false,
    // avoiding a hydration mismatch. The value is updated immediately after mount.
    const [isEmbedded, setIsEmbedded] = useState(false)
    useEffect(() => {
        setIsEmbedded(new URLSearchParams(window.location.search).get('embedded') === '1')
    }, [])

    // Initialize active tab from URL query parameter
    useEffect(() => {
        if (!router.isReady) return
        const tabParam = router.query.tab as string
        if (tabParam && ['form', 'analytics'].includes(tabParam)) {
            setActiveTab(tabParam as 'form' | 'analytics')
        }
    }, [router.isReady, router.query.tab])

    // Load existing program if editing
    useEffect(() => {
        // Wait for router to be ready before trying to fetch
        if (!router.isReady) return
        
        // For create mode, no need to fetch - just disable loading
        if (isCreateMode) {
            setLoading(false)
            return
        }

        // Mock IDs (e.g. "mock-1") don't exist in the backend — skip the API
        // call and render with defaults so the embedded form structure shows cleanly.
        if (typeof id === 'string' && id.startsWith('mock-')) {
            setLoading(false)
            return
        }
        
        // For edit mode, need both token and id to fetch
        if (token && id) {
            fetchProgram()
        }
        // If no token yet but auth is not loading, something is wrong - set loading false
        // to prevent infinite loading state
        else if (!authLoading && !token) {
            console.log('⚠️ No token available after auth loaded - cannot fetch program')
            setLoading(false)
            setError('Authentication required')
        }
    }, [token, id, isCreateMode, router.isReady, authLoading])

    // Load template data if creating from template
    useEffect(() => {
        const loadTemplate = async () => {
            if (!router.isReady || !isCreateMode || !token) return
            
            const templateId = router.query.templateId as string
            if (!templateId) return

            try {
                const response = await fetch(`${API_URL}/program-templates/${templateId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })

                if (response.ok) {
                    const data = await response.json()
                    if (data.success && data.data) {
                        const template = data.data
                        // Pre-fill form with template data
                        setName(template.name)
                        setDescription(template.description || '')
                        setMedicalTemplateId(template.medicalTemplateId || null)
                        setIsActive(template.isActive)
                        // Load non-medical services from template
                        setHasPatientPortal(template.hasPatientPortal || false)
                        setPatientPortalPrice(parseFloat(template.patientPortalPrice) || 0)
                        setHasBmiCalculator(template.hasBmiCalculator || false)
                        setBmiCalculatorPrice(parseFloat(template.bmiCalculatorPrice) || 0)
                        setHasProteinIntakeCalculator(template.hasProteinIntakeCalculator || false)
                        setProteinIntakeCalculatorPrice(parseFloat(template.proteinIntakeCalculatorPrice) || 0)
                        setHasCalorieDeficitCalculator(template.hasCalorieDeficitCalculator || false)
                        setCalorieDeficitCalculatorPrice(parseFloat(template.calorieDeficitCalculatorPrice) || 0)
                        setHasEasyShopping(template.hasEasyShopping || false)
                        setEasyShoppingPrice(parseFloat(template.easyShoppingPrice) || 0)
                    }
                }
            } catch (err) {
                console.error('Error loading template:', err)
            }
        }

        loadTemplate()
    }, [router.isReady, router.query.templateId, isCreateMode, token])

    // Load Teleforms
    useEffect(() => {
        if (token) {
            fetchTemplates()
        }
    }, [token])

    // Load clinic info for form URLs
    useEffect(() => {
        const fetchClinic = async () => {
            if (!token || !user?.clinicId) return
            try {
                const response = await fetch(`${API_URL}/clinic/${user.clinicId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (response.ok) {
                    const data = await response.json()
                    if (data.success && data.data) {
                        setClinicSlug(data.data.slug)
                        setClinicCustomDomain(data.data.customDomain || null)
                        // Set dashboard prefix based on clinic's patientPortalDashboardFormat
                        const format = data.data.patientPortalDashboardFormat || 'fuse'
                        setDashboardPrefix(format === 'md-integrations' ? '/mdi-dashboard' : '/fuse-dashboard')
                    }
                }
            } catch (err) {
                console.error('Failed to load clinic:', err)
            }
        }
        fetchClinic()
    }, [token, user?.clinicId])

    // Fetch TenantProducts to know which products are activated for this clinic
    useEffect(() => {
        const fetchTenantProducts = async () => {
            if (!token) return
            try {
                const response = await fetch(`${API_URL}/tenant-products`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (response.ok) {
                    const data = await response.json()
                    if (Array.isArray(data?.data)) {
                        const activeProductIds = new Set<string>(
                            data.data.filter((tp: any) => tp.isActive).map((tp: any) => tp.productId)
                        )
                        setActivatedProductIds(activeProductIds)
                    }
                }
            } catch (err) {
                console.error('Failed to load tenant products:', err)
            }
        }
        fetchTenantProducts()
    }, [token])

    // Load selected template details and forms when template is selected
    useEffect(() => {
        if (!medicalTemplateId || !token) {
            setSelectedTemplateDetails(null)
            setEnabledForms([])
            return
        }

        // Find template from loaded templates list
        const template = templates.find(t => t.id === medicalTemplateId)
        if (template) {
            setSelectedTemplateDetails(template)
            
            // Fetch enabled forms for each product in this template
            const fetchFormsForProducts = async () => {
                if (!template.formProducts?.length) return
                
                const allForms: EnabledForm[] = []
                for (const fp of template.formProducts) {
                    if (!fp.product?.id) continue
                    try {
                        const res = await fetch(`${API_URL}/admin/tenant-product-forms?productId=${fp.product.id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        })
                        if (res.ok) {
                            const data = await res.json()
                            if (Array.isArray(data?.data)) {
                                allForms.push(...data.data.map((f: any) => ({
                                    id: f.id,
                                    productId: f.productId,
                                    globalFormStructureId: f.globalFormStructureId
                                })))
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching forms for product:', fp.product.id, err)
                    }
                }
                setEnabledForms(allForms)
            }
            
            fetchFormsForProducts()
        }
    }, [medicalTemplateId, templates, token])

    const fetchProgram = async () => {
        try {
            setLoading(true)
            const response = await fetch(`${API_URL}/programs/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success && data.data) {
                    const program = data.data
                    setName(program.name)
                    setDescription(program.description || '')
                    setMedicalTemplateId(program.medicalTemplateId || null)
                    setIsActive(program.isActive)
                    setFrontendDisplayProductId(program.frontendDisplayProductId || null)
                    const mappedSteps = mapStepOrderToSteps(program.formStepOrder)
                    setFormSteps(mappedSteps)
                    setSavedFormSteps(mappedSteps)
                    // Load non-medical services
                    setHasPatientPortal(program.hasPatientPortal || false)
                    setPatientPortalPrice(parseFloat(program.patientPortalPrice) || 0)
                    setHasBmiCalculator(program.hasBmiCalculator || false)
                    setBmiCalculatorPrice(parseFloat(program.bmiCalculatorPrice) || 0)
                    setHasProteinIntakeCalculator(program.hasProteinIntakeCalculator || false)
                    setProteinIntakeCalculatorPrice(parseFloat(program.proteinIntakeCalculatorPrice) || 0)
                    setHasCalorieDeficitCalculator(program.hasCalorieDeficitCalculator || false)
                    setCalorieDeficitCalculatorPrice(parseFloat(program.calorieDeficitCalculatorPrice) || 0)
                    setHasEasyShopping(program.hasEasyShopping || false)
                    setEasyShoppingPrice(parseFloat(program.easyShoppingPrice) || 0)
                    
                    // Fetch individual product programs (children) for this program
                    await fetchIndividualProductPrograms(program.id)
                }
            } else {
                setError('Failed to load program')
            }
        } catch (err) {
            console.error('Error fetching program:', err)
            setError('Failed to load program')
        } finally {
            setLoading(false)
        }
    }
    
    // Fetch individual product programs that belong to this parent program
    const fetchIndividualProductPrograms = async (parentId: string) => {
        try {
            // Use parentProgramId to get child programs, and includeChildren to bypass the default filter
            const response = await fetch(`${API_URL}/programs?parentProgramId=${parentId}&includeChildren=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            
            if (response.ok) {
                const data = await response.json()
                if (data.success && Array.isArray(data.data)) {
                    // These are child programs with individualProductId set
                    const individualPrograms = data.data.filter((p: any) => p.individualProductId)
                    
                    if (individualPrograms.length > 0) {
                        setProgramMode('per_product')
                        const programsMap: Record<string, IndividualProductProgram> = {}
                        individualPrograms.forEach((p: any) => {
                            programsMap[p.individualProductId] = {
                                productId: p.individualProductId,
                                programName: p.name,
                                hasPatientPortal: p.hasPatientPortal || false,
                                patientPortalPrice: parseFloat(p.patientPortalPrice) || 0,
                                hasBmiCalculator: p.hasBmiCalculator || false,
                                bmiCalculatorPrice: parseFloat(p.bmiCalculatorPrice) || 0,
                                hasProteinIntakeCalculator: p.hasProteinIntakeCalculator || false,
                                proteinIntakeCalculatorPrice: parseFloat(p.proteinIntakeCalculatorPrice) || 0,
                                hasCalorieDeficitCalculator: p.hasCalorieDeficitCalculator || false,
                                calorieDeficitCalculatorPrice: parseFloat(p.calorieDeficitCalculatorPrice) || 0,
                                hasEasyShopping: p.hasEasyShopping || false,
                                easyShoppingPrice: parseFloat(p.easyShoppingPrice) || 0,
                                existingProgramId: p.id,
                            }
                        })
                        setIndividualProductPrograms(programsMap)
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching individual product programs:', err)
        }
    }

    const fetchTemplates = async () => {
        try {
            setTemplatesLoading(true)
            const response = await fetch(`${API_URL}/questionnaires/templates/product-forms`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success && Array.isArray(data.data)) {
                    setTemplates(data.data)
                }
            }
        } catch (err) {
            console.error('Error fetching templates:', err)
        } finally {
            setTemplatesLoading(false)
        }
    }

    // Activate a product for the current clinic (create TenantProduct entry)
    const handleActivateProduct = async (productId: string) => {
        if (!token || !productId) return
        
        setActivatingProductId(productId)
        try {
            const response = await fetch(`${API_URL}/tenant-products/update-selection`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    products: [{ productId, isActive: true }]
                })
            })

            if (response.ok) {
                // Add to activated set
                setActivatedProductIds(prev => {
                    const newSet = new Set(Array.from(prev))
                    newSet.add(productId)
                    return newSet
                })
            } else {
                const data = await response.json()
                setError(data.message || 'Failed to activate product')
            }
        } catch (err) {
            console.error('Error activating product:', err)
            setError('Failed to activate product')
        } finally {
            setActivatingProductId(null)
        }
    }

    // Handle switching to unified mode with warning
    const handleSwitchToUnified = () => {
        // Check if there are existing per-product programs
        const hasExistingPrograms = Object.values(individualProductPrograms).some(p => p.existingProgramId)
        
        if (programMode === 'per_product' && hasExistingPrograms) {
            // Show warning dialog
            setShowUnifiedWarning(true)
        } else {
            // No existing programs to delete, just switch
            setProgramMode('unified')
        }
    }

    const confirmSwitchToUnified = () => {
        setProgramMode('unified')
        setShowUnifiedWarning(false)
    }

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Program name is required')
            return
        }

        try {
            setSaving(true)
            setError(null)

            const payload: any = {
                name: name.trim(),
                description: description.trim() || undefined,
                medicalTemplateId: medicalTemplateId || undefined,
                formStepOrder: formSteps.map((step) => step.id),
                frontendDisplayProductId: frontendDisplayProductId || null,
                // Non-medical services (for unified mode)
                hasPatientPortal: programMode === 'unified' ? hasPatientPortal : false,
                patientPortalPrice: programMode === 'unified' ? patientPortalPrice : 0,
                hasBmiCalculator: programMode === 'unified' ? hasBmiCalculator : false,
                bmiCalculatorPrice: programMode === 'unified' ? bmiCalculatorPrice : 0,
                hasProteinIntakeCalculator: programMode === 'unified' ? hasProteinIntakeCalculator : false,
                proteinIntakeCalculatorPrice: programMode === 'unified' ? proteinIntakeCalculatorPrice : 0,
                hasCalorieDeficitCalculator: programMode === 'unified' ? hasCalorieDeficitCalculator : false,
                calorieDeficitCalculatorPrice: programMode === 'unified' ? calorieDeficitCalculatorPrice : 0,
                hasEasyShopping: programMode === 'unified' ? hasEasyShopping : false,
                easyShoppingPrice: programMode === 'unified' ? easyShoppingPrice : 0,
                isActive,
            }

            // Include templateId if creating from template
            if (isCreateMode && router.query.templateId) {
                payload.templateId = router.query.templateId as string
            }

            const url = isCreateMode ? `${API_URL}/programs` : `${API_URL}/programs/${id}`
            const method = isCreateMode ? 'POST' : 'PUT'

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })

            const data = await response.json()

            if (response.ok && data.success) {
                const mainProgramId = isCreateMode ? data.data.id : id
                
                // If in per_product mode, save/update individual product programs
                if (programMode === 'per_product' && Object.keys(individualProductPrograms).length > 0) {
                    for (const [productId, config] of Object.entries(individualProductPrograms)) {
                        const individualPayload = {
                            name: config.programName,
                            medicalTemplateId: medicalTemplateId,
                            individualProductId: productId,
                            parentProgramId: mainProgramId, // Link child program to parent
                            hasPatientPortal: config.hasPatientPortal,
                            patientPortalPrice: config.patientPortalPrice,
                            hasBmiCalculator: config.hasBmiCalculator,
                            bmiCalculatorPrice: config.bmiCalculatorPrice,
                            hasProteinIntakeCalculator: config.hasProteinIntakeCalculator,
                            proteinIntakeCalculatorPrice: config.proteinIntakeCalculatorPrice,
                            hasCalorieDeficitCalculator: config.hasCalorieDeficitCalculator,
                            calorieDeficitCalculatorPrice: config.calorieDeficitCalculatorPrice,
                            hasEasyShopping: config.hasEasyShopping,
                            easyShoppingPrice: config.easyShoppingPrice,
                            isActive,
                        }
                        
                        const individualUrl = config.existingProgramId 
                            ? `${API_URL}/programs/${config.existingProgramId}`
                            : `${API_URL}/programs`
                        const individualMethod = config.existingProgramId ? 'PUT' : 'POST'
                        
                        await fetch(individualUrl, {
                            method: individualMethod,
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(individualPayload)
                        })
                    }
                } else if (programMode === 'unified' && !isCreateMode) {
                    // If switching to unified mode, delete any existing child programs
                    // First, fetch all child programs for this parent
                    const childProgramsResponse = await fetch(
                        `${API_URL}/programs?parentProgramId=${mainProgramId}&includeChildren=true`,
                        {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                            }
                        }
                    )
                    
                    if (childProgramsResponse.ok) {
                        const childProgramsData = await childProgramsResponse.json()
                        if (childProgramsData.success && Array.isArray(childProgramsData.data)) {
                            // Delete each child program
                            for (const childProgram of childProgramsData.data) {
                                await fetch(`${API_URL}/programs/${childProgram.id}`, {
                                    method: 'DELETE',
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                    }
                                })
                            }
                        }
                    }
                    
                    // Clear the local state
                    setIndividualProductPrograms({})
                }
                
                router.push('/programs')
            } else {
                setError(data.error || 'Failed to save program')
            }
        } catch (err) {
            console.error('Error saving program:', err)
            setError('Failed to save program')
        } finally {
            setSaving(false)
        }
    }

    const saveFormStepOrder = async () => {
        if (isCreateMode || !id) {
            setIsEditingSteps(false)
            return
        }

        try {
            setSavingStepOrder(true)
            const response = await fetch(`${API_URL}/programs/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    formStepOrder: formSteps.map((step) => step.id)
                })
            })

            const data = await response.json().catch(() => ({}))
            if (!response.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to save form step order')
            }

            setSavedFormSteps(formSteps)
            setIsEditingSteps(false)
        } catch (err) {
            console.error('Error saving form step order:', err)
            setError(err instanceof Error ? err.message : 'Failed to save form step order')
        } finally {
            setSavingStepOrder(false)
        }
    }

    // Build BOTH URLs for forms with custom domains (matching product page)
    const buildFormUrls = (formId: string, productSlug: string | undefined | null) => {
        if (!formId || !productSlug || !clinicSlug) return null

        const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
        const protocol = isLocalhost ? 'http' : 'https'

        // Standard subdomain URL (always available)
        const isStaging = process.env.NEXT_PUBLIC_IS_STAGING === 'true'
        const baseDomain = isStaging ? 'fusehealthstaging.xyz' : 'fusehealth.com'
        const subdomainBase = isLocalhost
            ? `http://${clinicSlug}.localhost:3000`
            : `https://${clinicSlug}.${baseDomain}`
        const subdomainUrl = `${subdomainBase}${dashboardPrefix}/my-products/${formId}/${productSlug}`

        // Custom domain URL (if configured)
        let customDomainUrl = null
        if (clinicCustomDomain) {
            customDomainUrl = `${protocol}://${clinicCustomDomain}${dashboardPrefix}/my-products/${formId}/${productSlug}`
        }

        return {
            subdomainUrl,
            customDomainUrl
        }
    }

    // Copy URL to clipboard
    const handleCopyUrl = async (url: string, productId: string) => {
        try {
            await navigator.clipboard.writeText(url)
            setCopiedUrl(productId)
            setTimeout(() => setCopiedUrl(null), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    // Format price helper
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price)
    }

    const getUnifiedServiceTotal = () => {
        return (
            (hasPatientPortal ? patientPortalPrice : 0) +
            (hasBmiCalculator ? bmiCalculatorPrice : 0) +
            (hasProteinIntakeCalculator ? proteinIntakeCalculatorPrice : 0) +
            (hasCalorieDeficitCalculator ? calorieDeficitCalculatorPrice : 0) +
            (hasEasyShopping ? easyShoppingPrice : 0)
        )
    }

    const getPerProductServiceTotal = (productId: string) => {
        const config = individualProductPrograms[productId]
        if (!config) return 0
        return (
            (config.hasPatientPortal ? config.patientPortalPrice : 0) +
            (config.hasBmiCalculator ? config.bmiCalculatorPrice : 0) +
            (config.hasProteinIntakeCalculator ? config.proteinIntakeCalculatorPrice : 0) +
            (config.hasCalorieDeficitCalculator ? config.calorieDeficitCalculatorPrice : 0) +
            (config.hasEasyShopping ? config.easyShoppingPrice : 0)
        )
    }

    const getProductPricingPreview = (product: TemplateProduct) => {
        const baseProductCost = product.pharmacyWholesaleCost || product.price || 0
        const serviceTotal = programMode === 'per_product'
            ? getPerProductServiceTotal(product.id)
            : getUnifiedServiceTotal()
        const subtotalCogs = baseProductCost + defaultShippingCost + defaultFacilitationFee + serviceTotal
        const platformRetainedCost = includePlatformRetainedInCogs
            ? subtotalCogs * (platformRetainedPercent / 100)
            : 0
        const allInCogs = subtotalCogs + platformRetainedCost
        const sellPrice = productPricingDrafts[product.id]?.sellPrice ?? allInCogs
        const net = sellPrice - allInCogs
        const marginPercent = sellPrice > 0 ? (net / sellPrice) * 100 : 0

        return {
            baseProductCost,
            serviceTotal,
            shippingCost: defaultShippingCost,
            facilitationFee: defaultFacilitationFee,
            platformRetainedCost,
            allInCogs,
            sellPrice,
            net,
            marginPercent,
        }
    }

    const updateProductSellPrice = (productId: string, value: string) => {
        const parsed = parseFloat(value)
        setProductPricingDrafts((prev) => ({
            ...prev,
            [productId]: {
                sellPrice: Number.isFinite(parsed) ? parsed : 0
            }
        }))
    }

    useEffect(() => {
        if (!selectedTemplateDetails?.formProducts?.length) return

        setProductPricingDrafts((prev) => {
            const next = { ...prev }
            selectedTemplateDetails.formProducts
                .filter((fp) => fp.product)
                .forEach((fp) => {
                    const product = fp.product as TemplateProduct
                    if (!next[product.id]) {
                        const baseProductCost = product.pharmacyWholesaleCost || product.price || 0
                        const serviceTotal = programMode === 'per_product'
                            ? getPerProductServiceTotal(product.id)
                            : getUnifiedServiceTotal()
                        const subtotalCogs = baseProductCost + defaultShippingCost + defaultFacilitationFee + serviceTotal
                        const platformRetainedCost = includePlatformRetainedInCogs
                            ? subtotalCogs * (platformRetainedPercent / 100)
                            : 0
                        next[product.id] = { sellPrice: subtotalCogs + platformRetainedCost }
                    }
                })
            return next
        })
    }, [
        selectedTemplateDetails,
        programMode,
        individualProductPrograms,
        hasPatientPortal,
        patientPortalPrice,
        hasBmiCalculator,
        bmiCalculatorPrice,
        hasProteinIntakeCalculator,
        proteinIntakeCalculatorPrice,
        hasCalorieDeficitCalculator,
        calorieDeficitCalculatorPrice,
        hasEasyShopping,
        easyShoppingPrice,
        defaultShippingCost,
        defaultFacilitationFee,
        includePlatformRetainedInCogs,
        platformRetainedPercent
    ])
    
    // Open modal to configure individual product program
    const openProductConfigModal = (product: TemplateProduct) => {
        const existingConfig = individualProductPrograms[product.id]
        setConfigModalProductId(product.id)
        setConfigModalData(existingConfig || {
            productId: product.id,
            programName: `${name} - ${product.name}`,
            hasPatientPortal: hasPatientPortal,
            patientPortalPrice: patientPortalPrice,
            hasBmiCalculator: hasBmiCalculator,
            bmiCalculatorPrice: bmiCalculatorPrice,
            hasProteinIntakeCalculator: hasProteinIntakeCalculator,
            proteinIntakeCalculatorPrice: proteinIntakeCalculatorPrice,
            hasCalorieDeficitCalculator: hasCalorieDeficitCalculator,
            calorieDeficitCalculatorPrice: calorieDeficitCalculatorPrice,
            hasEasyShopping: hasEasyShopping,
            easyShoppingPrice: easyShoppingPrice,
        })
        setConfigModalOpen(true)
    }
    
    // Save individual product program configuration
    const saveProductConfig = () => {
        if (!configModalProductId || !configModalData) return
        
        setIndividualProductPrograms(prev => ({
            ...prev,
            [configModalProductId]: configModalData
        }))
        setConfigModalOpen(false)
        setConfigModalProductId(null)
        setConfigModalData(null)
    }
    
    // Remove individual product program configuration
    const removeProductConfig = (productId: string) => {
        setIndividualProductPrograms(prev => {
            const newMap = { ...prev }
            delete newMap[productId]
            return newMap
        })
    }

    const filteredTemplates = templates
        .filter(t => {
            // Only show custom templates (not system)
            if (t.formTemplateType === 'system') return false
            
            // Only show templates that have products
            if (!t.formProducts || t.formProducts.length === 0) return false
            
            // Apply search filter
            return t.title.toLowerCase().includes(templateSearch.toLowerCase())
        })
        .sort((a, b) => {
            // Selected template always comes first
            if (a.id === medicalTemplateId) return -1
            if (b.id === medicalTemplateId) return 1
            
            // Then sort by number of products (descending) - templates with more products appear first
            const aProductCount = a.formProducts?.length || 0
            const bProductCount = b.formProducts?.length || 0
            return bProductCount - aProductCount
        })

    // Show loading state while waiting for router or data
    if (!router.isReady || loading) {
        if (isEmbedded) {
            return (
                <div className="flex items-center justify-center h-full min-h-[200px] py-16">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                </div>
            )
        }
        return (
            <Layout>
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading program...</p>
                    </div>
                </div>
            </Layout>
        )
    }

    const pageContent = (
            <div className={`bg-background text-foreground ${isEmbedded ? 'p-6' : 'min-h-screen p-8'}`} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="max-w-4xl mx-auto">
                    {/* Back Button — hidden when embedded in iframe */}
                    {!isEmbedded && <button
                        onClick={() => router.push('/programs')}
                        className="mb-6 flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:bg-muted text-sm font-medium transition-all shadow-sm"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Programs
                    </button>}

                    {/* Header — hidden in embedded/modal context since the unified modal header already shows the program name */}
                    {!isEmbedded && (
                        <div className="mb-8">
                            <h1 className="text-3xl font-semibold mb-2">
                                {isCreateMode ? 'Create New Program' : 'Edit Program'}
                            </h1>
                            <p className="text-muted-foreground">
                                {isCreateMode ? 'Set up a new program with Teleforms' : 'Update program details'}
                            </p>
                        </div>
                    )}

                    {/* Tab Navigation — Form and Analytics (hidden in embedded/modal context) */}
                    {!isCreateMode && !isEmbedded && (
                        <div className="flex items-center gap-2 border-b border-gray-200 mb-6">
                            <button
                                onClick={() => {
                                    setActiveTab('form')
                                    router.push(`/programs/${id}?tab=form`, undefined, { shallow: true })
                                }}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'form'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Form Structure
                                </div>
                            </button>
                            {medicalTemplateId && (
                                <button
                                    onClick={() => {
                                        setActiveTab('analytics')
                                        router.push(`/programs/${id}?tab=analytics`, undefined, { shallow: true })
                                    }}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === 'analytics'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4" />
                                        Analytics
                                    </div>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Error Messages */}
                    {error && !isEmbedded && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Details Tab Content — hidden (managed in tenant portal) */}
                    {false && activeTab === 'details' && (
                        <>
                            {/* Step Indicator for Create Mode */}
                    {isCreateMode && (
                        <div className="mb-8 flex items-center justify-center gap-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 1 ? 'bg-primary text-primary-foreground' : currentStep > 1 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
                                </div>
                                <span className={`text-sm font-medium hidden sm:inline ${currentStep === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Teleform
                                </span>
                            </div>
                            <div className="w-8 h-px bg-border"></div>
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 2 ? 'bg-primary text-primary-foreground' : currentStep > 2 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
                                </div>
                                <span className={`text-sm font-medium hidden sm:inline ${currentStep === 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Services
                                </span>
                            </div>
                            <div className="w-8 h-px bg-border"></div>
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    3
                                </div>
                                <span className={`text-sm font-medium hidden sm:inline ${currentStep === 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Program Details
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Program Details (or Edit Mode) — hidden in edit mode */}
                    {(currentStep === 3 || false) && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
                            <h3 className="text-lg font-semibold mb-4">Program Details</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Catalog Name <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., Weight Loss Catalog, Wellness Catalog"
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium">
                                            Description (Optional)
                                        </label>
                                        <span className="text-xs text-muted-foreground">
                                            {116 - description.length} characters remaining
                                        </span>
                                    </div>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe what this program includes..."
                                        rows={3}
                                        maxLength={116}
                                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                {!isCreateMode && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                        <label htmlFor="isActive" className="text-sm font-medium">
                                            Active
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                {isCreateMode ? (
                                    <>
                                    <Button
                                            variant="outline"
                                        onClick={() => setCurrentStep(2)}
                                        className="flex-1"
                                    >
                                            Back
                                    </Button>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving || !name.trim()}
                                            className="flex-1"
                                        >
                                            {saving ? 'Creating Program...' : 'Create Program'}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving || !name.trim()}
                                            className="flex-1"
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => router.push('/programs')}
                                        >
                                            Cancel
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 1: Choose Teleform (Create Mode Only) */}
                    {isCreateMode && currentStep === 1 && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <h3 className="text-lg font-semibold mb-4">Choose Teleform</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Select a medical questionnaire template that will be used for patient intake in this program.
                            </p>

                            {/* Search */}
                            <div className="mb-6">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        placeholder="Search templates..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            {templatesLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Templates List */}
                                    <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                                        {filteredTemplates.length > 0 ? (
                                            filteredTemplates.map((template) => {
                                                const products = template.formProducts
                                                    ?.map(fp => fp.product)
                                                    .filter((p): p is TemplateProduct => !!p) || []
                                                
                                                return (
                                                    <div
                                                        key={template.id}
                                                        onClick={() => setMedicalTemplateId(template.id)}
                                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${medicalTemplateId === template.id
                                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                                    <h4 className="text-sm font-medium">{template.title}</h4>
                                                                </div>
                                                                {template.description && (
                                                                    <p className="text-xs text-muted-foreground mt-1">
                                                                        {template.description}
                                                                    </p>
                                                                )}
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {template.user ? 'Custom' : 'System'}
                                                                    </Badge>
                                                                    {template.user && (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            Created by {template.user.firstName} {template.user.lastName}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Products Section */}
                                                                {products.length > 0 && (
                                                                    <div className="mt-3 pt-3 border-t border-border">
                                                                        <div className="flex items-center gap-1.5 mb-2">
                                                                            <Package className="h-3 w-3 text-muted-foreground" />
                                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                                Products ({products.length})
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {products.slice(0, 5).map((product) => (
                                                                                <div
                                                                                    key={product.id}
                                                                                    className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md"
                                                                                >
                                                                                    {product.imageUrl && (
                                                                                        <img
                                                                                            src={product.imageUrl}
                                                                                            alt={product.name}
                                                                                            className="w-4 h-4 rounded object-cover"
                                                                                        />
                                                                                    )}
                                                                                    <span className="text-xs truncate max-w-[120px]">
                                                                                        {product.name}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                            {products.length > 5 && (
                                                                                <div className="px-2 py-1 bg-muted rounded-md">
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        +{products.length - 5} more
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {medicalTemplateId === template.id && (
                                                                <div className="ml-4">
                                                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                                                        <Check className="h-4 w-4 text-primary-foreground" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <p className="text-sm">No templates found</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Navigation Buttons */}
                                    <div className="flex gap-3">
                                        <Button
                                            onClick={() => setCurrentStep(2)}
                                            className="flex-1"
                                        >
                                            Next: Non-Medical Services
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 2: Non-Medical Services (Create Mode Only) */}
                    {isCreateMode && currentStep === 2 && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <h3 className="text-lg font-semibold">Configure Program</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Choose your pricing mode and configure non-medical services for this program.
                            </p>

                            <div className="bg-muted/40 border border-border rounded-lg p-4 mb-6">
                                <div className="flex flex-col gap-2 mb-3">
                                    <h4 className="text-sm font-semibold">All-In COGS Assumptions (editable)</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Temporary calculator until fee infra is finalized. Values below apply to all products unless overridden later.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Shipping Cost</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={defaultShippingCost}
                                            onChange={(e) => setDefaultShippingCost(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Facilitation Fee</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={defaultFacilitationFee}
                                            onChange={(e) => setDefaultFacilitationFee(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Platform Retained %</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={platformRetainedPercent}
                                            onChange={(e) => setPlatformRetainedPercent(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={includePlatformRetainedInCogs}
                                                onChange={(e) => setIncludePlatformRetainedInCogs(e.target.checked)}
                                            />
                                            Include retained fee in COGS
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Show Products from Selected Template */}
                            {selectedTemplateDetails && selectedTemplateDetails.formProducts && selectedTemplateDetails.formProducts.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Package className="h-5 w-5 text-blue-500" />
                                        <h3 className="text-base font-semibold">Products ({selectedTemplateDetails.formProducts.filter(fp => fp.product).length})</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Products from template: <span className="font-medium text-foreground">{selectedTemplateDetails.title}</span>
                                        <br />
                                        <span className="text-xs">Click the circle next to a product to use its image as the program's display image on the frontend.</span>
                                    </p>
                                </div>
                            )}

                            {/* Program Pricing Mode - MOVED TO TOP */}
                            <div className="bg-muted/50 rounded-lg p-4 mb-6">
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Settings2 className="h-4 w-4" />
                                    Program Pricing Mode
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSwitchToUnified}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                                            programMode === 'unified'
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                programMode === 'unified' ? 'border-primary bg-primary' : 'border-muted-foreground/50'
                                            }`}>
                                                {programMode === 'unified' && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <span className="font-medium">Unified Program</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-6">
                                            One set of non-medical services and prices for all products
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProgramMode('per_product')}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                                            programMode === 'per_product'
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                programMode === 'per_product' ? 'border-primary bg-primary' : 'border-muted-foreground/50'
                                            }`}>
                                                {programMode === 'per_product' && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <span className="font-medium">Per-Product Programs</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-6">
                                            Unique program name, services, and prices for each product
                                        </p>
                                    </button>
                                </div>
                                {programMode === 'per_product' && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                                        💡 Click "Configure" on each product below to set individual program name and pricing
                                    </p>
                                )}
                            </div>

                            {/* Product Cards */}
                            {selectedTemplateDetails && selectedTemplateDetails.formProducts && selectedTemplateDetails.formProducts.length > 0 && (
                                <div className="space-y-4 mb-6">
                                    {selectedTemplateDetails.formProducts
                                        .filter(fp => fp.product)
                                        .map((fp) => {
                                            const product = fp.product!
                                            const isDisplayProduct = frontendDisplayProductId === product.id
                                            
                                            return (
                                                <div key={fp.id} className={`border rounded-xl overflow-hidden transition-all ${isDisplayProduct ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                                                    {/* Product Header */}
                                                    <div className="bg-muted/30 p-4 border-b border-border">
                                                        <div className="flex items-center gap-4">
                                                            {/* Display Image Selection Radio */}
                                                            <div className="flex flex-col items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFrontendDisplayProductId(isDisplayProduct ? null : product.id)}
                                                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                        isDisplayProduct 
                                                                            ? 'border-primary bg-primary' 
                                                                            : 'border-muted-foreground/50 hover:border-primary/50'
                                                                    }`}
                                                                >
                                                                    {isDisplayProduct && <Check className="h-4 w-4 text-white" />}
                                                                </button>
                                                                <span className="text-[10px] text-muted-foreground">Display</span>
                                                            </div>

                                                            {/* Product Image */}
                                                            {product.imageUrl && (
                                                                <img
                                                                    src={product.imageUrl}
                                                                    alt={product.name}
                                                                    className="w-16 h-16 rounded-lg object-cover border border-border"
                                                                />
                                                            )}

                                                            {/* Product Info */}
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="text-lg font-semibold">{product.name}</h4>
                                                                    {isDisplayProduct && (
                                                                        <Badge className="bg-black text-white text-xs">
                                                                            Frontend Display Image
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {product.placeholderSig && (
                                                                    <p className="text-sm text-muted-foreground">
                                                                        <span className="font-medium">SIG:</span> {product.placeholderSig}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* COGS + Sell Price Preview */}
                                                            <div className="text-right min-w-[210px]">
                                                                {(() => {
                                                                    const pricing = getProductPricingPreview(product)
                                                                    return (
                                                                        <div className="space-y-1">
                                                                            <div className="text-xs text-muted-foreground uppercase">All-In COGS</div>
                                                                            <div className="text-xl font-bold">{formatPrice(pricing.allInCogs)}</div>
                                                                            <div className="text-[11px] text-muted-foreground">
                                                                                Product {formatPrice(pricing.baseProductCost)} + Shipping {formatPrice(pricing.shippingCost)} + Services {formatPrice(pricing.serviceTotal)} + Fees {formatPrice(pricing.facilitationFee + pricing.platformRetainedCost)}
                                                                            </div>
                                                                            <div className="flex items-center justify-end gap-2 pt-1">
                                                                                <span className="text-xs text-muted-foreground">Sell Price</span>
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    step="0.01"
                                                                                    value={pricing.sellPrice}
                                                                                    onChange={(e) => updateProductSellPrice(product.id, e.target.value)}
                                                                                    className="w-24 h-8 text-right"
                                                                                />
                                                                            </div>
                                                                            <div className={`text-xs font-medium ${pricing.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                                Net: {formatPrice(pricing.net)} ({pricing.marginPercent.toFixed(1)}%)
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })()}
                                                            </div>

                                                            {/* Configure button for per-product mode */}
                                                            {programMode === 'per_product' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant={individualProductPrograms[product.id] ? 'outline' : 'default'}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        openProductConfigModal(product)
                                                                    }}
                                                                    className="text-xs"
                                                                >
                                                                    <Settings2 className="h-3 w-3 mr-1" />
                                                                    {individualProductPrograms[product.id] ? 'Edit' : 'Configure'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Show configured status for per-product mode */}
                                                    {programMode === 'per_product' && individualProductPrograms[product.id] && (
                                                        <div className="p-4 bg-muted/10 border-t border-border">
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <Check className="h-4 w-4 text-green-500" />
                                                                <span className="text-muted-foreground">
                                                                    Configured: <span className="font-medium text-foreground">{individualProductPrograms[product.id].programName}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                </div>
                            )}

                            {/* Non-Medical Services - Only show if Unified mode */}
                            {programMode === 'unified' && (
                                <>
                                    <h4 className="text-sm font-semibold mb-3">Non-Medical Services</h4>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Configure the services and prices that will apply to all products in this program.
                            </p>

                            {/* Services List */}
                            <div className="space-y-3 mb-6">
                                {/* Patient Portal */}
                                <div className={`p-4 border rounded-lg transition-all ${hasPatientPortal ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasPatientPortal} onChange={(e) => setHasPatientPortal(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Patient Portal</span>
                                        </div>
                                        {hasPatientPortal && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={patientPortalPrice} onChange={(e) => setPatientPortalPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* BMI Calculator */}
                                <div className={`p-4 border rounded-lg transition-all ${hasBmiCalculator ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasBmiCalculator} onChange={(e) => setHasBmiCalculator(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">BMI Calculator</span>
                                        </div>
                                        {hasBmiCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={bmiCalculatorPrice} onChange={(e) => setBmiCalculatorPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Protein Intake Calculator */}
                                <div className={`p-4 border rounded-lg transition-all ${hasProteinIntakeCalculator ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasProteinIntakeCalculator} onChange={(e) => setHasProteinIntakeCalculator(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Protein Intake Calculator</span>
                                        </div>
                                        {hasProteinIntakeCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={proteinIntakeCalculatorPrice} onChange={(e) => setProteinIntakeCalculatorPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Calorie Deficit Calculator */}
                                <div className={`p-4 border rounded-lg transition-all ${hasCalorieDeficitCalculator ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasCalorieDeficitCalculator} onChange={(e) => setHasCalorieDeficitCalculator(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Calorie Deficit Calculator</span>
                                        </div>
                                        {hasCalorieDeficitCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={calorieDeficitCalculatorPrice} onChange={(e) => setCalorieDeficitCalculatorPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Easy Shopping */}
                                <div className={`p-4 border rounded-lg transition-all ${hasEasyShopping ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasEasyShopping} onChange={(e) => setHasEasyShopping(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Easy Shopping</span>
                                        </div>
                                        {hasEasyShopping && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={easyShoppingPrice} onChange={(e) => setEasyShoppingPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Summary */}
                            {(hasPatientPortal || hasBmiCalculator || hasProteinIntakeCalculator || hasCalorieDeficitCalculator || hasEasyShopping) && (
                                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                                    <h4 className="text-sm font-medium mb-2">Selected Services Summary</h4>
                                    <div className="space-y-1">
                                        {hasPatientPortal && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Patient Portal</span>
                                                <span className="font-medium">{patientPortalPrice > 0 ? `$${patientPortalPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                        {hasBmiCalculator && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">BMI Calculator</span>
                                                <span className="font-medium">{bmiCalculatorPrice > 0 ? `$${bmiCalculatorPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                        {hasProteinIntakeCalculator && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Protein Intake Calculator</span>
                                                <span className="font-medium">{proteinIntakeCalculatorPrice > 0 ? `$${proteinIntakeCalculatorPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                        {hasCalorieDeficitCalculator && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Calorie Deficit Calculator</span>
                                                <span className="font-medium">{calorieDeficitCalculatorPrice > 0 ? `$${calorieDeficitCalculatorPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                        {hasEasyShopping && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Easy Shopping</span>
                                                <span className="font-medium">{easyShoppingPrice > 0 ? `$${easyShoppingPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                    )}
                                </>
                            )}

                            {/* Navigation Buttons */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentStep(1)}
                                    className="flex-1"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={() => setCurrentStep(3)}
                                    className="flex-1"
                                >
                                    Next: Catalog Name
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Edit Mode: Show Teleform Selection — hidden (managed in tenant portal) */}
                    {false && !isCreateMode && activeTab === 'details' && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <h3 className="text-lg font-semibold mb-4">Teleform</h3>

                            {/* Search */}
                            <div className="mb-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        placeholder="Search templates..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            {templatesLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {filteredTemplates.length > 0 ? (
                                        filteredTemplates.map((template) => {
                                            const products = template.formProducts
                                                ?.map(fp => fp.product)
                                                .filter((p): p is TemplateProduct => !!p) || []
                                            
                                            return (
                                                <div
                                                    key={template.id}
                                                    onClick={() => setMedicalTemplateId(template.id)}
                                                    className={`p-4 border rounded-lg cursor-pointer transition-all ${medicalTemplateId === template.id
                                                            ? 'border-primary bg-primary/5 shadow-sm'
                                                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                                <h4 className="text-sm font-medium">{template.title}</h4>
                                                            </div>
                                                            {template.description && (
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    {template.description}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {template.user ? 'Custom' : 'System'}
                                                                </Badge>
                                                                {template.user && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Created by {template.user.firstName} {template.user.lastName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Products Section */}
                                                            {products.length > 0 && (
                                                                <div className="mt-3 pt-3 border-t border-border">
                                                                    <div className="flex items-center gap-1.5 mb-2">
                                                                        <Package className="h-3 w-3 text-muted-foreground" />
                                                                        <span className="text-xs font-medium text-muted-foreground">
                                                                            Products ({products.length})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {products.slice(0, 5).map((product) => (
                                                                            <div
                                                                                key={product.id}
                                                                                className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md"
                                                                            >
                                                                                {product.imageUrl && (
                                                                                    <img
                                                                                        src={product.imageUrl}
                                                                                        alt={product.name}
                                                                                        className="w-4 h-4 rounded object-cover"
                                                                                    />
                                                                                )}
                                                                                <span className="text-xs truncate max-w-[120px]">
                                                                                    {product.name}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                        {products.length > 5 && (
                                                                            <div className="px-2 py-1 bg-muted rounded-md">
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    +{products.length - 5} more
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {medicalTemplateId === template.id && (
                                                            <div className="ml-4">
                                                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                                                    <Check className="h-4 w-4 text-primary-foreground" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <p className="text-sm">No templates found</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                        </>
                    )}

                    {/* Edit Mode: Program Form Link - uses program ID */}
                    {!isCreateMode && activeTab === 'form' && (
                        <>
                            {!clinicSlug || !id ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-pulse text-muted-foreground">Loading form data...</div>
                                </div>
                            ) : (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-5 w-5 text-green-500" />
                                <h3 className="text-lg font-semibold">Program Form Link</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Share this link for customers to access all products in this program
                            </p>

                            {(() => {
                                const isLocalhost = process.env.NODE_ENV !== 'production'
                                const protocol = isLocalhost ? 'http' : 'https'
                                const isStaging = process.env.NEXT_PUBLIC_IS_STAGING === 'true'
                                const baseDomain = isStaging ? 'fusehealthstaging.xyz' : 'fusehealth.com'
                                const subdomainBase = isLocalhost
                                    ? `http://${clinicSlug}.localhost:3000`
                                    : `https://${clinicSlug}.${baseDomain}`
                                
                                // Use program ID in the URL with dashboard prefix
                                const programUrl = `${subdomainBase}${dashboardPrefix}/my-products/${id}/program`
                                const customProgramUrl = clinicCustomDomain 
                                    ? `${protocol}://${clinicCustomDomain}${dashboardPrefix}/my-products/${id}/program`
                                    : null
                                
                                // Check if Teleform is selected and has products
                                const hasTemplate = !!medicalTemplateId
                                const templateHasProducts = selectedTemplateDetails?.formProducts && selectedTemplateDetails.formProducts.length > 0
                                const canPreview = hasTemplate && templateHasProducts

                                return (
                                    <div className="border border-border rounded-xl overflow-hidden">
                                        <div className="p-4">
                                            {/* Header with Edit Button */}
                                            <div className="flex items-center justify-between mb-4">
                                                <h5 className="text-sm font-bold text-foreground">
                                                    Program Default Form
                                                </h5>
                                                {!isEditingSteps ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setIsEditingSteps(true)}
                                                        className="h-7 px-2"
                                                    >
                                                        <Edit className="h-3 w-3 mr-1" />
                                                        Edit Order
                                                    </Button>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setFormSteps(savedFormSteps)
                                                                setIsEditingSteps(false)
                                                            }}
                                                            className="h-7 px-2"
                                                            disabled={savingStepOrder}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={saveFormStepOrder}
                                                            className="h-7 px-2"
                                                            disabled={savingStepOrder}
                                                        >
                                                            {savingStepOrder ? 'Saving...' : 'Save Order'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Form Flow Icons */}
                                            <div className="border-b border-border pb-4 mb-4">
                                                {isEditingSteps ? (
                                                    // Edit mode: draggable vertical list
                                                    <div className="space-y-2">
                                                        {formSteps.map((step, idx) => {
                                                            const isLast = idx === formSteps.length - 1
                                                            const isDragging = draggedIndex === idx
                                                            const canDrag = !step.locked

                                                            return (
                                                                <div
                                                                    key={step.id}
                                                                    draggable={canDrag}
                                                                    onDragStart={(e) => {
                                                                        if (canDrag) {
                                                                            setDraggedIndex(idx)
                                                                            e.dataTransfer.effectAllowed = 'move'
                                                                        }
                                                                    }}
                                                                    onDragOver={(e) => {
                                                                        if (!canDrag && isLast) return // Can't drop on locked last item
                                                                        e.preventDefault()
                                                                        e.dataTransfer.dropEffect = 'move'
                                                                    }}
                                                                    onDrop={(e) => {
                                                                        e.preventDefault()
                                                                        if (draggedIndex === null || draggedIndex === idx) return
                                                                        if (isLast) return // Can't drop on last position

                                                                        const newSteps = [...formSteps]
                                                                        const draggedStep = newSteps[draggedIndex]
                                                                        newSteps.splice(draggedIndex, 1)
                                                                        newSteps.splice(idx, 0, draggedStep)
                                                                        
                                                                        // Ensure payment is always last
                                                                        const paymentIndex = newSteps.findIndex(s => s.id === 'payment')
                                                                        if (paymentIndex !== newSteps.length - 1) {
                                                                            const payment = newSteps.splice(paymentIndex, 1)[0]
                                                                            newSteps.push(payment)
                                                                        }
                                                                        
                                                                        setFormSteps(newSteps)
                                                                        setDraggedIndex(null)
                                                                    }}
                                                                    onDragEnd={() => setDraggedIndex(null)}
                                                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                                                        isDragging
                                                                            ? 'opacity-50 border-primary'
                                                                            : step.locked
                                                                            ? 'bg-muted/50 border-border cursor-not-allowed'
                                                                            : 'bg-card border-border cursor-move hover:border-primary/50'
                                                                    }`}
                                                                >
                                                                    {canDrag && (
                                                                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                                    )}
                                                                    <div className="flex items-center gap-2 flex-1">
                                                                        <div className="w-8 h-8 bg-background rounded-lg flex items-center justify-center text-lg border border-border flex-shrink-0">
                                                                            {step.icon}
                                                                        </div>
                                                                        <span className="text-sm font-medium text-foreground">
                                                                            {step.label}
                                                                        </span>
                                                                        {step.locked && (
                                                                            <Badge variant="secondary" className="ml-auto text-[10px]">
                                                                                Fixed Position
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                        <p className="text-xs text-muted-foreground mt-3">
                                                            💡 Drag steps to reorder. Payment & Checkout must always be last.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    // View mode: horizontal flow
                                                    <div className="flex items-center gap-2 overflow-x-auto">
                                                        {formSteps.map((step, idx) => (
                                                            <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="w-8 h-8 bg-card rounded-lg flex items-center justify-center text-lg border border-border">
                                                                        {step.icon}
                                                                    </div>
                                                                    <span className="text-[10px] font-medium text-muted-foreground max-w-[60px] leading-tight">
                                                                        {step.label}
                                                                    </span>
                                                                </div>
                                                                {idx < formSteps.length - 1 && (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/40 flex-shrink-0">
                                                                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Warning when no template selected */}
                                            {!hasTemplate && (
                                                <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                                        Please select a Teleform above to enable preview links
                                                    </p>
                                                </div>
                                            )}

                                            {/* Warning when template is selected but has no products */}
                                            {hasTemplate && !templateHasProducts && (
                                                <div className="flex flex-col gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                                        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                                                            The selected template has no products attached
                                                        </p>
                                                    </div>
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 ml-6">
                                                        A doctor can change the products attached to each Teleform
                                                    </p>
                                                </div>
                                            )}

                                            {/* Form URLs */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Subdomain URL */}
                                                <div className="relative group">
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        onClick={() => canPreview && window.open(programUrl, '_blank')}
                                                        className="gap-1.5"
                                                        disabled={!canPreview}
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                        Preview Subdomain
                                                    </Button>
                                                    {canPreview && (
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 max-w-xs truncate">
                                                            {programUrl}
                                                        </div>
                                                    )}
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => canPreview && handleCopyUrl(programUrl, 'program-subdomain')}
                                                    className="h-8 w-8 p-0"
                                                    title="Copy subdomain URL"
                                                    disabled={!canPreview}
                                                >
                                                    {copiedUrl === 'program-subdomain' ? (
                                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>

                                                {/* Custom Domain URL */}
                                                {customProgramUrl && (
                                                    <>
                                                        <div className="w-px h-6 bg-border mx-1" />
                                                        <div className="relative group">
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                onClick={() => canPreview && window.open(customProgramUrl, '_blank')}
                                                                className="gap-1.5"
                                                                disabled={!canPreview}
                                                            >
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                Preview Custom Domain
                                                            </Button>
                                                            {canPreview && (
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 max-w-xs truncate">
                                                                    {customProgramUrl}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            onClick={() => canPreview && handleCopyUrl(customProgramUrl, 'program-custom')}
                                                            className="h-8 w-8 p-0"
                                                            title="Copy custom domain URL"
                                                            disabled={!canPreview}
                                                        >
                                                            {copiedUrl === 'program-custom' ? (
                                                                <Check className="h-3.5 w-3.5 text-green-500" />
                                                            ) : (
                                                                <Copy className="h-3.5 w-3.5" />
                                                            )}
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                            )}
                        </>
                    )}

                    {/* Edit Mode: Selected Template Products & Form Links — hidden (managed in tenant portal) */}
                    {false && !isCreateMode && activeTab === 'services' && selectedTemplateDetails && selectedTemplateDetails.formProducts && selectedTemplateDetails.formProducts.length > 0 && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Pill className="h-5 w-5 text-blue-500" />
                                <h3 className="text-lg font-semibold">Products ({selectedTemplateDetails.formProducts.filter(fp => fp.product).length})</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Products from template: <span className="font-medium text-foreground">{selectedTemplateDetails.title}</span>
                                <br />
                                <span className="text-xs">Click the circle next to a product to use its image as the program's display image on the frontend.</span>
                            </p>
                            
                            {/* Warning for deactivated products */}
                            {(() => {
                                const deactivatedProducts = selectedTemplateDetails.formProducts
                                    .filter(fp => fp.product && !activatedProductIds.has(fp.product.id))
                                if (deactivatedProducts.length > 0) {
                                    return (
                                        <div className="flex flex-col gap-2 p-4 mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                                                    {deactivatedProducts.length === 1 
                                                        ? '1 product in this template is not activated for your brand'
                                                        : `${deactivatedProducts.length} products in this template are not activated for your brand`
                                                    }
                                                </p>
                                            </div>
                                            <p className="text-xs text-amber-600 dark:text-amber-400 ml-7">
                                                Deactivated products won't be available for purchase. Use the "Activate" button below to enable them.
                                            </p>
                                        </div>
                                    )
                                }
                                return null
                            })()}

                            {/* Program Mode Toggle */}
                            <div className="bg-muted/50 rounded-lg p-4 mb-6">
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Settings2 className="h-4 w-4" />
                                    Program Pricing Mode
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSwitchToUnified}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                                            programMode === 'unified'
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                programMode === 'unified' ? 'border-primary bg-primary' : 'border-muted-foreground/50'
                                            }`}>
                                                {programMode === 'unified' && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <span className="font-medium">Unified Program</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-6">
                                            One set of non-medical services and prices for all products
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProgramMode('per_product')}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                                            programMode === 'per_product'
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                programMode === 'per_product' ? 'border-primary bg-primary' : 'border-muted-foreground/50'
                                            }`}>
                                                {programMode === 'per_product' && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <span className="font-medium">Per-Product Programs</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-6">
                                            Unique program name, services, and prices for each product
                                        </p>
                                    </button>
                                </div>
                                {programMode === 'per_product' && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                                        💡 Click "Configure" on each product below to set individual program name and pricing
                                    </p>
                                )}
                            </div>

                            <div className="bg-muted/40 border border-border rounded-lg p-4 mb-6">
                                <div className="flex flex-col gap-2 mb-3">
                                    <h4 className="text-sm font-semibold">All-In COGS Assumptions (editable)</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Use this to preview true COGS and estimated net payout while setting sell prices.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Shipping Cost</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={defaultShippingCost}
                                            onChange={(e) => setDefaultShippingCost(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Facilitation Fee</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={defaultFacilitationFee}
                                            onChange={(e) => setDefaultFacilitationFee(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Platform Retained %</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={platformRetainedPercent}
                                            onChange={(e) => setPlatformRetainedPercent(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={includePlatformRetainedInCogs}
                                                onChange={(e) => setIncludePlatformRetainedInCogs(e.target.checked)}
                                            />
                                            Include retained fee in COGS
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {selectedTemplateDetails.formProducts
                                    .filter(fp => fp.product)
                                    .map((fp) => {
                                        const product = fp.product!
                                        const productForms = enabledForms.filter(f => f.productId === product.id)
                                        const isDisplayProduct = frontendDisplayProductId === product.id
                                        const isActivated = activatedProductIds.has(product.id)
                                        const isActivating = activatingProductId === product.id
                                        
                                        return (
                                            <div key={fp.id} className={`border rounded-xl overflow-hidden transition-all ${
                                                !isActivated 
                                                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20' 
                                                    : isDisplayProduct 
                                                        ? 'border-primary ring-2 ring-primary/20' 
                                                        : 'border-border'
                                            }`}>
                                                {/* Product Header */}
                                                <div className={`p-4 border-b border-border ${!isActivated ? 'bg-amber-100/50 dark:bg-amber-900/20' : 'bg-muted/30'}`}>
                                                    <div className="flex items-center gap-4">
                                                        {/* Display Image Selection Radio */}
                                                        <div className="flex flex-col items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setFrontendDisplayProductId(isDisplayProduct ? null : product.id)}
                                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                    isDisplayProduct 
                                                                        ? 'border-primary bg-primary' 
                                                                        : 'border-muted-foreground/30 hover:border-primary/50'
                                                                }`}
                                                                title={isDisplayProduct ? 'Click to unset as display image' : 'Use this product image for program display'}
                                                            >
                                                                {isDisplayProduct && (
                                                                    <Check className="h-4 w-4 text-primary-foreground" />
                                                                )}
                                                            </button>
                                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                                {isDisplayProduct ? 'Display' : ''}
                                                            </span>
                                                        </div>
                                                        {product.imageUrl && (
                                                            <img
                                                                src={product.imageUrl}
                                                                alt={product.name}
                                                                className={`w-16 h-16 rounded-lg object-cover border ${isDisplayProduct ? 'border-primary' : 'border-border'} ${!isActivated ? 'opacity-60' : ''}`}
                                                            />
                                                        )}
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className={`font-semibold ${!isActivated ? 'text-muted-foreground' : 'text-foreground'}`}>{product.name}</h4>
                                                                {!isActivated && (
                                                                    <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                                                        Not Activated
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {product.placeholderSig && (
                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                    <span className="font-medium">SIG:</span> {product.placeholderSig}
                                                                </p>
                                                            )}
                                                            {isDisplayProduct && (
                                                                <Badge variant="default" className="mt-1 text-xs">
                                                                    Frontend Display Image
                                                                </Badge>
                                                            )}
                                                            {/* Show individual program config summary */}
                                                            {programMode === 'per_product' && individualProductPrograms[product.id] && (
                                                                <div className="mt-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded inline-flex items-center gap-1">
                                                                    <Check className="h-3 w-3" />
                                                                    Configured: {individualProductPrograms[product.id].programName}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right flex flex-col items-end gap-2 min-w-[220px]">
                                                            <div className="text-right">
                                                                {(() => {
                                                                    const pricing = getProductPricingPreview(product)
                                                                    return (
                                                                        <div>
                                                                            <div className="text-xs text-muted-foreground uppercase tracking-wide">All-In COGS</div>
                                                                            <div className="text-lg font-semibold text-foreground">
                                                                                {formatPrice(pricing.allInCogs)}
                                                                            </div>
                                                                            <div className="text-[11px] text-muted-foreground">
                                                                                Product {formatPrice(pricing.baseProductCost)} + Shipping {formatPrice(pricing.shippingCost)} + Services {formatPrice(pricing.serviceTotal)} + Fees {formatPrice(pricing.facilitationFee + pricing.platformRetainedCost)}
                                                                            </div>
                                                                            <div className="flex items-center justify-end gap-2 mt-2">
                                                                                <span className="text-xs text-muted-foreground">Sell Price</span>
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    step="0.01"
                                                                                    value={pricing.sellPrice}
                                                                                    onChange={(e) => updateProductSellPrice(product.id, e.target.value)}
                                                                                    className="w-24 h-8 text-right"
                                                                                />
                                                                            </div>
                                                                            <div className={`text-xs font-medium mt-1 ${pricing.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                                Net: {formatPrice(pricing.net)} ({pricing.marginPercent.toFixed(1)}%)
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })()}
                                                            </div>
                                                            {/* Activate button for deactivated products */}
                                                            {!isActivated && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleActivateProduct(product.id)
                                                                    }}
                                                                    disabled={isActivating}
                                                                    className="text-xs bg-amber-600 hover:bg-amber-700"
                                                                >
                                                                    {isActivating ? (
                                                                        <>
                                                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                                                            Activating...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Check className="h-3 w-3 mr-1" />
                                                                            Activate
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            )}
                                                            {/* Configure button for per-product mode */}
                                                            {programMode === 'per_product' && isActivated && (
                                                                <Button
                                                                    size="sm"
                                                                    variant={individualProductPrograms[product.id] ? 'outline' : 'default'}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        openProductConfigModal(product)
                                                                    }}
                                                                    className="text-xs"
                                                                >
                                                                    <Settings2 className="h-3 w-3 mr-1" />
                                                                    {individualProductPrograms[product.id] ? 'Edit' : 'Configure'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Default Form - Short form (matching product page structure) */}
                                                {productForms.length > 0 && (() => {
                                                    // Find the DEFAULT form specifically (globalFormStructureId === 'default' or null/undefined)
                                                    const defaultForm = productForms.find(f => 
                                                        !f.globalFormStructureId || f.globalFormStructureId === 'default'
                                                    ) || productForms[0] // Fallback to first if no default found
                                                    const form = defaultForm
                                                    const urls = buildFormUrls(form.id, product.slug)
                                                    
                                                    return (
                                                        <div className="p-4">
                                                            {/* Form Header with Flow Icons */}
                                                            <div className="border-b border-border pb-4 mb-4">
                                                                <div className="flex items-center justify-between gap-6">
                                                                    {/* Left: Name and Type */}
                                                                    <div className="flex-shrink-0">
                                                                        <h5 className="text-sm font-semibold mb-1">
                                                                            Default - Short form
                                                                        </h5>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            📦 Product-Specific Form
                                                                        </p>
                                                                    </div>

                                                                    {/* Center: Form Flow Preview (Inline) */}
                                                                    <div className="flex items-center gap-2 overflow-x-auto flex-1">
                                                                        {[
                                                                            { icon: '🩺', label: 'Medical Questions' },
                                                                            { icon: '👤', label: 'Create Account' },
                                                                            { icon: '🛒', label: 'Product Selection' },
                                                                            { icon: '💳', label: 'Payment & Checkout' }
                                                                        ].map((section, idx, arr) => (
                                                                            <div key={section.label} className="flex items-center gap-2 flex-shrink-0">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <div className="w-8 h-8 bg-card rounded-lg flex items-center justify-center text-lg border border-border">
                                                                                        {section.icon}
                                                                                    </div>
                                                                                    <span className="text-[10px] font-medium text-muted-foreground max-w-[60px] leading-tight">
                                                                                        {section.label}
                                                                                    </span>
                                                                                </div>
                                                                                {idx < arr.length - 1 && (
                                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/40 flex-shrink-0">
                                                                                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                                    </svg>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Form URLs */}
                                                            {urls ? (
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    {/* Subdomain URL */}
                                                                    <div className="relative group">
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="outline" 
                                                                            onClick={() => window.open(urls.subdomainUrl, '_blank')}
                                                                            className="gap-1.5"
                                                                        >
                                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                                            Preview Subdomain
                                                                        </Button>
                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 max-w-xs truncate">
                                                                            {urls.subdomainUrl}
                                                                        </div>
                                                                    </div>
                                                                    <Button 
                                                                        size="sm" 
                                                                        variant="ghost" 
                                                                        onClick={() => handleCopyUrl(urls.subdomainUrl, `${product.id}-subdomain`)}
                                                                        className="h-8 w-8 p-0"
                                                                        title="Copy subdomain URL"
                                                                    >
                                                                        {copiedUrl === `${product.id}-subdomain` ? (
                                                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                                                        ) : (
                                                                            <Copy className="h-3.5 w-3.5" />
                                                                        )}
                                                                    </Button>

                                                                    {/* Custom Domain URL (if configured) */}
                                                                    {urls.customDomainUrl && (
                                                                        <>
                                                                            <div className="w-px h-6 bg-border mx-1" />
                                                                            <div className="relative group">
                                                                                <Button 
                                                                                    size="sm" 
                                                                                    variant="outline" 
                                                                                    onClick={() => urls.customDomainUrl && window.open(urls.customDomainUrl, '_blank')}
                                                                                    className="gap-1.5"
                                                                                >
                                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                                    Preview Custom Domain
                                                                                </Button>
                                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 max-w-xs truncate">
                                                                                    {urls.customDomainUrl}
                                                                                </div>
                                                                            </div>
                                                                            <Button 
                                                                                size="sm" 
                                                                                variant="ghost" 
                                                                                onClick={() => urls.customDomainUrl && handleCopyUrl(urls.customDomainUrl, `${product.id}-custom`)}
                                                                                className="h-8 w-8 p-0"
                                                                                title="Copy custom domain URL"
                                                                            >
                                                                                {copiedUrl === `${product.id}-custom` ? (
                                                                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                                                                ) : (
                                                                                    <Copy className="h-3.5 w-3.5" />
                                                                                )}
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-3 rounded">
                                                                    Form URL not available - Missing: 
                                                                    {!product.slug && ' product slug'}
                                                                    {!clinicSlug && ' clinic slug'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })()}

                                                {/* No forms message - different for activated vs deactivated */}
                                                {productForms.length === 0 && (
                                                    <div className="p-4">
                                                        {isActivated ? (
                                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                                <FileText className="h-4 w-4" />
                                                                No forms enabled for this product yet. 
                                                                <a 
                                                                    href={`/products/${product.id}`} 
                                                                    className="text-primary hover:underline"
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    Configure in Products →
                                                                </a>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                                                <AlertTriangle className="h-4 w-4" />
                                                                Activate this product first to configure forms and make it available for purchase.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Edit Mode: Non-Medical Services — hidden (managed in tenant portal) */}
                    {false && !isCreateMode && activeTab === 'services' && programMode === 'unified' && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <h3 className="text-lg font-semibold">Non-Medical Services</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Select which non-medical services to offer in this program and set their prices.
                            </p>

                            {/* Services List */}
                            <div className="space-y-3">
                                {/* Patient Portal */}
                                <div className={`p-4 border rounded-lg transition-all ${hasPatientPortal ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasPatientPortal} onChange={(e) => setHasPatientPortal(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Patient Portal</span>
                                        </div>
                                        {hasPatientPortal && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={patientPortalPrice} onChange={(e) => setPatientPortalPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* BMI Calculator */}
                                <div className={`p-4 border rounded-lg transition-all ${hasBmiCalculator ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasBmiCalculator} onChange={(e) => setHasBmiCalculator(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">BMI Calculator</span>
                                        </div>
                                        {hasBmiCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={bmiCalculatorPrice} onChange={(e) => setBmiCalculatorPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Protein Intake Calculator */}
                                <div className={`p-4 border rounded-lg transition-all ${hasProteinIntakeCalculator ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasProteinIntakeCalculator} onChange={(e) => setHasProteinIntakeCalculator(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Protein Intake Calculator</span>
                                        </div>
                                        {hasProteinIntakeCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={proteinIntakeCalculatorPrice} onChange={(e) => setProteinIntakeCalculatorPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Calorie Deficit Calculator */}
                                <div className={`p-4 border rounded-lg transition-all ${hasCalorieDeficitCalculator ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasCalorieDeficitCalculator} onChange={(e) => setHasCalorieDeficitCalculator(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Calorie Deficit Calculator</span>
                                        </div>
                                        {hasCalorieDeficitCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={calorieDeficitCalculatorPrice} onChange={(e) => setCalorieDeficitCalculatorPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Easy Shopping */}
                                <div className={`p-4 border rounded-lg transition-all ${hasEasyShopping ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasEasyShopping} onChange={(e) => setHasEasyShopping(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Easy Shopping</span>
                                        </div>
                                        {hasEasyShopping && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={easyShoppingPrice} onChange={(e) => setEasyShoppingPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                        
                    {/* Analytics Tab */}
                    {!isCreateMode && activeTab === 'analytics' && medicalTemplateId && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <BarChart3 className="h-5 w-5 text-blue-500" />
                                <h3 className="text-lg font-semibold">Form Analytics</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Track visitor behavior, completion rates, and form performance for this program's medical form.
                            </p>
                            
                            {(() => {
                                // Find the first form ID (TenantProductForm ID) for analytics
                                // All products in the program share the same Teleform
                                const formWithId = enabledForms.find(f => f.id)
                                
                                if (!formWithId?.id) {
                                    return (
                                        <div className="text-center py-12">
                                            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                            <h4 className="text-lg font-medium text-foreground mb-2">
                                                No Form Data Available
                                            </h4>
                                            <p className="text-muted-foreground">
                                                {enabledForms.length === 0 
                                                    ? "Loading forms..." 
                                                    : "This program's forms have not been published yet"}
                                            </p>
                                        </div>
                                    )
                                }
                                
                                return (
                                    <div>
                                        {selectedTemplateDetails && (
                                            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border">
                                                <FileText className="h-5 w-5 text-blue-500" />
                                                <div>
                                                    <h4 className="text-base font-semibold">{selectedTemplateDetails.title}</h4>
                                                    {selectedTemplateDetails.description && (
                                                        <p className="text-sm text-muted-foreground">{selectedTemplateDetails.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <FormAnalytics 
                                            formId={formWithId.id} 
                                            templateTitle={selectedTemplateDetails?.title}
                                            formStepLabels={formSteps.map((step) => step.label)}
                                        />
                                    </div>
                                )
                            })()}
                        </div>
                    )}
                </div>

            {/* Warning Dialog for Switching to Unified Mode */}
            {showUnifiedWarning && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-md mx-4">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Switch to Unified Pricing?</h3>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Switching to unified pricing mode will <span className="font-medium text-foreground">permanently delete</span> all 
                                individual product programs and their custom pricing configurations. 
                                The unified non-medical services pricing will apply to all products.
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowUnifiedWarning(false)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={confirmSwitchToUnified}
                                    className="flex-1"
                                >
                                    Delete & Switch
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Individual Product Program Configuration Modal */}
            {configModalOpen && configModalData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold">Configure Product Program</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Set unique pricing for this product
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setConfigModalOpen(false)
                                        setConfigModalProductId(null)
                                        setConfigModalData(null)
                                    }}
                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Program Name */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-2">
                                    Program Name for this Product
                                </label>
                                <Input
                                    value={configModalData.programName}
                                    onChange={(e) => setConfigModalData(prev => prev ? { ...prev, programName: e.target.value } : null)}
                                    placeholder="e.g., NAD+ Wellness Program"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    This name will be shown to customers for this specific product
                                </p>
                            </div>

                            {/* Non-Medical Services */}
                            <div className="space-y-3 mb-6">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Non-Medical Services & Pricing
                                </h4>

                                {/* Patient Portal */}
                                <div className={`p-3 border rounded-lg transition-all ${configModalData.hasPatientPortal ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={configModalData.hasPatientPortal}
                                                onChange={(e) => setConfigModalData(prev => prev ? { ...prev, hasPatientPortal: e.target.checked } : null)}
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm font-medium">Patient Portal</span>
                                        </div>
                                        {configModalData.hasPatientPortal && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={configModalData.patientPortalPrice}
                                                    onChange={(e) => setConfigModalData(prev => prev ? { ...prev, patientPortalPrice: parseFloat(e.target.value) || 0 } : null)}
                                                    className="w-20 text-right text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* BMI Calculator */}
                                <div className={`p-3 border rounded-lg transition-all ${configModalData.hasBmiCalculator ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={configModalData.hasBmiCalculator}
                                                onChange={(e) => setConfigModalData(prev => prev ? { ...prev, hasBmiCalculator: e.target.checked } : null)}
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm font-medium">BMI Calculator</span>
                                        </div>
                                        {configModalData.hasBmiCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={configModalData.bmiCalculatorPrice}
                                                    onChange={(e) => setConfigModalData(prev => prev ? { ...prev, bmiCalculatorPrice: parseFloat(e.target.value) || 0 } : null)}
                                                    className="w-20 text-right text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Protein Intake Calculator */}
                                <div className={`p-3 border rounded-lg transition-all ${configModalData.hasProteinIntakeCalculator ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={configModalData.hasProteinIntakeCalculator}
                                                onChange={(e) => setConfigModalData(prev => prev ? { ...prev, hasProteinIntakeCalculator: e.target.checked } : null)}
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm font-medium">Protein Intake Calculator</span>
                                        </div>
                                        {configModalData.hasProteinIntakeCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={configModalData.proteinIntakeCalculatorPrice}
                                                    onChange={(e) => setConfigModalData(prev => prev ? { ...prev, proteinIntakeCalculatorPrice: parseFloat(e.target.value) || 0 } : null)}
                                                    className="w-20 text-right text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Calorie Deficit Calculator */}
                                <div className={`p-3 border rounded-lg transition-all ${configModalData.hasCalorieDeficitCalculator ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={configModalData.hasCalorieDeficitCalculator}
                                                onChange={(e) => setConfigModalData(prev => prev ? { ...prev, hasCalorieDeficitCalculator: e.target.checked } : null)}
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm font-medium">Calorie Deficit Calculator</span>
                                        </div>
                                        {configModalData.hasCalorieDeficitCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={configModalData.calorieDeficitCalculatorPrice}
                                                    onChange={(e) => setConfigModalData(prev => prev ? { ...prev, calorieDeficitCalculatorPrice: parseFloat(e.target.value) || 0 } : null)}
                                                    className="w-20 text-right text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Easy Shopping */}
                                <div className={`p-3 border rounded-lg transition-all ${configModalData.hasEasyShopping ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={configModalData.hasEasyShopping}
                                                onChange={(e) => setConfigModalData(prev => prev ? { ...prev, hasEasyShopping: e.target.checked } : null)}
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm font-medium">Easy Shopping</span>
                                        </div>
                                        {configModalData.hasEasyShopping && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={configModalData.easyShoppingPrice}
                                                    onChange={(e) => setConfigModalData(prev => prev ? { ...prev, easyShoppingPrice: parseFloat(e.target.value) || 0 } : null)}
                                                    className="w-20 text-right text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Summary */}
                            {(configModalData.hasPatientPortal || configModalData.hasBmiCalculator || configModalData.hasProteinIntakeCalculator || configModalData.hasCalorieDeficitCalculator || configModalData.hasEasyShopping) && (
                                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                                    <h4 className="text-sm font-medium mb-2">Total Non-Medical Fee</h4>
                                    <div className="text-2xl font-bold text-primary">
                                        {formatPrice(
                                            (configModalData.hasPatientPortal ? configModalData.patientPortalPrice : 0) +
                                            (configModalData.hasBmiCalculator ? configModalData.bmiCalculatorPrice : 0) +
                                            (configModalData.hasProteinIntakeCalculator ? configModalData.proteinIntakeCalculatorPrice : 0) +
                                            (configModalData.hasCalorieDeficitCalculator ? configModalData.calorieDeficitCalculatorPrice : 0) +
                                            (configModalData.hasEasyShopping ? configModalData.easyShoppingPrice : 0)
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                {configModalData.existingProgramId && (
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            if (configModalProductId) {
                                                removeProductConfig(configModalProductId)
                                            }
                                            setConfigModalOpen(false)
                                            setConfigModalProductId(null)
                                            setConfigModalData(null)
                                        }}
                                        className="flex-1"
                                    >
                                        Remove Configuration
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setConfigModalOpen(false)
                                        setConfigModalProductId(null)
                                        setConfigModalData(null)
                                    }}
                                    className={configModalData.existingProgramId ? '' : 'flex-1'}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={saveProductConfig}
                                    className="flex-1"
                                >
                                    Save Configuration
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )

    return isEmbedded ? (
        <>{pageContent}</>
    ) : (
        <Layout>
            <Head>
                <title>{isCreateMode ? 'Create Program' : 'Edit Program'} - Fuse Admin</title>
            </Head>
            {pageContent}
        </Layout>
    )
}
