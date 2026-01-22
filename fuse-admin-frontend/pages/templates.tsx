import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToastManager } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import Layout from '@/components/Layout'
import {
    Mail,
    MessageSquare,
    Plus,
    Search,
    Edit,
    Trash2,
    Copy,
    Eye,
    X,
    FileText,
    Calendar,
    User,
    Smartphone,
    Code2,
    ChevronDown,
    ChevronUp
} from 'lucide-react'

interface TemplateBlock {
    id: string
    type: 'text' | 'image'
    content: string
    order: number
}

interface MergeField {
    name: string          // Display name like "First Name"
    dbField: string       // Database field like "firstName"
}

interface MessageTemplate {
    id: string
    clinicId: string
    name: string
    description?: string
    type: 'email' | 'sms'
    subject?: string
    body: string // Can be plain text or JSON string of TemplateBlock[]
    category?: string
    mergeFields: string[]
    isActive: boolean
    version: number
    createdBy: string
    createdAt: string
    updatedAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function Templates() {
    const { user, token } = useAuth()
    const { toasts, dismiss, success, error: showError } = useToast()
    const [templates, setTemplates] = useState<MessageTemplate[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [duplicating, setDuplicating] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteConfirmName, setDeleteConfirmName] = useState('')
    const [isEditMode, setIsEditMode] = useState(false)
    const [isCreatingNew, setIsCreatingNew] = useState(false)
    const [templateBlocks, setTemplateBlocks] = useState<TemplateBlock[]>([])
    const [draggedBlock, setDraggedBlock] = useState<'text' | 'image' | null>(null)
    const [saving, setSaving] = useState(false)
    const [editedName, setEditedName] = useState('')
    const [editedDescription, setEditedDescription] = useState('')
    const [editedSubject, setEditedSubject] = useState('')
    const [editedType, setEditedType] = useState<'email' | 'sms'>('email')
    const [editedMergeFields, setEditedMergeFields] = useState<string[]>([])
    const [showHIPAAFieldsDropdown, setShowHIPAAFieldsDropdown] = useState(false)

    // Fetch templates on mount
    useEffect(() => {
        fetchTemplates()
    }, [])

    // Debug edit mode
    useEffect(() => {
        console.log('🔍 isEditMode changed:', isEditMode)
        console.log('📦 templateBlocks:', templateBlocks)
    }, [isEditMode, templateBlocks])

    const fetchTemplates = async () => {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch(`${API_URL}/message-templates`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                throw new Error('Failed to fetch templates')
            }

            const data = await response.json()
            
            if (data.success) {
                setTemplates(data.data || [])
            } else {
                throw new Error(data.message || 'Failed to fetch templates')
            }
        } catch (err) {
            console.error('Error fetching templates:', err)
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleDuplicate = async (templateId: string) => {
        try {
            setDuplicating(true)

            const response = await fetch(`${API_URL}/message-templates/${templateId}/duplicate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                throw new Error('Failed to duplicate template')
            }

            const data = await response.json()

            if (data.success) {
                // Refresh templates list
                await fetchTemplates()
                // Close modal
                setShowModal(false)
                setSelectedTemplate(null)
                success('Template duplicated successfully!')
            } else {
                throw new Error(data.message || 'Failed to duplicate template')
            }
        } catch (err) {
            console.error('Error duplicating template:', err)
            showError(err instanceof Error ? err.message : 'Failed to duplicate template')
        } finally {
            setDuplicating(false)
        }
    }

    const handleDeleteClick = () => {
        setDeleteConfirmName('')
        setShowDeleteModal(true)
    }

    const handleDeleteConfirm = async () => {
        if (!selectedTemplate) return

        try {
            setDeleting(true)

            const response = await fetch(`${API_URL}/message-templates/${selectedTemplate.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                throw new Error('Failed to delete template')
            }

            const data = await response.json()

            if (data.success) {
                // Refresh templates list
                await fetchTemplates()
                // Close modals
                setShowDeleteModal(false)
                setShowModal(false)
                setSelectedTemplate(null)
                setDeleteConfirmName('')
                success('Template deleted successfully!')
            } else {
                throw new Error(data.message || 'Failed to delete template')
            }
        } catch (err) {
            console.error('Error deleting template:', err)
            showError(err instanceof Error ? err.message : 'Failed to delete template')
        } finally {
            setDeleting(false)
        }
    }

    const handleDeleteCancel = () => {
        setShowDeleteModal(false)
        setDeleteConfirmName('')
    }

    // Filter templates by search and type
    const filteredTemplates = templates.filter(template => {
        const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.description?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesType = template.type === activeTab
        return matchesSearch && matchesType
    })

    const handleTemplateClick = (template: MessageTemplate) => {
        setSelectedTemplate(template)
        setShowModal(true)
        setIsEditMode(false)
        // Parse body to blocks if it's JSON
        try {
            const parsed = JSON.parse(template.body)
            if (Array.isArray(parsed)) {
                setTemplateBlocks(parsed)
            } else {
                setTemplateBlocks([])
            }
        } catch {
            // If body is not JSON, treat as plain text
            setTemplateBlocks([])
        }
    }

    const handleCreateNew = () => {
        console.log('✨ Creating new template')
        setIsCreatingNew(true)
        setIsEditMode(true)
        setShowModal(true)
        setEditedName('Untitled Template')
        setEditedDescription('')
        setEditedSubject('')
        setEditedType(activeTab) // Use current active tab
        setEditedMergeFields([])
        setTemplateBlocks([{
            id: '1',
            type: 'text',
            content: 'Start typing your message here...',
            order: 0
        }])
        setSelectedTemplate(null)
    }

    const openCreateModal = (type: 'email' | 'sms') => {
        console.log(`✨ Creating new ${type} template`)
        setIsCreatingNew(true)
        setIsEditMode(true)
        setShowModal(true)
        setEditedName('Untitled Template')
        setEditedDescription('')
        setEditedSubject('')
        setEditedType(type) // Set specific type
        setEditedMergeFields([])
        setTemplateBlocks([{
            id: '1',
            type: 'text',
            content: 'Start typing your message here...',
            order: 0
        }])
        setSelectedTemplate(null)
        // Switch to the correct tab
        setActiveTab(type)
    }

    const handleEditClick = () => {
        if (!selectedTemplate) return
        console.log('🔧 Entering edit mode')
        setIsEditMode(true)
        setEditedName(selectedTemplate.name)
        setEditedDescription(selectedTemplate.description || '')
        setEditedSubject(selectedTemplate.subject || '')
        setEditedType(selectedTemplate.type)
        setEditedMergeFields(selectedTemplate.mergeFields || [])
        // Parse body to blocks if needed
        try {
            const parsed = JSON.parse(selectedTemplate.body)
            if (Array.isArray(parsed)) {
                setTemplateBlocks(parsed)
            } else {
                // Convert plain text to single text block
                setTemplateBlocks([{
                    id: '1',
                    type: 'text',
                    content: selectedTemplate.body,
                    order: 0
                }])
            }
        } catch {
            // Convert plain text to single text block
            setTemplateBlocks([{
                id: '1',
                type: 'text',
                content: selectedTemplate.body,
                order: 0
            }])
        }
    }

    const handleCancelEdit = () => {
        setIsEditMode(false)
        if (isCreatingNew) {
            setIsCreatingNew(false)
            setShowModal(false)
            setSelectedTemplate(null)
        }
    }

    const handleAddHIPAAField = (fieldName: string, dbField: string) => {
        // Create the merge field with mapping: name|dbField
        const mergeFieldWithMapping = `${fieldName}|${dbField}`
        
        // Check if already exists
        if (editedMergeFields.some(f => f.startsWith(fieldName + '|'))) {
            showError('This HIPAA field is already added')
            return
        }

        setEditedMergeFields([...editedMergeFields, mergeFieldWithMapping])
        setShowHIPAAFieldsDropdown(false)
        success('HIPAA field added! Click "Save Changes" to persist.', 'Added to template')
    }

    const handleRemoveMergeField = (field: string) => {
        setEditedMergeFields(editedMergeFields.filter(f => f !== field))
    }

    // HIPAA Fields Dropdown Component
    const HIPAAFieldsDropdown = () => {
        const hipaaFields = [
            { name: 'phone_last4', dbField: 'phone', description: 'Shows: XXX-XXX-4567' },
            { name: 'phone_masked', dbField: 'phone', description: 'Shows: XXX-XXX-4567' },
            { name: 'email_masked', dbField: 'email', description: 'Shows: j***@example.com' },
            { name: 'age', dbField: 'dateOfBirth', description: 'Shows: 34 (calculated from DOB)' },
            { name: 'dob_year', dbField: 'dateOfBirth', description: 'Shows: 1990' },
            { name: 'name_masked', dbField: 'firstName', description: 'Shows: John D.' },
            { name: 'firstName', dbField: 'firstName', description: 'Patient first name' },
            { name: 'lastName', dbField: 'lastName', description: 'Patient last name' },
            { name: 'email', dbField: 'email', description: 'Patient email address' },
            { name: 'phone', dbField: 'phone', description: 'Patient phone number' },
            { name: 'dateOfBirth', dbField: 'dateOfBirth', description: 'Patient date of birth' },
            { name: 'gender', dbField: 'gender', description: 'Patient gender' },
            { name: 'address', dbField: 'address', description: 'Patient address' },
            { name: 'city', dbField: 'city', description: 'Patient city' },
            { name: 'state', dbField: 'state', description: 'Patient state' },
            { name: 'zipCode', dbField: 'zipCode', description: 'Patient zip code' },
        ]

        return (
            <div className="relative">
                <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setShowHIPAAFieldsDropdown(!showHIPAAFieldsDropdown)}
                    className="flex items-center gap-2 h-8 text-xs"
                >
                    <Code2 className="h-3.5 w-3.5" />
                    HIPAA Fields
                    {showHIPAAFieldsDropdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>

                {showHIPAAFieldsDropdown && (
                    <>
                        {/* Backdrop to close dropdown when clicking outside */}
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowHIPAAFieldsDropdown(false)}
                        />

                        <div className="absolute z-20 bottom-full mb-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 max-h-[400px] overflow-y-auto">
                            <div className="text-xs font-semibold text-gray-500 mb-2 px-2">
                                Click to add HIPAA field
                            </div>

                            {hipaaFields.map((field) => {
                                const fieldKey = `${field.name}|${field.dbField}`
                                const isAlreadyAdded = editedMergeFields.some(f => f.startsWith(field.name + '|'))
                                
                                return (
                                    <button
                                        key={fieldKey}
                                        type="button"
                                        onClick={() => {
                                            if (!isAlreadyAdded) {
                                                handleAddHIPAAField(field.name, field.dbField)
                                            }
                                        }}
                                        disabled={isAlreadyAdded}
                                        className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between group transition-colors ${
                                            isAlreadyAdded 
                                                ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900' 
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        <div className="flex-1">
                                            <div className="font-mono font-medium text-sm">{'{{' + field.name + '}}'}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{field.description}</div>
                                        </div>
                                        {isAlreadyAdded && (
                                            <span className="text-green-600 text-xs font-medium">Added</span>
                                        )}
                                    </button>
                                )
                            })}

                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-[10px] text-gray-500 px-2 leading-relaxed">
                                    HIPAA-safe fields automatically mask sensitive PHI data to comply with regulations.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        )
    }

    // Helper function to render template body (handles both JSON blocks and plain text)
    const renderTemplateBody = (body: string) => {
        try {
            const parsed = JSON.parse(body)
            if (Array.isArray(parsed)) {
                // It's a JSON array of blocks
                return (
                    <div className="space-y-2">
                        {parsed.map((block: TemplateBlock) => {
                            if (block.type === 'text') {
                                return (
                                    <div key={block.id} className="text-[10px] text-gray-700 leading-relaxed">
                                        {block.content}
                                    </div>
                                )
                            } else if (block.type === 'image') {
                                return (
                                    <div key={block.id} className="my-2">
                                        {block.content ? (
                                            <img 
                                                src={block.content} 
                                                alt="Template image" 
                                                className="w-full rounded"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none'
                                                }}
                                            />
                                        ) : (
                                            <div className="bg-gray-100 rounded p-2 text-center">
                                                <Eye className="h-4 w-4 mx-auto text-gray-400" />
                                                <p className="text-[8px] text-gray-400 mt-1">Image placeholder</p>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                            return null
                        })}
                    </div>
                )
            }
        } catch {
            // Not JSON, return as plain text
        }
        
        // Plain text fallback
        return <div className="text-[10px] text-gray-700 whitespace-pre-line leading-relaxed">{body}</div>
    }

    const handleSaveChanges = async () => {
        try {
            setSaving(true)

            // Convert blocks to JSON string
            const bodyAsJson = JSON.stringify(templateBlocks)

            if (isCreatingNew) {
                // CREATE new template
                console.log('Creating new template')

                const response = await fetch(`${API_URL}/message-templates`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: editedName,
                        description: editedDescription,
                        type: editedType,
                        subject: editedType === 'email' ? editedSubject : undefined,
                        body: bodyAsJson,
                        mergeFields: editedMergeFields,
                        category: 'custom'
                    })
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.message || 'Failed to create template')
                }

                const data = await response.json()

                if (data.success) {
                    await fetchTemplates()
                    setIsEditMode(false)
                    setIsCreatingNew(false)
                    setShowModal(false)
                    success('Template created successfully!')
                    
                    // Show HIPAA warnings if present
                    if (data.warnings && data.warnings.length > 0) {
                        console.warn('🔒 HIPAA Warnings:', data.warnings)
                        setTimeout(() => {
                            showError(`⚠️ HIPAA Warning: ${data.warnings.join(', ')}`)
                        }, 500)
                    }
                } else {
                    throw new Error(data.message || 'Failed to create template')
                }
            } else {
                // UPDATE existing template
                if (!selectedTemplate) return

                console.log('Updating template with body:', bodyAsJson)

                const response = await fetch(`${API_URL}/message-templates/${selectedTemplate.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: editedName,
                        description: editedDescription,
                        type: editedType,
                        subject: editedType === 'email' ? editedSubject : undefined,
                        body: bodyAsJson,
                        mergeFields: editedMergeFields
                    })
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.message || 'Failed to update template')
                }

                const data = await response.json()

                if (data.success) {
                    setSelectedTemplate({ 
                        ...selectedTemplate, 
                        name: editedName,
                        description: editedDescription,
                        type: editedType,
                        subject: editedType === 'email' ? editedSubject : undefined,
                        body: bodyAsJson,
                        mergeFields: editedMergeFields
                    })
                    await fetchTemplates()
                    setIsEditMode(false)
                    success('Template saved successfully!')
                    
                    // Show HIPAA warnings if present
                    if (data.warnings && data.warnings.length > 0) {
                        console.warn('🔒 HIPAA Warnings:', data.warnings)
                        setTimeout(() => {
                            showError(`⚠️ HIPAA Warning: ${data.warnings.join(', ')}`)
                        }, 500)
                    }
                } else {
                    throw new Error(data.message || 'Failed to update template')
                }
            }
        } catch (err) {
            console.error('Error saving template:', err)
            showError(err instanceof Error ? err.message : 'Failed to save template')
        } finally {
            setSaving(false)
        }
    }

    // Drag and drop handlers
    const handleDragStart = (blockType: 'text' | 'image') => {
        setDraggedBlock(blockType)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        if (!draggedBlock) return

        const newBlock: TemplateBlock = {
            id: `block-${Date.now()}`,
            type: draggedBlock,
            content: draggedBlock === 'text' ? 'New text block' : '',
            order: templateBlocks.length
        }

        setTemplateBlocks([...templateBlocks, newBlock])
        setDraggedBlock(null)
    }

    const handleBlockContentChange = (blockId: string, newContent: string) => {
        setTemplateBlocks(blocks =>
            blocks.map(block =>
                block.id === blockId ? { ...block, content: newContent } : block
            )
        )
    }

    const handleRemoveBlock = (blockId: string) => {
        setTemplateBlocks(blocks => blocks.filter(block => block.id !== blockId))
    }

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, blockId: string) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showError('Please select an image file')
            return
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            showError('Image must be less than 5MB')
            return
        }

        try {
            // Show loading state
            const loadingToastId = `upload-${blockId}`
            success('Uploading image...', loadingToastId)

            // Create form data
            const formData = new FormData()
            formData.append('image', file)

            // Upload to backend
            const response = await fetch(`${API_URL}/message-templates/upload-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Failed to upload image')
            }

            const data = await response.json()

            if (data.success && data.data.url) {
                // Update block content with S3 URL
                handleBlockContentChange(blockId, data.data.url)
                dismiss(loadingToastId)
                success('Image uploaded successfully!')
            } else {
                throw new Error('Invalid response from server')
            }

        } catch (error) {
            console.error('Error uploading image:', error)
            showError(error instanceof Error ? error.message : 'Failed to upload image')
        }

        // Reset input
        event.target.value = ''
    }

    const closeModal = () => {
        setShowModal(false)
        setSelectedTemplate(null)
        setIsCreatingNew(false)
        setIsEditMode(false)
    }

    return (
        <>
            <Head>
                <title>Message Templates - Admin Portal</title>
                <style jsx global>{`
                    .phone-preview-scroll::-webkit-scrollbar {
                        width: 1px;
                    }
                    .phone-preview-scroll::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .phone-preview-scroll::-webkit-scrollbar-thumb {
                        background: rgba(0, 0, 0, 0.08);
                        border-radius: 0px;
                    }
                    .phone-preview-scroll::-webkit-scrollbar-thumb:hover {
                        background: rgba(0, 0, 0, 0.15);
                    }
                `}</style>
            </Head>
            <Layout>
                <div className="space-y-6 p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-semibold text-foreground flex items-center gap-3">
                                <FileText className="h-8 w-8 text-primary" />
                                Message Templates
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Create and manage reusable email and SMS templates
                            </p>
                        </div>
                        <Button className="gap-2" onClick={handleCreateNew}>
                            <Plus className="h-4 w-4" />
                            New Template
                        </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Total Templates</p>
                                        <h3 className="text-2xl font-bold mt-1">{templates.length}</h3>
                                    </div>
                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Email Templates</p>
                                        <h3 className="text-2xl font-bold mt-1">
                                            {templates.filter(t => t.type === 'email').length}
                                        </h3>
                                    </div>
                                    <Mail className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">SMS Templates</p>
                                        <h3 className="text-2xl font-bold mt-1">
                                            {templates.filter(t => t.type === 'sms').length}
                                        </h3>
                                    </div>
                                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Search */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                <input
                                    type="text"
                                    placeholder="Search templates..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabs with Templates */}
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'email' | 'sms')}>
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="email" className="gap-2">
                                <Mail className="h-4 w-4" />
                                Email Templates
                            </TabsTrigger>
                            <TabsTrigger value="sms" className="gap-2">
                                <MessageSquare className="h-4 w-4" />
                                SMS Templates
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="email" className="mt-6">
                            {loading ? (
                                <Card>
                                    <CardContent className="pt-12 pb-12 text-center">
                                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-muted-foreground">Loading templates...</p>
                                    </CardContent>
                                </Card>
                            ) : error ? (
                                <Card>
                                    <CardContent className="pt-12 pb-12 text-center">
                                        <Mail className="h-12 w-12 text-destructive mx-auto mb-4" />
                                        <h3 className="text-lg font-medium mb-2">Error loading templates</h3>
                                        <p className="text-muted-foreground mb-6">{error}</p>
                                        <Button onClick={fetchTemplates}>
                                            Try Again
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : filteredTemplates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredTemplates.map((template) => (
                                    <Card 
                                        key={template.id} 
                                        className="cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => handleTemplateClick(template)}
                                    >
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="text-base flex items-center gap-2">
                                                        <Mail className="h-4 w-4 text-primary" />
                                                        {template.name}
                                                    </CardTitle>
                                                    {template.description && (
                                                        <CardDescription className="mt-2">
                                                            {template.description}
                                                        </CardDescription>
                                                    )}
                                                </div>
                                                {template.version > 1 && (
                                                    <Badge variant="secondary" className="ml-2">
                                                        v{template.version}
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {template.category && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {template.category}
                                                    </Badge>
                                                )}
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            ) : (
                            <Card>
                                <CardContent className="pt-12 pb-12 text-center">
                                    <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium mb-2">No email templates found</h3>
                                    <p className="text-muted-foreground mb-6">
                                        {searchTerm ? 'Try adjusting your search' : 'Create your first email template to get started'}
                                    </p>
                                    {!searchTerm && templates.length === 0 && (
                                        <Button onClick={() => openCreateModal('email')}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create Email Template
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="sms" className="mt-6">
                            {loading ? (
                                <Card>
                                    <CardContent className="pt-12 pb-12 text-center">
                                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-muted-foreground">Loading templates...</p>
                                    </CardContent>
                                </Card>
                            ) : error ? (
                                <Card>
                                    <CardContent className="pt-12 pb-12 text-center">
                                        <MessageSquare className="h-12 w-12 text-destructive mx-auto mb-4" />
                                        <h3 className="text-lg font-medium mb-2">Error loading templates</h3>
                                        <p className="text-muted-foreground mb-6">{error}</p>
                                        <Button onClick={fetchTemplates}>
                                            Try Again
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : filteredTemplates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredTemplates.map((template) => (
                                    <Card 
                                        key={template.id} 
                                        className="cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => handleTemplateClick(template)}
                                    >
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="text-base flex items-center gap-2">
                                                        <MessageSquare className="h-4 w-4 text-primary" />
                                                        {template.name}
                                                    </CardTitle>
                                                    {template.description && (
                                                        <CardDescription className="mt-2">
                                                            {template.description}
                                                        </CardDescription>
                                                    )}
                                                </div>
                                                {template.version > 1 && (
                                                    <Badge variant="secondary" className="ml-2">
                                                        v{template.version}
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {template.category && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {template.category}
                                                    </Badge>
                                                )}
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {template.body.length} characters
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            ) : (
                            <Card>
                                <CardContent className="pt-12 pb-12 text-center">
                                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium mb-2">No SMS templates found</h3>
                                    <p className="text-muted-foreground mb-6">
                                        {searchTerm ? 'Try adjusting your search' : 'Create your first SMS template to get started'}
                                    </p>
                                    {!searchTerm && templates.length === 0 && (
                                        <Button onClick={() => openCreateModal('sms')}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create SMS Template
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Modal */}
                {(showModal && (selectedTemplate || isCreatingNew)) && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full h-[70vh] flex flex-col overflow-hidden">
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        {(() => {
                                            const currentType = (isEditMode || isCreatingNew) ? editedType : selectedTemplate?.type
                                            return currentType === 'email' ? (
                                                <Mail className="h-6 w-6 text-primary flex-shrink-0" />
                                            ) : (
                                                <MessageSquare className="h-6 w-6 text-primary flex-shrink-0" />
                                            )
                                        })()}
                                        {isEditMode || isCreatingNew ? (
                                            <input
                                                type="text"
                                                value={editedName}
                                                onChange={(e) => setEditedName(e.target.value)}
                                                className="text-2xl font-semibold bg-transparent border-b-2 border-primary text-foreground focus:outline-none flex-1 min-w-0"
                                                placeholder="Template name"
                                            />
                                        ) : (
                                            <h2 className="text-2xl font-semibold truncate">{selectedTemplate?.name}</h2>
                                        )}
                                        <Badge variant="outline" className="flex-shrink-0">
                                            {((isEditMode || isCreatingNew) ? editedType : selectedTemplate?.type || 'email').toUpperCase()}
                                        </Badge>
                                        {selectedTemplate && selectedTemplate.version > 1 && (
                                            <Badge variant="secondary" className="flex-shrink-0">v{selectedTemplate.version}</Badge>
                                        )}
                                    </div>
                                    {isEditMode || isCreatingNew ? (
                                        <input
                                            type="text"
                                            value={editedDescription}
                                            onChange={(e) => setEditedDescription(e.target.value)}
                                            className="text-muted-foreground bg-transparent border-b border-input text-foreground focus:outline-none w-full"
                                            placeholder="Template description (optional)"
                                        />
                                    ) : (
                                        selectedTemplate?.description && (
                                            <p className="text-muted-foreground">{selectedTemplate.description}</p>
                                        )
                                    )}
                                </div>
                                
                                {/* Header Actions */}
                                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                    {isEditMode ? (
                                        <>
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={handleCancelEdit}
                                                disabled={saving}
                                            >
                                                Close
                                            </Button>
                                            <Button 
                                                variant="default" 
                                                size="sm"
                                                onClick={handleSaveChanges}
                                                disabled={saving}
                                            >
                                                {saving ? (isCreatingNew ? 'Creating...' : 'Saving...') : (isCreatingNew ? 'Create' : 'Save')}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={closeModal}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Subject Field - Full Width (Only in edit/create mode) */}
                            {(isEditMode || isCreatingNew) && editedType === 'email' && (
                                <div className="px-6 py-4 border-b border-border bg-muted/30">
                                    <div className="relative">
                                        <label className="absolute -top-2 left-3 px-2 text-xs font-semibold text-foreground bg-background">Subject</label>
                                        <input
                                            type="text"
                                            value={editedSubject}
                                            onChange={(e) => setEditedSubject(e.target.value)}
                                            className="w-full px-4 py-3 pt-4 text-lg font-medium border border-input bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            placeholder="Enter email subject..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Modal Body - Two Column Layout */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Left Column - Template Info or Editor */}
                                    <div className="space-y-6">
                                        {isEditMode ? (
                                            /* Edit Mode - Drop Area with Blocks */
                                            <div
                                                onDragOver={handleDragOver}
                                                onDrop={handleDrop}
                                                className="min-h-[400px] border-2 border-dashed border-border rounded-lg p-4 bg-background/50 h-full"
                                            >
                                                <h3 className="font-semibold mb-4">Content Builder</h3>
                                                
                                                {templateBlocks.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center h-64 text-center">
                                                        <Plus className="h-12 w-12 text-muted-foreground mb-4" />
                                                        <p className="text-muted-foreground mb-2">Drag elements here to build your template</p>
                                                        <p className="text-xs text-muted-foreground">Start by dragging Text or Image blocks from the right</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {templateBlocks.map((block) => (
                                                            <div key={block.id} className="group relative">
                                                                <div className="border border-border rounded-lg p-4 bg-background hover:border-primary transition-colors">
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            {block.type === 'text' ? 'Text' : 'Image'}
                                                                        </Badge>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleRemoveBlock(block.id)}
                                                                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                    
                                                                    {block.type === 'text' ? (
                                                                        <textarea
                                                                            value={block.content}
                                                                            onChange={(e) => handleBlockContentChange(block.id, e.target.value)}
                                                                            className="w-full min-h-[100px] p-2 border border-input bg-background text-foreground rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                                            placeholder="Enter your text here..."
                                                                        />
                                                                    ) : (
                                                                        <div className="space-y-3">
                                                                            {!block.content ? (
                                                                                <label className="cursor-pointer block">
                                                                                    <input
                                                                                        type="file"
                                                                                        accept="image/*"
                                                                                        className="hidden"
                                                                                        onChange={(e) => handleImageUpload(e, block.id)}
                                                                                    />
                                                                                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors">
                                                                                        <div className="flex flex-col items-center gap-2">
                                                                                            <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                                            </svg>
                                                                                            <div>
                                                                                                <p className="text-sm font-medium text-foreground">Click to upload image</p>
                                                                                                <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or WEBP (max 5MB)</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </label>
                                                                            ) : (
                                                                                <div className="relative group">
                                                                                    <img
                                                                                        src={block.content}
                                                                                        alt="Uploaded"
                                                                                        className="w-full h-auto rounded-lg border border-border"
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                                                                        <label className="cursor-pointer">
                                                                                            <input
                                                                                                type="file"
                                                                                                accept="image/*"
                                                                                                className="hidden"
                                                                                                onChange={(e) => handleImageUpload(e, block.id)}
                                                                                            />
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="secondary"
                                                                                                size="sm"
                                                                                                onClick={(e) => {
                                                                                                    e.preventDefault()
                                                                                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement
                                                                                                    input?.click()
                                                                                                }}
                                                                                            >
                                                                                                Change Image
                                                                                            </Button>
                                                                                        </label>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="destructive"
                                                                                            size="sm"
                                                                                            onClick={() => handleBlockContentChange(block.id, '')}
                                                                                        >
                                                                                            Remove
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* View Mode - Template Info */
                                            <>
                                        {/* Metadata */}
                                        {selectedTemplate && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-sm text-muted-foreground mb-1">Category</p>
                                                    <Badge variant="outline">{selectedTemplate.category || 'Uncategorized'}</Badge>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                                                    <Badge variant={selectedTemplate.isActive ? 'default' : 'secondary'}>
                                                        {selectedTemplate.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground mb-1">Created</p>
                                                    <p className="text-sm">{new Date(selectedTemplate.createdAt).toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                                                    <p className="text-sm">{new Date(selectedTemplate.updatedAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Subject (only in view mode) */}
                                        {!isEditMode && !isCreatingNew && selectedTemplate?.type === 'email' && selectedTemplate?.subject && (
                                            <div>
                                                <h3 className="font-semibold mb-2">Subject</h3>
                                                <div className="bg-muted p-3 rounded-lg">
                                                    <p className="text-sm">{selectedTemplate.subject}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* HIPAA Fields */}
                                        <div>
                                            <h3 className="font-semibold mb-2">HIPAA Fields</h3>
                                            {(isEditMode || isCreatingNew) ? (
                                                <div className="space-y-3">
                                                    {/* HIPAA Fields Dropdown */}
                                                    <HIPAAFieldsDropdown />
                                                    
                                                    {/* Display existing HIPAA fields */}
                                                    {editedMergeFields.length > 0 && (
                                                        <div className="space-y-2">
                                                            {editedMergeFields.map((field, idx) => {
                                                                // Parse field: "name|dbField"
                                                                const parts = field.split('|')
                                                                const fieldName = parts[0]
                                                                const dbField = parts[1] || 'unknown'
                                                                
                                                                return (
                                                                    <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-md border border-border">
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <Badge variant="secondary" className="text-xs">
                                                                                    {'{{' + fieldName + '}}'}
                                                                                </Badge>
                                                                                <span className="text-xs text-muted-foreground">→</span>
                                                                                <code className="text-xs text-muted-foreground">users.{dbField}</code>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleRemoveMergeField(field)}
                                                                            className="ml-2 hover:bg-destructive/20 rounded-full p-1"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                    
                                                    <p className="text-xs text-muted-foreground">
                                                        Select HIPAA-safe fields that will be replaced with patient data
                                                    </p>
                                                </div>
                                            ) : (
                                                selectedTemplate && selectedTemplate.mergeFields && selectedTemplate.mergeFields.length > 0 ? (
                                                    <div>
                                                        <div className="space-y-2 mb-2">
                                                            {selectedTemplate.mergeFields.map((field, idx) => {
                                                                // Parse field: "name|dbField"
                                                                const parts = field.split('|')
                                                                const fieldName = parts[0]
                                                                const dbField = parts[1]
                                                                
                                                                return (
                                                                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            {'{{' + fieldName + '}}'}
                                                                        </Badge>
                                                                        {dbField && (
                                                                            <>
                                                                                <span className="text-xs text-muted-foreground">→</span>
                                                                                <code className="text-xs text-muted-foreground">users.{dbField}</code>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            These fields will be replaced with actual patient data when messages are sent
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">No HIPAA fields defined</p>
                                                )
                                            )}
                                        </div>
                                            </>
                                        )}

                                        {/* Actions - Only in view mode */}
                                        {!isEditMode && (
                                            <div className="flex flex-wrap gap-3 pt-4 border-t border-border mt-6">
                                                <Button variant="default" className="gap-2" onClick={handleEditClick}>
                                                    <Edit className="h-4 w-4" />
                                                    Edit
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    className="gap-2"
                                                    onClick={() => selectedTemplate && handleDuplicate(selectedTemplate.id)}
                                                    disabled={duplicating || deleting || !selectedTemplate}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    {duplicating ? 'Duplicating...' : 'Duplicate'}
                                                </Button>
                                                <Button 
                                                    variant="destructive" 
                                                    className="gap-2"
                                                    onClick={handleDeleteClick}
                                                    disabled={duplicating || deleting}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Column - Preview or Editor Blocks */}
                                    <div className="lg:sticky lg:top-6 lg:self-start bg-muted p-4 rounded-lg">
                                        <div className="space-y-4">
                                            {isEditMode ? (
                                                /* Edit Mode - Draggable Blocks */
                                                <>
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Plus className="h-5 w-5 text-primary" />
                                                        <h3 className="font-semibold">Add Elements</h3>
                                                    </div>
                                                    
                                                    <div className="space-y-3">
                                                        {/* Text Block */}
                                                        <div
                                                            draggable
                                                            onDragStart={() => handleDragStart('text')}
                                                            className="flex items-center gap-3 p-4 bg-background border-2 border-border rounded-lg cursor-move hover:border-primary hover:shadow-md transition-all"
                                                        >
                                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                                <FileText className="h-5 w-5 text-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-sm">Text</p>
                                                                <p className="text-xs text-muted-foreground">Add text or description</p>
                                                            </div>
                                                        </div>

                                                        {/* Image Block */}
                                                        <div
                                                            draggable
                                                            onDragStart={() => handleDragStart('image')}
                                                            className="flex items-center gap-3 p-4 bg-background border-2 border-border rounded-lg cursor-move hover:border-primary hover:shadow-md transition-all"
                                                        >
                                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                                <Eye className="h-5 w-5 text-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-sm">Image</p>
                                                                <p className="text-xs text-muted-foreground">Upload or add an image</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Template Type Selector */}
                                                    <div className="pt-4 border-t border-border space-y-3">
                                                        <h4 className="font-semibold text-sm">Template Type</h4>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditedType('email')
                                                                }}
                                                                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${
                                                                    editedType === 'email'
                                                                        ? 'border-primary bg-primary/10 text-primary'
                                                                        : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                                                                }`}
                                                            >
                                                                <Mail className="h-4 w-4" />
                                                                <span className="text-sm font-medium">Email</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditedType('sms')
                                                                    // Clear subject when switching to SMS
                                                                    if (editedType === 'email') {
                                                                        setEditedSubject('')
                                                                    }
                                                                }}
                                                                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${
                                                                    editedType === 'sms'
                                                                        ? 'border-primary bg-primary/10 text-primary'
                                                                        : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                                                                }`}
                                                            >
                                                                <MessageSquare className="h-4 w-4" />
                                                                <span className="text-sm font-medium">SMS</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* HIPAA Fields Section */}
                                                    <div className="pt-4 border-t border-border space-y-3">
                                                        <h4 className="font-semibold text-sm">HIPAA Fields</h4>
                                                        
                                                        {/* Display HIPAA fields as badges */}
                                                        {editedMergeFields.length > 0 && (
                                                            <div className="flex flex-wrap gap-2">
                                                                {editedMergeFields.map((field, idx) => {
                                                                    const parts = field.split('|')
                                                                    const fieldName = parts[0]
                                                                    
                                                                    return (
                                                                        <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                                                                            {'{{' + fieldName + '}}'}
                                                                            <button
                                                                                onClick={() => handleRemoveMergeField(field)}
                                                                                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </Badge>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                        
                                                        <HIPAAFieldsDropdown />
                                                        <p className="text-xs text-muted-foreground">
                                                            Select HIPAA-safe fields to insert patient data
                                                        </p>
                                                    </div>

                                                    <div className="pt-4 border-t border-border">
                                                        <p className="text-xs text-muted-foreground">
                                                            💡 Drag elements to the content area on the left
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                /* View Mode - Mobile Preview */
                                                <>
                                                    {/* Preview Header */}
                                                    <div className="flex items-center gap-2">
                                                        <Smartphone className="h-5 w-5 text-primary" />
                                                        <h3 className="font-semibold">Message Preview</h3>
                                                    </div>

                                            {/* Mobile Phone Mockup */}
                                            <div className="flex justify-center">
                                                <div className="w-full max-w-[340px]">
                                                    <div className="relative border-[12px] border-gray-800 rounded-[2rem] shadow-2xl bg-white overflow-hidden" style={{ aspectRatio: '9/19.5' }}>
                                                        {/* Phone notch */}
                                                        <div className="absolute top-0 inset-x-0 h-5 bg-gray-800 rounded-b-3xl mx-auto w-32 z-10"></div>
                                                        
                                                        {/* Screen content */}
                                                        <div 
                                                            className="h-full overflow-y-auto bg-gradient-to-b from-gray-50 to-white phone-preview-scroll"
                                                            style={{
                                                                scrollbarWidth: 'thin',
                                                                scrollbarColor: 'rgba(0, 0, 0, 0.1) transparent'
                                                            }}
                                                        >
                                                            {(() => {
                                                                // Use edited values if in edit/create mode, otherwise use selectedTemplate
                                                                const currentType = (isEditMode || isCreatingNew) ? editedType : selectedTemplate?.type
                                                                const currentBody = (isEditMode || isCreatingNew) ? JSON.stringify(templateBlocks) : selectedTemplate?.body || ''
                                                                const currentSubject = (isEditMode || isCreatingNew) ? editedSubject : selectedTemplate?.subject || ''
                                                                
                                                                return currentType === 'sms' ? (
                                                                /* SMS View */
                                                                <div className="p-3 pt-7 space-y-2">
                                                                    {/* Header */}
                                                                    <div className="flex items-center gap-2 mb-3 px-1">
                                                                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-semibold">
                                                                            HC
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] font-semibold text-gray-900">Health Clinic</p>
                                                                            <p className="text-[9px] text-gray-500">SMS</p>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Message bubble */}
                                                                    <div className="flex justify-start px-1">
                                                                        <div className="bg-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                                                                            <div className="text-[11px] text-gray-900 leading-relaxed">
                                                                                {renderTemplateBody(currentBody)}
                                                                            </div>
                                                                            <p className="text-[9px] text-gray-500 mt-1">Just now</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                /* Email View */
                                                                <div className="p-3 pt-7">
                                                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                                                        {/* Email header */}
                                                                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-semibold">
                                                                                    HC
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-[10px] font-semibold text-gray-900">Health Clinic</p>
                                                                                    <p className="text-[9px] text-gray-500 truncate">support@healthclinic.com</p>
                                                                                </div>
                                                                            </div>
                                                                            {currentSubject && (
                                                                                <h3 className="text-[11px] font-semibold text-gray-900 mt-1 leading-tight">
                                                                                    {currentSubject}
                                                                                </h3>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Email body */}
                                                                        <div className="p-3">
                                                                            {renderTemplateBody(currentBody)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )})()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                                    {/* Preview Note */}
                                                    <div className="bg-muted p-3 rounded-lg">
                                                        <p className="text-xs text-muted-foreground">
                                                            <strong>Note:</strong> HIPAA fields (like {'{{'} phone_masked {'}}'}  ) will be replaced with actual patient data when messages are sent.
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && selectedTemplate && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                        <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 rounded-full bg-destructive/10">
                                    <Trash2 className="h-6 w-6 text-destructive" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-semibold mb-2">Delete Template</h2>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        This action cannot be undone. This will permanently delete the template.
                                    </p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <div className="bg-muted p-3 rounded-lg mb-4">
                                    <p className="text-sm font-medium mb-1">Template to delete:</p>
                                    <p className="text-sm text-muted-foreground">{selectedTemplate.name}</p>
                                </div>

                                <label htmlFor="confirmName" className="block text-sm font-medium mb-2">
                                    Type <span className="font-semibold text-destructive">{selectedTemplate.name}</span> to confirm:
                                </label>
                                <input
                                    id="confirmName"
                                    type="text"
                                    value={deleteConfirmName}
                                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    placeholder="Enter template name"
                                    autoComplete="off"
                                    disabled={deleting}
                                />
                            </div>

                            <div className="flex gap-3 justify-end">
                                <Button 
                                    variant="outline" 
                                    onClick={handleDeleteCancel}
                                    disabled={deleting}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    variant="destructive"
                                    onClick={handleDeleteConfirm}
                                    disabled={deleteConfirmName !== selectedTemplate.name || deleting}
                                >
                                    {deleting ? 'Deleting...' : 'Delete Template'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}


                {/* Toast Notifications */}
                <ToastManager toasts={toasts} onDismiss={dismiss} />
            </Layout>
        </>
    )
}

