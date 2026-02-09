import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, Copy, Check, RefreshCw } from "lucide-react"
import { StepEditor } from "./StepEditor"
import { QuestionEditor } from "./QuestionEditor"
import { useState, useRef } from "react"

interface QuestionnaireOptionTemplate {
    id: string
    optionText: string
    optionValue?: string | null
    optionOrder: number
}

interface QuestionnaireQuestionTemplate {
    id: string
    stepId: string
    questionText: string
    answerType: string
    questionOrder: number
    isRequired?: boolean
    options?: QuestionnaireOptionTemplate[]
}

interface QuestionnaireStepTemplate {
    id: string
    title: string
    description?: string | null
    stepOrder: number
    category?: 'normal' | 'user_profile' | 'doctor'
    questions?: QuestionnaireQuestionTemplate[]
}

interface QuestionnaireTemplate {
    id: string
    title: string
    description?: string | null
    checkoutStepPosition: number
    treatmentId: string | null
    isTemplate?: boolean
    steps?: QuestionnaireStepTemplate[]
    treatment?: {
        id: string
        name: string
        slug?: string | null
        clinic?: {
            id: string
            name: string
            slug: string
        }
    }
}

interface QuestionnaireEditorProps {
    questionnaire: QuestionnaireTemplate | null
    onBack: () => void
    token: string | null
    baseUrl: string
    onQuestionSaved: (question: QuestionnaireQuestionTemplate) => void
    onStepSaved: (step: QuestionnaireStepTemplate) => void
    onStepReordered: (stepId: string, direction: 'up' | 'down') => void
}

