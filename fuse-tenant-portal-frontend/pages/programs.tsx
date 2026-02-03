import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Stethoscope,
    Plus,
    Edit,
    Trash2,
    FileText,
    Loader2
} from 'lucide-react'

interface ProgramTemplate {
    id: string
    name: string
    description?: string
    medicalTemplateId?: string
    isActive: boolean
    isTemplate: boolean
    createdAt: string
    updatedAt: string
    medicalTemplate?: {
        id: string
        title: string
        description?: string
        formTemplateType: string
    }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export default function ProgramTemplates() {
    const [templates, setTemplates] = useState<ProgramTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { token } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (token) {
            fetchTemplates()
        }
    }, [token])

    const fetchTemplates = async () => {
        if (!token) return

        try {
            setLoading(true)
            const response = await fetch(`${API_URL}/program-templates`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    setTemplates(data.data)
                } else {
                    setError(data.message || 'Failed to load program templates')
                }
            } else {
                setError('Failed to load program templates')
            }
        } catch (err) {
            console.error('Error fetching program templates:', err)
            setError('Failed to load program templates')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteTemplate = async (templateId: string, templateName: string) => {
        if (!confirm(`Are you sure you want to delete "${templateName}" template? This action cannot be undone.`)) {
            return
        }

        try {
            const response = await fetch(`${API_URL}/program-templates/${templateId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            const data = await response.json()

            if (response.ok && data.success) {
                setTemplates(prev => prev.filter(t => t.id !== templateId))
                setError('✅ Program template deleted successfully!')
                setTimeout(() => setError(null), 3000)
            } else {
                setError(data.message || 'Failed to delete program template')
            }
        } catch (err) {
            console.error('Error deleting program template:', err)
            setError('Failed to delete program template')
        }
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-0">
                <Header />
                <main className="flex-1 overflow-y-auto p-8">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h1 className="text-3xl font-semibold text-foreground mb-2">Program Templates</h1>
                            <p className="text-base text-muted-foreground">
                                Create and manage program templates that brands can customize
                            </p>
                        </div>
                        <Button
                            onClick={() => router.push('/programs/create')}
                            className="flex items-center gap-2 bg-[#4FA59C] hover:bg-[#478F87] text-white px-6 py-2.5 rounded-full shadow-sm"
                        >
                            <Plus className="h-4 w-4" />
                            Create Template
                        </Button>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div
                            className={`mb-6 p-4 border rounded-2xl ${error.includes('✅')
                                ? 'bg-background border-border text-foreground'
                                : 'bg-destructive/10 border-destructive/30 text-destructive text-sm'
                                }`}
                        >
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Info Banner */}
                    <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                        <div className="flex gap-3">
                            <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                                    What are Program Templates?
                                </h3>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Templates are read-only blueprints that brands can use to create their own customized programs. 
                                    Brands can modify their own versions, but cannot change the templates themselves.
                                </p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex h-64 items-center justify-center text-muted-foreground">
                            <Loader2 className="mr-3 h-6 w-6 animate-spin text-[#4FA59C]" />
                            <span className="text-base">Loading templates...</span>
                        </div>
                    ) : templates.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    className="bg-card rounded-2xl shadow-sm border border-border p-6 hover:shadow-md hover:border-[#4FA59C] transition-all cursor-pointer"
                                    onClick={() => router.push(`/programs/${template.id}`)}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-xl flex items-center justify-center shadow-sm">
                                                <Stethoscope className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold">{template.name}</h3>
                                                <Badge variant={template.isActive ? "default" : "secondary"} className="text-xs mt-1">
                                                    {template.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {template.description && (
                                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                            {template.description}
                                        </p>
                                    )}

                                    {template.medicalTemplate && (
                                        <div className="mb-4 p-3 bg-muted rounded-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs font-medium text-muted-foreground">Medical Template</span>
                                            </div>
                                            <p className="text-sm font-medium">{template.medicalTemplate.title}</p>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 pt-4 border-t border-border">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                router.push(`/programs/${template.id}`)
                                            }}
                                            className="flex-1 hover:bg-[#4FA59C]/10 hover:text-[#4FA59C] hover:border-[#4FA59C]"
                                        >
                                            <Edit className="h-3 w-3 mr-1" />
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteTemplate(template.id, template.name)
                                            }}
                                            className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-sm">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                    <Stethoscope className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className='flex flex-col justify-center items-center'>
                                    <h3 className="text-lg font-semibold mb-1">No program templates yet</h3>
                                    <p className="text-sm text-muted-foreground mb-4 max-w-md">
                                        Create your first program template to provide brands with a starting point for their programs
                                    </p>
                                    <Button
                                        onClick={() => router.push('/programs/create')}
                                        className="flex items-center gap-2 bg-[#4FA59C] hover:bg-[#478F87] text-white px-6 py-2.5 rounded-full shadow-sm"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Create Template
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
