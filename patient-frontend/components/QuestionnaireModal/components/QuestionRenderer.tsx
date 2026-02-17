import React from "react";
import { Icon } from "@iconify/react";
import { Question, ThemePalette } from "../types";
import { USStateAutocomplete, US_STATES } from "./USStateAutocomplete";

interface QuestionRendererProps {
    question: Question;
    answers: Record<string, any>;
    errors: Record<string, string>;
    theme: ThemePalette;
    stepRequired?: boolean;
    onAnswerChange: (questionId: string, value: any) => void;
    onRadioChange: (questionId: string, value: any) => void;
    onCheckboxChange: (questionId: string, optionValue: string, isChecked: boolean) => void;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
    question,
    answers,
    errors,
    theme,
    stepRequired = true,
    onAnswerChange,
    onRadioChange,
    onCheckboxChange,
}) => {
    // If step is not required, treat question as not required regardless of question.isRequired
    const isQuestionRequired = stepRequired !== false && question.isRequired;
    const value = answers[question.id] || "";
    const isEmpty = (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
    );
    const hasError = !!errors[question.id] && isEmpty;

    switch (question.answerType) {
        case "text":
        case "email":
        case "phone":
            const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const newValue = e.target.value;
                // For phone fields, limit to 10 digits (numbers only)
                if (question.answerType === "phone") {
                    const numericValue = newValue.replace(/\D/g, ''); // Remove non-numeric characters
                    if (numericValue.length <= 10) {
                        onAnswerChange(question.id, numericValue);
                    }
                } else {
                    onAnswerChange(question.id, newValue);
                }
            };

            return (
                <div key={question.id} className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: "var(--q-primary-text)" }}>
                        {question.questionText}
                        {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                    </label>
                    <input
                        type={question.answerType === "email" ? "email" : question.answerType === "phone" ? "tel" : "text"}
                        placeholder={question.placeholder}
                        value={value}
                        onChange={handlePhoneChange}
                        maxLength={question.answerType === "phone" ? 10 : undefined}
                        className={`w-full p-4 rounded-2xl border-2 transition-all ${hasError ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}
                        style={hasError ? undefined : {
                            borderColor: theme.primaryLight,
                            color: "#111827"
                        }}
                        onFocus={(e) => {
                            if (!hasError) {
                                e.currentTarget.style.borderColor = theme.primary;
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.primaryLight}`;
                                e.currentTarget.style.backgroundColor = theme.primaryLighter;
                            }
                        }}
                        onBlur={(e) => {
                            if (!hasError) {
                                e.currentTarget.style.borderColor = theme.primaryLight;
                                e.currentTarget.style.boxShadow = "none";
                                e.currentTarget.style.backgroundColor = "#FFFFFF";
                            }
                        }}
                    />
                    {question.helpText && (
                        <p className="text-sm text-gray-600">{question.helpText}</p>
                    )}
                    {hasError && (
                        <p className="text-sm text-red-600">{errors[question.id]}</p>
                    )}
                </div>
            );

        case "number": {
            const hasSubtype = (question as any).questionSubtype;
            return (
                <div key={question.id} className="space-y-4">
                    <div>
                        <h3 className="text-2xl font-medium text-gray-900 mb-3">
                            {question.questionText}
                            {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                        </h3>
                        {question.helpText && (
                            <p className="text-gray-600">{question.helpText}</p>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            type="number"
                            placeholder={question.placeholder}
                            value={value}
                            onChange={(e) => onAnswerChange(question.id, e.target.value)}
                            className={`w-full p-4 rounded-2xl border-2 transition-all ${hasError
                                ? "border-red-300 bg-red-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                                } outline-none ${hasSubtype ? "pr-16" : ""}`}
                            style={hasError ? undefined : {
                                borderColor: theme.primaryLight,
                                color: "#111827"
                            }}
                            onFocus={(e) => {
                                if (!hasError) {
                                    e.currentTarget.style.borderColor = theme.primary;
                                    e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.primaryLight}`;
                                    e.currentTarget.style.backgroundColor = theme.primaryLighter;
                                }
                            }}
                            onBlur={(e) => {
                                if (!hasError) {
                                    e.currentTarget.style.borderColor = theme.primaryLight;
                                    e.currentTarget.style.boxShadow = "none";
                                    e.currentTarget.style.backgroundColor = "#FFFFFF";
                                }
                            }}
                            onWheel={(e) => hasSubtype && e.currentTarget.blur()}
                        />
                        {hasSubtype && (
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">
                                {(question as any).questionSubtype}
                            </div>
                        )}
                    </div>
                    {(question as any).footerNote && (
                        <div className="bg-gray-100 mt-8 rounded-xl p-4">
                            <p
                                className="text-gray-600 text-sm"
                                dangerouslySetInnerHTML={{ __html: (question as any).footerNote }}
                            />
                        </div>
                    )}
                    {hasError && (
                        <p className="text-sm text-red-600">{errors[question.id]}</p>
                    )}
                </div>
            );
        }

        case "date": {
            // Check if this is a Date of Birth question
            const isDobQuestion = (question.questionText || '').toLowerCase().includes('date of birth');
            
            // If it's a DOB question, use dropdown pickers
            if (isDobQuestion) {
                // Parse current value to get year, month, day
                const parseDateValue = (val: string) => {
                    if (!val) return { year: '', month: '', day: '' };
                    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
                    if (match) {
                        return { year: match[1], month: match[2], day: match[3] };
                    }
                    return { year: '', month: '', day: '' };
                };

                const currentDate = parseDateValue(value);
                const [year, setYear] = React.useState(currentDate.year);
                const [month, setMonth] = React.useState(currentDate.month);
                const [day, setDay] = React.useState(currentDate.day);

                // Update local state when external value changes
                React.useEffect(() => {
                    const parsed = parseDateValue(value);
                    setYear(parsed.year);
                    setMonth(parsed.month);
                    setDay(parsed.day);
                }, [value]);

                // Generate options
                const currentYear = new Date().getFullYear();
                const years = Array.from({ length: 103 }, (_, i) => currentYear - 18 - i);
                const months = [
                    { value: '01', label: 'January' },
                    { value: '02', label: 'February' },
                    { value: '03', label: 'March' },
                    { value: '04', label: 'April' },
                    { value: '05', label: 'May' },
                    { value: '06', label: 'June' },
                    { value: '07', label: 'July' },
                    { value: '08', label: 'August' },
                    { value: '09', label: 'September' },
                    { value: '10', label: 'October' },
                    { value: '11', label: 'November' },
                    { value: '12', label: 'December' },
                ];

                // Get days in selected month
                const getDaysInMonth = (y: string, m: string) => {
                    if (!y || !m) return 31;
                    const yearNum = parseInt(y);
                    const monthNum = parseInt(m);
                    return new Date(yearNum, monthNum, 0).getDate();
                };

                const daysInMonth = getDaysInMonth(year, month);
                const days = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString().padStart(2, '0'));

                const handleDateChange = (newYear: string, newMonth: string, newDay: string) => {
                    setYear(newYear);
                    setMonth(newMonth);
                    setDay(newDay);

                    // Construct YYYY-MM-DD format
                    if (newYear && newMonth && newDay) {
                        const formattedDate = `${newYear}-${newMonth}-${newDay}`;
                        
                        // Validate date
                        const yearNum = parseInt(newYear);
                        const monthNum = parseInt(newMonth);
                        const dayNum = parseInt(newDay);
                        
                        const isValid = (() => {
                            if (yearNum < 1900) return false;
                            if (monthNum < 1 || monthNum > 12) return false;
                            if (dayNum < 1 || dayNum > 31) return false;
                            const dob = new Date(formattedDate + 'T00:00:00Z');
                            if (isNaN(dob.getTime())) return false;
                            const now = new Date();
                            const ageYears = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
                            return ageYears >= 18 && ageYears <= 120;
                        })();

                        onAnswerChange(question.id, formattedDate);

                        if (!isValid) {
                            errors[question.id] = 'Enter a valid date, age 18-120.';
                        } else if (errors[question.id]) {
                            delete errors[question.id];
                        }
                    } else {
                        onAnswerChange(question.id, '');
                    }
                };

                return (
                    <div key={question.id} className="space-y-3">
                        <label className="block text-sm font-medium" style={{ color: "var(--q-primary-text)" }}>
                            {question.questionText}
                            {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {/* Month */}
                            <div>
                                <select
                                    value={month}
                                    onChange={(e) => {
                                        const newMonth = e.target.value;
                                        // Validate day doesn't exceed days in new month
                                        let newDay = day;
                                        if (newDay && year) {
                                            const maxDays = getDaysInMonth(year, newMonth);
                                            const currentDay = parseInt(newDay);
                                            if (currentDay > maxDays) {
                                                newDay = maxDays.toString().padStart(2, '0');
                                            }
                                        }
                                        handleDateChange(year, newMonth, newDay);
                                    }}
                                    className={`w-full p-4 rounded-2xl border-2 transition-all outline-none cursor-pointer ${
                                        hasError
                                            ? "border-red-300 bg-red-50"
                                            : "border-gray-200 bg-white hover:border-gray-300"
                                    }`}
                                    style={!hasError ? { borderColor: theme.primaryLight } : undefined}
                                >
                                    <option value="">Month</option>
                                    {months.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Day */}
                            <div>
                                <select
                                    value={day}
                                    onChange={(e) => handleDateChange(year, month, e.target.value)}
                                    className={`w-full p-4 rounded-2xl border-2 transition-all outline-none cursor-pointer ${
                                        hasError
                                            ? "border-red-300 bg-red-50"
                                            : "border-gray-200 bg-white hover:border-gray-300"
                                    }`}
                                    style={!hasError ? { borderColor: theme.primaryLight } : undefined}
                                >
                                    <option value="">Day</option>
                                    {days.map((d) => (
                                        <option key={d} value={d}>
                                            {parseInt(d)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Year */}
                            <div>
                                <select
                                    value={year}
                                    onChange={(e) => {
                                        const newYear = e.target.value;
                                        // Validate day doesn't exceed days in month for new year
                                        let newDay = day;
                                        if (newDay && month) {
                                            const maxDays = getDaysInMonth(newYear, month);
                                            const currentDay = parseInt(newDay);
                                            if (currentDay > maxDays) {
                                                newDay = maxDays.toString().padStart(2, '0');
                                            }
                                        }
                                        handleDateChange(newYear, month, newDay);
                                    }}
                                    className={`w-full p-4 rounded-2xl border-2 transition-all outline-none cursor-pointer ${
                                        hasError
                                            ? "border-red-300 bg-red-50"
                                            : "border-gray-200 bg-white hover:border-gray-300"
                                    }`}
                                    style={!hasError ? { borderColor: theme.primaryLight } : undefined}
                                >
                                    <option value="">Year</option>
                                    {years.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        {question.helpText && (
                            <p className="text-sm text-gray-600">{question.helpText}</p>
                        )}
                        {hasError && (
                            <p className="text-sm text-red-600">{errors[question.id]}</p>
                        )}
                    </div>
                );
            }

            // For non-DOB date questions, keep the original date picker
            const onChange = (v: string) => {
                onAnswerChange(question.id, v);
            };

            return (
                <div key={question.id} className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: "var(--q-primary-text)" }}>
                        {question.questionText}
                        {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                    </label>
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all ${hasError
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-white hover:border-gray-300 focus:border-primary focus:bg-primary-light"
                            } outline-none`}
                    />
                    {question.helpText && (
                        <p className="text-sm text-gray-600">{question.helpText}</p>
                    )}
                    {hasError && (
                        <p className="text-sm text-red-600">{errors[question.id]}</p>
                    )}
                </div>
            );
        }

        case "textarea": {
            // Detect if this is a dead end or info message (not actual input)
            const questionText = question.questionText?.toLowerCase() || ''
            const placeholder = question.placeholder?.toLowerCase() || ''

            const isDeadEnd = questionText.includes('unfortunat') || questionText.includes('disqualif') ||
                questionText.includes('do not qualify') || questionText.includes('cannot be medically')

            const isInfoOnly = !isQuestionRequired && (
                placeholder?.includes('informational') ||
                placeholder?.includes('no response needed')
            )

            // If it's dead end or info, show as read-only message (no textarea)
            if (isDeadEnd || isInfoOnly) {
                return (
                    <div key={question.id} className="space-y-4">
                        <div className={`p-6 rounded-2xl ${isDeadEnd ? 'bg-red-50 border-2 border-red-200' : 'bg-blue-50 border-2 border-blue-200'}`}>
                            <h3 className={`text-xl font-semibold mb-3 ${isDeadEnd ? 'text-red-900' : 'text-blue-900'}`}>
                                {question.questionText}
                            </h3>
                            {question.helpText && (
                                <p className={`text-base ${isDeadEnd ? 'text-red-700' : 'text-blue-700'}`}>
                                    {question.helpText}
                                </p>
                            )}
                        </div>
                    </div>
                )
            }

            // Otherwise show normal textarea input
            return (
                <div key={question.id} className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: "var(--q-primary-text)" }}>
                        {question.questionText}
                        {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                    </label>
                    <textarea
                        placeholder={question.placeholder || "Type your detailed response here..."}
                        value={value}
                        onChange={(e) => onAnswerChange(question.id, e.target.value)}
                        rows={8}
                        className={`w-full p-4 rounded-2xl border-2 transition-all resize-y min-h-[150px] ${hasError
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                            } outline-none`}
                        style={hasError ? undefined : {
                            borderColor: theme.primaryLight,
                            color: "#111827"
                        }}
                        onFocus={(e) => {
                            if (!hasError) {
                                e.currentTarget.style.borderColor = theme.primary;
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.primaryLight}`;
                                e.currentTarget.style.backgroundColor = theme.primaryLighter;
                            }
                        }}
                        onBlur={(e) => {
                            if (!hasError) {
                                e.currentTarget.style.borderColor = theme.primaryLight;
                                e.currentTarget.style.boxShadow = "none";
                                e.currentTarget.style.backgroundColor = "#FFFFFF";
                            }
                        }}
                    />
                    {question.helpText && (
                        <p className="text-sm text-gray-600">{question.helpText}</p>
                    )}
                    {hasError && (
                        <p className="text-sm text-red-600">{errors[question.id]}</p>
                    )}
                </div>
            );
        }

        case "radio": {
            // Detect if this is a US State selection question
            const questionTextLower = (question.questionText || '').toLowerCase();
            const isStateQuestion = (
                (questionTextLower.includes('state') && (
                    questionTextLower.includes('live') ||
                    questionTextLower.includes('reside') ||
                    questionTextLower.includes('located') ||
                    questionTextLower.includes('where') ||
                    questionTextLower.includes('which')
                )) ||
                questionTextLower.includes('state do you') ||
                questionTextLower.includes('your state')
            );

            // Check if options match US states (verify by checking if at least 40+ state codes exist in options)
            const hasStateOptions = question.options && question.options.length >= 40 && 
                US_STATES.some(state => 
                    question.options?.some(opt => 
                        opt.optionValue === state.value || opt.optionText === state.label
                    )
                );

            // If this is a state question, render the autocomplete
            if (isStateQuestion || hasStateOptions) {
                console.log('🗺️ Detected state question, rendering autocomplete:', question.questionText);
                return (
                    <USStateAutocomplete
                        key={question.id}
                        questionId={question.id}
                        questionText={question.questionText}
                        isRequired={isQuestionRequired}
                        value={value}
                        error={errors[question.id]}
                        helpText={question.helpText}
                        theme={theme}
                        onChange={onAnswerChange}
                    />
                );
            }

            const renderGenericRadio = () => (
                <div key={question.id} className="space-y-4">
                    <div>
                        <h3 className="text-2xl font-medium text-gray-900 mb-3">
                            {question.questionText}
                            {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                        </h3>
                        {question.helpText && <p className="text-gray-600">{question.helpText}</p>}
                    </div>

                    <div className="space-y-3">
                        {question.options?.map((option) => {
                            const isSelected = value === option.optionValue;
                            return (
                                <label
                                    key={option.id}
                                    className={`block w-full p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? "" : "bg-white border-gray-200 hover:border-gray-300"}`}
                                    style={isSelected ? { backgroundColor: theme.primaryLight, borderColor: theme.primaryDark } : undefined}
                                >
                                    <div className="flex items-center">
                                        <div className="relative">
                                            <input
                                                type="radio"
                                                name={question.id}
                                                value={option.optionValue}
                                                checked={isSelected}
                                                onChange={(e) => onRadioChange(question.id, e.target.value)}
                                                className="sr-only"
                                            />
                                            <div
                                                className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                style={isSelected ? { borderColor: theme.primaryDark, backgroundColor: theme.primaryDark } : undefined}
                                            >
                                                {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                            </div>
                                        </div>
                                        <span className="ml-3 text-gray-900 font-medium">{option.optionText}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>

                    {hasError && <p className="text-sm text-red-600">{errors[question.id]}</p>}
                </div>
            );

            if (question.questionText === "What's your gender at birth?") {
                const genderOptions = [
                    { value: "Male", label: "Male", emoji: "🧑" },
                    { value: "Female", label: "Female", emoji: "👩" }
                ];

                return (
                    <div key={question.id} className="space-y-4">
                        <div>
                            <h3 className="text-2xl font-medium text-gray-900 mb-3">
                                {question.questionText}
                                {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                            </h3>
                            {question.helpText && <p className="text-gray-600">{question.helpText}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {genderOptions.map((option) => {
                                const isSelected = value === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`p-6 rounded-2xl border-2 text-center transition-all ${isSelected ? "" : "bg-white border-gray-200 hover:border-gray-300"}`}
                                        style={isSelected ? { backgroundColor: theme.primaryLight, borderColor: theme.primaryDark } : undefined}
                                        onClick={() => onRadioChange(question.id, option.value)}
                                    >
                                        <div className="text-4xl mb-3">{option.emoji}</div>
                                        <span
                                            className={`font-medium text-lg ${isSelected ? "" : "text-gray-900"}`}
                                            style={{ color: isSelected ? theme.primary : undefined }}
                                        >
                                            {option.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            }

            return renderGenericRadio();
        }

        case "checkbox":
            return (
                <div key={question.id} className="space-y-4">
                    <div>
                        <h3 className="text-2xl font-medium text-gray-900 mb-3">
                            {question.questionText}
                            {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                        </h3>
                        {question.helpText && <p className="text-gray-600">{question.helpText}</p>}
                    </div>

                    <div className="space-y-3">
                        {question.options?.map((option) => {
                            const currentValues = Array.isArray(value) ? value : [];
                            const isChecked = currentValues.includes(option.optionValue);
                            return (
                                <label
                                    key={option.id}
                                    className={`block w-full p-4 rounded-2xl border-2 cursor-pointer transition-all ${isChecked ? "" : "bg-white border-gray-200 hover:border-gray-300"}`}
                                    style={isChecked ? { backgroundColor: theme.primaryLight, borderColor: theme.primary } : undefined}
                                >
                                    <div className="flex items-center">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                value={option.optionValue}
                                                checked={isChecked}
                                                onChange={(e) => onCheckboxChange(question.id, option.optionValue, e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div
                                                className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                style={isChecked ? { borderColor: theme.primaryDark, backgroundColor: theme.primaryDark } : undefined}
                                            >
                                                {isChecked && <Icon icon="lucide:check" className="w-3 h-3 text-white" />}
                                            </div>
                                        </div>
                                        <span className="ml-3 text-gray-900 font-medium">{option.optionText}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>

                    {hasError && <p className="text-sm text-red-600">{errors[question.id]}</p>}
                </div>
            );

        case "select":
            // Check if this is a state question - use modern autocomplete instead of radio list
            const questionTextLowerSelect = (question.questionText || '').toLowerCase();
            const isStateQuestionSelect = (
                (question as any).questionSubtype === "State" ||
                (questionTextLowerSelect.includes('state') && (
                    questionTextLowerSelect.includes('live') ||
                    questionTextLowerSelect.includes('reside') ||
                    questionTextLowerSelect.includes('located') ||
                    questionTextLowerSelect.includes('where') ||
                    questionTextLowerSelect.includes('which')
                )) ||
                questionTextLowerSelect.includes('state do you') ||
                questionTextLowerSelect.includes('your state')
            );

            // Check if options match US states
            const hasStateOptionsSelect = question.options && question.options.length >= 40 && 
                US_STATES.some(state => 
                    question.options?.some(opt => 
                        opt.optionValue === state.value || opt.optionText === state.label
                    )
                );

            // Use modern autocomplete for state questions
            if (isStateQuestionSelect || hasStateOptionsSelect) {
                console.log('🗺️ [SELECT] Detected state question, rendering autocomplete:', question.questionText);
                return (
                    <USStateAutocomplete
                        key={question.id}
                        questionId={question.id}
                        questionText={question.questionText}
                        isRequired={isQuestionRequired}
                        value={value}
                        error={errors[question.id]}
                        helpText={question.helpText}
                        theme={theme}
                        onChange={onAnswerChange}
                    />
                );
            }

            // Fallback to old state rendering (shouldn't reach here for states)
            if ((question as any).questionSubtype === "State") {
                const stateAbbreviations: Record<string, string> = {
                    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
                    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
                    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
                    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
                    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
                    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
                    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
                    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
                    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
                    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
                    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
                    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
                    "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC"
                };

                return (
                    <div key={question.id} className="space-y-4">
                        <div>
                            <h3 className="text-2xl font-medium text-gray-900 mb-3">
                                {question.questionText}
                                {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                            </h3>
                            {question.helpText && <p className="text-gray-600">{question.helpText}</p>}
                        </div>

                        <div className="space-y-3">
                            {question.options?.map((option) => {
                                const stateAbbr = stateAbbreviations[option.optionText];
                                const isSelected = value === option.optionValue;

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`block w-full p-4 rounded-2xl border-2 text-left transition-all ${isSelected ? "" : "bg-white border-gray-200 hover:border-gray-300"}`}
                                        style={isSelected ? { backgroundColor: theme.primaryLight, borderColor: theme.primaryDark } : undefined}
                                        onClick={() => onRadioChange(question.id, option.optionValue)}
                                    >
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3 overflow-hidden">
                                                {stateAbbr ? (
                                                    <img
                                                        src={`/images/${stateAbbr}.svg`}
                                                        alt={`${option.optionText} flag`}
                                                        className="w-6 h-4 object-cover rounded-sm"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-4 bg-gradient-to-r from-blue-500 to-red-500 rounded-sm"></div>
                                                )}
                                            </div>
                                            <span className="font-medium text-gray-900">{option.optionText}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {hasError && <p className="text-sm text-red-600">{errors[question.id]}</p>}
                    </div>
                );
            }

            // Use radio button UI for all select questions (no dropdown)
            return (
                <div key={question.id} className="space-y-4">
                    <div>
                        <h3 className="text-2xl font-medium text-gray-900 mb-3">
                            {question.questionText}
                            {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                        </h3>
                        {question.helpText && <p className="text-gray-600">{question.helpText}</p>}
                    </div>

                    <div className="space-y-3">
                        {question.options?.map((option) => {
                            const isSelected = value === option.optionValue;
                            return (
                                <label
                                    key={option.id}
                                    className={`block w-full p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? "" : "bg-white border-gray-200 hover:border-gray-300"}`}
                                    style={isSelected ? { backgroundColor: theme.primaryLight, borderColor: theme.primaryDark } : undefined}
                                >
                                    <div className="flex items-center">
                                        <div className="relative">
                                            <input
                                                type="radio"
                                                name={question.id}
                                                value={option.optionValue}
                                                checked={isSelected}
                                                onChange={(e) => onRadioChange(question.id, e.target.value)}
                                                className="sr-only"
                                            />
                                            <div
                                                className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                style={isSelected ? { borderColor: theme.primaryDark, backgroundColor: theme.primaryDark } : undefined}
                                            >
                                                {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                            </div>
                                        </div>
                                        <span className="ml-3 text-gray-900 font-medium">{option.optionText}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>

                    {hasError && <p className="text-sm text-red-600">{errors[question.id]}</p>}
                </div>
            );

        case "height":
            return (
                <div key={question.id} className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: "var(--q-primary-text)" }}>
                        {question.questionText}
                        {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                    </label>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <input
                                type="number"
                                placeholder="5"
                                value={value.feet || ""}
                                onChange={(e) => onAnswerChange(question.id, { ...value, feet: e.target.value })}
                                className={`w-full p-4 rounded-2xl border-2 transition-all ${hasError
                                    ? "border-red-300 bg-red-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                    } outline-none`}
                                style={hasError ? undefined : {
                                    borderColor: theme.primaryLight,
                                    color: "#111827"
                                }}
                                onFocus={(e) => {
                                    if (!hasError) {
                                        e.currentTarget.style.borderColor = theme.primary;
                                        e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.primaryLight}`;
                                        e.currentTarget.style.backgroundColor = theme.primaryLighter;
                                    }
                                }}
                                onBlur={(e) => {
                                    if (!hasError) {
                                        e.currentTarget.style.borderColor = theme.primaryLight;
                                        e.currentTarget.style.boxShadow = "none";
                                        e.currentTarget.style.backgroundColor = "#FFFFFF";
                                    }
                                }}
                            />
                            <label className="block text-xs text-gray-500 mt-1 ml-1">Feet</label>
                        </div>
                        <div className="flex-1">
                            <input
                                type="number"
                                placeholder="10"
                                value={value.inches || ""}
                                onChange={(e) => onAnswerChange(question.id, { ...value, inches: e.target.value })}
                                className={`w-full p-4 rounded-2xl border-2 transition-all ${hasError
                                    ? "border-red-300 bg-red-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                    } outline-none`}
                                style={hasError ? undefined : {
                                    borderColor: theme.primaryLight,
                                    color: "#111827"
                                }}
                                onFocus={(e) => {
                                    if (!hasError) {
                                        e.currentTarget.style.borderColor = theme.primary;
                                        e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.primaryLight}`;
                                        e.currentTarget.style.backgroundColor = theme.primaryLighter;
                                    }
                                }}
                                onBlur={(e) => {
                                    if (!hasError) {
                                        e.currentTarget.style.borderColor = theme.primaryLight;
                                        e.currentTarget.style.boxShadow = "none";
                                        e.currentTarget.style.backgroundColor = "#FFFFFF";
                                    }
                                }}
                            />
                            <label className="block text-xs text-gray-500 mt-1 ml-1">Inches</label>
                        </div>
                    </div>
                    {question.helpText && (
                        <p className="text-sm text-gray-600">{question.helpText}</p>
                    )}
                    {hasError && (
                        <p className="text-sm text-red-600">{errors[question.id]}</p>
                    )}
                </div>
            );

        case "weight":
            return (
                <div key={question.id} className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: "var(--q-primary-text)" }}>
                        {question.questionText}
                        {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                    </label>
                    <input
                        type="number"
                        placeholder={question.placeholder}
                        value={value}
                        onChange={(e) => onAnswerChange(question.id, e.target.value)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all ${hasError
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                            } outline-none`}
                        style={hasError ? undefined : {
                            borderColor: theme.primaryLight,
                            color: "#111827"
                        }}
                        onFocus={(e) => {
                            if (!hasError) {
                                e.currentTarget.style.borderColor = theme.primary;
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.primaryLight}`;
                                e.currentTarget.style.backgroundColor = theme.primaryLighter;
                            }
                        }}
                        onBlur={(e) => {
                            if (!hasError) {
                                e.currentTarget.style.borderColor = theme.primaryLight;
                                e.currentTarget.style.boxShadow = "none";
                                e.currentTarget.style.backgroundColor = "#FFFFFF";
                            }
                        }}
                    />
                    {question.helpText && (
                        <p className="text-sm text-gray-600">{question.helpText}</p>
                    )}
                    {hasError && (
                        <p className="text-sm text-red-600">{errors[question.id]}</p>
                    )}
                </div>
            );

        default:
            return (
                <div key={question.id} className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: "var(--q-primary-text)" }}>
                        {question.questionText}
                        {isQuestionRequired && <span className="text-red-500 ml-1">*</span>}
                        {!isQuestionRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
                    </label>
                    <input
                        type="text"
                        placeholder={question.placeholder}
                        value={value}
                        onChange={(e) => onAnswerChange(question.id, e.target.value)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all ${hasError
                            ? "border-red-300 bg-red-50"
                            : `border-gray-200 bg-white hover:border-gray-300`}
              outline-none`}
                    />
                    {question.helpText && (
                        <p className="text-sm text-gray-600">{question.helpText}</p>
                    )}
                    {hasError && (
                        <p className="text-sm text-red-600">{errors[question.id]}</p>
                    )}
                </div>
            );
    }
};


