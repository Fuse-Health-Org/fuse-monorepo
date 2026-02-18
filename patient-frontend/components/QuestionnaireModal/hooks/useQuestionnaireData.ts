import { useState, useEffect } from "react";
import { apiCall } from "../../../lib/api";
import { replaceVariables, getVariablesFromClinic } from "../../../lib/templateVariables";
import { QuestionnaireData, QuestionnaireModalProps } from "../types";

export function useQuestionnaireData(
  isOpen: boolean,
  props: Pick<
    QuestionnaireModalProps,
    | "treatmentId"
    | "questionnaireId"
    | "productName"
    | "productCategory"
    | "productFormVariant"
    | "globalFormStructure"
    | "programData"
  >,
  onClose: () => void
) {
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadQuestionnaire = async () => {
      if (!isOpen) return;

      setLoading(true);
      try {
        // If questionnaireId is provided (product-based), fetch questionnaire directly via public proxy
        // Also supports Program IDs - if it's a program, we'll fetch the questionnaire from its medicalTemplate
        if (props.questionnaireId) {
          let questionnaireData: any = null
          let isProgramFlow = false

          // First, try to fetch as a questionnaire
          const qRes = await fetch(`/api/public/questionnaires/${encodeURIComponent(props.questionnaireId)}`)
          const qData = await qRes.json().catch(() => null)

          if (qRes.ok && qData?.success && qData?.data) {
            // It's a regular questionnaire
            questionnaireData = qData.data
            console.log('📋 Loaded as questionnaire:', questionnaireData.id)
          } else {
            // Questionnaire not found - try to fetch as a Program
            console.log('🔄 Questionnaire not found, checking if ID is a Program...')
            const pRes = await fetch(`/api/public/programs/${encodeURIComponent(props.questionnaireId)}`)
            const pData = await pRes.json().catch(() => null)

            if (pRes.ok && pData?.success && pData?.data) {
              // It's a Program! Get the questionnaire from its medicalTemplate
              const program = pData.data
              console.log('📦 Found Program:', program.name, 'with template:', program.medicalTemplateId)
              isProgramFlow = true

              if (!program.medicalTemplateId) {
                throw new Error('Program has no medical template configured')
              }

              // Fetch the actual questionnaire from the program's medical template
              const templateRes = await fetch(`/api/public/questionnaires/${encodeURIComponent(program.medicalTemplateId)}`)
              const templateData = await templateRes.json().catch(() => null)

              if (!templateRes.ok || !templateData?.success || !templateData?.data) {
                throw new Error('Failed to load program medical template')
              }

              questionnaireData = templateData.data
              // Store program info on the questionnaire for later use
              questionnaireData._programId = program.id
              questionnaireData._programName = program.name
              questionnaireData._programFormStepOrder = Array.isArray(program.formStepOrder) ? program.formStepOrder : null
              console.log('✅ Loaded questionnaire from Program template:', questionnaireData.id)
            } else {
              throw new Error(qData?.message || 'Failed to load questionnaire or program')
            }
          }

          if (!questionnaireData) {
            throw new Error('Failed to load questionnaire data')
          }

          // Debug: Log questionnaire data structure
          console.log('📋 Questionnaire data loaded:', {
            id: questionnaireData.id,
            title: questionnaireData.title,
            stepsCount: questionnaireData.steps?.length,
            steps: questionnaireData.steps?.map((s: any) => ({
              id: s.id,
              title: s.title,
              category: s.category,
              questionsCount: s.questions?.length,
              questions: s.questions?.map((q: any) => ({
                id: q.id,
                questionText: q.questionText,
                answerType: q.answerType,
                questionSubtype: q.questionSubtype,
              }))
            }))
          });

          // Ensure steps
          if (!Array.isArray(questionnaireData.steps)) {
            questionnaireData.steps = []
          }

          // If no user_profile steps exist, append them from the global first user_profile questionnaire
          const hasUserProfile = (questionnaireData.steps || []).some((s: any) => s.category === 'user_profile')
          if (!hasUserProfile) {
            try {
              const upRes = await fetch('/api/public/questionnaires/first-user-profile')
              const upData = await upRes.json().catch(() => null)
              if (upRes.ok && upData?.success && upData?.data) {
                const userProfileSteps = (upData.data.steps || []).filter((s: any) => s.category === 'user_profile')
                if (userProfileSteps.length > 0) {
                  const normal = (questionnaireData.steps || [])
                    .filter((s: any) => s.category === 'normal' || !s.category)
                    .sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
                  const userProfileSorted = userProfileSteps.sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
                  const others = (questionnaireData.steps || [])
                    .filter((s: any) => s.category && s.category !== 'normal' && s.category !== 'user_profile')
                    .sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
                  const merged = [...normal, ...userProfileSorted, ...others]
                  questionnaireData.steps = merged
                }
              }
            } catch (e) {
              console.warn('Failed to append user_profile steps:', e)
            }
          }

          // Load standardized category questions for Global Form Structure usage
          let categoryQuestionSteps: any[] = []
          try {
            if (props.productCategory) {
              const stdRes = await fetch(`/api/public/questionnaires/standardized?category=${encodeURIComponent(props.productCategory)}`)
              const stdData = await stdRes.json().catch(() => null)
              if (stdRes.ok && stdData?.success && Array.isArray(stdData?.data) && stdData.data.length > 0) {
                categoryQuestionSteps = stdData.data.flatMap((q: any) => q.steps || []).sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
                console.log(`✅ Loaded ${categoryQuestionSteps.length} category question steps for ${props.productCategory}`)
              }
            }
          } catch (e) {
            console.warn('Failed to load standardized steps:', e)
          }

          // Apply Global Form Structure section ordering if provided
          if (props.globalFormStructure && props.globalFormStructure.sections && Array.isArray(props.globalFormStructure.sections)) {
            console.log('🎯 Applying Global Form Structure ordering:', props.globalFormStructure.name)
            const currentSteps = Array.isArray(questionnaireData.steps) ? questionnaireData.steps : []

            // Categorize current steps by their actual category field
            const normalSteps = currentSteps.filter((s: any) => s.category === 'normal' || !s.category).sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
            const userProfileSteps = currentSteps.filter((s: any) => s.category === 'user_profile').sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
            const otherSteps = currentSteps.filter((s: any) => s.category && s.category !== 'normal' && s.category !== 'user_profile').sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))

            // Get enabled sections in order
            const enabledSections = props.globalFormStructure.sections
              .filter((s: any) => s.enabled)
              .sort((a: any, b: any) => a.order - b.order)

            console.log('  Enabled sections:', enabledSections.map((s: any) => `${s.order}. ${s.label} (${s.type})`))
            console.log('  Available steps - normal:', normalSteps.length, 'userProfile:', userProfileSteps.length, 'category:', categoryQuestionSteps.length)

            const orderedSteps: any[] = []

            for (const section of enabledSections) {
              switch (section.type) {
                case 'product_questions':
                  console.log(`  → Adding ${normalSteps.length} medical question steps`)
                  orderedSteps.push(...normalSteps)
                  break
                case 'category_questions':
                  console.log(`  → Adding ${categoryQuestionSteps.length} category question steps`)
                  orderedSteps.push(...categoryQuestionSteps)
                  break
                case 'account_creation':
                  console.log(`  → Adding ${userProfileSteps.length} account creation steps`)
                  orderedSteps.push(...userProfileSteps)
                  break
                case 'product_selection':
                  // Product selection is handled separately via productSelectionStepPosition
                  console.log('  → Product Selection section (handled separately)')
                  break
                case 'checkout':
                  // Checkout is handled separately via checkoutStepPosition
                  console.log('  → Checkout section (handled separately)')
                  break
                default:
                  console.log(`  → Unknown section type: ${section.type}`)
              }
            }

            // Add any other steps that weren't categorized
            if (otherSteps.length > 0) {
              console.log(`  → Adding ${otherSteps.length} other steps`)
              orderedSteps.push(...otherSteps)
            }

            questionnaireData.steps = orderedSteps
            console.log(`✅ Global Form Structure applied: ${orderedSteps.length} total steps`)

            // Update product selection step position based on Global Form Structure
            const productSelectionSection = enabledSections.find((s: any) => s.type === 'product_selection')
            if (productSelectionSection) {
              // Calculate position: count how many section types come before product selection
              const sectionsBeforeProductSelection = enabledSections.filter((s: any) => s.order < productSelectionSection.order && s.enabled && s.type !== 'product_selection')
              let productSelectionPosition = 0

              for (const section of sectionsBeforeProductSelection) {
                switch (section.type) {
                  case 'product_questions':
                    productSelectionPosition += normalSteps.length
                    break
                  case 'category_questions':
                    productSelectionPosition += categoryQuestionSteps.length
                    break
                  case 'account_creation':
                    productSelectionPosition += userProfileSteps.length
                    break
                }
              }

              questionnaireData.productSelectionStepPosition = productSelectionPosition
              console.log(`✅ Product Selection position set to: ${productSelectionPosition} (based on Global Form Structure)`)
            } else {
              questionnaireData.productSelectionStepPosition = -1 // Not enabled
            }

            // Update checkout step position based on Global Form Structure
            const checkoutSection = enabledSections.find((s: any) => s.type === 'checkout')
            if (checkoutSection) {
              // Calculate position: count how many section types come before checkout
              const sectionsBeforeCheckout = enabledSections.filter((s: any) => s.order < checkoutSection.order && s.enabled && s.type !== 'checkout')
              let checkoutPosition = 0

              for (const section of sectionsBeforeCheckout) {
                switch (section.type) {
                  case 'product_questions':
                    checkoutPosition += normalSteps.length
                    break
                  case 'category_questions':
                    checkoutPosition += categoryQuestionSteps.length
                    break
                  case 'account_creation':
                    checkoutPosition += userProfileSteps.length
                    break
                  case 'product_selection':
                    checkoutPosition += 1 // Product selection is a single step
                    break
                }
              }

              questionnaireData.checkoutStepPosition = checkoutPosition
              console.log(`✅ Checkout position set to: ${checkoutPosition} (based on Global Form Structure)`)
            }
          } else if (categoryQuestionSteps.length > 0) {
            // Fallback: No Global Form Structure - use default ordering
            console.log('ℹ️ No Global Form Structure - using default section ordering')
            const currentSteps = Array.isArray(questionnaireData.steps) ? questionnaireData.steps : []

            if (props.productFormVariant === '2') {
              // Prepend standardized
              questionnaireData.steps = [...categoryQuestionSteps, ...currentSteps]
            } else {
              // Default behavior: append after user_profile
              const normal = currentSteps
                .filter((s: any) => s.category === 'normal' || !s.category)
                .sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
              const userProfile = currentSteps
                .filter((s: any) => s.category === 'user_profile')
                .sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
              const others = currentSteps
                .filter((s: any) => s.category && s.category !== 'normal' && s.category !== 'user_profile')
                .sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))

              // Order: normal, user_profile, category questions, others
              questionnaireData.steps = [...normal, ...userProfile, ...categoryQuestionSteps, ...others]
            }
          }

          // Program-level form section ordering override (saved from admin Program Form tab)
          const programStepOrder = Array.isArray((props.programData as any)?.formStepOrder)
            ? (props.programData as any).formStepOrder
            : Array.isArray((questionnaireData as any)._programFormStepOrder)
            ? (questionnaireData as any)._programFormStepOrder
            : null

          if (programStepOrder && programStepOrder.length > 0) {
            const stepSet = new Set<string>(programStepOrder.filter((s: any): s is string => typeof s === 'string'))
            const normalizedOrder = [...stepSet].filter((s) =>
              ['productSelection', 'medical', 'account', 'payment'].includes(s)
            )

            // Payment is always the final step.
            const withoutPayment = normalizedOrder.filter((s) => s !== 'payment')
            const finalOrder = [...withoutPayment, 'payment']

            const currentSteps = Array.isArray(questionnaireData.steps) ? questionnaireData.steps : []
            const medicalSteps = currentSteps
              .filter((s: any) => s.category === 'normal' || !s.category)
              .sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
            const accountSteps = currentSteps
              .filter((s: any) => s.category === 'user_profile')
              .sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
            const otherSteps = currentSteps
              .filter((s: any) => s.category && s.category !== 'normal' && s.category !== 'user_profile')
              .sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))

            const orderedSteps: any[] = []
            let cursor = 0
            let productSelectionPosition: number = -1
            let checkoutPosition: number = currentSteps.length

            for (const section of finalOrder) {
              if (section === 'medical') {
                orderedSteps.push(...medicalSteps)
                cursor += medicalSteps.length
              } else if (section === 'account') {
                orderedSteps.push(...accountSteps)
                cursor += accountSteps.length
              } else if (section === 'productSelection') {
                productSelectionPosition = cursor
                cursor += 1
              } else if (section === 'payment') {
                checkoutPosition = cursor
              }
            }

            // Keep any uncategorized steps visible (at the end) to avoid data loss.
            if (otherSteps.length > 0) {
              orderedSteps.push(...otherSteps)
            }

            questionnaireData.steps = orderedSteps
            questionnaireData.productSelectionStepPosition = productSelectionPosition
            questionnaireData.checkoutStepPosition = checkoutPosition

            console.log('✅ Applied program form step order:', finalOrder)
            console.log('   Product selection position:', productSelectionPosition, 'Checkout position:', checkoutPosition)
          }

          // Universal fallback: ensure dedicated product selection step appears before checkout
          // when a structure did not explicitly set productSelectionStepPosition.
          if (
            questionnaireData.productSelectionStepPosition === undefined &&
            questionnaireData.checkoutStepPosition !== undefined
          ) {
            const checkoutPosition =
              questionnaireData.checkoutStepPosition === -1
                ? questionnaireData.steps.length
                : questionnaireData.checkoutStepPosition

            questionnaireData.productSelectionStepPosition = checkoutPosition
            questionnaireData.checkoutStepPosition = checkoutPosition + 1

            console.log(
              `✅ Default Product Selection applied at ${questionnaireData.productSelectionStepPosition}; checkout shifted to ${questionnaireData.checkoutStepPosition}`
            )
          }

          // Fetch clinic data for variable replacement
          try {
            // Get clinic slug from hostname
            const hostname = window.location.hostname;
            let clinicSlug: string | null = null;

            if (process.env.NODE_ENV === 'production') {
              // Production: clinicSlug.fuse.health or clinicSlug.fusehealthstaging.xyz
              if (hostname.endsWith('.fusehealth.com')) {
                const parts = hostname.split('.fuse.health');
                clinicSlug = parts.length > 1 ? parts[0] : null;
              } else if (hostname.endsWith('.fusehealthstaging.xyz')) {
                const parts = hostname.split('.fusehealthstaging.xyz');
                clinicSlug = parts.length > 1 ? parts[0] : null;
              }
            } else {
              // Development: clinicSlug.localhost
              const parts = hostname.split('.localhost');
              clinicSlug = parts.length > 1 ? parts[0] : null;
            }

            if (clinicSlug) {
              // Fetch clinic data
              const clinicRes = await fetch(`/api/public/clinic/${encodeURIComponent(clinicSlug)}`);
              const clinicData = await clinicRes.json().catch(() => null);

              if (clinicRes.ok && clinicData?.success && clinicData?.data) {
                const clinic = clinicData.data;
                const variables = {
                  ...getVariablesFromClinic(clinic),
                  productName: props.productName || ''
                  // Don't include patientName/patientFirstName yet - they'll be set after account creation
                };

                // Replace variables in all step titles, descriptions, and questions
                if (questionnaireData.steps && questionnaireData.steps.length > 0) {
                  questionnaireData.steps = questionnaireData.steps.map((step: any) => ({
                    ...step,
                    title: replaceVariables(step.title || '', variables),
                    description: replaceVariables(step.description || '', variables),
                    questions: step.questions?.map((question: any) => ({
                      ...question,
                      questionText: replaceVariables(question.questionText || '', variables),
                      placeholder: replaceVariables(question.placeholder || '', variables),
                      options: question.options?.map((opt: any) => {
                        if (typeof opt === 'string') {
                          return replaceVariables(opt, variables);
                        }
                        if (opt && typeof opt === 'object') {
                          return {
                            ...opt,
                            optionText: replaceVariables(opt.optionText || '', variables),
                          };
                        }
                        return opt;
                      }),
                    })),
                  }));
                }
              }
            }
          } catch (e) {
            console.warn('Failed to load clinic data for variable replacement:', e);
          }

          setQuestionnaire(questionnaireData)
          setLoading(false)
          return
        }

        // Else fallback to treatment-based flow
        if (!props.treatmentId) return;

        // Fetch both questionnaire and treatment products
        const [questionnaireResult, treatmentResult] = await Promise.all([
          apiCall(`/questionnaires/treatment/${props.treatmentId}`),
          apiCall(`/treatments/${props.treatmentId}`)
        ]);
        console.log('📋 Questionnaire API result:', questionnaireResult);
        console.log('📋 Treatment API result:', treatmentResult);

        if (questionnaireResult.success && questionnaireResult.data && treatmentResult.success && treatmentResult.data) {
          // The actual questionnaire data is nested in result.data.data
          const questionnaireData = questionnaireResult.data.data || questionnaireResult.data;
          const treatmentData = treatmentResult.data.data || treatmentResult.data;
          console.log('📋 Questionnaire data:', questionnaireData);
          console.log('📋 Treatment data:', treatmentData);
          console.log('📋 Steps:', questionnaireData.steps);

          // Ensure steps array exists (allow empty arrays for checkout-only questionnaires)
          if (!Array.isArray(questionnaireData.steps)) {
            console.log('⚠️ No steps array found, initializing empty array for checkout-only questionnaire');
            questionnaireData.steps = [];
          }

          // Get template variables from clinic/treatment data
          const variables = {
            ...getVariablesFromClinic(treatmentData.clinic || {}),
            productName: props.productName || ''
          };

          // Replace variables in all step titles, descriptions, and questions
          if (questionnaireData.steps && questionnaireData.steps.length > 0) {
            questionnaireData.steps = questionnaireData.steps.map((step: any) => ({
              ...step,
              title: replaceVariables(step.title || '', variables),
              description: replaceVariables(step.description || '', variables),
              questions: step.questions?.map((question: any) => ({
                ...question,
                questionText: replaceVariables(question.questionText || '', variables),
                placeholder: replaceVariables(question.placeholder || '', variables),
                options: question.options?.map((opt: any) => {
                  if (typeof opt === 'string') {
                    return replaceVariables(opt, variables);
                  }
                  if (opt && typeof opt === 'object') {
                    return {
                      ...opt,
                      optionText: replaceVariables(opt.optionText || '', variables),
                    };
                  }
                  return opt;
                }),
              })),
            }));
          }

          // Combine questionnaire with treatment products
          const combinedData = {
            ...questionnaireData,
            treatment: treatmentData
          };

          setQuestionnaire(combinedData);
        } else {
          throw new Error('Failed to load questionnaire');
        }
      } catch (error) {
        console.error('Error loading questionnaire:', error);
        alert('Failed to load questionnaire: ' + (error as Error).message);
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadQuestionnaire();
  }, [isOpen, props.treatmentId, props.questionnaireId, props.productCategory, props.productFormVariant, props.globalFormStructure, props.productName, onClose]);

  return { questionnaire, loading, setQuestionnaire };
}

