import { ChangeEvent, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit, Save, X, Loader2, Code2, ChevronDown, ChevronUp } from "lucide-react"

interface QuestionnaireOptionTemplate {
    id: string
    optionText: string
    optionValue?: string | null
    optionOrder: number
    riskLevel?: 'safe' | 'review' | 'reject' | null
}

interface QuestionnaireQuestionTemplate {
    id: string
    stepId: string
    questionText: string
    answerType: string
    questionSubtype?: string | null
    questionOrder: number
    isRequired?: boolean
    helpText?: string | null
    placeholder?: string | null
    options?: QuestionnaireOptionTemplate[]
}

type EditableOption = {
    id?: string
    optionText: string
    optionValue: string
    optionOrder: number
    riskLevel?: 'safe' | 'review' | 'reject' | null
    localKey: string
}

interface QuestionEditorProps {
    question: QuestionnaireQuestionTemplate
    stepCategory?: 'normal' | 'user_profile' | 'doctor'
    token: string | null
    baseUrl: string
    onQuestionSaved: (question: QuestionnaireQuestionTemplate) => void
    restrictStructuralEdits?: boolean
    autoEdit?: boolean
}

export function QuestionEditor({
    question,
    stepCategory,
    token,
    baseUrl,
    onQuestionSaved,
    restrictStructuralEdits = false,
    autoEdit = false
}: QuestionEditorProps) {
    const editable = Boolean(token)
    const [isEditing, setIsEditing] = useState(autoEdit)
    const [questionText, setQuestionText] = useState(question.questionText)
    const [answerType, setAnswerType] = useState<string>(question.answerType || 'radio')
    const [helpText, setHelpText] = useState(question.helpText || '')
    const [placeholder, setPlaceholder] = useState(question.placeholder || '')
    const [options, setOptions] = useState<EditableOption[]>(() =>
        (question.options ?? []).map((option, index) => ({
            id: option.id,
            optionText: option.optionText ?? '',
            optionValue: option.optionValue ?? option.optionText ?? '',
            optionOrder: option.optionOrder ?? index + 1,
            riskLevel: option.riskLevel ?? null,
            localKey: option.id ?? `existing-${index}`,
        }))
    )
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showVariables, setShowVariables] = useState(false)
    const [copiedVariable, setCopiedVariable] = useState<string | null>(null)

    // Computed values that update with state
    const isYesNoType = question.questionSubtype === 'yesno'
    const isBMIType = question.questionSubtype === 'bmi'
    const isTextArea = answerType === 'textarea' || question.answerType === 'textarea'
    const isNumberInput = answerType === 'number' || question.answerType === 'number'
    // Restrict editing text/value for Yes/No and BMI, but allow risk level changes
    const restrictOptionEdits = restrictStructuralEdits || isYesNoType || isBMIType
    // Allow risk level editing even for Yes/No questions
    const allowRiskLevelEdits = true

    useEffect(() => {
        if (autoEdit) {
            setIsEditing(true)
        }
    }, [autoEdit])

    useEffect(() => {
        if (!isEditing) {
            setQuestionText(question.questionText)
            setAnswerType(question.answerType || 'radio')
            setHelpText(question.helpText || '')
            setPlaceholder(question.placeholder || '')
            setOptions(
                (question.options ?? []).map((option, index) => ({
                    id: option.id,
                    optionText: option.optionText ?? '',
                    optionValue: option.optionValue ?? option.optionText ?? '',
                    optionOrder: option.optionOrder ?? index + 1,
                    riskLevel: option.riskLevel ?? null,
                    localKey: option.id ?? `existing-${index}`,
                }))
            )
        }
    }, [question, isEditing])

    const handleOptionTextChange = (localKey: string, value: string) => {
        setOptions((prev) =>
            prev.map((option) =>
                option.localKey === localKey
                    ? { ...option, optionText: value }
                    : option
            )
        )
    }

    const handleOptionValueChange = (localKey: string, value: string) => {
        setOptions((prev) =>
            prev.map((option) =>
                option.localKey === localKey
                    ? { ...option, optionValue: value }
                    : option
            )
        )
    }

    const handleRiskLevelChange = (localKey: string, riskLevel: 'safe' | 'review' | 'reject' | null) => {
        setOptions((prev) =>
            prev.map((option) =>
                option.localKey === localKey
                    ? { ...option, riskLevel }
                    : option
            )
        )
    }

    const handleAddOption = () => {
        if (restrictOptionEdits) return
        setOptions((prev) => (
            [...prev, {
                id: undefined,
                optionText: '',
                optionValue: '',
                optionOrder: prev.length + 1,
                riskLevel: null,
                localKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            }]
        ))
    }

    const handleRemoveOption = (localKey: string) => {
        if (restrictOptionEdits) return
        setOptions((prev) =>
            prev
                .filter((option) => option.localKey !== localKey)
                .map((option, index) => ({ ...option, optionOrder: index + 1 }))
        )
    }

    const resetEditingState = () => {
        setIsEditing(false)
        setError(null)
        setQuestionText(question.questionText)
        setHelpText(question.helpText || '')
        setPlaceholder(question.placeholder || '')
        setOptions(
            (question.options ?? []).map((option, index) => ({
                id: option.id,
                optionText: option.optionText ?? '',
                optionValue: option.optionValue ?? option.optionText ?? '',
                optionOrder: option.optionOrder ?? index + 1,
                localKey: option.id ?? `existing-${index}`,
            }))
        )
    }

    const handleCopyVariable = async (variable: string) => {
        try {
            await navigator.clipboard.writeText(variable)
            setCopiedVariable(variable)
            setTimeout(() => setCopiedVariable(null), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    // Dynamic Variables Dropdown Component
    const DynamicVariablesDropdown = () => (
        <div className="relative">
            <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="flex items-center gap-2 h-7 text-xs"
            >
                <Code2 className="h-3 w-3" />
                Variables
                {showVariables ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>

            {showVariables && (
                <>
                    {/* Backdrop to close dropdown when clicking outside */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowVariables(false)}
                    />

                    <div className="absolute right-0 z-20 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2">
                        <div className="text-xs font-semibold text-gray-500 mb-2 px-2">
                            Click to copy variable
                        </div>

                        {/* Product Name */}
                        <button
                            type="button"
                            onClick={() => {
                                handleCopyVariable('{{productName}}')
                                setShowVariables(false)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm flex items-center justify-between group transition-colors"
                        >
                            <div className="flex-1">
                                <div className="font-mono font-medium text-sm">{'{{productName}}'}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Product name (e.g., NAD+)</div>
                            </div>
                            {copiedVariable === '{{productName}}' && (
                                <span className="text-green-600 text-xs font-medium">Copied!</span>
                            )}
                        </button>

                        {/* Placeholder Sig */}
                        <button
                            type="button"
                            onClick={() => {
                                handleCopyVariable('{{placeholderSig}}')
                                setShowVariables(false)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm flex items-center justify-between group transition-colors"
                        >
                            <div className="flex-1">
                                <div className="font-mono font-medium text-sm">{'{{placeholderSig}}'}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Product Placeholder Sig (e.g., 50mg)</div>
                            </div>
                            {copiedVariable === '{{placeholderSig}}' && (
                                <span className="text-green-600 text-xs font-medium">Copied!</span>
                            )}
                        </button>

                        {/* Active Ingredients */}
                        <button
                            type="button"
                            onClick={() => {
                                handleCopyVariable('{{activeIngredients}}')
                                setShowVariables(false)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm flex items-center justify-between group transition-colors"
                        >
                            <div className="flex-1">
                                <div className="font-mono font-medium text-sm">{'{{activeIngredients}}'}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Active ingredients list</div>
                            </div>
                            {copiedVariable === '{{activeIngredients}}' && (
                                <span className="text-green-600 text-xs font-medium">Copied!</span>
                            )}
                        </button>

                        <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

                        {/* Company Name */}
                        <button
                            type="button"
                            onClick={() => {
                                handleCopyVariable('{{companyName}}')
                                setShowVariables(false)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm flex items-center justify-between group transition-colors"
                        >
                            <div className="flex-1">
                                <div className="font-mono font-medium text-sm">{'{{companyName}}'}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Tenant's company name</div>
                            </div>
                            {copiedVariable === '{{companyName}}' && (
                                <span className="text-green-600 text-xs font-medium">Copied!</span>
                            )}
                        </button>

                        {/* Clinic Name */}
                        <button
                            type="button"
                            onClick={() => {
                                handleCopyVariable('{{clinicName}}')
                                setShowVariables(false)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm flex items-center justify-between group transition-colors"
                        >
                            <div className="flex-1">
                                <div className="font-mono font-medium text-sm">{'{{clinicName}}'}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Tenant's clinic name</div>
                            </div>
                            {copiedVariable === '{{clinicName}}' && (
                                <span className="text-green-600 text-xs font-medium">Copied!</span>
                            )}
                        </button>

                        {/* Patient Name */}
                        <button
                            type="button"
                            onClick={() => {
                                handleCopyVariable('{{patientName}}')
                                setShowVariables(false)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm flex items-center justify-between group transition-colors"
                        >
                            <div className="flex-1">
                                <div className="font-mono font-medium text-sm">{'{{patientName}}'}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Patient's first name</div>
                            </div>
                            {copiedVariable === '{{patientName}}' && (
                                <span className="text-green-600 text-xs font-medium">Copied!</span>
                            )}
                        </button>

                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-[10px] text-gray-500 px-2 leading-relaxed">
                                Variables are replaced automatically when patients view the form.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )

    const handleSave = async () => {
        if (!token) return

        const trimmedQuestionText = questionText.trim()
        if (!trimmedQuestionText) {
            setError('Question text is required')
            return
        }

        // Only process options for non-textarea questions
        const cleanedOptions = isTextArea ? [] : options
            .map((option, index) => {
                const trimmedText = (option.optionText || '').trim()
                const trimmedValue = (option.optionValue || '').trim()

                return {
                    id: option.id,
                    optionText: trimmedText,
                    optionValue: trimmedValue.length > 0 ? trimmedValue : trimmedText,
                    optionOrder: index + 1,
                    riskLevel: option.riskLevel || null,
                }
            })
            .filter((option) => option.optionText.length > 0)

        setIsSaving(true)
        setError(null)

        try {
            const payload: any = {
                questionText: trimmedQuestionText,
                answerType: answerType || 'radio',
                helpText: helpText.trim() || null,
            }

            // Only include options for non-textarea questions
            if (!isTextArea) {
                payload.options = cleanedOptions
            }

            // Only include placeholder for textarea questions
            if (isTextArea) {
                payload.placeholder = placeholder.trim() || null
            }

            const response = await fetch(`${baseUrl}/questions/${question.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || 'Failed to save question')
            }

            const data = await response.json()
            if (data?.data) {
                onQuestionSaved(data.data)
                setQuestionText(data.data.questionText ?? trimmedQuestionText)
                setAnswerType(data.data.answerType || answerType || 'radio')
                setHelpText(data.data.helpText || '')
                setOptions(
                    (data.data.options ?? cleanedOptions).map((option: any, index: number) => ({
                        id: option.id,
                        optionText: option.optionText ?? '',
                        optionValue: option.optionValue ?? option.optionText ?? '',
                        optionOrder: option.optionOrder ?? index + 1,
                        riskLevel: option.riskLevel ?? null,
                        localKey: option.id ?? `existing-${index}`,
                    }))
                )
                setIsEditing(false)
            }
        } catch (err: any) {
            console.error('❌ Error saving question:', err)
            setError(err.message || 'Unable to save question')
        } finally {
            setIsSaving(false)
        }
    }

    // Get question type label for display
    const getQuestionTypeLabel = () => {
        if (question.questionSubtype === 'yesno') return 'Yes/No Question'
        if (question.questionSubtype === 'bmi') return 'BMI Calculator Question'
        if (answerType === 'textarea' || question.answerType === 'textarea') return 'Multi-Line Text'
        if (answerType === 'checkbox') return 'Multi-Choice Question'
        if (answerType === 'radio') return 'Single-Choice Question'
        if (answerType === 'text') return 'Short Text'
        if (answerType === 'number') return 'Number Input'
        if (answerType === 'select') return 'Select Dropdown'
        return 'Question'
    }

    return (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-4">
            {/* Header with Save Button */}
            {editable && isEditing && (
                <div className="flex items-center justify-between pb-3 border-b">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold text-foreground">Edit Question</h3>
                        <span className="text-xs text-muted-foreground font-medium">{getQuestionTypeLabel()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Save
                        </Button>
                        {!autoEdit && (
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={resetEditingState}
                                disabled={isSaving}
                            >
                                <X className="mr-1.5 h-3.5 w-3.5" />
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Question Text */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-foreground">
                        Question Text {isEditing && <span className="text-destructive">*</span>}
                    </label>
                    {isEditing && <DynamicVariablesDropdown />}
                </div>
                {isEditing ? (
                    <Input
                        value={questionText}
                        onChange={(event) => setQuestionText(event.target.value)}
                        placeholder="Enter your question here..."
                        className="text-sm h-9"
                    />
                ) : (
                    <p className="text-sm font-medium text-foreground">{question.questionText}</p>
                )}
            </div>

            {/* Help Text */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-muted-foreground">
                        Help Text <span className="text-xs">(optional)</span>
                    </label>
                    {isEditing && <DynamicVariablesDropdown />}
                </div>
                {isEditing ? (
                    <textarea
                        value={helpText}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setHelpText(e.target.value)}
                        placeholder="Add context or instructions..."
                        className="w-full px-2.5 py-2 text-xs border border-input bg-background rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent"
                        rows={2}
                    />
                ) : (
                    question.helpText ? (
                        <p className="text-xs text-muted-foreground">{question.helpText}</p>
                    ) : (
                        <p className="text-xs text-muted-foreground italic">No help text</p>
                    )
                )}
            </div>

            {/* Placeholder (for textarea and number types) */}
            {(isTextArea || isNumberInput) && (
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">
                        Placeholder <span className="text-xs">(optional)</span>
                    </label>
                    {isEditing ? (
                        <Input
                            value={placeholder}
                            onChange={(e) => setPlaceholder(e.target.value)}
                            placeholder={isNumberInput ? "e.g., 200" : "e.g., Enter your response..."}
                            className="text-xs h-8"
                        />
                    ) : (
                        question.placeholder ? (
                            <p className="text-xs text-muted-foreground">{question.placeholder}</p>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">No placeholder</p>
                        )
                    )}
                </div>
            )}

            {/* Textarea Preview (for textarea types) */}
            {isTextArea && (
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                        Patient View Preview
                    </label>
                    <div className="relative">
                        <textarea
                            disabled
                            placeholder={placeholder || "Type your detailed response here..."}
                            className="w-full px-3 py-2.5 text-sm border-2 border-border rounded-lg bg-muted/30 text-muted-foreground resize-none cursor-not-allowed"
                            rows={6}
                        />
                        <div className="absolute top-2 right-2">
                            <span className="text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border/50">
                                Preview
                            </span>
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                        This is what patients will see. Placeholder text disappears when they start typing.
                    </p>
                </div>
            )}

            {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                </div>
            )}

            {/* Options - Read Only (Hide for textarea) */}
            {!isTextArea && question.options && question.options.length > 0 && !isEditing && (
                <div className="space-y-2">
                    <label className="block text-xs font-semibold text-foreground">
                        Options
                        {isYesNoType && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">(Yes/No)</span>
                        )}
                    </label>
                    <div className="space-y-1.5">
                        {question.options
                            ?.slice()
                            .sort((a, b) => (a.optionOrder ?? 0) - (b.optionOrder ?? 0))
                            .map((option) => (
                                <div key={option.id ?? option.optionOrder} className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border border-border/40">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary flex-shrink-0">
                                        {option.optionOrder ?? 0}
                                    </span>
                                    <span className="text-xs font-medium text-foreground">{option.optionText}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Options - Editing (Hide for textarea) */}
            {!isTextArea && isEditing && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-foreground">
                            Options
                            {isYesNoType && (
                                <span className="ml-1 text-[10px] font-normal text-muted-foreground">(Fixed)</span>
                            )}
                        </label>
                        {!restrictOptionEdits && (
                            <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="h-7 text-xs">
                                + Add
                            </Button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {options.map((option) => (
                            <div key={option.localKey} className="rounded-md border border-border p-2.5 bg-muted/20">
                                <div className="flex items-start gap-2">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary mt-1 flex-shrink-0">
                                        {option.optionOrder}
                                    </span>
                                    <div className="flex-1 space-y-2">
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-medium text-muted-foreground">
                                                Text
                                            </label>
                                            <Input
                                                value={option.optionText}
                                                onChange={(event: ChangeEvent<HTMLInputElement>) => handleOptionTextChange(option.localKey, event.target.value)}
                                                placeholder="e.g., Yes"
                                                className="text-xs h-8"
                                                disabled={restrictOptionEdits}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-medium text-muted-foreground">
                                                Value <span className="opacity-70" title="Used to identify this option in conditional logic rules">(Used in conditional rules)</span>
                                            </label>
                                            <Input
                                                value={option.optionValue}
                                                onChange={(event: ChangeEvent<HTMLInputElement>) => handleOptionValueChange(option.localKey, event.target.value)}
                                                placeholder="e.g., yes"
                                                className="text-xs h-8"
                                                disabled={restrictOptionEdits}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-medium text-muted-foreground">
                                                Risk Level <span className="opacity-70" title="Determines how this answer is handled: Safe = auto-approved, Review = needs doctor review, Reject = automatically rejected">(Controls how this answer is processed: Safe = auto-approved, Review = needs doctor review, Reject = auto-rejected)</span>
                                            </label>
                                            <div className="flex gap-1">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={option.riskLevel === 'safe' ? 'default' : 'outline'}
                                                    onClick={() => handleRiskLevelChange(option.localKey, option.riskLevel === 'safe' ? null : 'safe')}
                                                    className={`flex-1 h-7 text-[10px] ${option.riskLevel === 'safe' ? 'bg-green-500 hover:bg-green-600 text-white' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
                                                    disabled={!allowRiskLevelEdits}
                                                >
                                                    ✓ Safe
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={option.riskLevel === 'review' ? 'default' : 'outline'}
                                                    onClick={() => handleRiskLevelChange(option.localKey, option.riskLevel === 'review' ? null : 'review')}
                                                    className={`flex-1 h-7 text-[10px] ${option.riskLevel === 'review' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'}`}
                                                    disabled={!allowRiskLevelEdits}
                                                >
                                                    ⚠ Review
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={option.riskLevel === 'reject' ? 'default' : 'outline'}
                                                    onClick={() => handleRiskLevelChange(option.localKey, option.riskLevel === 'reject' ? null : 'reject')}
                                                    className={`flex-1 h-7 text-[10px] ${option.riskLevel === 'reject' ? 'bg-red-500 hover:bg-red-600 text-white' : 'border-red-300 text-red-700 hover:bg-red-50'}`}
                                                    disabled={!allowRiskLevelEdits}
                                                >
                                                    ✕ Reject
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {options.length > 1 && !restrictOptionEdits && (
                                    <div className="flex justify-end pt-1.5 mt-1.5 border-t">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleRemoveOption(option.localKey)}
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 text-[10px] px-2"
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default QuestionEditor
