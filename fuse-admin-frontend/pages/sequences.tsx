import React, { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToastManager } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import Layout from '@/components/Layout'
import {
    Workflow,
    Plus,
    Search,
    Mail,
    MessageSquare,
    Clock,
    Play,
    Pause,
    Edit,
    Trash2,
    ChevronRight,
    ArrowLeft,
    Settings,
    Users,
    TrendingUp,
    Filter,
    Smartphone,
    X
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const TRIGGER_OPTIONS = [
    { value: 'checkout_completed', label: 'Checkout Completed' },
    { value: 'protocol_start', label: 'Protocol Start' },
    { value: 'prescription_expired', label: 'Prescription Expired' },
    { value: 'abandoned_cart', label: 'Abandoned Cart' },
    { value: 'manual', label: 'Manual Trigger' }
]

const SEQUENCE_STATUS_OPTIONS: Sequence['status'][] = ['draft', 'active', 'paused', 'archived']

const STEP_PALETTE = [
    {
        type: 'delay' as const,
        label: 'Delay',
        description: 'Wait before the next step',
        icon: Clock
    },
    {
        type: 'sms' as const,
        label: 'SMS',
        description: 'Send a text message',
        icon: MessageSquare
    },
    {
        type: 'email' as const,
        label: 'Email',
        description: 'Send an email message',
        icon: Mail
    }
]

interface TemplateBlock {
    id?: string
    type: 'text' | 'image'
    content: string
    order?: number
}

const SAMPLE_PLACEHOLDER_VALUES: Record<string, string> = {
    first_name: 'John',
    last_name: 'Doe',
    treatment_name: 'Semaglutide',
    expiry_date: '12/31/2024',
    renewal_link: 'clinic.com/renew',
    dosage: '2.5mg',
    provider_name: 'Dr. Smith'
}

const secondsToDelay = (totalSeconds: number): { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' } => {
    const normalizedSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0

    if (normalizedSeconds === 0) {
        return { value: 0, unit: 'seconds' }
    }

    if (normalizedSeconds % (24 * 3600) === 0) {
        return { value: normalizedSeconds / (24 * 3600), unit: 'days' }
    }

    if (normalizedSeconds % 3600 === 0) {
        return { value: normalizedSeconds / 3600, unit: 'hours' }
    }

    if (normalizedSeconds % 60 === 0) {
        return { value: normalizedSeconds / 60, unit: 'minutes' }
    }

    return { value: normalizedSeconds, unit: 'seconds' }
}

const parseTemplateBody = (body?: string): { blocks: TemplateBlock[] | null; plainText: string } => {
    if (!body) {
        return { blocks: null, plainText: '' }
    }

    try {
        const parsed = JSON.parse(body)
        if (Array.isArray(parsed)) {
            const sanitizedBlocks: TemplateBlock[] = parsed
                .filter(block => block && typeof block === 'object' && typeof block.content === 'string')
                .map((block: any) => ({
                    id: typeof block.id === 'string' ? block.id : undefined,
                    type: block.type === 'image' ? 'image' : 'text',
                    content: block.content,
                    order: typeof block.order === 'number' ? block.order : undefined
                }))

            if (sanitizedBlocks.length > 0) {
                sanitizedBlocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                return { blocks: sanitizedBlocks, plainText: '' }
            }
        }
    } catch {
        // Not JSON, treat as plain text
    }

    return { blocks: null, plainText: body }
}

const applySampleValues = (text: string): string => {
    return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const normalized = String(key).trim().toLowerCase()
        return SAMPLE_PLACEHOLDER_VALUES[normalized] || normalized
    })
}

const formatEmailText = (text: string): string => {
    return applySampleValues(text).replace(/\[([^\]]+)\]/g, (_, label) => `\n━━━━━━━\n ${label}\n━━━━━━━\n`)
}

const extractMergeFields = (body?: string): string[] => {
    if (!body) return []

    const { blocks, plainText } = parseTemplateBody(body)
    const sourceText = blocks
        ? blocks.map(block => block.content).join(' ')
        : plainText

    const matches = sourceText.match(/\{\{[^}]+\}\}/g)
    if (!matches) return []

    const unique = new Set(matches.map(match => match.trim()))
    return Array.from(unique)
}

interface SequenceStep {
    id: string
    name: string
    triggerType?: 'event' | 'time' | 'manual'
    delay?: number // in hours
    delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days'
    channel?: 'email' | 'sms'
    templateId?: string
    templateName?: string
    templateSubject?: string // For email
    templateBody?: string // Preview of message content
    conditionalLogic?: {
        field: string
        operator: string
        value: string
    }
    stepType?: 'delay' | 'sms' | 'email'
    useCustomText?: boolean
    customText?: string
    customSubject?: string
}

interface SequenceStats {
    totalSent: number
    openRate?: number
    clickRate?: number
    activeContacts: number
}

interface Sequence {
    id: string
    name: string
    description?: string
    status: 'active' | 'paused' | 'draft' | 'archived'
    triggerEvent: string
    steps: SequenceStep[]
    stats: SequenceStats
    createdAt: string
    updatedAt: string
}

interface MessageTemplate {
    id: string
    name: string
    type: 'email' | 'sms'
    subject?: string
    body: string
}

type ApiSequence = {
    id: string
    clinicId: string
    name: string
    description?: string
    status: string
    trigger?: Record<string, any> | null
    steps?: Array<Record<string, any>> | null
    audience?: Record<string, any> | null
    analytics?: Record<string, any> | null
    isActive?: boolean
    createdAt: string
    updatedAt: string
}

const mapSequenceFromApi = (sequence: ApiSequence): Sequence => {
    const stepsData = Array.isArray(sequence.steps) ? sequence.steps : []

    const mappedSteps: SequenceStep[] = stepsData.map((step, index) => {
        const rawType = (step.stepType || step.step_type || step.type) as SequenceStep['stepType'] | undefined
        const inferredChannel = step.channel === 'sms' ? 'sms' : step.channel === 'email' ? 'email' : undefined

        let stepType: SequenceStep['stepType'] | undefined = rawType
        if (!stepType) {
            if (inferredChannel) {
                stepType = inferredChannel
            } else if (typeof step.timeSeconds === 'number' || typeof step.time_seconds === 'number') {
                stepType = 'delay'
            } else {
                stepType = 'delay'
            }
        }

        if (stepType !== 'delay' && stepType !== 'sms' && stepType !== 'email') {
            stepType = 'delay'
        }

        let delayValue: number | undefined
        let delayUnit: SequenceStep['delayUnit'] | undefined

        if (stepType === 'delay') {
            const timeSeconds = typeof step.timeSeconds === 'number'
                ? step.timeSeconds
                : typeof step.time_seconds === 'number'
                    ? step.time_seconds
                    : (() => {
                        const rawDelayValue = typeof step.delay === 'number'
                            ? step.delay
                            : typeof step.delay?.value === 'number'
                                ? step.delay.value
                                : 0
                        const rawDelayUnit = typeof step.delayUnit === 'string'
                            ? step.delayUnit
                            : typeof step.delay?.unit === 'string'
                                ? step.delay.unit
                                : undefined
                        const unitSeconds: Record<string, number> = {
                            seconds: 1,
                            minutes: 60,
                            hours: 3600,
                            days: 24 * 3600
                        }
                        const multiplier = rawDelayUnit && unitSeconds[rawDelayUnit] ? unitSeconds[rawDelayUnit] : 3600
                        return rawDelayValue * multiplier
                    })()

            const normalizedDelay = secondsToDelay(timeSeconds)
            delayValue = normalizedDelay.value
            delayUnit = normalizedDelay.unit
        }

        const templateId = typeof step.templateId === 'string'
            ? step.templateId
            : typeof step.template_id === 'string'
                ? step.template_id
                : undefined

        const resolvedChannel: SequenceStep['channel'] = stepType === 'sms'
            ? 'sms'
            : stepType === 'email'
                ? 'email'
                : undefined

        const resolvedId = typeof step.id === 'string'
            ? step.id
            : typeof step.step_id === 'string'
                ? step.step_id
                : uuidv4()

        return {
            id: resolvedId,
            name: step.name || (stepType === 'delay' ? 'Delay' : stepType === 'sms' ? 'SMS Step' : 'Email Step'),
            triggerType: step.triggerType || step.trigger_type || 'time',
            delay: delayValue,
            delayUnit,
            channel: resolvedChannel,
            templateId,
            templateName: step.templateName || step.template_name,
            templateSubject: step.templateSubject || step.template_subject,
            templateBody: step.templateBody || step.template_body,
            conditionalLogic: step.conditionalLogic || step.conditional_logic,
            stepType,
            useCustomText: step.useCustomText || step.use_custom_text || false,
            customText: step.customText || step.custom_text,
            customSubject: step.customSubject || step.custom_subject
        }
    })

    const analytics = sequence.analytics || {}

    const stats: SequenceStats = {
        totalSent: typeof analytics.totalSent === 'number' ? analytics.totalSent : 0,
        openRate: typeof analytics.openRate === 'number' ? analytics.openRate : undefined,
        clickRate: typeof analytics.clickRate === 'number' ? analytics.clickRate : undefined,
        activeContacts: typeof analytics.activeContacts === 'number' ? analytics.activeContacts : 0
    }

    const trigger = sequence.trigger || {}
    const triggerEvent = typeof trigger === 'object'
        ? (trigger.eventKey || trigger.event || trigger.type || 'custom_trigger')
        : 'custom_trigger'

    const normalizedStatus = ((): Sequence['status'] => {
        switch (sequence.status) {
            case 'active':
            case 'paused':
            case 'draft':
                return sequence.status
            case 'archived':
                return 'archived'
            default:
                return 'draft'
        }
    })()

    return {
        id: sequence.id,
        name: sequence.name,
        description: sequence.description || undefined,
        status: normalizedStatus,
        triggerEvent,
        steps: mappedSteps,
        stats,
        createdAt: sequence.createdAt,
        updatedAt: sequence.updatedAt
    }
}


