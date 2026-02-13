/**
 * Utility functions for handling questionnaire answers in both structured and legacy formats
 */

export interface StructuredAnswer {
    questionId: string;
    stepId: string;
    stepCategory?: string; // Add the step category
    questionText: string;
    answerType: string;
    answer: any;
    selectedOptions?: Array<{
        optionId: string;
        optionText: string;
        optionValue: string;
    }>;
    answeredAt: string;
}

export interface StructuredQuestionnaireAnswers {
    answers: StructuredAnswer[];
    metadata: {
        questionnaireId?: string;
        completedAt: string;
        version: string;
    };
}

export interface LegacyQuestionnaireAnswers {
    [questionText: string]: string;
}

export type QuestionnaireAnswers = StructuredQuestionnaireAnswers | LegacyQuestionnaireAnswers;

/**
 * Determines if the questionnaire answers are in the new structured format
 */
export function isStructuredFormat(answers: any): answers is StructuredQuestionnaireAnswers {
    return answers &&
        typeof answers === 'object' &&
        Array.isArray(answers.answers) &&
        answers.metadata &&
        typeof answers.metadata === 'object';
}

/**
 * Converts structured answers to legacy format for backward compatibility
 */
export function toLegacyFormat(structuredAnswers: StructuredQuestionnaireAnswers): LegacyQuestionnaireAnswers {
    const legacyAnswers: LegacyQuestionnaireAnswers = {};

    structuredAnswers.answers.forEach(answer => {
        if (answer.selectedOptions && answer.selectedOptions.length > 0) {
            // For option-based questions, use the option text
            const optionTexts = answer.selectedOptions.map(option => option.optionText);
            legacyAnswers[answer.questionText] = optionTexts.join(', ');
        } else {
            // For text-based questions, use the answer directly
            legacyAnswers[answer.questionText] = String(answer.answer);
        }
    });

    return legacyAnswers;
}

/**
 * Converts legacy format to structured format
 */
export function toStructuredFormat(legacyAnswers: LegacyQuestionnaireAnswers): StructuredQuestionnaireAnswers {
    const answers: StructuredAnswer[] = [];

    Object.entries(legacyAnswers).forEach(([questionText, answer]) => {
        answers.push({
            questionId: `legacy-${questionText.replace(/\s+/g, '-').toLowerCase()}`,
            stepId: 'legacy-step',
            stepCategory: 'legacy', // Add legacy category for converted answers
            questionText,
            answerType: 'text',
            answer,
            answeredAt: new Date().toISOString()
        });
    });

    return {
        answers,
        metadata: {
            completedAt: new Date().toISOString(),
            version: "1.0"
        }
    };
}

/**
 * Gets the legacy format from either structured or legacy format
 */
export function getLegacyFormat(answers: QuestionnaireAnswers): LegacyQuestionnaireAnswers {
    if (isStructuredFormat(answers)) {
        return toLegacyFormat(answers);
    }
    return answers as LegacyQuestionnaireAnswers;
}

/**
 * Gets the structured format from either structured or legacy format
 */
export function getStructuredFormat(answers: QuestionnaireAnswers): StructuredQuestionnaireAnswers {
    if (isStructuredFormat(answers)) {
        return answers;
    }
    return toStructuredFormat(answers as LegacyQuestionnaireAnswers);
}

/**
 * Extracts case questions for MD Integration from either format (basic)
 */
export function extractCaseQuestions(answers: QuestionnaireAnswers): Array<{
    question: string;
    answer: string;
    type: string;
}> {
    const legacyAnswers = getLegacyFormat(answers);

    return Object.entries(legacyAnswers).map(([question, answer]) => ({
        question: String(question),
        answer: String(answer),
        type: 'string'
    }));
}

/**
 * Maps a FUSE answerType to the MDI question type.
 * MDI supports: boolean, number, string
 */
function mapAnswerTypeToMDI(answerType: string, answer: any): string {
    switch (answerType) {
        case 'checkbox':
            // Checkbox answers are typically boolean-like (yes/no, true/false)
            return 'boolean';
        case 'radio':
        case 'select':
            // Radio/select answers could be string or boolean depending on the options
            if (typeof answer === 'boolean' || answer === 'true' || answer === 'false' || answer === 'yes' || answer === 'no') {
                return 'boolean';
            }
            return 'string';
        case 'number':
        case 'height':
        case 'weight':
            return 'number';
        default:
            return 'string';
    }
}

/**
 * Formats the answer value for MDI.
 * Booleans should be "true"/"false", numbers as strings, etc.
 */
function formatAnswerForMDI(answer: any, selectedOptions?: StructuredAnswer['selectedOptions']): string {
    if (selectedOptions && selectedOptions.length > 0) {
        return selectedOptions.map(opt => opt.optionText).join(', ');
    }
    if (typeof answer === 'boolean') {
        return String(answer);
    }
    if (answer === null || answer === undefined) {
        return '';
    }
    return String(answer);
}

/**
 * Extracts rich case questions for MD Integrations from structured format.
 * Produces the full MDI question payload including important, is_critical,
 * display_in_pdf, description, label, displayed_options, etc.
 */
export function extractRichCaseQuestions(answers: QuestionnaireAnswers): Array<{
    question: string;
    answer: string;
    type: string;
    important: boolean;
    is_critical: boolean;
    display_in_pdf: boolean;
    description?: string;
    label?: string;
    metadata?: string;
    displayed_options?: string[];
}> {
    if (isStructuredFormat(answers)) {
        return answers.answers.map((sa) => {
            const mdiType = mapAnswerTypeToMDI(sa.answerType, sa.answer);
            const formattedAnswer = formatAnswerForMDI(sa.answer, sa.selectedOptions);

            // Build displayed_options from selectedOptions or from a radio/select/checkbox answer
            let displayedOptions: string[] | undefined;
            if (sa.selectedOptions && sa.selectedOptions.length > 0) {
                displayedOptions = sa.selectedOptions.map(opt => opt.optionText);
            }

            return {
                question: sa.questionText,
                answer: formattedAnswer,
                type: mdiType,
                important: true,
                is_critical: false,
                display_in_pdf: true,
                description: sa.stepCategory || undefined,
                label: sa.questionText.substring(0, 50),
                metadata: sa.questionId ? `questionId:${sa.questionId}|stepId:${sa.stepId}` : undefined,
                displayed_options: displayedOptions,
            };
        });
    }

    // Fallback for legacy format - use basic extraction
    const legacyAnswers = getLegacyFormat(answers);
    return Object.entries(legacyAnswers).map(([question, answer]) => ({
        question: String(question),
        answer: String(answer),
        type: 'string',
        important: true,
        is_critical: false,
        display_in_pdf: true,
    }));
}
