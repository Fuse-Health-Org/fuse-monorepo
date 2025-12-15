import React from "react";
import { QuestionRenderer } from "./QuestionRenderer";
import { QuestionnaireStep } from "../types";

interface RegularQuestionsViewProps {
  currentStep: QuestionnaireStep;
  answers: Record<string, any>;
  errors: Record<string, string>;
  theme: any;
  replaceCurrentVariables: (text: string) => string;
  onAnswerChange: (questionId: string, value: any) => void;
  onRadioChange: (questionId: string, value: any) => void;
  onCheckboxChange: (questionId: string, optionValue: string, isChecked: boolean) => void;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const RegularQuestionsView: React.FC<RegularQuestionsViewProps> = ({
  currentStep,
  answers,
  errors,
  theme,
  replaceCurrentVariables,
  onAnswerChange,
  onRadioChange,
  onCheckboxChange,
  setErrors,
}) => {
  return (
    <div className="space-y-6">
      {currentStep.questions
        .filter((question) => {
          const conditionalLogic = (question as any).conditionalLogic;
          if (!conditionalLogic) return true;

          try {
            // Find the parent question (conditionalLevel 0) in this step
            const parentQuestion = currentStep.questions?.find(q =>
              (q as any).conditionalLevel === 0 || !(q as any).conditionalLevel
            );

            if (!parentQuestion) return false;
            const parentAnswer = answers[parentQuestion.id];

            // Helper to check if a single condition is met
            const checkCondition = (conditionStr: string): boolean => {
              if (conditionStr.startsWith('answer_equals:')) {
                const requiredValue = conditionStr.replace('answer_equals:', '').trim();

                // Handle array answers (for checkboxes/multiple choice)
                if (Array.isArray(parentAnswer)) {
                  return parentAnswer.includes(requiredValue);
                }

                return parentAnswer === requiredValue;
              }
              return false;
            };

            // Parse complex logic with AND/OR operators
            // Format: "answer_equals:value1 OR answer_equals:value2 AND answer_equals:value3"
            if (conditionalLogic.includes(' OR ') || conditionalLogic.includes(' AND ')) {
              const tokens = conditionalLogic.split(' ');
              const conditions: Array<{ check: boolean, operator?: 'OR' | 'AND' }> = [];

              for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (token.startsWith('answer_equals:')) {
                  const isTrue = checkCondition(token);
                  // Look ahead for operator
                  const nextToken = tokens[i + 1];
                  const operator = (nextToken === 'OR' || nextToken === 'AND') ? nextToken as 'OR' | 'AND' : undefined;
                  conditions.push({ check: isTrue, operator });
                }
              }

              // Evaluate the conditions with proper precedence (AND has higher precedence than OR)
              // First, group AND conditions
              let result = conditions[0]?.check ?? false;
              let currentOperator: 'OR' | 'AND' | undefined = conditions[0]?.operator;

              for (let i = 1; i < conditions.length; i++) {
                const cond = conditions[i];
                if (currentOperator === 'AND') {
                  result = result && cond.check;
                } else if (currentOperator === 'OR') {
                  result = result || cond.check;
                }
                currentOperator = cond.operator;
              }

              return result;
            }

            // Simple single condition: "answer_equals:optionValue"
            if (conditionalLogic.startsWith('answer_equals:')) {
              return checkCondition(conditionalLogic);
            }

            // Support legacy format: "question:2,answer:yes"
            const parts = conditionalLogic.split(',');
            const targetQuestionOrder = parseInt(parts[0].split(':')[1]);
            const answerPart = parts.slice(1).join(',');
            const requiredAnswer = answerPart.substring(answerPart.indexOf(':') + 1);

            const targetQuestion = currentStep.questions.find(q => q.questionOrder === targetQuestionOrder);
            if (targetQuestion) {
              const targetAnswer = answers[targetQuestion.id];

              // Handle array answers (for checkboxes/multiple choice)
              if (Array.isArray(targetAnswer)) {
                return targetAnswer.includes(requiredAnswer);
              }

              return targetAnswer === requiredAnswer;
            }
            return false;
          } catch (error) {
            console.error('Error parsing conditional logic:', conditionalLogic, error);
            return true;
          }
        })
        .sort((a, b) => {
          const aLevel = (a as any).conditionalLevel || 0;
          const bLevel = (b as any).conditionalLevel || 0;
          const aSubOrder = (a as any).subQuestionOrder;
          const bSubOrder = (b as any).subQuestionOrder;
          const aConditional = (a as any).conditionalLogic;
          const bConditional = (b as any).conditionalLogic;

          if (aLevel !== bLevel) {
            return aLevel - bLevel;
          }

          const sameConditionalGroup = aConditional && bConditional &&
            aConditional.split(',')[0] === bConditional.split(',')[0] &&
            aConditional.split(',')[1] === bConditional.split(',')[1];

          if (sameConditionalGroup &&
            aSubOrder !== null && aSubOrder !== undefined &&
            bSubOrder !== null && bSubOrder !== undefined) {
            return aSubOrder - bSubOrder;
          }

          return a.questionOrder - b.questionOrder;
        })
        .map((question) => {
          // Apply dynamic variable replacement to question text
          const questionWithReplacedVars = {
            ...question,
            questionText: replaceCurrentVariables(question.questionText || ''),
            placeholder: replaceCurrentVariables(question.placeholder || '')
          };

          return (
            <QuestionRenderer
              key={question.id}
              question={questionWithReplacedVars}
              answers={answers}
              errors={errors}
              theme={theme}
              stepRequired={currentStep.required}
              onAnswerChange={onAnswerChange}
              onRadioChange={(questionId: string, value: any) => {
                // Clear any existing error on first selection
                setErrors(prev => {
                  const next = { ...prev };
                  delete next[questionId];
                  return next;
                });
                onRadioChange(questionId, value);
              }}
              onCheckboxChange={onCheckboxChange}
            />
          );
        })}
    </div>
  );
};

