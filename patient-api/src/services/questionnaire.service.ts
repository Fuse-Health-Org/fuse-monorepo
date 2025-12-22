import Questionnaire from "../models/Questionnaire";
import QuestionnaireStep from "../models/QuestionnaireStep";
import Question from "../models/Question";
import QuestionOption from "../models/QuestionOption";
import Treatment from "../models/Treatment";
import User from "../models/User";
import Clinic from "../models/Clinic";
import Product from "../models/Product";
import FormProducts from "../models/FormProducts";
import { Op, Transaction } from "sequelize";
import {
  CreateQuestionnaireInput,
  UpdateQuestionnaireInput,
} from "@fuse/validators";

class QuestionnaireService {
  async createTemplate(input: {
    title: string;
    description?: string;
    treatmentId?: string | null;
    productId?: string | null;
    category?: string | null;
    formTemplateType?:
      | "normal"
      | "user_profile"
      | "doctor"
      | "master_template"
      | "standardized_template"
      | null;
    createdById?: string | null;
  }) {
    return Questionnaire.create({
      title: input.title,
      description: input.description ?? null,
      checkoutStepPosition: -1,
      treatmentId: input.treatmentId ?? null,
      productId: input.productId ?? null,
      category: input.category ?? null,
      formTemplateType: input.formTemplateType ?? null,
      isTemplate: true,
      userId: input.createdById ?? null,
      personalizationQuestionsSetup: false,
      createAccountQuestionsSetup: false,
      doctorQuestionsSetup: false,
    });
  }