export function QuestionnaireEditor({
    questionnaire,
    onBack,
    token,
    baseUrl,
    onQuestionSaved,
    onStepSaved,
    onStepReordered,
}: QuestionnaireEditorProps) {
    const steps = questionnaire?.steps ?? []
    const [copiedQuestionnaireId, setCopiedQuestionnaireId] = useState<string | null>(null)
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [rebuilding, setRebuilding] = useState(false)

    // Group steps by category for reordering logic
    const normalSteps = steps.filter(step => step.category === 'normal')
    const otherSteps = steps.filter(step => step.category !== 'normal')

    // Create a map to determine if a step can move up/down within its category
    const getStepMovementFlags = (stepId: string) => {
        if (normalSteps.length <= 1) {
            return { canMoveUp: false, canMoveDown: false }
        }

        const stepIndex = normalSteps.findIndex(step => step.id === stepId)
        if (stepIndex === -1) {
            return { canMoveUp: false, canMoveDown: false }
        }

        return {
            canMoveUp: stepIndex > 0,
            canMoveDown: stepIndex < normalSteps.length - 1
        }
    }

    const handleCopyPreview = async (url: string, questionnaireId: string) => {
        try {
            await navigator.clipboard.writeText(url)
            setCopiedQuestionnaireId(questionnaireId)

            // Clear any existing timeout
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current)
            }

            // Reset the copied state after 2 seconds
            copyTimeoutRef.current = setTimeout(() => {
                setCopiedQuestionnaireId(null)
            }, 2000)
        } catch (err) {
            console.error('Failed to copy URL:', err)
        }
    }

    return (
        <div className="space-y-6">
            {/* Editor Header */}
            <div className="flex justify-between items-start">
                <div>
                    <Button variant="ghost" onClick={onBack} className="mb-4">
                        ← Back to Forms
                    </Button>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">{questionnaire?.title || 'Questionnaire'} - Editor</h2>
                    <p className="text-muted-foreground">Review and manage questionnaire steps</p>

                    {/* Preview URL */}
                    {questionnaire?.treatment && (
                        <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-foreground">Preview URL:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="px-2 py-1 bg-background rounded border text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                                    {(() => {
                                        const clinicSlug = questionnaire.treatment?.clinic?.slug || 'limitless'
                                        const slug = questionnaire.treatment?.slug || questionnaire.treatment?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                                        const devUrl = `http://${clinicSlug}.localhost:3000/my-treatments/${slug}`
                                        const prodDisplay = `${clinicSlug}.fuse.health/my-treatments/${slug}`
                                        return process.env.NODE_ENV === 'production' ? prodDisplay : devUrl
                                    })()}
                                </code>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        const clinicSlug = questionnaire.treatment?.clinic?.slug || 'limitless'
                                        const slug = questionnaire.treatment?.slug || questionnaire.treatment?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                                        const devUrl = `http://${clinicSlug}.localhost:3000/my-treatments/${slug}`
                                        const prodDisplay = `${clinicSlug}.fuse.health/my-treatments/${slug}`
                                        const previewHref = process.env.NODE_ENV === 'production' ? `https://${prodDisplay}` : devUrl
                                        window.open(previewHref, '_blank', 'noopener,noreferrer')
                                    }}
                                    aria-label="Open preview in new tab"
                                >
                                    <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 shrink-0 transition-colors ${copiedQuestionnaireId === questionnaire.id ? 'text-green-600' : 'text-muted-foreground'}`}
                                    onClick={() => {
                                        const clinicSlug = questionnaire.treatment?.clinic?.slug || 'limitless'
                                        const slug = questionnaire.treatment?.slug || questionnaire.treatment?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                                        const devUrl = `http://${clinicSlug}.localhost:3000/my-treatments/${slug}`
                                        const prodDisplay = `${clinicSlug}.fuse.health/my-treatments/${slug}`
                                        const previewHref = process.env.NODE_ENV === 'production' ? `https://${prodDisplay}` : devUrl
                                        handleCopyPreview(previewHref, questionnaire.id)
                                    }}
                                    aria-label={copiedQuestionnaireId === questionnaire.id ? 'Preview URL copied' : 'Copy preview URL'}
                                >
                                    {copiedQuestionnaireId === questionnaire.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        onClick={async () => {
                            if (!token || !questionnaire?.id) return
                            if (!confirm('This will rebuild the questionnaire from the master doctor template and remove existing steps. Continue?')) return
                            try {
                                setRebuilding(true)
                                const res = await fetch(`${baseUrl}/questionnaires/reset-doctor-from-master`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ questionnaireId: questionnaire.id })
                                })
                                const data = await res.json().catch(() => ({}))
                                if (!res.ok || data?.success === false) {
                                    throw new Error(data?.message || 'Failed to rebuild from template')
                                }
                                window.location.reload()
                            } catch (e: any) {
                                alert(e?.message || 'Failed to rebuild from template')
                            } finally {
                                setRebuilding(false)
                            }
                        }}
                        disabled={rebuilding}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" /> {rebuilding ? 'Rebuilding...' : 'Rebuild from Template'}
                    </Button>
                    <Button variant="outline" disabled>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                    </Button>
                    <Button disabled>
                        Save Changes
                    </Button>
                </div>
            </div>

            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">Questionnaire Steps</CardTitle>
                    <p className="text-sm text-muted-foreground">{steps.length} total steps</p>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {steps.length === 0 ? (
                            <div className="text-sm text-muted-foreground">No steps available for this questionnaire.</div>
                        ) : (
                            steps
                                .slice()
                                .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
                                .map((step) => {
                                    const { canMoveUp, canMoveDown } = getStepMovementFlags(step.id)
                                    return (
                                        <div key={step.id} className="space-y-3">
                                            <StepEditor
                                                step={step}
                                                token={token}
                                                baseUrl={baseUrl}
                                                onStepSaved={onStepSaved}
                                                onStepReordered={onStepReordered}
                                                canMoveUp={canMoveUp}
                                                canMoveDown={canMoveDown}
                                            />

                                            {step.questions && step.questions.length > 0 && (
                                                <div className="ml-8 space-y-2 border-l-2 border-border/60 pl-4">
                                                    {(() => {
                                                        // Group questions by category and sort by questionOrder
                                                        const sortedQuestions = step.questions
                                                            .slice()
                                                            .sort((a, b) => (a.questionOrder ?? 0) - (b.questionOrder ?? 0))

                                                        // Group by category
                                                        const questionsByCategory: { [key: string]: QuestionnaireQuestionTemplate[] } = {}
                                                        sortedQuestions.forEach(question => {
                                                            const category = step.category || 'normal'
                                                            if (!questionsByCategory[category]) {
                                                                questionsByCategory[category] = []
                                                            }
                                                            questionsByCategory[category].push(question)
                                                        })

                                                        // Render questions grouped by category
                                                        return Object.entries(questionsByCategory).map(([category, questions]) => (
                                                            <div key={category} className="space-y-2">
                                                                {questions.map((question) => (
                                                                    <QuestionEditor
                                                                        key={question.id}
                                                                        question={question}
                                                                        stepCategory={step.category}
                                                                        token={token}
                                                                        baseUrl={baseUrl}
                                                                        onQuestionSaved={onQuestionSaved}
                                                                    />
                                                                ))}
                                                            </div>
                                                        ))
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default QuestionnaireEditor