export default function Flows() {
    const { token } = useAuth()
    const { toasts, dismiss, success, error: showError } = useToast()
    const [sequences, setSequences] = useState<Sequence[]>([])
    const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'draft'>('all')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedStepForPreview, setSelectedStepForPreview] = useState<string | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newFlowName, setNewFlowName] = useState('')
    const [newFlowTrigger, setNewFlowTrigger] = useState('')
    const [creatingFlow, setCreatingFlow] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [editableSteps, setEditableSteps] = useState<SequenceStep[]>([])
    const [draggedStepType, setDraggedStepType] = useState<'delay' | 'sms' | 'email' | null>(null)
    const [isDropTargetActive, setIsDropTargetActive] = useState(false)
    const [templates, setTemplates] = useState<{ email: MessageTemplate[]; sms: MessageTemplate[] }>({ email: [], sms: [] })
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [templatesError, setTemplatesError] = useState<string | null>(null)
    const stepsSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [showEditSequenceModal, setShowEditSequenceModal] = useState(false)
    const [editSequenceName, setEditSequenceName] = useState('')
    const [editSequenceDescription, setEditSequenceDescription] = useState('')
    const [editSequenceStatus, setEditSequenceStatus] = useState<Sequence['status']>('draft')
    const [savingSequenceDetails, setSavingSequenceDetails] = useState(false)
    const [updatingTrigger, setUpdatingTrigger] = useState(false)
    const [togglingSequenceStatus, setTogglingSequenceStatus] = useState(false)
    const [draggedExistingStepId, setDraggedExistingStepId] = useState<string | null>(null)
    const [dropIndicator, setDropIndicator] = useState<{ stepId: string; position: 'before' | 'after' } | null>(null)

    useEffect(() => {
        return () => {
            if (stepsSaveTimeoutRef.current) {
                clearTimeout(stepsSaveTimeoutRef.current)
            }
        }
    }, [])

    const fetchSequences = useCallback(async () => {
        if (!token) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`${API_URL}/sequences`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                let errorMessage = 'Failed to load sequences'

                try {
                    const errorData = await response.json()
                    if (errorData?.message) {
                        errorMessage = errorData.message
                    }
                } catch {
                    // ignore JSON parse errors
                }

                throw new Error(errorMessage)
            }

            const data = await response.json()
            const items: ApiSequence[] = Array.isArray(data?.data) ? data.data : []
            const mappedSequences = items.map(mapSequenceFromApi)
            setSequences(mappedSequences)
        } catch (err) {
            console.error('Error fetching sequences:', err)
            setError(err instanceof Error ? err.message : 'Failed to load sequences')
        } finally {
            setLoading(false)
        }
    }, [token, setSequences, setSelectedSequence, setEditableSteps])

    const fetchTemplates = useCallback(async () => {
        if (!token) {
            setTemplates({ email: [], sms: [] })
            return
        }

        setTemplatesLoading(true)
        setTemplatesError(null)

        try {
            const response = await fetch(`${API_URL}/message-templates`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                let errorMessage = 'Failed to load templates'
                try {
                    const errorData = await response.json()
                    if (errorData?.message) {
                        errorMessage = errorData.message
                    }
                } catch {
                    // ignore JSON parse error
                }
                throw new Error(errorMessage)
            }

            const data = await response.json()
            const items: MessageTemplate[] = Array.isArray(data?.data) ? data.data : []
            const emailTemplates = items.filter(template => template.type === 'email')
            const smsTemplates = items.filter(template => template.type === 'sms')
            setTemplates({ email: emailTemplates, sms: smsTemplates })
        } catch (err) {
            console.error('Error fetching templates:', err)
            setTemplatesError(err instanceof Error ? err.message : 'Failed to load templates')
        } finally {
            setTemplatesLoading(false)
        }
    }, [token])

    const createStepTemplate = (type: 'delay' | 'sms' | 'email'): SequenceStep => {
        if (type === 'delay') {
            return {
                id: uuidv4(),
                name: 'Delay',
                triggerType: 'time',
                delay: 1,
                delayUnit: 'hours',
                stepType: 'delay'
            }
        }

        if (type === 'sms') {
            return {
                id: uuidv4(),
                name: 'SMS Step',
                triggerType: 'time',
                delay: 0,
                delayUnit: 'hours',
                channel: 'sms',
                stepType: 'sms'
            }
        }

        return {
            id: uuidv4(),
            name: 'Email Step',
            triggerType: 'time',
            delay: 0,
            delayUnit: 'hours',
            channel: 'email',
            stepType: 'email'
        }
    }

    const insertNewStep = (type: 'delay' | 'sms' | 'email', insertIndex?: number) => {
        if (!selectedSequence) return

        const sequenceId = selectedSequence.id
        const newStep = createStepTemplate(type)
        const updatedSteps = [...editableSteps]
        const targetIndex = typeof insertIndex === 'number'
            ? Math.max(0, Math.min(insertIndex, updatedSteps.length))
            : updatedSteps.length

        updatedSteps.splice(targetIndex, 0, newStep)

        applyStepsUpdate(sequenceId, updatedSteps)
        setSelectedStepForPreview(newStep.id)
        schedulePersistSequenceSteps(sequenceId, updatedSteps)
    }

    const moveExistingStep = (stepId: string, targetIndex: number) => {
        if (!selectedSequence) return

        const sequenceId = selectedSequence.id
        const currentIndex = editableSteps.findIndex(step => step.id === stepId)

        if (currentIndex === -1) return

        const desiredIndex = Math.max(0, Math.min(targetIndex, editableSteps.length))

        if (desiredIndex === currentIndex || desiredIndex === currentIndex + 1) {
            return
        }

        const updatedSteps = [...editableSteps]
        const [movedStep] = updatedSteps.splice(currentIndex, 1)

        const adjustedIndex = desiredIndex > currentIndex ? desiredIndex - 1 : desiredIndex

        updatedSteps.splice(adjustedIndex, 0, movedStep)

        applyStepsUpdate(sequenceId, updatedSteps)
        schedulePersistSequenceSteps(sequenceId, updatedSteps)
    }

    const handleStepReorderDrop = (draggedId: string, targetStepId: string, position: 'before' | 'after') => {
        const targetIndex = editableSteps.findIndex(step => step.id === targetStepId)
        if (targetIndex === -1) return
        const insertIndex = targetIndex + (position === 'after' ? 1 : 0)
        moveExistingStep(draggedId, insertIndex)
    }

    const handleNewStepDrop = (type: 'delay' | 'sms' | 'email', targetStepId: string, position: 'before' | 'after') => {
        const targetIndex = editableSteps.findIndex(step => step.id === targetStepId)
        if (targetIndex === -1) return
        const insertIndex = targetIndex + (position === 'after' ? 1 : 0)
        insertNewStep(type, insertIndex)
    }

    const handleStepDragOver = (event: React.DragEvent<HTMLDivElement>, stepId: string) => {
        if (!(draggedStepType || draggedExistingStepId)) return
        event.preventDefault()
        const bounds = event.currentTarget.getBoundingClientRect()
        const isBefore = event.clientY < bounds.top + bounds.height / 2
        const position: 'before' | 'after' = isBefore ? 'before' : 'after'

        setDropIndicator(prev => {
            if (!prev || prev.stepId !== stepId || prev.position !== position) {
                return { stepId, position }
            }
            return prev
        })
    }

    const handleStepDragLeave = (event: React.DragEvent<HTMLDivElement>, stepId: string) => {
        const related = event.relatedTarget as Node | null
        if (related && event.currentTarget.contains(related)) {
            return
        }
        setDropIndicator(prev => (prev?.stepId === stepId ? null : prev))
    }

    const handleStepDrop = (event: React.DragEvent<HTMLDivElement>, targetStepId: string) => {
        event.preventDefault()
        event.stopPropagation()

        const position = dropIndicator && dropIndicator.stepId === targetStepId
            ? dropIndicator.position
            : 'after'

        const draggedIdFromData = event.dataTransfer.getData('application/flow-step-id')
        const stepTypeFromData = event.dataTransfer.getData('application/flow-step-type')

        if (draggedExistingStepId || draggedIdFromData) {
            const stepId = draggedExistingStepId || draggedIdFromData
            if (stepId && stepId !== targetStepId) {
                handleStepReorderDrop(stepId, targetStepId, position)
            }
            clearDragState()
            return
        }

        let type = draggedStepType
        if (!type && (stepTypeFromData === 'delay' || stepTypeFromData === 'sms' || stepTypeFromData === 'email')) {
            type = stepTypeFromData
        }

        if (type) {
            handleNewStepDrop(type, targetStepId, position)
        }

        clearDragState()
    }

    const handleStepDragStart = (type: 'delay' | 'sms' | 'email') => {
        setDraggedStepType(type)
        setDraggedExistingStepId(null)
        setIsDropTargetActive(true)
    }

    const handleStepDragEnd = () => {
        clearDragState()
    }

    const handleExistingStepDragStart = (event: React.DragEvent<HTMLDivElement>, stepId: string) => {
        setDraggedExistingStepId(stepId)
        setDraggedStepType(null)
        setIsDropTargetActive(true)
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/flow-step-id', stepId)
    }

    const handleExistingStepDragEnd = () => {
        clearDragState()
    }

    const handleStepsDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        if (draggedStepType || draggedExistingStepId) {
            setIsDropTargetActive(true)
        }
    }

    const handleStepsDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        if (draggedStepType || draggedExistingStepId) {
            setIsDropTargetActive(true)
            if (!dropIndicator) {
                setDropIndicator(null)
            }
        }
    }

    const handleStepsDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        const related = event.relatedTarget as Node | null
        if (!related || !event.currentTarget.contains(related)) {
            setIsDropTargetActive(false)
            setDropIndicator(null)
        }
    }

    const handleStepsDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.stopPropagation()

        if (!selectedSequence) {
            clearDragState()
            return
        }

        const sequenceId = selectedSequence.id

        if (draggedExistingStepId) {
            moveExistingStep(draggedExistingStepId, editableSteps.length)
            clearDragState()
            return
        }

        let type = draggedStepType
        if (!type) {
            const dataType = event.dataTransfer.getData('application/flow-step-type')
            if (dataType === 'delay' || dataType === 'sms' || dataType === 'email') {
                type = dataType as 'delay' | 'sms' | 'email'
            }
        }

        if (!type) {
            clearDragState()
            return
        }

        insertNewStep(type)
        clearDragState()
    }

    const handlePaletteAdd = (type: 'delay' | 'sms' | 'email') => {
        if (!selectedSequence) return
        insertNewStep(type)
    }

    const handleTemplateSelect = (stepId: string, templateId: string) => {
        if (!selectedSequence) return

        const sequenceId = selectedSequence.id

        const applyTemplateToStep = (step: SequenceStep): SequenceStep => {
            if (step.id !== stepId) {
                return step
            }

            if (!templateId) {
                return {
                    ...step,
                    templateId: undefined,
                    templateName: undefined,
                    templateSubject: undefined,
                    templateBody: undefined
                }
            }

            const templateList = step.stepType === 'email' ? templates.email : templates.sms
            const selectedTemplate = templateList.find(template => template.id === templateId)

            if (!selectedTemplate) {
                return step
            }

            return {
                ...step,
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.name,
                templateSubject: selectedTemplate.type === 'email' ? selectedTemplate.subject : undefined,
                templateBody: selectedTemplate.body,
                channel: selectedTemplate.type
            }
        }

        const updatedSteps = editableSteps.map(applyTemplateToStep)

        applyStepsUpdate(sequenceId, updatedSteps)
        schedulePersistSequenceSteps(sequenceId, updatedSteps)
    }

    const handleToggleCustomText = (stepId: string, useCustom: boolean) => {
        if (!selectedSequence) return

        const sequenceId = selectedSequence.id

        const applyToggle = (step: SequenceStep): SequenceStep => {
            if (step.id !== stepId) return step
            
            return {
                ...step,
                useCustomText: useCustom,
                // Clear template fields when switching to custom
                ...(useCustom ? {
                    templateId: undefined,
                    templateName: undefined,
                    templateSubject: undefined,
                    templateBody: undefined
                } : {}),
                // Clear custom fields when switching to template
                ...(!useCustom ? {
                    customText: undefined,
                    customSubject: undefined
                } : {})
            }
        }

        const updatedSteps = editableSteps.map(applyToggle)
        applyStepsUpdate(sequenceId, updatedSteps)
        schedulePersistSequenceSteps(sequenceId, updatedSteps)
    }

    const handleCustomTextChange = (stepId: string, text: string, subject?: string) => {
        if (!selectedSequence) return

        const sequenceId = selectedSequence.id

        const applyCustomText = (step: SequenceStep): SequenceStep => {
            if (step.id !== stepId) return step
            
            return {
                ...step,
                customText: text,
                ...(subject !== undefined ? { customSubject: subject } : {})
            }
        }

        const updatedSteps = editableSteps.map(applyCustomText)
        applyStepsUpdate(sequenceId, updatedSteps)
        schedulePersistSequenceSteps(sequenceId, updatedSteps)
    }

    const getTotalDelaySeconds = (step: SequenceStep): number => {
        if (!step.stepType || step.stepType !== 'delay') return 0
        const unitSeconds: Record<string, number> = {
            seconds: 1,
            minutes: 60,
            hours: 3600,
            days: 24 * 3600
        }
        const multiplier = unitSeconds[step.delayUnit || 'seconds'] || 1
        return (step.delay || 0) * multiplier
    }

    const persistSequenceSteps = useCallback(async (sequenceId: string, steps: SequenceStep[]) => {
        if (!token) return

        const payloadSteps = steps.map(step => {
            const type: SequenceStep['stepType'] = step.stepType
                ? step.stepType
                : step.channel === 'sms'
                    ? 'sms'
                    : step.channel === 'email'
                        ? 'email'
                        : 'delay'

            if (type === 'delay') {
                return {
                    id: step.id,
                    type: 'delay',
                    timeSeconds: getTotalDelaySeconds(step)
                }
            }

            const stepPayload: Record<string, unknown> = {
                id: step.id,
                type,
                useCustomText: !!step.useCustomText
            }

            if (step.useCustomText) {
                stepPayload.customText = step.customText || ''
                if (step.customSubject) {
                    stepPayload.customSubject = step.customSubject
                }
                // Add merge fields for custom text (default available fields)
                stepPayload.customMergeFields = [
                    'firstName|firstName',
                    'lastName|lastName',
                    'email|email',
                    'phoneNumber|phoneNumber'
                ]
            } else if (step.templateId) {
                stepPayload.templateId = step.templateId
            }

            return stepPayload
        })

        try {
            const response = await fetch(`${API_URL}/sequences/${sequenceId}/steps`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ steps: payloadSteps })
            })

            if (!response.ok) {
                let errorMessage = 'Failed to update sequence steps'
                try {
                    const errorData = await response.json()
                    if (typeof errorData?.message === 'string') {
                        errorMessage = errorData.message
                    }
                } catch {
                    // ignore parse error
                }
                throw new Error(errorMessage)
            }
        } catch (error) {
            console.error('Error updating sequence steps:', error)
        }
    }, [token])

    const schedulePersistSequenceSteps = useCallback((sequenceId: string | undefined, steps: SequenceStep[]) => {
        if (!sequenceId || !token) return

        if (stepsSaveTimeoutRef.current) {
            clearTimeout(stepsSaveTimeoutRef.current)
        }

        stepsSaveTimeoutRef.current = setTimeout(() => {
            persistSequenceSteps(sequenceId, steps)
            stepsSaveTimeoutRef.current = null
        }, 400)
    }, [persistSequenceSteps, token])

    const applyStepsUpdate = useCallback((sequenceId: string, updatedSteps: SequenceStep[]) => {
        setEditableSteps(updatedSteps)
        setSelectedSequence(prev => prev && prev.id === sequenceId ? { ...prev, steps: updatedSteps } : prev)
        setSequences(prev => prev.map(seq =>
            seq.id === sequenceId ? { ...seq, steps: updatedSteps } : seq
        ))
    }, [])

    const clearDragState = useCallback(() => {
        setDraggedStepType(null)
        setDraggedExistingStepId(null)
        setDropIndicator(null)
        setIsDropTargetActive(false)
    }, [])

    const updateSequenceOnServer = useCallback(async (
        sequenceId: string,
        payload: {
            name?: string
            description?: string | null
            triggerEvent?: string
            status?: Sequence['status']
        }
    ): Promise<Sequence | null> => {
        if (!token) return null

        try {
            const response = await fetch(`${API_URL}/sequences/${sequenceId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                let errorMessage = 'Failed to update sequence'
                try {
                    const errorData = await response.json()
                    if (typeof errorData?.message === 'string') {
                        errorMessage = errorData.message
                    }
                } catch {
                    // ignore parse error
                }
                throw new Error(errorMessage)
            }

            const data = await response.json()
            const updatedSequence = mapSequenceFromApi(data.data)

            setSequences(prev => prev.map(seq => seq.id === sequenceId ? updatedSequence : seq))
            setSelectedSequence(prev => prev && prev.id === sequenceId ? updatedSequence : prev)
            setEditableSteps(updatedSequence.steps)

            return updatedSequence
        } catch (error) {
            console.error('Error updating sequence:', error)
            return null
        }
    }, [token])

    const formatDelayLabel = (step: SequenceStep): string => {
        const totalSeconds = getTotalDelaySeconds(step)
        if (totalSeconds <= 0) return '0 seconds'
        const days = Math.floor(totalSeconds / (24 * 3600))
        const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        const parts: string[] = []
        if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`)
        if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
        if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
        if (seconds || parts.length === 0) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`)
        return parts.join(' ')
    }

    const updateDelayForStep = (stepId: string, partialSeconds: number) => {
        if (!selectedSequence) return

        const sequenceId = selectedSequence.id
        const clampedSeconds = Math.max(0, Math.floor(partialSeconds))
        const normalized = secondsToDelay(clampedSeconds)

        const applyDelay = (step: SequenceStep): SequenceStep => {
            if (step.id !== stepId) return step
            return {
                ...step,
                delay: normalized.value,
                delayUnit: normalized.unit
            }
        }

        const updatedSteps = editableSteps.map(applyDelay)

        applyStepsUpdate(sequenceId, updatedSteps)
        schedulePersistSequenceSteps(sequenceId, updatedSteps)
    }

    const handleRemoveStep = (stepId: string) => {
        if (!selectedSequence) return

        const sequenceId = selectedSequence.id
        const updatedSteps = editableSteps.filter(step => step.id !== stepId)

        if (selectedStepForPreview === stepId) {
            setSelectedStepForPreview(updatedSteps[0]?.id ?? null)
        }

        applyStepsUpdate(sequenceId, updatedSteps)
        schedulePersistSequenceSteps(sequenceId, updatedSteps)
    }

    const handleOpenEditSequenceModal = () => {
        if (!selectedSequence) return
        setEditSequenceName(selectedSequence.name || '')
        setEditSequenceDescription(selectedSequence.description || '')
        setEditSequenceStatus(selectedSequence.status)
        setShowEditSequenceModal(true)
    }

    const handleCloseEditSequenceModal = () => {
        if (savingSequenceDetails) return
        setShowEditSequenceModal(false)
    }

    const handleSaveSequenceDetails = async () => {
        if (!selectedSequence) return

        const name = editSequenceName.trim()
        const normalizedDescription = editSequenceDescription.trim()

        if (!name) {
            return
        }

        // Validate that if changing to 'active', all email/sms steps have templates
        if (editSequenceStatus === 'active') {
            const steps = editableSteps
            const stepsWithoutTemplates = steps.filter(step => 
                (step.stepType === 'email' || step.stepType === 'sms') && !step.templateId
            )

            if (stepsWithoutTemplates.length > 0) {
                const stepTypes = stepsWithoutTemplates.map(s => s.stepType?.toUpperCase() || 'STEP').join(', ')
                showError(`Cannot activate sequence: ${stepsWithoutTemplates.length} ${stepTypes} step(s) missing templates. Please assign templates to all email and SMS steps.`)
                return
            }
        }

        setSavingSequenceDetails(true)

        try {
            const updated = await updateSequenceOnServer(selectedSequence.id, {
                name,
                description: normalizedDescription.length > 0 ? normalizedDescription : null,
                status: editSequenceStatus
            })
            if (updated) {
                setShowEditSequenceModal(false)
            }
        } finally {
            setSavingSequenceDetails(false)
        }
    }

    const handleTriggerChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (!selectedSequence) return
        const newTrigger = event.target.value
        if (!newTrigger) return

        setUpdatingTrigger(true)
        try {
            await updateSequenceOnServer(selectedSequence.id, {
                triggerEvent: newTrigger
            })
        } finally {
            setUpdatingTrigger(false)
        }
    }

    const handleToggleSequenceStatus = async () => {
        if (!selectedSequence) return
        const nextStatus = selectedSequence.status === 'active' ? 'paused' : 'active'
        
        // Validate that if activating, all email/sms steps have templates
        if (nextStatus === 'active') {
            const steps = editableSteps
            const stepsWithoutTemplates = steps.filter(step => 
                (step.stepType === 'email' || step.stepType === 'sms') && !step.templateId
            )

            if (stepsWithoutTemplates.length > 0) {
                const stepTypes = stepsWithoutTemplates.map(s => s.stepType?.toUpperCase() || 'STEP').join(', ')
                showError(`Cannot activate sequence: ${stepsWithoutTemplates.length} ${stepTypes} step(s) missing templates. Please assign templates to all email and SMS steps.`)
                return
            }
        }
        
        setTogglingSequenceStatus(true)
        try {
            await updateSequenceOnServer(selectedSequence.id, { status: nextStatus })
        } finally {
            setTogglingSequenceStatus(false)
        }
    }

    useEffect(() => {
        if (token) {
            fetchSequences()
            fetchTemplates()
        } else {
            setLoading(false)
            setTemplates({ email: [], sms: [] })
            setTemplatesLoading(false)
        }
    }, [token, fetchSequences, fetchTemplates])

    const totalSequences = sequences.length
    const totalActiveContacts = sequences.reduce((sum, seq) => sum + (seq.stats?.activeContacts ?? 0), 0)
    const totalMessagesSent = sequences.reduce((sum, seq) => sum + (seq.stats?.totalSent ?? 0), 0)
    const averageOpenRate = totalSequences > 0
        ? (sequences.reduce((sum, seq) => sum + (seq.stats?.openRate ?? 0), 0) / totalSequences).toFixed(1)
        : '0.0'

    const handleSelectSequence = (sequence: Sequence) => {
        setSelectedSequence(sequence)
        setSelectedStepForPreview(sequence.steps[0]?.id ?? null)
        setEditableSteps(sequence.steps)
    }

    const handleBackToList = () => {
        if (stepsSaveTimeoutRef.current) {
            clearTimeout(stepsSaveTimeoutRef.current)
            stepsSaveTimeoutRef.current = null
        }
        setSelectedSequence(null)
        setSelectedStepForPreview(null)
        setEditableSteps([])
    }

    const handleRetry = () => {
        fetchSequences()
    }

    useEffect(() => {
        if (selectedSequence) {
            setEditableSteps(selectedSequence.steps)
        } else {
            setEditableSteps([])
        }
    }, [selectedSequence])

    useEffect(() => {
        if (selectedSequence) {
            setEditSequenceName(selectedSequence.name || '')
            setEditSequenceDescription(selectedSequence.description || '')
            setEditSequenceStatus(selectedSequence.status)
        }
    }, [selectedSequence])

    const resetCreateForm = () => {
        setNewFlowName('')
        setNewFlowTrigger('')
        setCreateError(null)
    }

    const handleOpenCreateModal = () => {
        resetCreateForm()
        setShowCreateModal(true)
    }

    const handleCloseCreateModal = () => {
        if (creatingFlow) return
        setShowCreateModal(false)
        resetCreateForm()
    }

    const handleCreateFlow = async () => {
        if (!token) return

        const name = newFlowName.trim()
        if (!name || !newFlowTrigger) {
            setCreateError('Please provide a name and select a trigger')
            return
        }

        setCreatingFlow(true)
        setCreateError(null)

        try {
            const response = await fetch(`${API_URL}/sequences`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    triggerEvent: newFlowTrigger
                })
            })

            if (!response.ok) {
                let errorMessage = 'Failed to create flow'
                try {
                    const errorData = await response.json()
                    if (errorData?.message) {
                        errorMessage = errorData.message
                    }
                } catch {
                    // ignore json parse error
                }
                throw new Error(errorMessage)
            }

            const data = await response.json()
            const createdSequence = mapSequenceFromApi(data.data)

            setSequences(prev => [createdSequence, ...prev])
            setShowCreateModal(false)
            resetCreateForm()
            setSelectedSequence(createdSequence)
            setSelectedStepForPreview(createdSequence.steps[0]?.id ?? null)
            setEditableSteps(createdSequence.steps)
        } catch (err) {
            console.error('Error creating flow:', err)
            setCreateError(err instanceof Error ? err.message : 'Failed to create flow')
        } finally {
            setCreatingFlow(false)
        }
    }

    // Filter sequences
    const filteredSequences = sequences.filter(seq => {
        const matchesSearch = seq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            seq.description?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === 'all' || seq.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800 border-green-200'
            case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
            case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200'
            default: return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    const getChannelIcon = (channel?: string, stepType?: string) => {
        if (channel === 'email') return <Mail className="h-4 w-4" />
        if (channel === 'sms') return <MessageSquare className="h-4 w-4" />
        if (stepType === 'delay') return <Clock className="h-4 w-4" />
        return <Workflow className="h-4 w-4" />
    }

    const getTriggerTypeLabel = (type?: string) => {
        switch (type) {
            case 'event': return 'Event-based'
            case 'time': return 'Time-based'
            case 'manual': return 'Manual'
            default: return type || 'Custom'
        }
    }

    // Vista de lista
    if (!selectedSequence) {
        return (
            <>
                <Head>
                    <title>Sequences - Admin Portal</title>
                </Head>
                <Layout>
                    <ToastManager toasts={toasts} onDismiss={dismiss} />
                    <div className="space-y-6 p-6">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-semibold text-foreground flex items-center gap-3">
                                    <Workflow className="h-8 w-8 text-primary" />
                                    Messaging Sequences
                                </h1>
                                <p className="text-muted-foreground mt-1">
                                    Automated email and SMS sequences for patient engagement
                                </p>
                            </div>
                            <Button className="gap-2" onClick={handleOpenCreateModal}>
                                <Plus className="h-4 w-4" />
                                Create Sequence
                            </Button>
                        </div>

                        {loading ? (
                            <Card>
                                <CardContent className="py-12 text-center space-y-3">
                                    <Workflow className="h-12 w-12 text-muted-foreground mx-auto animate-pulse" />
                                    <p className="text-muted-foreground">Loading sequences...</p>
                                </CardContent>
                            </Card>
                        ) : error ? (
                            <Card>
                                <CardContent className="py-12 text-center space-y-4">
                                    <Workflow className="h-12 w-12 text-destructive mx-auto" />
                                    <div>
                                        <h3 className="text-lg font-semibold mb-1">We couldn't load your sequences</h3>
                                        <p className="text-muted-foreground">{error}</p>
                                    </div>
                                    <Button variant="default" onClick={handleRetry} className="gap-2">
                                        <Workflow className="h-4 w-4" />
                                        Try again
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {/* Stats Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">Total Sequences</p>
                                                    <h3 className="text-2xl font-bold mt-1">{totalSequences}</h3>
                                                </div>
                                                <Workflow className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">Active Contacts</p>
                                                    <h3 className="text-2xl font-bold mt-1">
                                                        {totalActiveContacts}
                                                    </h3>
                                                </div>
                                                <Users className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">Messages Sent</p>
                                                    <h3 className="text-2xl font-bold mt-1">
                                                        {totalMessagesSent}
                                                    </h3>
                                                </div>
                                                <TrendingUp className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">Avg. Open Rate</p>
                                                    <h3 className="text-2xl font-bold mt-1">
                                                        {averageOpenRate}%
                                                    </h3>
                                                </div>
                                                <Mail className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Filters */}
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex gap-4 flex-wrap">
                                            <div className="flex-1 min-w-[300px]">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search sequences..."
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setStatusFilter('all')}
                                                >
                                                    All
                                                </Button>
                                                <Button
                                                    variant={statusFilter === 'active' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setStatusFilter('active')}
                                                >
                                                    Active
                                                </Button>
                                                <Button
                                                    variant={statusFilter === 'paused' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setStatusFilter('paused')}
                                                >
                                                    Paused
                                                </Button>
                                                <Button
                                                    variant={statusFilter === 'draft' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setStatusFilter('draft')}
                                                >
                                                    Draft
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Sequences List */}
                                <div className="grid gap-4">
                                    {filteredSequences.map((sequence) => (
                                        <Card key={sequence.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectSequence(sequence)}>
                                            <CardContent className="pt-6">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h3 className="text-lg font-semibold">{sequence.name}</h3>
                                                            <Badge className={`${getStatusColor(sequence.status)} border`}>
                                                                {sequence.status}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground mb-4">
                                                            {sequence.description}
                                                        </p>
                                                        
                                                        {/* Trigger Selector */}
                                                        <div className="mb-4">
                                                            <label className="text-xs text-muted-foreground block mb-1">Trigger Event</label>
                                                            <select
                                                                value={sequence.triggerEvent}
                                                                onChange={async (e) => {
                                                                    e.stopPropagation();
                                                                    const newTrigger = e.target.value;
                                                                    if (!newTrigger || newTrigger === sequence.triggerEvent) return;
                                                                    
                                                                    try {
                                                                        await updateSequenceOnServer(sequence.id, {
                                                                            triggerEvent: newTrigger
                                                                        });
                                                                        success(`Trigger updated to ${TRIGGER_OPTIONS.find(t => t.value === newTrigger)?.label}`);
                                                                    } catch (error) {
                                                                        showError("Failed to update trigger");
                                                                    }
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full max-w-xs px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                            >
                                                                {TRIGGER_OPTIONS.map(option => (
                                                                    <option key={option.value} value={option.value}>
                                                                        {option.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        
                                                        {/* Stats */}
                                                        <div className="flex gap-6 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                                <span className="text-muted-foreground">
                                                                    {sequence.stats.activeContacts} active
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                                <span className="text-muted-foreground">
                                                                    {sequence.stats.totalSent} sent
                                                                </span>
                                                            </div>
                                                            {sequence.stats.openRate !== undefined && (
                                                                <div className="flex items-center gap-2">
                                                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                                                    <span className="text-muted-foreground">
                                                                        {sequence.stats.openRate}% open rate
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2">
                                                                <Workflow className="h-4 w-4 text-muted-foreground" />
                                                                <span className="text-muted-foreground">
                                                                    {sequence.steps.length} steps
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 ml-4">
                                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); }}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); }}>
                                                            {sequence.status === 'active' ? (
                                                                <Pause className="h-4 w-4" />
                                                            ) : (
                                                                <Play className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                {filteredSequences.length === 0 && (
                                    <Card>
                                        <CardContent className="pt-12 pb-12 text-center">
                                            <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                            <h3 className="text-lg font-medium mb-2">No sequences found</h3>
                                            <p className="text-muted-foreground mb-6">
                                                {searchTerm || statusFilter !== 'all'
                                                    ? 'Try adjusting your filters'
                                                    : 'Create your first automated messaging sequence'}
                                            </p>
                                            {!searchTerm && statusFilter === 'all' && (
                                                <Button onClick={handleOpenCreateModal}>
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Create Sequence
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}
                            </>
                        )}
                    </div>
                </Layout>
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
                        <div className="bg-background w-full max-w-lg rounded-xl shadow-xl overflow-hidden">
                            <div className="flex items-start justify-between border-b border-border p-5">
                                <div>
                                    <h2 className="text-xl font-semibold">Create Sequence</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Name your sequence and choose when it should start.</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleCloseCreateModal} disabled={creatingFlow}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Sequence name</label>
                                    <input
                                        type="text"
                                        value={newFlowName}
                                        onChange={(e) => setNewFlowName(e.target.value)}
                                        placeholder="e.g. Post-Checkout Onboarding"
                                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        disabled={creatingFlow}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Trigger</label>
                                    <select
                                        value={newFlowTrigger}
                                        onChange={(e) => setNewFlowTrigger(e.target.value)}
                                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        disabled={creatingFlow}
                                    >
                                        <option value="">Select a trigger...</option>
                                        {TRIGGER_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Draft sequences can be activated later once steps are configured.
                                    </p>
                                </div>

                                {createError && (
                                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                                        {createError}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t border-border p-5">
                                <Button variant="outline" onClick={handleCloseCreateModal} disabled={creatingFlow}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCreateFlow}
                                    disabled={creatingFlow || !newFlowName.trim() || !newFlowTrigger}
                                    className="min-w-[110px]"
                                >
                                    {creatingFlow ? 'Creating...' : 'Create Sequence'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )
    }

    // Vista de detalle de secuencia
    if (selectedSequence) {
        const displaySteps = editableSteps
        const sequenceStats: SequenceStats = {
            totalSent: selectedSequence.stats?.totalSent ?? 0,
            openRate: selectedSequence.stats?.openRate ?? 0,
            clickRate: selectedSequence.stats?.clickRate ?? 0,
            activeContacts: selectedSequence.stats?.activeContacts ?? 0
        }
        const hasTriggerOption = TRIGGER_OPTIONS.some(option => option.value === selectedSequence.triggerEvent)
        const triggerSelectOptions = hasTriggerOption
            ? TRIGGER_OPTIONS
            : [
                {
                    value: selectedSequence.triggerEvent,
                    label: selectedSequence.triggerEvent.replace(/_/g, ' ').toUpperCase()
                },
                ...TRIGGER_OPTIONS
            ]

        return (
        <>
            <Head>
                <title>{selectedSequence.name} - Sequences</title>
            </Head>
            <Layout>
                <ToastManager toasts={toasts} onDismiss={dismiss} />
                <div className="space-y-6 p-6">
                    {/* Header con botón de volver */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="sm" onClick={handleBackToList}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Flows
                            </Button>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-semibold">{selectedSequence.name}</h1>
                                    <Badge className={`${getStatusColor(selectedSequence.status)} border`}>
                                        {selectedSequence.status}
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground mt-1">{selectedSequence.description}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleOpenEditSequenceModal}>
                                <Settings className="h-4 w-4 mr-2" />
                                Edit
                            </Button>
                            <Button
                                variant={selectedSequence.status === 'active' ? 'outline' : 'default'}
                                onClick={handleToggleSequenceStatus}
                                disabled={togglingSequenceStatus}
                            >
                                {togglingSequenceStatus ? (
                                    'Updating...'
                                ) : selectedSequence.status === 'active' ? (
                                    <>
                                        <Pause className="h-4 w-4 mr-2" />
                                        Pause
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4 mr-2" />
                                        Activate
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Active Contacts</p>
                                        <h3 className="text-2xl font-bold mt-1">{sequenceStats.activeContacts}</h3>
                                    </div>
                                    <Users className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                                        <h3 className="text-2xl font-bold mt-1">{sequenceStats.totalSent}</h3>
                                    </div>
                                    <Mail className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Open Rate</p>
                                        <h3 className="text-2xl font-bold mt-1">
                                            {Number(sequenceStats.openRate ?? 0).toFixed(1)}%
                                        </h3>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Click Rate</p>
                                        <h3 className="text-2xl font-bold mt-1">
                                            {Number(sequenceStats.clickRate ?? 0).toFixed(1)}%
                                        </h3>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Trigger Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Trigger Event</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <label className="text-sm text-muted-foreground">Select when this flow should start</label>
                                <div className="relative">
                                    <Play className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <select
                                        value={selectedSequence.triggerEvent}
                                        onChange={handleTriggerChange}
                                        disabled={updatingTrigger}
                                        className="w-full pl-9 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                    >
                                        {triggerSelectOptions.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {updatingTrigger && (
                                    <p className="text-xs text-muted-foreground">Updating trigger...</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sequence Steps - Split Layout */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Sequence Steps ({displaySteps.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left Column - Builder */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
                                        {/* Palette */}
                                        <div className="space-y-3">
                                            <h4 className="font-semibold text-sm">Available Steps</h4>
                                            <div className="space-y-3">
                                                {STEP_PALETTE.map((item) => {
                                                    const Icon = item.icon
                                                    return (
                                                        <div
                                                            key={item.type}
                                                            draggable
                                                            onDragStart={(event) => {
                                                                handleStepDragStart(item.type)
                                                                event.dataTransfer.setData('application/flow-step-type', item.type)
                                                                event.dataTransfer.effectAllowed = 'copy'
                                                            }}
                                                            onDragEnd={handleStepDragEnd}
                                                            onClick={() => handlePaletteAdd(item.type)}
                                                            className="border-2 border-dashed border-border rounded-lg p-3 hover:border-primary hover:bg-primary/5 transition-all cursor-move"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <div className="p-2 rounded-md bg-muted">
                                                                    <Icon className="h-4 w-4 text-primary" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-sm">{item.label}</p>
                                                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Drop Zone */}
                                        <div
                                            className={`min-h-[220px] border-2 rounded-lg p-4 transition-colors ${
                                                isDropTargetActive ? 'border-primary bg-primary/5' : 'border-dashed border-border bg-muted/40'
                                            }`}
                                            onDragEnter={handleStepsDragEnter}
                                            onDragOver={handleStepsDragOver}
                                            onDragLeave={handleStepsDragLeave}
                                            onDrop={handleStepsDrop}
                                        >
                                            {displaySteps.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground pointer-events-none">
                                                    <Workflow className="h-8 w-8 mb-2" />
                                                    <p>Drag a step from the list to build your flow.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {displaySteps.map((step, index) => {
                                                        const isSelected = selectedStepForPreview === step.id
                                                        const showIndicatorBefore = dropIndicator?.stepId === step.id && dropIndicator.position === 'before'
                                                        const showIndicatorAfter = dropIndicator?.stepId === step.id && dropIndicator.position === 'after'
                                                        return (
                                                            <div key={step.id} className="space-y-1">
                                                                {showIndicatorBefore && (
                                                                    <div className="h-2 border-2 border-dashed border-primary rounded" />
                                                                )}
                                                                <div
                                                                    className={`relative flex gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 ${
                                                                        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/50'
                                                                    } ${draggedExistingStepId === step.id ? 'opacity-60' : ''}`}
                                                                    onClick={() => setSelectedStepForPreview(step.id)}
                                                                    draggable
                                                                    onDragStart={(event) => handleExistingStepDragStart(event, step.id)}
                                                                    onDragEnd={handleExistingStepDragEnd}
                                                                    onDragOver={(event) => handleStepDragOver(event, step.id)}
                                                                    onDragEnter={(event) => handleStepDragOver(event, step.id)}
                                                                    onDragLeave={(event) => handleStepDragLeave(event, step.id)}
                                                                    onDrop={(event) => handleStepDrop(event, step.id)}
                                                                >
                                                                <div className="flex-shrink-0">
                                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                                                                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                                                    }`}>
                                                                        {index + 1}
                                                                    </div>
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                                        <h4 className="font-semibold text-sm truncate">{step.name}</h4>
                                                                        <Badge variant="outline" className="gap-1 flex-shrink-0">
                                                                            {getChannelIcon(step.channel, step.stepType)}
                                                                            <span className="text-xs">
                                                                                {step.channel
                                                                                    ? step.channel.toUpperCase()
                                                                                    : step.stepType
                                                                                    ? step.stepType.toUpperCase()
                                                                                    : 'STEP'}
                                                                            </span>
                                                                        </Badge>
                                                                    </div>
                                                                    {(step.stepType === 'sms' || step.stepType === 'email') && (
                                                                        <div className="mb-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                                                                            {/* Toggle between Template and Custom Text */}
                                                                            <div className="flex gap-2 text-xs">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleToggleCustomText(step.id, false)}
                                                                                    className={`flex-1 px-2 py-1 rounded-md border transition-colors ${
                                                                                        !step.useCustomText
                                                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                                                            : 'bg-background border-border hover:bg-muted'
                                                                                    }`}
                                                                                >
                                                                                    Use Template
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleToggleCustomText(step.id, true)}
                                                                                    className={`flex-1 px-2 py-1 rounded-md border transition-colors ${
                                                                                        step.useCustomText
                                                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                                                            : 'bg-background border-border hover:bg-muted'
                                                                                    }`}
                                                                                >
                                                                                    Write Custom
                                                                                </button>
                                                                            </div>

                                                                            {/* Template Selector */}
                                                                            {!step.useCustomText && (
                                                                                <div>
                                                                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                                                                        {step.stepType === 'sms' ? 'SMS Template' : 'Email Template'}
                                                                                    </label>
                                                                                    <select
                                                                                        value={step.templateId || ''}
                                                                                        onChange={(e) => handleTemplateSelect(step.id, e.target.value)}
                                                                                        className="w-full px-2 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                                                                    >
                                                                                        <option value="">
                                                                                            Select a {step.stepType === 'sms' ? 'SMS' : 'Email'} template...
                                                                                        </option>
                                                                                        {(step.stepType === 'sms' ? templates.sms : templates.email).map(template => (
                                                                                            <option key={template.id} value={template.id}>
                                                                                                {template.name}
                                                                                            </option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                            )}

                                                                            {/* Custom Text Editor */}
                                                                            {step.useCustomText && (
                                                                                <div className="space-y-2">
                                                                                    {step.stepType === 'email' && (
                                                                                        <div>
                                                                                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                                                                                Subject Line
                                                                                            </label>
                                                                                            <input
                                                                                                type="text"
                                                                                                value={step.customSubject || ''}
                                                                                                onChange={(e) => handleCustomTextChange(step.id, step.customText || '', e.target.value)}
                                                                                                placeholder="Enter email subject..."
                                                                                                className="w-full px-2 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                                                                            />
                                                                                        </div>
                                                                                    )}
                                                                                    <div>
                                                                                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                                                                                            Message Text
                                                                                        </label>
                                                                                        <textarea
                                                                                            value={step.customText || ''}
                                                                                            onChange={(e) => handleCustomTextChange(step.id, e.target.value, step.customSubject)}
                                                                                            placeholder={`Write your ${step.stepType === 'sms' ? 'SMS' : 'email'} message here...\n\nUse variables like:\n{{firstName}}\n{{lastName}}\n{{email}}`}
                                                                                            rows={6}
                                                                                            className="w-full px-2 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background font-mono"
                                                                                        />
                                                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                                                            <span className="font-medium">Available variables:</span> {'{'}{'{'} firstName {'}'}{'}'}, {'{'}{'{'} lastName {'}'}{'}'}, {'{'}{'{'} email {'}'}{'}'}, {'{'}{'{'} phoneNumber {'}'}{'}'}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {step.stepType === 'delay' && (
                                                                        (() => {
                                                                            const totalSeconds = getTotalDelaySeconds(step)
                                                                            const days = Math.floor(totalSeconds / (24 * 3600))
                                                                            const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
                                                                            const minutes = Math.floor((totalSeconds % 3600) / 60)
                                                                            const seconds = totalSeconds % 60
                                                                            const values = { Days: days, Hours: hours, Minutes: minutes, Seconds: seconds }

                                                                            return (
                                                                                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                                                                    {(['Days', 'Hours', 'Minutes', 'Seconds'] as const).map((label) => (
                                                                                        <div key={label} className="space-y-1">
                                                                                            <label className="block text-xs font-medium text-muted-foreground">{label}</label>
                                                                                            <input
                                                                                                type="number"
                                                                                                min={0}
                                                                                                className="w-full px-2 py-1 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                                                                                                value={values[label]}
                                                                                                onChange={(e) => {
                                                                                                    const newValue = Math.max(0, Number(e.target.value) || 0)
                                                                                                    const updated = {
                                                                                                        Days: label === 'Days' ? newValue : values.Days,
                                                                                                        Hours: label === 'Hours' ? newValue : values.Hours,
                                                                                                        Minutes: label === 'Minutes' ? newValue : values.Minutes,
                                                                                                        Seconds: label === 'Seconds' ? newValue : values.Seconds
                                                                                                    }
                                                                                                    const newTotalSeconds =
                                                                                                        updated.Days * 24 * 3600 +
                                                                                                        updated.Hours * 3600 +
                                                                                                        updated.Minutes * 60 +
                                                                                                        updated.Seconds
                                                                                                    updateDelayForStep(step.id, newTotalSeconds)
                                                                                                }}
                                                                                            />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )
                                                                        })()
                                                                    )}
                                                                    {step.stepType === 'delay' && (
                                                                        <p className="text-xs text-muted-foreground mt-2">Total delay: {formatDelayLabel(step)}</p>
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-col gap-1 flex-shrink-0">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleRemoveStep(step.id)
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>

                                                                {index < displaySteps.length - 1 && (
                                                                    <div className="absolute left-8 -bottom-3 w-0.5 h-3 bg-border" />
                                                                )}
                                                                </div>
                                                                {showIndicatorAfter && (
                                                                    <div className="h-2 border-2 border-dashed border-primary rounded" />
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Preview */}
                                <div className="lg:sticky lg:top-6 lg:self-start">
                                    {selectedStepForPreview ? (() => {
                                        const step = displaySteps.find((s) => s.id === selectedStepForPreview)
                                        if (!step) return null

                                        const isDelayStep = step.stepType === 'delay' || !step.channel
                                        const hasCustomText = !!step.useCustomText && !!step.customText
                                        const hasTemplateSelected = isDelayStep || hasCustomText || !!step.templateId
                                        
                                        // Use custom text if available, otherwise use template body
                                        const contentToShow = hasCustomText ? step.customText : step.templateBody
                                        const { blocks: templateBlocks, plainText: templatePlainText } = parseTemplateBody(contentToShow)
                                        const mergeFields = extractMergeFields(contentToShow)

                                        const smsPreviewText = (() => {
                                            if (step.channel !== 'sms') return ''
                                            if (hasCustomText) {
                                                return applySampleValues(step.customText || '')
                                            }
                                            const rawText = templateBlocks
                                                ? templateBlocks
                                                    .filter(block => block.type === 'text')
                                                    .map(block => block.content)
                                                    .join('\n\n')
                                                : templatePlainText
                                            return applySampleValues(rawText || '')
                                        })()

                                        const emailBlocks = step.channel === 'email' && !hasCustomText ? templateBlocks : null
                                        const emailPlainText = step.channel === 'email' ? (hasCustomText ? (step.customText || '') : templatePlainText) : ''

                                        return (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Smartphone className="h-5 w-5 text-primary" />
                                                        <h3 className="font-semibold">Message Preview</h3>
                                                    </div>
                                                    <Badge variant="outline" className="gap-1">
                                                        {getChannelIcon(step.channel, step.stepType)}
                                                        {step.channel
                                                            ? step.channel.toUpperCase()
                                                            : step.stepType
                                                            ? step.stepType.toUpperCase()
                                                            : 'STEP'}
                                                    </Badge>
                                                </div>

                                                <div className="flex justify-center">
                                                    <div className="w-full max-w-[340px]">
                                                        <div className="relative border-[12px] border-gray-800 rounded-[2rem] shadow-2xl bg-white overflow-hidden" style={{ aspectRatio: '9/19.5' }}>
                                                            <div className="absolute top-0 inset-x-0 h-5 bg-gray-800 rounded-b-3xl mx-auto w-32 z-10"></div>

                                                            <div className="h-full overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
                                                                {!hasTemplateSelected && !isDelayStep ? (
                                                                    <div className="p-6 flex items-center justify-center h-full text-center">
                                                                        <div className="space-y-2">
                                                                            <Mail className="h-8 w-8 text-primary mx-auto" />
                                                                            <h4 className="font-semibold">Select a Template</h4>
                                                                            <p className="text-sm text-muted-foreground">
                                                                                Choose a {step.stepType === 'sms' ? 'SMS' : 'Email'} template from the list to preview the message content.
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ) : isDelayStep ? (
                                                                    <div className="p-6 flex items-center justify-center h-full text-center">
                                                                        <div className="space-y-2">
                                                                            <Clock className="h-8 w-8 text-primary mx-auto" />
                                                                            <h4 className="font-semibold">Delay Step</h4>
                                                                            <p className="text-sm text-muted-foreground">
                                                                                Wait {formatDelayLabel(step)} before the next step is executed.
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ) : step.channel === 'sms' ? (
                                                                    <div className="p-3 pt-7 space-y-2">
                                                                        <div className="flex items-center gap-2 mb-3 px-1">
                                                                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-semibold">
                                                                                HC
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] font-semibold text-gray-900">Health Clinic</p>
                                                                                <p className="text-[9px] text-gray-500">SMS</p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex justify-start px-1">
                                                                            <div className="bg-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                                                                                <p className="text-[11px] text-gray-900 whitespace-pre-line leading-relaxed">
                                                                                    {smsPreviewText || 'Preview not available'}
                                                                                </p>
                                                                                <p className="text-[9px] text-gray-500 mt-1">Just now</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-3 pt-7">
                                                                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
                                                                                {step.templateSubject && (
                                                                                    <h3 className="text-[11px] font-semibold text-gray-900 mt-1 leading-tight">{step.templateSubject}</h3>
                                                                                )}
                                                                            </div>

                                                                            <div className="p-3">
                                                                                {emailBlocks ? (
                                                                                    <div className="space-y-3 text-[10px] text-gray-700 leading-relaxed">
                                                                                        {emailBlocks.map((block, idx) => {
                                                                                            if (block.type === 'image') {
                                                                                                return (
                                                                                                    <div key={block.id ?? idx} className="my-2">
                                                                                                        {block.content ? (
                                                                                                            <img
                                                                                                                src={block.content}
                                                                                                                alt="Template image"
                                                                                                                className="w-full rounded"
                                                                                                                onError={(event) => {
                                                                                                                    (event.target as HTMLImageElement).style.display = 'none'
                                                                                                                }}
                                                                                                            />
                                                                                                        ) : (
                                                                                                            <div className="bg-gray-100 rounded p-2 text-center">
                                                                                                                <Mail className="h-4 w-4 mx-auto text-gray-400" />
                                                                                                                <p className="text-[8px] text-gray-400 mt-1">Image placeholder</p>
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                )
                                                                                            }

                                                                                            return (
                                                                                                <div key={block.id ?? idx} className="text-[10px] text-gray-700 whitespace-pre-line leading-relaxed">
                                                                                                    {formatEmailText(block.content)}
                                                                                                </div>
                                                                                            )
                                                                                        })}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-[10px] text-gray-700 whitespace-pre-line leading-relaxed">
                                                                                        {formatEmailText(emailPlainText || 'Preview not available')}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-muted rounded-lg p-4 space-y-3">
                                                    <h4 className="font-semibold text-sm">Step Details</h4>

                                                    <div className="space-y-2 text-sm">
                                                        {(step.stepType === 'sms' || step.stepType === 'email') ? (
                                                            <div className="flex items-center gap-2">
                                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                                <span className="text-muted-foreground">Template:</span>
                                                                <span className="font-medium">{step.templateName || 'Not selected'}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                                <span className="text-muted-foreground">Delay:</span>
                                                                <span className="font-medium">Wait {step.delay} {step.delayUnit}</span>
                                                            </div>
                                                        )}

                                                        {step.conditionalLogic && (
                                                            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-900">
                                                                <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-400">
                                                                    <Filter className="h-3 w-3" />
                                                                    <span className="font-medium">Conditional Logic:</span>
                                                                </div>
                                                                <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                                                                    {step.conditionalLogic.field} {step.conditionalLogic.operator} {step.conditionalLogic.value}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {mergeFields.length > 0 && (
                                                        <div className="pt-3 border-t border-border">
                                                            <p className="text-xs text-muted-foreground mb-2">Merge Fields:</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {mergeFields.map((field, idx) => (
                                                                    <Badge key={`${field}-${idx}`} variant="secondary" className="text-xs">
                                                                        {field}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })() : (
                                        <div className="space-y-4">
                                            {/* Header */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Smartphone className="h-5 w-5 text-primary" />
                                                    <h3 className="font-semibold">Message Preview</h3>
                                                </div>
                                                <Badge variant="outline" className="gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    DELAY
                                                </Badge>
                                            </div>

                                            {/* Phone Mockup with Example */}
                                            <div className="flex justify-center">
                                                <div className="w-full max-w-[340px]">
                                                    <div className="relative border-[12px] border-gray-800 rounded-[2rem] shadow-2xl bg-white overflow-hidden" style={{ aspectRatio: '9/19.5' }}>
                                                        {/* Phone Notch */}
                                                        <div className="absolute top-0 inset-x-0 h-5 bg-gray-800 rounded-b-3xl mx-auto w-32 z-10"></div>

                                                        {/* Phone Content */}
                                                        <div className="h-full overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
                                                            <div className="p-6 flex items-center justify-center h-full text-center">
                                                                <div className="space-y-4">
                                                                    <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(270, 80%, 65%) 0%, hsl(280, 75%, 72%) 100%)' }}>
                                                                        <Clock className="h-8 w-8 text-white" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold text-base mb-2">Delay Step</h4>
                                                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                                                            Wait 1 hour before the next step is executed.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Example Step Card */}
                                            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 rounded-xl p-4 border-2 border-purple-200 dark:border-purple-800">
                                                <div className="space-y-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, hsl(270, 80%, 65%) 0%, hsl(280, 75%, 72%) 100%)' }}>
                                                            <span className="text-white font-bold text-lg">1</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                                                    <Clock className="h-4 w-4" />
                                                                    Delay
                                                                </h4>
                                                                <Badge variant="outline" className="text-xs">
                                                                    <Clock className="h-3 w-3 mr-1" />
                                                                    DELAY
                                                                </Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">
                                                                Wait before the next step
                                                            </p>
                                                            <div className="mt-3 p-3 bg-white/60 dark:bg-gray-900/20 rounded-lg border border-purple-200/50 dark:border-purple-800/50">
                                                                <div className="grid grid-cols-4 gap-2 text-center">
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Days</p>
                                                                        <p className="font-semibold">0</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Hours</p>
                                                                        <p className="font-semibold">1</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Minutes</p>
                                                                        <p className="font-semibold">0</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Seconds</p>
                                                                        <p className="font-semibold">0</p>
                                                                    </div>
                                                                </div>
                                                                <div className="mt-2 pt-2 border-t border-purple-200/50 dark:border-purple-800/50">
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Total delay: <span className="font-medium text-foreground">1 hour</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Instruction Card */}
                                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                        <Smartphone className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-sm mb-1">Select a Step to Preview</h4>
                                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                                            Click on any step from the sequence builder on the left to see how the message will appear to your patients. You'll be able to preview SMS messages, emails, and delay steps.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Metadata */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Created</p>
                                    <p className="font-medium">{new Date(selectedSequence.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Last Updated</p>
                                    <p className="font-medium">{new Date(selectedSequence.updatedAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </Layout>
            {showEditSequenceModal && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
                    <div className="bg-background w-full max-w-lg rounded-xl shadow-xl overflow-hidden">
                        <div className="flex items-start justify-between border-b border-border p-5">
                            <div>
                                <h2 className="text-xl font-semibold">Edit flow</h2>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleCloseEditSequenceModal} disabled={savingSequenceDetails}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editSequenceName}
                                    onChange={(e) => setEditSequenceName(e.target.value)}
                                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Enter the flow name"
                                    disabled={savingSequenceDetails}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                                <textarea
                                    value={editSequenceDescription}
                                    onChange={(e) => setEditSequenceDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                                    placeholder="Describe the goal of this flow"
                                    disabled={savingSequenceDetails}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                                <select
                                    value={editSequenceStatus}
                                    onChange={(e) => setEditSequenceStatus(e.target.value as Sequence['status'])}
                                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                    disabled={savingSequenceDetails}
                                >
                                    {SEQUENCE_STATUS_OPTIONS.map(option => (
                                        <option key={option} value={option}>
                                            {option.charAt(0).toUpperCase() + option.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-border p-5">
                            <Button variant="outline" onClick={handleCloseEditSequenceModal} disabled={savingSequenceDetails}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveSequenceDetails}
                                disabled={savingSequenceDetails || !editSequenceName.trim()}
                                className="min-w-[110px]"
                            >
                                {savingSequenceDetails ? 'Saving...' : 'Save changes'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
        )
    }

    return null
}

