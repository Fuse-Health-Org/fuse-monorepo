import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import {
    ArrowLeft,
    FileText,
    Check,
    Search,
    Package,
    DollarSign,
    Sparkles,
    Copy,
    Pill
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export default function ProgramEditor() {
    const router = useRouter()
    const { id } = router.query
    const isCreateMode = id === 'create'

    const { token, user } = useAuth()
    const [loading, setLoading] = useState(!isCreateMode)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [medicalTemplateId, setMedicalTemplateId] = useState<string | null>(null)
    const [isActive, setIsActive] = useState(true)

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


    // Step state for creation flow
    const [currentStep, setCurrentStep] = useState(1)

    // Medical templates
    const [templates, setTemplates] = useState<MedicalTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(true)
    const [templateSearch, setTemplateSearch] = useState('')

    // Selected template details (for edit mode display)
    const [selectedTemplateDetails, setSelectedTemplateDetails] = useState<MedicalTemplate | null>(null)
    
    // Clinic info for building form URLs
    const [clinicSlug, setClinicSlug] = useState<string | null>(null)
    const [clinicCustomDomain, setClinicCustomDomain] = useState<string | null>(null)
    
    // Enabled forms for each product
    const [enabledForms, setEnabledForms] = useState<EnabledForm[]>([])
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

    // Load existing program if editing
    useEffect(() => {
        if (!isCreateMode && token && id) {
            fetchProgram()
        }
    }, [token, id, isCreateMode])

    // Load medical templates
    useEffect(() => {
        if (token) {
            fetchTemplates()
        }
    }, [token])

    // Load clinic info for form URLs
    useEffect(() => {
        const fetchClinic = async () => {
            console.log('🏥 Fetching clinic info...', { token: !!token, clinicId: user?.clinicId })
            if (!token || !user?.clinicId) {
                console.log('⚠️ Missing token or clinicId')
                return
            }
            try {
                const response = await fetch(`${API_URL}/clinic/${user.clinicId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (response.ok) {
                    const data = await response.json()
                    console.log('🏥 Clinic data:', data)
                    if (data.success && data.data) {
                        setClinicSlug(data.data.slug)
                        setClinicCustomDomain(data.data.customDomain || null)
                        console.log('✅ Clinic slug set:', data.data.slug)
                    }
                } else {
                    console.error('❌ Failed to fetch clinic:', response.status)
                }
            } catch (err) {
                console.error('Failed to load clinic:', err)
            }
        }
        fetchClinic()
    }, [token, user?.clinicId])

    // Load selected template details and forms when template is selected
    useEffect(() => {
        if (!medicalTemplateId || !token) {
            setSelectedTemplateDetails(null)
            setEnabledForms([])
            return
        }

        // Find template from loaded templates list
        const template = templates.find(t => t.id === medicalTemplateId)
        console.log('📋 Selected template:', template)
        console.log('📦 Products in template:', template?.formProducts?.map(fp => ({
            id: fp.product?.id,
            name: fp.product?.name,
            slug: fp.product?.slug
        })))
        if (template) {
            setSelectedTemplateDetails(template)
            
            // Fetch enabled forms for each product in this template
            const fetchFormsForProducts = async () => {
                if (!template.formProducts?.length) return
                
                const allForms: EnabledForm[] = []
                for (const fp of template.formProducts) {
                    if (!fp.product?.id) continue
                    console.log(`🔄 Fetching forms for product: ${fp.product.name} (ID: ${fp.product.id})`)
                    try {
                        const res = await fetch(`${API_URL}/admin/tenant-product-forms?productId=${fp.product.id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        })
                        if (res.ok) {
                            const data = await res.json()
                            console.log(`📥 Forms returned for ${fp.product.name}:`, data?.data)
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
                console.log('📋 All forms collected:', allForms)
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

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Program name is required')
            return
        }

        try {
            setSaving(true)
            setError(null)

            const payload = {
                name: name.trim(),
                description: description.trim() || undefined,
                medicalTemplateId: medicalTemplateId || undefined,
                // Non-medical services
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
                isActive,
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

    // Build BOTH URLs for forms with custom domains (matching product page)
    const buildFormUrls = (formId: string, productSlug: string | undefined | null) => {
        if (!formId || !productSlug || !clinicSlug) return null

        const isLocalhost = process.env.NODE_ENV !== 'production'
        const protocol = isLocalhost ? 'http' : 'https'

        // Standard subdomain URL (always available)
        const isStaging = process.env.NEXT_PUBLIC_IS_STAGING === 'true'
        const baseDomain = isStaging ? 'fusehealthstaging.xyz' : 'fusehealth.com'
        const subdomainBase = isLocalhost
            ? `http://${clinicSlug}.localhost:3000`
            : `https://${clinicSlug}.${baseDomain}`
        const subdomainUrl = `${subdomainBase}/my-products/${formId}/${productSlug}`

        // Custom domain URL (if configured)
        let customDomainUrl = null
        if (clinicCustomDomain) {
            customDomainUrl = `${protocol}://${clinicCustomDomain}/my-products/${formId}/${productSlug}`
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

    const filteredTemplates = templates
        .filter(t => t.title.toLowerCase().includes(templateSearch.toLowerCase()))
        .sort((a, b) => {
            // Sort by number of products (descending) - templates with more products appear first
            const aProductCount = a.formProducts?.length || 0
            const bProductCount = b.formProducts?.length || 0
            return bProductCount - aProductCount
        })

    if (loading) {
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

    return (
        <Layout>
            <Head>
                <title>{isCreateMode ? 'Create Program' : 'Edit Program'} - Fuse Admin</title>
            </Head>
            <div className="min-h-screen bg-background text-foreground p-8" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="max-w-4xl mx-auto">
                    {/* Back Button */}
                    <button
                        onClick={() => router.push('/programs')}
                        className="mb-6 flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:bg-muted text-sm font-medium transition-all shadow-sm"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Programs
                    </button>

                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-semibold mb-2">
                            {isCreateMode ? 'Create New Program' : 'Edit Program'}
                        </h1>
                        <p className="text-muted-foreground">
                            {isCreateMode ? 'Set up a new program with medical templates' : 'Update program details'}
                        </p>
                    </div>

                    {/* Error Messages */}
                    {error && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Step Indicator for Create Mode */}
                    {isCreateMode && (
                        <div className="mb-8 flex items-center justify-center gap-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 1 ? 'bg-primary text-primary-foreground' : currentStep > 1 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
                                </div>
                                <span className={`text-sm font-medium hidden sm:inline ${currentStep === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Program Details
                                </span>
                            </div>
                            <div className="w-8 h-px bg-border"></div>
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 2 ? 'bg-primary text-primary-foreground' : currentStep > 2 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
                                </div>
                                <span className={`text-sm font-medium hidden sm:inline ${currentStep === 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Medical Template
                                </span>
                            </div>
                            <div className="w-8 h-px bg-border"></div>
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    3
                                </div>
                                <span className={`text-sm font-medium hidden sm:inline ${currentStep === 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Services
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Step 1: Program Details (or Edit Mode) */}
                    {(currentStep === 1 || !isCreateMode) && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
                            <h3 className="text-lg font-semibold mb-4">Program Details</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Program Name <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., Weight Loss Program, Wellness Program"
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Description (Optional)
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe what this program includes..."
                                        rows={3}
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
                                    <Button
                                        onClick={() => setCurrentStep(2)}
                                        disabled={!name.trim()}
                                        className="flex-1"
                                    >
                                        Next: Choose Medical Template
                                    </Button>
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

                    {/* Step 2: Choose Medical Template (Create Mode Only) */}
                    {isCreateMode && currentStep === 2 && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <h3 className="text-lg font-semibold mb-4">Choose Medical Template Form</h3>
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
                                            Next: Non-Medical Services
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 3: Non-Medical Services (Create Mode Only) */}
                    {isCreateMode && currentStep === 3 && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <h3 className="text-lg font-semibold">Non-Medical Services</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Select which non-medical services to offer in this program and set their prices.
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

                            {/* Navigation Buttons */}
                            <div className="flex gap-3">
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
                            </div>
                        </div>
                    )}

                    {/* Edit Mode: Show Medical Template Selection */}
                    {!isCreateMode && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <h3 className="text-lg font-semibold mb-4">Medical Template</h3>

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

                    {/* Edit Mode: Selected Template Products & Form Links */}
                    {!isCreateMode && selectedTemplateDetails && selectedTemplateDetails.formProducts && selectedTemplateDetails.formProducts.length > 0 && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Pill className="h-5 w-5 text-blue-500" />
                                <h3 className="text-lg font-semibold">Program Products & Form Links</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Products from template: <span className="font-medium text-foreground">{selectedTemplateDetails.title}</span>
                            </p>

                            <div className="space-y-4">
                                {selectedTemplateDetails.formProducts
                                    .filter(fp => fp.product)
                                    .map((fp) => {
                                        const product = fp.product!
                                        const productForms = enabledForms.filter(f => f.productId === product.id)
                                        
                                        // Debug logging
                                        console.log('🔍 Product:', { id: product.id, name: product.name, slug: product.slug })
                                        console.log('📝 All enabled forms:', enabledForms.map(f => ({ id: f.id, productId: f.productId })))
                                        console.log('✅ Matched forms for this product:', productForms.map(f => ({ id: f.id, productId: f.productId })))
                                        
                                        return (
                                            <div key={fp.id} className="border border-border rounded-xl overflow-hidden">
                                                {/* Product Header */}
                                                <div className="bg-muted/30 p-4 border-b border-border">
                                                    <div className="flex items-center gap-4">
                                                        {product.imageUrl && (
                                                            <img
                                                                src={product.imageUrl}
                                                                alt={product.name}
                                                                className="w-16 h-16 rounded-lg object-cover border border-border"
                                                            />
                                                        )}
                                                        <div className="flex-1">
                                                            <h4 className="font-semibold text-foreground">{product.name}</h4>
                                                            {product.placeholderSig && (
                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                    <span className="font-medium">SIG:</span> {product.placeholderSig}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-muted-foreground uppercase tracking-wide">Wholesale Cost</div>
                                                            <div className="text-lg font-semibold text-foreground">
                                                                {formatPrice(product.pharmacyWholesaleCost || product.price || 0)}
                                                            </div>
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
                                                    console.log('🎯 Default form for', product.name, ':', form)
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
                                                                            { icon: '📦', label: 'Product Questions' },
                                                                            { icon: '👤', label: 'Create Account' },
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
                                                                <div className="bg-card border border-border rounded-lg p-3">
                                                                    <div className="space-y-3">
                                                                        {/* Standard Subdomain URL */}
                                                                        <div>
                                                                            <div className="text-xs font-medium text-muted-foreground mb-1">
                                                                                Subdomain URL:
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="text-xs truncate flex-1 font-mono bg-muted px-2 py-1 rounded">
                                                                                    {urls.subdomainUrl}
                                                                                </div>
                                                                                <Button size="sm" variant="outline" onClick={() => window.open(urls.subdomainUrl, '_blank')}>
                                                                                    Preview
                                                                                </Button>
                                                                                <Button 
                                                                                    size="sm" 
                                                                                    variant="outline" 
                                                                                    onClick={() => handleCopyUrl(urls.subdomainUrl, `${product.id}-subdomain`)}
                                                                                >
                                                                                    {copiedUrl === `${product.id}-subdomain` ? 'Copied!' : 'Copy'}
                                                                                </Button>
                                                                            </div>
                                                                        </div>

                                                                        {/* Custom Domain URL (if configured) */}
                                                                        {urls.customDomainUrl && (
                                                                            <div>
                                                                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                                                                    Custom Domain URL:
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="text-xs truncate flex-1 font-mono bg-muted px-2 py-1 rounded">
                                                                                        {urls.customDomainUrl}
                                                                                    </div>
                                                                                    <Button size="sm" variant="outline" onClick={() => urls.customDomainUrl && window.open(urls.customDomainUrl, '_blank')}>
                                                                                        Preview
                                                                                    </Button>
                                                                                    <Button 
                                                                                        size="sm" 
                                                                                        variant="outline" 
                                                                                        onClick={() => urls.customDomainUrl && handleCopyUrl(urls.customDomainUrl, `${product.id}-custom`)}
                                                                                    >
                                                                                        {copiedUrl === `${product.id}-custom` ? 'Copied!' : 'Copy'}
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
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

                                                {/* No forms message */}
                                                {productForms.length === 0 && (
                                                    <div className="p-4">
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
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Edit Mode: Non-Medical Services */}
                    {!isCreateMode && (
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
                </div>
            </div>
        </Layout>
    )
}
