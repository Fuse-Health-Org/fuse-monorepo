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
    Search
} from 'lucide-react'

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
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export default function ProgramEditor() {
    const router = useRouter()
    const { id } = router.query
    const isCreateMode = id === 'create'

    const { token } = useAuth()
    const [loading, setLoading] = useState(!isCreateMode)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [medicalTemplateId, setMedicalTemplateId] = useState<string | null>(null)
    const [isActive, setIsActive] = useState(true)

    // Step state for creation flow
    const [currentStep, setCurrentStep] = useState(1)

    // Medical templates
    const [templates, setTemplates] = useState<MedicalTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(true)
    const [templateSearch, setTemplateSearch] = useState('')

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

    const filteredTemplates = templates.filter(t =>
        t.title.toLowerCase().includes(templateSearch.toLowerCase())
    )

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
                        <div className="mb-8 flex items-center justify-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    1
                                </div>
                                <span className={`text-sm font-medium ${currentStep === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Program Details
                                </span>
                            </div>
                            <div className="w-12 h-px bg-border"></div>
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    2
                                </div>
                                <span className={`text-sm font-medium ${currentStep === 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Medical Template
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
                                            filteredTemplates.map((template) => (
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
                                            ))
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
                                            onClick={handleSave}
                                            disabled={saving || !name.trim()}
                                            className="flex-1"
                                        >
                                            {saving ? 'Creating Program...' : 'Create Program'}
                                        </Button>
                                    </div>
                                </>
                            )}
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
                                        filteredTemplates.map((template) => (
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
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <p className="text-sm">No templates found</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
