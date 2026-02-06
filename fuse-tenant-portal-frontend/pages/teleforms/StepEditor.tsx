import { ChangeEvent, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit, Save, X, Loader2, ChevronUp, ChevronDown } from "lucide-react"

interface QuestionnaireStepTemplate {
    id: string
    title: string
    description?: string | null
    stepOrder: number
    category?: 'normal' | 'user_profile' | 'doctor'
}

interface StepEditorProps {
    step: QuestionnaireStepTemplate
    token: string | null
    baseUrl: string
    onStepSaved: (updatedStep: QuestionnaireStepTemplate) => void
    onStepReordered?: (stepId: string, direction: 'up' | 'down') => void
    canMoveUp?: boolean
    canMoveDown?: boolean
}

export function StepEditor({ step, token, baseUrl, onStepSaved, onStepReordered, canMoveUp = false, canMoveDown = false }: StepEditorProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [title, setTitle] = useState(step.title)
    const [description, setDescription] = useState(step.description || '')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isEditing) {
            setTitle(step.title)
            setDescription(step.description || '')
        }
    }, [step, isEditing])

    const resetEditingState = () => {
        setIsEditing(false)
        setError(null)
        setTitle(step.title)
        setDescription(step.description || '')
    }

    const handleSave = async () => {
        if (!token) return

        const trimmedTitle = title.trim()
        if (!trimmedTitle) {
            setError('Step title is required')
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            const response = await fetch(`${baseUrl}/questionnaires/step`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    stepId: step.id,
                    title: trimmedTitle,
                    description: description.trim() || null,
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || 'Failed to save step')
            }

            const data = await response.json()
            if (data?.data) {
                onStepSaved(data.data)
                setTitle(data.data.title ?? trimmedTitle)
                setDescription(data.data.description || '')
                setIsEditing(false)
            }
        } catch (err: any) {
            console.error('❌ Error saving step:', err)
            setError(err.message || 'Unable to save step')
        } finally {
            setIsSaving(false)
        }
    }

    const getCategoryStyles = (category?: string) => {
        switch (category) {
            case 'user_profile':
                return {
                    container: 'bg-emerald-950/5 border-emerald-300/60',
                    badge: 'bg-emerald-500/20 text-emerald-700',
                    chip: 'bg-emerald-500/15 text-emerald-800 border border-emerald-400/60'
                }
            case 'doctor':
                return {
                    container: 'bg-rose-950/5 border-rose-300/60',
                    badge: 'bg-rose-500/20 text-rose-700',
                    chip: 'bg-rose-500/15 text-rose-800 border border-rose-400/60'
                }
            case 'normal':
            default:
                return {
                    container: 'bg-sky-950/5 border-sky-300/60',
                    badge: 'bg-sky-500/20 text-sky-700',
                    chip: 'bg-sky-500/15 text-sky-800 border border-sky-400/60'
                }
        }
    }

    const styles = getCategoryStyles(step.category)

    return (
        <div className={`p-4 rounded-lg border ${styles.container}`}>
            <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${styles.badge}`}>
                            {step.stepOrder ?? 0}
                        </span>
                        {isEditing ? (
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Step title"
                                className="text-sm font-medium"
                            />
                        ) : (
                            <h4 className="font-medium text-foreground">{step.title}</h4>
                        )}
                    </div>

                    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium uppercase tracking-wide ${styles.chip}`}>
                        <span>Category:</span>
                        <span>{step.category || 'normal'}</span>
                    </div>

                    {isEditing ? (
                        <textarea
                            value={description}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                            placeholder="Step description (optional)"
                            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                            rows={2}
                        />
                    ) : (
                        step.description && (
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                        )
                    )}

                    <div className="text-xs text-muted-foreground">
                        {(step as any).questions?.length || 0} questions
                    </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                    {/* Reorder buttons - only show for normal category steps */}
                    {step.category === 'normal' && onStepReordered && (
                        <div className="flex flex-col gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onStepReordered(step.id, 'up')}
                                disabled={!canMoveUp}
                                className="h-6 w-6 p-0"
                            >
                                <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onStepReordered(step.id, 'down')}
                                disabled={!canMoveDown}
                                className="h-6 w-6 p-0"
                            >
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </div>
                    )}

                    {/* <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    Save
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={resetEditingState}
                                    disabled={isSaving}
                                >
                                    <X className="mr-2 h-4 w-4" />
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                        )}
                    </div> */}
                </div>
            </div>

            {error && (
                <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                </div>
            )}
        </div>
    )
}

export default StepEditor
