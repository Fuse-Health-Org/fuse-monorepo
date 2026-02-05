import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    ArrowLeft,
    FileText,
    Check,
    Search,
    DollarSign,
    Loader2,
    Save,
    Package
} from 'lucide-react'

interface Product {
    id: string
    name: string
    description?: string
    imageUrl?: string
    price?: number
    wholesalePrice?: number
}

interface FormProduct {
    id: string
    formId: string
    productId: string
    product: Product
}

interface MedicalTemplate {
    id: string
    title: string
    description?: string
    formTemplateType: string
    formProducts?: FormProduct[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export default function ProgramTemplateEditor() {
    const router = useRouter()
    const { id } = router.query
    const isCreateMode = id === 'create'

    const { token } = useAuth()
    const [loading, setLoading] = useState(!isCreateMode)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

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

    // Medical templates
    const [templates, setTemplates] = useState<MedicalTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(true)
    const [templateSearch, setTemplateSearch] = useState('')

    // Load existing template if editing
    useEffect(() => {
        if (!router.isReady) return
        
        if (isCreateMode) {
            setLoading(false)
            return
        }
        
        if (token && id) {
            fetchTemplate()
        }
    }, [token, id, isCreateMode, router.isReady])

    // Load medical templates
    useEffect(() => {
        if (token) {
            fetchMedicalTemplates()
        }
    }, [token])

    const fetchTemplate = async () => {
        try {
            setLoading(true)
            const response = await fetch(`${API_URL}/program-templates/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success && data.data) {
                    const template = data.data
                    setName(template.name)
                    setDescription(template.description || '')
                    setMedicalTemplateId(template.medicalTemplateId || null)
                    setIsActive(template.isActive)
                    // Load non-medical services
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
                } else {
                    setError(data.message || 'Failed to load template')
                }
            } else {
                setError('Failed to load template')
            }
        } catch (err) {
            console.error('Error fetching template:', err)
            setError('Failed to load template')
        } finally {
            setLoading(false)
        }
    }

    const fetchMedicalTemplates = async () => {
        try {
            setTemplatesLoading(true)
            const response = await fetch(`${API_URL}/questionnaires/templates/product-forms`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success && Array.isArray(data.data)) {
                    // Only include templates that have products attached (via FormProducts)
                    const templatesWithProducts = data.data.filter((template: any) => {
                        // Check if template has formProducts array with at least one entry
                        return template.formProducts && Array.isArray(template.formProducts) && template.formProducts.length > 0
                    })
                    setTemplates(templatesWithProducts)
                }
            }
        } catch (err) {
            console.error('Error fetching medical templates:', err)
        } finally {
            setTemplatesLoading(false)
        }
    }

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Template name is required')
            return
        }

        try {
            setSaving(true)
            setError(null)
            setSuccess(null)

            const payload = {
                name: name.trim(),
                description: description.trim() || undefined,
                medicalTemplateId: medicalTemplateId || undefined,
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

            const url = isCreateMode 
                ? `${API_URL}/program-templates` 
                : `${API_URL}/program-templates/${id}`
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
                setSuccess(isCreateMode ? 'Template created successfully!' : 'Template updated successfully!')
                
                if (isCreateMode) {
                    // Navigate to the edit page for the newly created template
                    setTimeout(() => {
                        router.push(`/programs/${data.data.id}`)
                    }, 1000)
                }
            } else {
                setError(data.message || 'Failed to save template')
            }
        } catch (err) {
            console.error('Error saving template:', err)
            setError('Failed to save template')
        } finally {
            setSaving(false)
        }
    }

    const filteredTemplates = templates.filter(t =>
        t.title.toLowerCase().includes(templateSearch.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex h-screen bg-background overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-h-0">
                    <Header />
                    <main className="flex-1 overflow-y-auto flex items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-[#4FA59C] mx-auto mb-4" />
                            <p className="text-muted-foreground">Loading template...</p>
                        </div>
                    </main>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-0">
                <Header />
                <main className="flex-1 overflow-y-auto p-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/programs')}
                                className="flex items-center gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                            <div>
                                <h1 className="text-3xl font-semibold text-foreground">
                                    {isCreateMode ? 'Create Program Template' : 'Edit Program Template'}
                                </h1>
                                <p className="text-base text-muted-foreground mt-1">
                                    {isCreateMode 
                                        ? 'Create a template that brands can use as a starting point'
                                        : 'Update this template - changes will not affect existing programs'}
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !name.trim()}
                            className="flex items-center gap-2 bg-[#4FA59C] hover:bg-[#478F87] text-white px-6 py-2.5 rounded-full shadow-sm"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Template
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="mb-6 p-4 border rounded-2xl bg-destructive/10 border-destructive/30 text-destructive text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-6 p-4 border rounded-2xl bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            {success}
                        </div>
                    )}

                    <div className="max-w-4xl space-y-6">
                        {/* Basic Info */}
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        Template Name *
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., Weight Loss Program, Hair Growth Program"
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe what this program template includes..."
                                        className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-[#4FA59C] transition-all resize-none"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Template Status</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isActive ? 'Active templates are visible to brands' : 'Inactive templates are hidden from brands'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsActive(!isActive)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 ${
                                            isActive ? 'bg-[#4FA59C]' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${
                                                isActive ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Medical Template Selection */}
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <h2 className="text-lg font-semibold text-foreground mb-4">Medical Template</h2>
                            <p className="text-sm text-muted-foreground mb-4">
                                Select the medical questionnaire form that will be used with this program template
                            </p>

                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        placeholder="Search medical templates..."
                                        className="pl-9"
                                    />
                                </div>

                                {templatesLoading ? (
                                    <div className="text-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-[#4FA59C] mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">Loading templates...</p>
                                    </div>
                                ) : (
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {filteredTemplates.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <FileText className="h-8 w-8 mx-auto mb-2" />
                                                <p className="text-sm">No medical templates found</p>
                                            </div>
                                        ) : (
                                            filteredTemplates.map((template) => (
                                                <div
                                                    key={template.id}
                                                    onClick={() => setMedicalTemplateId(template.id)}
                                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                                        medicalTemplateId === template.id
                                                            ? 'border-[#4FA59C] bg-[#4FA59C]/10'
                                                            : 'border-border hover:border-muted-foreground/50'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <FileText className="h-5 w-5 text-muted-foreground" />
                                                            <div>
                                                                <p className="text-sm font-medium text-foreground">
                                                                    {template.title}
                                                                </p>
                                                                {template.description && (
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        {template.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {medicalTemplateId === template.id && (
                                                            <Check className="h-5 w-5 text-[#4FA59C]" />
                                                        )}
                                                    </div>

                                                    {/* Associated Products */}
                                                    {template.formProducts && template.formProducts.length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-border/50">
                                                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                                                                <Package className="h-3 w-3" />
                                                                Associated Products ({template.formProducts.length})
                                                            </p>
                                                            <div className="space-y-2">
                                                                {template.formProducts.map((formProduct) => (
                                                                    <div
                                                                        key={formProduct.id}
                                                                        className="flex items-center gap-2 p-2 rounded-lg bg-background/50"
                                                                    >
                                                                        {formProduct.product.imageUrl ? (
                                                                            <img
                                                                                src={formProduct.product.imageUrl}
                                                                                alt={formProduct.product.name}
                                                                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                                                                <Package className="h-5 w-5 text-muted-foreground" />
                                                                            </div>
                                                                        )}
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-medium text-foreground truncate">
                                                                                {formProduct.product.name}
                                                                            </p>
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                {formProduct.product.price && (
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        ${formProduct.product.price.toFixed(2)}
                                                                                    </span>
                                                                                )}
                                                                                {formProduct.product.wholesalePrice && (
                                                                                    <span className="text-xs text-[#4FA59C]">
                                                                                        ${formProduct.product.wholesalePrice.toFixed(2)} wholesale
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Non-Medical Services */}
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <h2 className="text-lg font-semibold text-foreground mb-2">Non-Medical Services</h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                Configure additional services and their default prices for this template
                            </p>

                            <div className="space-y-4">
                                {/* Patient Portal */}
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted">
                                    <button
                                        onClick={() => setHasPatientPortal(!hasPatientPortal)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 flex-shrink-0 mt-1 ${
                                            hasPatientPortal ? 'bg-[#4FA59C]' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${
                                                hasPatientPortal ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground">Patient Portal Access</p>
                                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                                            Access to online patient portal with health tracking
                                        </p>
                                        {hasPatientPortal && (
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    value={patientPortalPrice}
                                                    onChange={(e) => setPatientPortalPrice(parseFloat(e.target.value) || 0)}
                                                    placeholder="0.00"
                                                    className="w-32"
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* BMI Calculator */}
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted">
                                    <button
                                        onClick={() => setHasBmiCalculator(!hasBmiCalculator)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 flex-shrink-0 mt-1 ${
                                            hasBmiCalculator ? 'bg-[#4FA59C]' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${
                                                hasBmiCalculator ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground">BMI Calculator</p>
                                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                                            Body Mass Index calculator and tracking
                                        </p>
                                        {hasBmiCalculator && (
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    value={bmiCalculatorPrice}
                                                    onChange={(e) => setBmiCalculatorPrice(parseFloat(e.target.value) || 0)}
                                                    placeholder="0.00"
                                                    className="w-32"
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Protein Intake Calculator */}
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted">
                                    <button
                                        onClick={() => setHasProteinIntakeCalculator(!hasProteinIntakeCalculator)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 flex-shrink-0 mt-1 ${
                                            hasProteinIntakeCalculator ? 'bg-[#4FA59C]' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${
                                                hasProteinIntakeCalculator ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground">Protein Intake Calculator</p>
                                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                                            Daily protein requirement calculator
                                        </p>
                                        {hasProteinIntakeCalculator && (
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    value={proteinIntakeCalculatorPrice}
                                                    onChange={(e) => setProteinIntakeCalculatorPrice(parseFloat(e.target.value) || 0)}
                                                    placeholder="0.00"
                                                    className="w-32"
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Calorie Deficit Calculator */}
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted">
                                    <button
                                        onClick={() => setHasCalorieDeficitCalculator(!hasCalorieDeficitCalculator)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 flex-shrink-0 mt-1 ${
                                            hasCalorieDeficitCalculator ? 'bg-[#4FA59C]' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${
                                                hasCalorieDeficitCalculator ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground">Calorie Deficit Calculator</p>
                                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                                            Calculate optimal calorie deficit for weight loss
                                        </p>
                                        {hasCalorieDeficitCalculator && (
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    value={calorieDeficitCalculatorPrice}
                                                    onChange={(e) => setCalorieDeficitCalculatorPrice(parseFloat(e.target.value) || 0)}
                                                    placeholder="0.00"
                                                    className="w-32"
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Easy Shopping */}
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted">
                                    <button
                                        onClick={() => setHasEasyShopping(!hasEasyShopping)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 flex-shrink-0 mt-1 ${
                                            hasEasyShopping ? 'bg-[#4FA59C]' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${
                                                hasEasyShopping ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground">Easy Shopping</p>
                                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                                            Streamlined shopping experience for patients
                                        </p>
                                        {hasEasyShopping && (
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    value={easyShoppingPrice}
                                                    onChange={(e) => setEasyShoppingPrice(parseFloat(e.target.value) || 0)}
                                                    placeholder="0.00"
                                                    className="w-32"
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save Button (Bottom) */}
                        <div className="flex justify-end pt-4">
                            <Button
                                onClick={handleSave}
                                disabled={saving || !name.trim()}
                                size="lg"
                                className="bg-[#4FA59C] hover:bg-[#478F87] text-white px-8 py-3 rounded-full shadow-sm"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-5 w-5 mr-2" />
                                        Save Template
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