  async listTemplates() {
    return Questionnaire.findAll({
      where: { isTemplate: true, formTemplateType: "standardized_template" },
      include: [
        {
          model: QuestionnaireStep,
          as: "steps",
          include: [
            {
              model: Question,
              as: "questions",
              include: [
                {
                  model: QuestionOption,
                  as: "options",
                },
              ],
            },
          ],
        },
      ],
      order: [
        [{ model: QuestionnaireStep, as: "steps" }, "stepOrder", "ASC"],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          "questionOrder",
          "ASC",
        ],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          { model: QuestionOption, as: "options" },
          "optionOrder",
          "ASC",
        ],
      ],
    });
  }

  async listAllProductForms() {
    return Questionnaire.findAll({
      where: { isTemplate: true, formTemplateType: "normal" },
      attributes: [
        "id",
        "title",
        "description",
        "productId",
        "category",
        "userId",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "firstName", "lastName"],
          required: false,
        },
        {
          model: FormProducts,
          as: "formProducts",
          attributes: ["id", "productId"],
          required: false,
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "imageUrl", "price", "placeholderSig", "pharmacyWholesaleCost", "slug"],
              required: false,
            },
          ],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });
  }

  async listTemplatesByProduct(productId: string) {
    // Return only the LATEST shared questionnaire for the product
    // All brands should use the same questionnaire for a product
    const latestQuestionnaire = await Questionnaire.findOne({
      where: {
        productId,
        isTemplate: false, // Only return the actual product form, not saved templates
        formTemplateType: "normal",
      },
      include: [
        {
          model: QuestionnaireStep,
          as: "steps",
          include: [
            {
              model: Question,
              as: "questions",
              include: [
                {
                  model: QuestionOption,
                  as: "options",
                },
              ],
            },
          ],
        },
      ],
      order: [
        ["updatedAt", "DESC"], // Get the most recently updated questionnaire
        [{ model: QuestionnaireStep, as: "steps" }, "stepOrder", "ASC"],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          "questionOrder",
          "ASC",
        ],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          { model: QuestionOption, as: "options" },
          "optionOrder",
          "ASC",
        ],
      ],
    });

    // Return as array for compatibility with existing code
    return latestQuestionnaire ? [latestQuestionnaire] : [];
  }

  async getTemplateById(id: string) {
    return Questionnaire.findOne({
      where: { id },
      include: [
        {
          model: QuestionnaireStep,
          as: "steps",
          include: [
            {
              model: Question,
              as: "questions",
              include: [
                {
                  model: QuestionOption,
                  as: "options",
                },
              ],
            },
          ],
        },
      ],
      order: [
        [{ model: QuestionnaireStep, as: "steps" }, "stepOrder", "ASC"],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          "questionOrder",
          "ASC",
        ],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          { model: QuestionOption, as: "options" },
          "optionOrder",
          "ASC",
        ],
      ],
    });
  }

  async updateTemplate(
    id: string,
    updates: {
      title?: string;
      description?: string | null;
      personalizationQuestionsSetup?: boolean;
      createAccountQuestionsSetup?: boolean;
      doctorQuestionsSetup?: boolean;
      status?: "in_progress" | "ready_for_review" | "ready";
      productId?: string | null;
    }
  ) {
    const template = await Questionnaire.findOne({
      where: { id, isTemplate: true },
    });

    if (!template) {
      throw new Error("Template not found");
    }

    await template.update({
      title: updates.title ?? template.title,
      description: updates.description ?? template.description,
      personalizationQuestionsSetup:
        updates.personalizationQuestionsSetup ??
        template.personalizationQuestionsSetup,
      createAccountQuestionsSetup:
        updates.createAccountQuestionsSetup ??
        template.createAccountQuestionsSetup,
      doctorQuestionsSetup:
        updates.doctorQuestionsSetup ?? template.doctorQuestionsSetup,
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.productId !== undefined && { productId: updates.productId }),
    });

    return this.getTemplateById(id);
  }

  async listForUser(userId: string) {
    return Questionnaire.findAll({
      where: {
        userId,
        isTemplate: false,
      },
      include: [
        {
          model: QuestionnaireStep,
          as: "steps",
          include: [
            {
              model: Question,
              as: "questions",
              include: [
                {
                  model: QuestionOption,
                  as: "options",
                },
              ],
            },
          ],
        },
      ],
      order: [
        [{ model: QuestionnaireStep, as: "steps" }, "stepOrder", "ASC"],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          "questionOrder",
          "ASC",
        ],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          { model: QuestionOption, as: "options" },
          "optionOrder",
          "ASC",
        ],
      ],
    });
  }

  async getByIdForUser(questionnaireId: string, userId: string) {
    return Questionnaire.findOne({
      where: {
        id: questionnaireId,
        userId,
        isTemplate: false,
      },
      include: [
        {
          model: QuestionnaireStep,
          as: "steps",
          include: [
            {
              model: Question,
              as: "questions",
              include: [
                {
                  model: QuestionOption,
                  as: "options",
                },
              ],
            },
          ],
        },
        {
          model: Treatment,
          as: "treatment",
          include: [
            {
              model: Clinic,
              as: "clinic",
            },
          ],
        },
      ],
      order: [
        [{ model: QuestionnaireStep, as: "steps" }, "stepOrder", "ASC"],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          "questionOrder",
          "ASC",
        ],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          { model: QuestionOption, as: "options" },
          "optionOrder",
          "ASC",
        ],
      ],
    });
  }

  async listForTreatment(treatmentId: string, userId: string) {
    return Questionnaire.findAll({
      where: {
        treatmentId,
        userId,
        isTemplate: false,
      },
      order: [["createdAt", "DESC"]],
    });
  }

  async updateColor(
    questionnaireId: string,
    userId: string,
    color: string | null
  ) {
    const questionnaire = await Questionnaire.findByPk(questionnaireId);

    if (!questionnaire) {
      throw new Error("Questionnaire not found");
    }

    if (questionnaire.userId !== userId) {
      throw new Error("Questionnaire does not belong to your account");
    }

    await questionnaire.update({ color: color ?? null });

    return questionnaire;
  }

  async duplicateTemplate(
    questionnaireId: string,
    userId: string,
    clinicId?: string
  ) {
    const template = await Questionnaire.findByPk(questionnaireId, {
      include: [
        {
          model: QuestionnaireStep,
          as: "steps",
          include: [
            {
              model: Question,
              as: "questions",
              include: [
                {
                  model: QuestionOption,
                  as: "options",
                },
              ],
            },
          ],
        },
      ],
    });

    if (!template) {
      throw new Error("Template not found");
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Use provided clinicId or fall back to user's clinic
    const targetClinicId = clinicId || user.clinicId;
    if (!targetClinicId) {
      throw new Error("No clinic specified for template import");
    }

    const treatment = await Treatment.findOne({
      where: { clinicId: targetClinicId },
    });

    const sequelize = Questionnaire.sequelize;
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    const transaction: Transaction = await sequelize.transaction();

    try {
      const clone = await Questionnaire.create(
        {
          title: template.title,
          description: template.description,
          checkoutStepPosition: template.checkoutStepPosition,
          treatmentId: template.treatmentId,
          isTemplate: false,
          userId,
          color: template.color,
        },
        { transaction }
      );

      for (const step of template.steps || []) {
        const clonedStep = await QuestionnaireStep.create(
          {
            title: step.title,
            description: step.description,
            category: step.category,
            stepOrder: step.stepOrder,
            questionnaireId: clone.id,
          },
          { transaction }
        );

        for (const question of step.questions || []) {
          const clonedQuestion = await Question.create(
            {
              questionText: question.questionText,
              answerType: question.answerType,
              questionSubtype: question.questionSubtype,
              isRequired: question.isRequired,
              questionOrder: question.questionOrder,
              subQuestionOrder: question.subQuestionOrder,
              conditionalLevel: question.conditionalLevel,
              placeholder: question.placeholder,
              helpText: question.helpText,
              footerNote: question.footerNote,
              conditionalLogic: question.conditionalLogic,
              stepId: clonedStep.id,
            },
            { transaction }
          );

          if (question.options?.length) {
            await QuestionOption.bulkCreate(
              question.options.map((option) => ({
                optionText: option.optionText,
                optionValue: option.optionValue,
                optionOrder: option.optionOrder,
                questionId: clonedQuestion.id,
              })),
              { transaction }
            );
          }
        }
      }

      await transaction?.commit();

      const fullClone = await Questionnaire.findByPk(clone.id, {
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [
                  {
                    model: QuestionOption,
                    as: "options",
                  },
                ],
              },
            ],
          },
        ],
        order: [
          [{ model: QuestionnaireStep, as: "steps" }, "stepOrder", "ASC"],
          [
            { model: QuestionnaireStep, as: "steps" },
            { model: Question, as: "questions" },
            "questionOrder",
            "ASC",
          ],
          [
            { model: QuestionnaireStep, as: "steps" },
            { model: Question, as: "questions" },
            { model: QuestionOption, as: "options" },
            "optionOrder",
            "ASC",
          ],
        ],
      });

      return fullClone ?? clone;
    } catch (error) {
      await transaction?.rollback();
      throw error;
    }
  }

  async createDefaultQuestionnaire(
    treatmentId: string,
    isTemplate = false,
    userId?: string | null
  ): Promise<Questionnaire> {
    const treatment = await Treatment.findByPk(treatmentId);

    if (!treatment) {
      throw new Error("Treatment not found");
    }

    const questionnaire = await Questionnaire.create({
      title: `${treatment.name} Intake Form`,
      description: `Medical intake questionnaire for ${treatment.name} treatment`,
      checkoutStepPosition: -1,
      treatmentId: treatmentId,
      isTemplate,
      userId: userId ?? null,
    });

    // Step 1: How are you feeling?
    const step1 = await QuestionnaireStep.create({
      title: "How are you feeling?",
      description: "",
      stepOrder: 1,
      questionnaireId: questionnaire.id,
    });

    const question1 = await Question.create({
      questionText: "How are you feeling?",
      answerType: "select",
      isRequired: true,
      questionOrder: 1,
      stepId: step1.id,
    });

    await QuestionOption.bulkCreate([
      {
        optionText: "Low Energy",
        optionValue: "low_energy",
        optionOrder: 1,
        questionId: question1.id,
      },
      {
        optionText: "Brain Fog",
        optionValue: "brain_fog",
        optionOrder: 2,
        questionId: question1.id,
      },
      {
        optionText: "Bad sleep",
        optionValue: "bad_sleep",
        optionOrder: 3,
        questionId: question1.id,
      },
    ]);

    // Step 2: Treatment Information
    const step2 = await QuestionnaireStep.create({
      title: "Treatment Information",
      description:
        "Treatment Information 83% of limitless patients report that Performance medication makes them more motivated",
      stepOrder: 2,
      questionnaireId: questionnaire.id,
    });

    await Question.create({
      questionText: "Treatment Information",
      answerType: "text",
      isRequired: true,
      questionOrder: 1,
      stepId: step2.id,
    });

    // Step 3: What state do you live in?
    const step3 = await QuestionnaireStep.create({
      title: "Location Information",
      description: "",
      stepOrder: 3,
      questionnaireId: questionnaire.id,
    });

    await Question.create({
      questionText: "What state do you live in?",
      answerType: "select",
      isRequired: true,
      questionOrder: 1,
      stepId: step3.id,
    });

    // Step 4: Gender at birth
    const step4 = await QuestionnaireStep.create({
      title: "Personal Information",
      description: "",
      stepOrder: 4,
      questionnaireId: questionnaire.id,
    });

    const question4 = await Question.create({
      questionText: "What's your gender at birth?",
      answerType: "radio",
      isRequired: true,
      questionOrder: 1,
      stepId: step4.id,
    });

    await QuestionOption.bulkCreate([
      {
        optionText: "Male",
        optionValue: "male",
        optionOrder: 1,
        questionId: question4.id,
      },
      {
        optionText: "Female",
        optionValue: "female",
        optionOrder: 2,
        questionId: question4.id,
      },
    ]);

    // Step 5: Date of birth
    const step5 = await QuestionnaireStep.create({
      title: "Date of Birth",
      description: "",
      stepOrder: 5,
      questionnaireId: questionnaire.id,
    });

    await Question.create({
      questionText: "Date of birth",
      answerType: "date",
      isRequired: true,
      questionOrder: 1,
      stepId: step5.id,
    });

    // Step 6: Personal information
    const step6 = await QuestionnaireStep.create({
      title: "Personal information",
      description: "",
      stepOrder: 6,
      questionnaireId: questionnaire.id,
    });

    await Question.bulkCreate([
      {
        questionText: "First name",
        answerType: "text",
        isRequired: true,
        questionOrder: 1,
        stepId: step6.id,
      },
      {
        questionText: "Last name",
        answerType: "text",
        isRequired: true,
        questionOrder: 2,
        stepId: step6.id,
      },
      {
        questionText: "Email",
        answerType: "email",
        isRequired: true,
        questionOrder: 3,
        stepId: step6.id,
      },
      {
        questionText: "Phone number",
        answerType: "phone",
        isRequired: true,
        questionOrder: 4,
        stepId: step6.id,
      },
    ]);

    return questionnaire;
  }

  async getQuestionnaireByTreatment(treatmentId: string) {
    const baseQuery = {
      include: [
        {
          model: QuestionnaireStep,
          as: "steps",
          include: [
            {
              model: Question,
              as: "questions",
              include: [
                {
                  model: QuestionOption,
                  as: "options",
                },
              ],
            },
          ],
        },
      ],
      order: [
        [{ model: QuestionnaireStep, as: "steps" }, "stepOrder", "ASC"],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          "questionOrder",
          "ASC",
        ],
        [
          { model: QuestionnaireStep, as: "steps" },
          { model: Question, as: "questions" },
          { model: QuestionOption, as: "options" },
          "optionOrder",
          "ASC",
        ],
      ] as any,
    };

    const nonTemplate = await Questionnaire.findOne({
      where: { treatmentId, isTemplate: false },
      ...baseQuery,
      order: [["updatedAt", "DESC"], ...baseQuery.order],
    });

    if (nonTemplate) {
      return nonTemplate;
    }

    const template = await Questionnaire.findOne({
      where: { treatmentId },
      ...baseQuery,
      order: [["updatedAt", "DESC"], ...baseQuery.order],
    });

    if (!template) {
      throw new Error("Questionnaire not found for this treatment");
    }

    return template;
  }

  async deleteQuestionnaire(questionnaireId: string, userId: string) {
    const questionnaire = await Questionnaire.findByPk(questionnaireId, {
      include: [
        {
          model: QuestionnaireStep,
          as: "steps",
          include: [
            {
              model: Question,
              as: "questions",
              include: [
                {
                  model: QuestionOption,
                  as: "options",
                },
              ],
            },
          ],
        },
      ],
    });

    if (!questionnaire) {
      throw new Error("Questionnaire not found");
    }

    // Ownership and template rules
    if (questionnaire.isTemplate) {
      // Allow deleting:
      // 1. standardized_template with no owner (tenant portal)
      // 2. normal type templates (product form templates - doctors can delete these)
      const isStandardizedWithNoOwner =
        questionnaire.formTemplateType === "standardized_template" &&
        questionnaire.userId === null;
      const isNormalTemplate =
        questionnaire.formTemplateType === "normal" ||
        questionnaire.formTemplateType === null;

      if (!isStandardizedWithNoOwner && !isNormalTemplate) {
        throw new Error("Cannot delete this type of template questionnaire");
      }
      // standardized_template with userId === null → permitted via tenant portal
      // normal templates → permitted (doctors can delete product form templates)
    } else {
      // Non-templates must belong to the requesting user
      if (questionnaire.userId !== userId) {
        throw new Error("Questionnaire does not belong to your account");
      }
    }

    const sequelize = Questionnaire.sequelize;
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    const transaction: Transaction = await sequelize.transaction();

    try {
      const deletedIds = {
        questionnaireId: questionnaireId,
        steps: [] as string[],
        questions: [] as string[],
        questionOptions: [] as string[],
      };

      // Delete in reverse order due to foreign key constraints
      for (const step of questionnaire.steps || []) {
        for (const question of step.questions || []) {
          // Delete question options first (hard delete)
          if (question.options && question.options.length > 0) {
            const optionIds = question.options.map((opt) => opt.id);

            await QuestionOption.destroy({
              where: { questionId: question.id },
              transaction,
              force: true,
            });

            deletedIds.questionOptions.push(...optionIds);
          }

          // Then delete the question (hard delete)
          await Question.destroy({
            where: { id: question.id },
            transaction,
            force: true,
          });

          deletedIds.questions.push(question.id);
        }

        // Delete the step (hard delete)
        await QuestionnaireStep.destroy({
          where: { id: step.id },
          transaction,
          force: true,
        });

        deletedIds.steps.push(step.id);
      }

      // Finally delete the questionnaire (hard delete)
      await Questionnaire.destroy({
        where: { id: questionnaireId },
        transaction,
        force: true,
      });

      await transaction.commit();

      console.log("✅ Questionnaire deleted:", deletedIds.questionnaireId);
      console.log("📈 Total Quantities:");
      console.log("  - Total Questionnaires: 1");
      console.log("  - Total Steps:", deletedIds.steps.length);
      console.log("  - Total Questions:", deletedIds.questions.length);
      console.log(
        "  - Total Question Options:",
        deletedIds.questionOptions.length
      );

      return {
        deleted: true,
        questionnaireId,
        deletedIds,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async reorderStep(
    stepId: string,
    direction: "up" | "down",
    userId: string
  ): Promise<QuestionnaireStep[]> {
    // Validate user permissions
    const step = await QuestionnaireStep.findByPk(stepId, {
      include: [
        {
          model: Questionnaire,
          where: { userId },
        },
      ],
    });

    if (!step) {
      throw new Error("Step not found or does not belong to your clinic");
    }

    // Get all steps in the same questionnaire with the same category
    const questionnaire = await Questionnaire.findByPk(step.questionnaireId);
    if (!questionnaire) {
      throw new Error("Questionnaire not found");
    }

    const allSteps = await QuestionnaireStep.findAll({
      where: {
        questionnaireId: questionnaire.id,
        category: step.category, // Only reorder within the same category
      },
      order: [["stepOrder", "ASC"]],
    });

    const currentIndex = allSteps.findIndex((s) => s.id === stepId);
    if (currentIndex === -1) {
      throw new Error("Step not found in questionnaire");
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= allSteps.length) {
      throw new Error(`Cannot move step ${direction}`);
    }

    // Swap step orders
    const currentStep = allSteps[currentIndex];
    const targetStep = allSteps[targetIndex];

    if (!currentStep || !targetStep) {
      throw new Error("Step not found");
    }

    const tempOrder = currentStep.stepOrder;
    currentStep.stepOrder = targetStep.stepOrder;
    targetStep.stepOrder = tempOrder;

    // Update both steps in database
    await QuestionnaireStep.update(
      { stepOrder: currentStep.stepOrder },
      { where: { id: currentStep.id } }
    );

    await QuestionnaireStep.update(
      { stepOrder: targetStep.stepOrder },
      { where: { id: targetStep.id } }
    );

    // Return updated steps
    return await QuestionnaireStep.findAll({
      where: { questionnaireId: questionnaire.id },
      order: [["stepOrder", "ASC"]],
    });
  }

  async createQuestionnaire(userId: string, data: CreateQuestionnaireInput) {
    const { productId } = data;
    // Validate user is admin
    const user = await User.findByPk(userId);
    if (!user || user.role !== "admin") {
      return {
        success: false,
        error: "Only admins can create questionnaires",
      };
    }

    // Validate product if provided
    let product: any = null;
    if (productId) {
      product = await Product.findByPk(productId);
      if (!product) {
        return {
          success: false,
          error: "Product not found",
        };
      }
    }

    // Create questionnaire
    const questionnaire = await Questionnaire.create({
      title: data.title,
      description: data.description || null,
      checkoutStepPosition: data.checkoutStepPosition ?? -1,
      isTemplate: data.isTemplate ?? false,
      userId,
      color: data.color || null,
      productId: productId,
    });

    return {
      success: true,
      message: "Questionnaire created successfully",
      data: {
        questionnaire,
        product,
      },
    };
  }

  async updateQuestionnaire(userId: string, data: UpdateQuestionnaireInput) {
    const { id, productId, ...updateData } = data;

    // Validate user is admin
    const user = await User.findByPk(userId);
    if (!user || user.role !== "admin") {
      return {
        success: false,
        error: "Only admins can update questionnaires",
      };
    }

    // Find the questionnaire
    const questionnaire = await Questionnaire.findByPk(id);
    if (!questionnaire) {
      return {
        success: false,
        error: "Questionnaire not found",
      };
    }

    // Validate product if provided
    let product: any = null;
    if (productId !== undefined) {
      if (productId) {
        product = await Product.findByPk(productId);
        if (!product) {
          return {
            success: false,
            error: "Product not found",
          };
        }
      }
      // Update productId (can be set to null if productId is explicitly null)
      await questionnaire.update({ ...updateData, productId });
    } else {
      // Update without changing productId
      await questionnaire.update(updateData);
    }

    // Reload to get updated data
    await questionnaire.reload();

    // Get product if questionnaire has one
    if (questionnaire.productId) {
      product = await Product.findByPk(questionnaire.productId);
    }

    return {
      success: true,
      message: "Questionnaire updated successfully",
      data: {
        questionnaire,
        product,
      },
    };
  }
}

export default QuestionnaireService;
