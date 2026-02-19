import "reflect-metadata";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import dns from "dns/promises";
import { initializeDatabase } from "./config/database";
import { MedicalCompanySlug } from "@fuse/enums";
import { MailsSender } from "@services/mailsSender";
import Treatment from "@models/Treatment";
import Product from "@models/Product";
import Order from "@models/Order";
import OrderItem from "@models/OrderItem";
import Payment from "@models/Payment";
import ShippingAddress from "@models/ShippingAddress";
import Pharmacy from "@models/Pharmacy";
import PharmacyCoverage from "@models/PharmacyCoverage";
import PharmacyProduct from "@models/PharmacyProduct";
import BrandSubscription, {
  BrandSubscriptionStatus,
} from "@models/BrandSubscription";
import BrandSubscriptionPlans from "@models/BrandSubscriptionPlans";
import TierConfiguration from "@models/TierConfiguration";
import TenantCustomFeatures from "@models/TenantCustomFeatures";
import Subscription from "@models/Subscription";
import {
  authenticateJWT,
  getCurrentUser,
  extractTokenFromHeader,
  verifyJWTToken,
} from "./config/jwt";
import {
  uploadToS3,
  deleteFromS3,
  isValidImageFile,
  isValidFileSize,
} from "./config/s3";
import {
  authLimiter,
  publicLimiter,
  apiLimiter,
  webhookLimiter,
} from "./middleware/rateLimiter";
import Stripe from "stripe";
import OrderService from "@services/order.service";
import UserService from "@services/user.service";
import {
  AuditService,
  AuditAction,
  AuditResourceType,
} from "@services/audit.service";
import TreatmentService from "@services/treatment.service";
import PaymentService from "@services/payment.service";
import ClinicService from "@services/clinic.service";
import { getDefaultCustomWebsiteValues, getDefaultFooterValues, getDefaultSocialMediaValues } from "@utils/customWebsiteDefaults";
import TreatmentProducts from "@models/TreatmentProducts";
import TreatmentPlan, { BillingInterval } from "@models/TreatmentPlan";
import ShippingOrder from "@models/ShippingOrder";
import QuestionnaireService from "@services/questionnaire.service";
import formTemplateService from "@services/formTemplate.service";
import User from "@models/User";
import UserRoles from "@models/UserRoles";
import Clinic from "@models/Clinic";
import { Op } from "sequelize";
import QuestionnaireStepService from "@services/questionnaireStep.service";
import QuestionService from "@services/question.service";
import { StripeService } from "@fuse/stripe";
import {
  clinicUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  treatmentCreateSchema,
  treatmentUpdateSchema,
  treatmentPlanCreateSchema,
  treatmentPlanUpdateSchema,
  createProductSubscriptionSchema,
  treatmentSubscriptionSchema,
  clinicSubscriptionSchema,
  brandPaymentIntentSchema,
  upgradeSubscriptionSchema,
  cancelSubscriptionSchema,
  updateBrandSubscriptionFeaturesSchema,
  questionnaireStepCreateSchema,
  questionnaireStepUpdateSchema,
  questionnaireStepOrderSchema,
  questionCreateSchema,
  questionUpdateSchema,
  questionOrderSchema,
  messageCreateSchema,
  patientUpdateSchema,
  brandTreatmentSchema,
  organizationUpdateSchema,
  listProductsSchema,
} from "@fuse/validators";
import TreatmentPlanService from "@services/treatmentPlan.service";
import SubscriptionService from "@services/subscription.service";
import MDWebhookService from "@services/mdIntegration/MDWebhook.service";
import MDFilesService from "@services/mdIntegration/MDFiles.service";
import PharmacyWebhookService from "@services/pharmacy/webhook";
import BrandSubscriptionService from "@services/brandSubscription.service";
import MessageService from "@services/Message.service";
import ProductService from "@services/product.service";
import TenantProductForm from "@models/TenantProductForm";
import TenantProduct from "@models/TenantProduct";
import FormProducts from "@models/FormProducts";
import GlobalFormStructure from "@models/GlobalFormStructure";
import Program from "@models/Program";
import MedicalCompany from "@models/MedicalCompany";
import Question from "@models/Question";
import QuestionOption from "@models/QuestionOption";
import { assignTemplatesSchema } from "./validators/formTemplates";
import BrandTreatment from "@models/BrandTreatment";
import Questionnaire from "@models/Questionnaire";
import QuestionnaireCustomization from "@models/QuestionnaireCustomization";
import CustomWebsite from "@models/CustomWebsite";
import TenantProductService from "@services/tenantProduct.service";
import QuestionnaireStep from "@models/QuestionnaireStep";
import DoctorPatientChats from "@models/DoctorPatientChats";
import SmsService from "@services/sms.service";
import { sequenceRoutes, webhookRoutes as sequenceWebhookRoutes } from "@endpoints/sequences";
import dashboardRoutes from "@endpoints/dashboard/routes/dashboard.routes";
import { templateRoutes } from "@endpoints/templates";
import { contactRoutes } from "@endpoints/contacts";
import { tagRoutes } from "@endpoints/tags";
import ordersRoutes from "@endpoints/orders/routes/orders.routes";
import payoutsRoutes from "@endpoints/payouts/routes/payouts.routes";
import { tenantRoutes } from "@endpoints/tenant";
import refundsRoutes from "@endpoints/refunds";
import refundRequestsRoutes from "@endpoints/refund-requests";
import { impersonationRoutes } from "@endpoints/impersonation";
import belugaProductsRoutes from "@endpoints/beluga-products";
import RefundRequest from "@models/RefundRequest";
import BelugaProduct from "@models/BelugaProduct";
import { stripeRoutes, webhookRoutes as stripeWebhookRoutes } from "@endpoints/stripe";
import { GlobalFees } from "./models/GlobalFees";
import { WebsiteBuilderConfigs, DEFAULT_FOOTER_DISCLAIMER } from "@models/WebsiteBuilderConfigs";
import {
  buildStatementDescriptor,
  buildStatementDescriptorSuffix,
} from "@utils/statementDescriptor";
import {
  getNonMedicalServicesProfitPercent,
  getPlatformFeePercent,
  useGlobalFees,
} from "@utils/useGlobalFees";

// Helper function to fetch global fees from database
async function getGlobalFees() {
  const globalFees = await GlobalFees.findOne();
  if (!globalFees) {
    throw new Error("Global fees configuration not found in database");
  }
  return {
    platformFeePercent: Number(globalFees.fuseTransactionFeePercent),
    stripeFeePercent: Number(globalFees.stripeTransactionFeePercent),
    doctorFlatFeeUsd: Number(globalFees.fuseTransactionDoctorFeeUsd),
  };
}

// Helper function to generate unique clinic slug
async function generateUniqueSlug(
  clinicName: string,
  excludeId?: string
): Promise<string> {
  // Generate base slug from clinic name
  const baseSlug = clinicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check if base slug is available
  const whereClause: any = { slug: baseSlug };
  if (excludeId) {
    whereClause.id = { [require("sequelize").Op.ne]: excludeId };
  }

  const existingClinic = await Clinic.findOne({ where: whereClause });

  if (!existingClinic) {
    return baseSlug;
  }

  // If base slug exists, try incremental numbers
  let counter = 1;
  while (true) {
    const slugWithNumber = `${baseSlug}-${counter}`;
    const whereClauseWithNumber: any = { slug: slugWithNumber };
    if (excludeId) {
      whereClauseWithNumber.id = { [require("sequelize").Op.ne]: excludeId };
    }

    const existingWithNumber = await Clinic.findOne({
      where: whereClauseWithNumber,
    });

    if (!existingWithNumber) {
      return slugWithNumber;
    }

    counter++;
  }
}

// HIPAA Compliance Note: TLS certificate validation is enabled globally.
// Database SSL uses relaxed validation (rejectUnauthorized: false) because
// AWS RDS certificates aren't in Node's default CA store.
// All other HTTPS connections (Stripe, SendGrid, etc.) use full TLS validation.

const app = express();

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY environment variable is not set");
  // SECURITY: Do not log available env variables
} else {
  if (process.env.NODE_ENV === "development") {
    console.log("✅ Stripe secret key found, initializing...");
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

// Validate APP_WEBHOOK_SECRET
if (!process.env.APP_WEBHOOK_SECRET) {
  console.error("❌ APP_WEBHOOK_SECRET environment variable is not set");
  process.exit(1);
}

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (isValidImageFile(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, WebP images, and PDF files are allowed."
        )
      );
    }
  },
});

// HIPAA-compliant CORS configuration with explicit origin whitelisting
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) return callback(null, true);

      // SECURITY: Strict CORS configuration - no hardcoded IPs in production
      const allowedOrigins =
        process.env.NODE_ENV === "production"
          ? [
            process.env.FRONTEND_URL,
            // Add additional production domains via environment variables only
            process.env.ADDITIONAL_ALLOWED_ORIGINS?.split(",").map((o) =>
              o.trim()
            ),
          ]
            .flat()
            .filter(Boolean)
          : [
            "http://localhost:3000",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:3005",
            "http://localhost:3030",
            // Development only - no production domains
          ];

      // SECURITY: Validate all origins are HTTPS in production
      if (process.env.NODE_ENV === "production") {
        const insecureOrigins = allowedOrigins.filter(
          (origin) =>
            typeof origin === "string" && !origin.startsWith("https://")
        );
        if (insecureOrigins.length > 0) {
          console.error(
            "❌ CRITICAL: HTTP origins not allowed in production:",
            insecureOrigins
          );
          throw new Error("All production origins must use HTTPS");
        }
      }
      // Check if origin is in allowed list or matches patterns
      const isAllowed =
        allowedOrigins.includes(origin) ||
        // Allow clinic subdomains in development (e.g., g-health.localhost:3000, saboia.xyz.localhost:3000)
        (process.env.NODE_ENV === "development" &&
          /^http:\/\/[a-zA-Z0-9.-]+\.localhost:3000$/.test(origin)) ||
        // Allow affiliate portal subdomains in development (e.g., limitless.localhost:3005)
        (process.env.NODE_ENV === "development" &&
          /^http:\/\/[a-zA-Z0-9.-]+\.localhost:3005$/.test(origin)) ||
        // Allow admin portal subdomains in development (e.g., limitless.localhost:3002)
        (process.env.NODE_ENV === "development" &&
          /^http:\/\/[a-zA-Z0-9.-]+\.localhost:3002$/.test(origin)) ||
        // Allow production clinic domains (e.g., app.limitless.health, app.hims.com)
        (process.env.NODE_ENV === "production" &&
          /^https:\/\/app\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(origin)) ||
        // Allow fuse.health root domain and any subdomain (e.g., https://limitless.fuse.health)
        (process.env.NODE_ENV === "production" &&
          /^https:\/\/([a-zA-Z0-9-]+\.)*fuse\.health$/.test(origin)) ||
        // Allow any origin containing fusehealth.com (e.g., https://app.fusehealth.com, https://doctor.fusehealth.com)
        origin.includes("fusehealth.com") ||
        // Allow fusehealthstaging.xyz and all its subdomains (e.g., fusehealthstaging.xyz, backend.fusehealthstaging.xyz, admin.checkhealth.fusehealthstaging.xyz)
        /^https:\/\/([a-zA-Z0-9-]+\.)*fusehealthstaging\.xyz$/.test(origin) ||
        // Allow all subdomains of unboundedhealth.xyz (legacy support)
        /^https:\/\/[a-zA-Z0-9-]+\.unboundedhealth\.xyz$/.test(origin);

      if (isAllowed) {
        if (process.env.NODE_ENV === "development") {
          console.log(`✅ CORS allowed origin: ${origin}`);
        }
        callback(null, true);
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log(`❌ CORS blocked origin: ${origin}`);
        }
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Essential for cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Portal-Context"],
    exposedHeaders: ["Set-Cookie"],
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false, // disable if frontend loads remote assets
  })
);

app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  })
);

app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: "deny" }));
app.use(helmet.referrerPolicy({ policy: "no-referrer" }));

app.disable("x-powered-by");

// Apply rate limiting to public endpoints (100 req/15min)
app.use("/public", publicLimiter);

// Apply rate limiting to webhook endpoints (1000 req/15min)
app.use("/webhook", webhookLimiter);
app.use("/md/webhooks", webhookLimiter);

// Apply general API rate limiting to authenticated endpoints (150 req/15min)
// This applies to all routes except those with specific limiters (auth, public, webhooks)
app.use((req, res, next) => {
  // Skip rate limiting for:
  // - Public endpoints (already limited)
  // - Webhooks (already limited)
  // - Auth endpoints (have stricter limits)
  if (
    req.path.startsWith("/public") ||
    req.path.startsWith("/webhook") ||
    req.path.startsWith("/md/webhooks") ||
    req.path.startsWith("/auth/")
  ) {
    return next();
  }
  // Apply API limiter to all other routes
  return apiLimiter(req, res, next);
});

// Conditional JSON parsing - exclude webhook paths that need raw body
app.use((req, res, next) => {
  if (
    req.path.startsWith("/webhook/stripe") ||
    req.path.startsWith("/md/webhooks")
  ) {
    next(); // Skip JSON parsing for webhook endpoints that need raw body
  } else {
    express.json()(req, res, next); // Apply JSON parsing for all other routes
  }
});

// Register refactored routes
app.use("/", sequenceRoutes);
app.use("/", sequenceWebhookRoutes);
app.use("/", templateRoutes);
app.use("/", contactRoutes);
app.use("/", tagRoutes);
app.use("/", ordersRoutes);
app.use("/", dashboardRoutes);
app.use("/", stripeRoutes);
app.use("/", stripeWebhookRoutes);
app.use("/", payoutsRoutes);
app.use("/", tenantRoutes);
app.use("/", refundsRoutes);
app.use("/", refundRequestsRoutes);
app.use("/", impersonationRoutes);
// Clone 'doctor' steps from master_template into a target questionnaire (preserve order)
app.post(
  "/questionnaires/clone-doctor-from-master",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { questionnaireId } = req.body || {};
      if (!questionnaireId || typeof questionnaireId !== "string") {
        return res
          .status(400)
          .json({ success: false, message: "questionnaireId is required" });
      }

      // Find target questionnaire
      const target = await Questionnaire.findByPk(questionnaireId, {
        include: [{ model: QuestionnaireStep, as: "steps" }],
      });
      if (!target) {
        return res
          .status(404)
          .json({ success: false, message: "Target questionnaire not found" });
      }

      // If target already has doctor steps, do nothing
      const hasDoctorSteps = (target as any).steps?.some(
        (s: any) => s.category === "doctor"
      );
      if (hasDoctorSteps) {
        return res
          .status(200)
          .json({ success: true, message: "Doctor steps already present" });
      }

      // Find master template (must be exactly one)
      const masters = await Questionnaire.findAll({
        where: { formTemplateType: "master_template" },
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
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
      });

      if (masters.length !== 1) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "There should be 1 and only 1 master_template questionnaire",
          });
      }

      const master = masters[0] as any;
      const doctorSteps = (master.steps || []).filter(
        (s: any) => s.category === "doctor"
      );
      if (doctorSteps.length === 0) {
        return res
          .status(200)
          .json({
            success: true,
            message: "No doctor steps found in master_template",
          });
      }

      // Determine offset to preserve order without collisions
      const existingMaxOrder = ((target as any).steps || []).reduce(
        (max: number, s: any) => Math.max(max, s.stepOrder ?? 0),
        -1
      );
      const baseOffset = isFinite(existingMaxOrder) ? existingMaxOrder + 1 : 0;

      // Clone steps, questions, options
      for (const step of doctorSteps) {
        const clonedStep = await QuestionnaireStep.create({
          title: step.title,
          description: step.description,
          category: step.category,
          stepOrder: (step.stepOrder ?? 0) + baseOffset,
          questionnaireId: target.id,
        });

        for (const question of step.questions || []) {
          const clonedQuestion = await Question.create({
            questionText: question.questionText,
            answerType: question.answerType,
            questionSubtype: (question as any).questionSubtype,
            isRequired: question.isRequired,
            questionOrder: question.questionOrder,
            subQuestionOrder: (question as any).subQuestionOrder,
            conditionalLevel: (question as any).conditionalLevel,
            placeholder: question.placeholder,
            helpText: question.helpText,
            footerNote: (question as any).footerNote,
            conditionalLogic: (question as any).conditionalLogic,
            stepId: clonedStep.id,
          });

          if (question.options?.length) {
            await QuestionOption.bulkCreate(
              question.options.map((opt: any) => ({
                optionText: opt.optionText,
                optionValue: opt.optionValue,
                optionOrder: opt.optionOrder,
                questionId: clonedQuestion.id,
              }))
            );
          }
        }
      }

      // Return updated questionnaire
      const updated = await Questionnaire.findByPk(target.id, {
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
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
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error(
          "❌ Error cloning doctor steps from master_template:",
          error
        );
      } else {
        console.error("❌ Error cloning doctor steps from master_template:");
      }
      return res
        .status(500)
        .json({ success: false, message: "Failed to clone doctor steps" });
    }
  }
);

// Reset questionnaire steps to doctor steps from master_template (delete all, then clone doctor)
app.post(
  "/questionnaires/reset-doctor-from-master",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { questionnaireId } = req.body || {};
      if (!questionnaireId || typeof questionnaireId !== "string") {
        return res
          .status(400)
          .json({ success: false, message: "questionnaireId is required" });
      }

      // Find all steps with questions/options for this questionnaire
      const steps = await QuestionnaireStep.findAll({
        where: { questionnaireId },
        include: [
          {
            model: Question,
            as: "questions",
            include: [{ model: QuestionOption, as: "options" }],
          },
        ],
      });

      // Delete options, questions, then steps
      for (const step of steps) {
        for (const q of (step as any).questions || []) {
          if (q.options?.length) {
            await QuestionOption.destroy({ where: { questionId: q.id } });
          }
          await Question.destroy({ where: { id: q.id } });
        }
        await QuestionnaireStep.destroy({ where: { id: step.id } });
      }

      // Reuse clone logic by calling previous handler logic inline
      // Find master template
      const masters = await Questionnaire.findAll({
        where: { formTemplateType: "master_template" },
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
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
      });

      if (masters.length !== 1) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "There should be 1 and only 1 master_template questionnaire",
          });
      }

      const master = masters[0] as any;
      const doctorSteps = (master.steps || []).filter(
        (s: any) => s.category === "doctor"
      );

      for (const step of doctorSteps) {
        const clonedStep = await QuestionnaireStep.create({
          title: step.title,
          description: step.description,
          category: step.category,
          stepOrder: step.stepOrder,
          questionnaireId,
        });

        for (const question of step.questions || []) {
          const clonedQuestion = await Question.create({
            questionText: question.questionText,
            answerType: question.answerType,
            questionSubtype: (question as any).questionSubtype,
            isRequired: question.isRequired,
            questionOrder: question.questionOrder,
            subQuestionOrder: (question as any).subQuestionOrder,
            conditionalLevel: (question as any).conditionalLevel,
            placeholder: question.placeholder,
            helpText: question.helpText,
            footerNote: (question as any).footerNote,
            conditionalLogic: (question as any).conditionalLogic,
            stepId: clonedStep.id,
          });

          if (question.options?.length) {
            await QuestionOption.bulkCreate(
              question.options.map((opt: any) => ({
                optionText: opt.optionText,
                optionValue: opt.optionValue,
                optionOrder: opt.optionOrder,
                questionId: clonedQuestion.id,
              }))
            );
          }
        }
      }

      const updated = await Questionnaire.findByPk(questionnaireId, {
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
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
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error resetting and cloning doctor steps:", error);
      } else {
        console.error("❌ Error resetting and cloning doctor steps");
      }
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to reset and clone doctor steps",
        });
    }
  }
);
// No session middleware needed for JWT

// Health check endpoint
app.get("/healthz", (_req, res) => res.status(200).send("ok"));





// ========================================
// Doctor Applications Management Endpoints
// ========================================

// Verify NPI number using NPPES API
app.get("/admin/verify-npi/:npi", authenticateJWT, async (req, res) => {
  try {
    const currentUser = (req as any).user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Load full user with roles
    const user = await User.findByPk(currentUser.userId, {
      include: [{ model: UserRoles, as: "userRoles" }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only admin, superAdmin, or brand can verify NPIs
    if (!user.hasAnyRoleSync(["admin", "superAdmin", "brand"])) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { npi } = req.params;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return res.status(400).json({
        success: false,
        message: "Invalid NPI format. Must be 10 digits",
        isValid: false,
      });
    }

    // Call NPPES API to verify NPI
    try {
      const nppesUrl = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npi}`;
      const nppesResponse = await fetch(nppesUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      if (!nppesResponse.ok) {
        return res.status(200).json({
          success: true,
          isValid: false,
          message: "Unable to verify NPI at this time",
        });
      }

      const nppesData = await nppesResponse.json() as any;

      // Check if NPI exists in the registry
      const isValid = nppesData.result_count > 0 && nppesData.results && nppesData.results.length > 0;

      if (isValid) {
        const provider = nppesData.results[0] as any;
        const basicInfo = provider.basic || {};
        const addresses = provider.addresses || [];
        const taxonomies = provider.taxonomies || [];

        return res.status(200).json({
          success: true,
          isValid: true,
          message: "NPI is valid",
          providerInfo: {
            name: basicInfo.organization_name ||
              `${basicInfo.first_name || ""} ${basicInfo.last_name || ""}`.trim() ||
              "N/A",
            credential: basicInfo.credential || "N/A",
            primaryTaxonomy: taxonomies.find((t: any) => t.primary)?.desc || "N/A",
            primaryLocation: addresses.find((a: any) => a.address_purpose === "LOCATION")?.city || "N/A",
            state: basicInfo.state || "N/A",
          },
        });
      } else {
        return res.status(200).json({
          success: true,
          isValid: false,
          message: "NPI not found in NPPES registry",
        });
      }
    } catch (error) {
      // If NPPES API fails, return unknown status
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error verifying NPI:", error);
      }
      return res.status(200).json({
        success: true,
        isValid: false,
        message: "Unable to verify NPI at this time",
        error: "NPPES API unavailable",
      });
    }
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error in NPI verification:", error);
    } else {
      console.error("❌ Error in NPI verification");
    }
    res.status(500).json({
      success: false,
      message: "Failed to verify NPI",
    });
  }
});

// Get all pending doctor applications
app.get("/admin/doctor-applications", authenticateJWT, async (req, res) => {
  try {
    const currentUser = (req as any).user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Load full user with roles
    const user = await User.findByPk(currentUser.userId, {
      include: [{ model: UserRoles, as: "userRoles" }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only admin, superAdmin, or brand can access doctor applications
    if (!user.hasAnyRoleSync(["admin", "superAdmin", "brand"])) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Only admins or brand users can view doctor applications",
      });
    }

    // Get all users with doctor role who are not approved yet
    const doctorApplications = await User.findAll({
      where: {
        role: "doctor",
        isApprovedDoctor: false,
      },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "phoneNumber",
        "npiNumber",
        "doctorLicenseStatesCoverage",
        "createdAt",
        "activated",
        "website",
        "businessType",
        "city",
        "state",
        "isApprovedDoctor",
      ],
      order: [["createdAt", "DESC"]],
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`📋 Found ${doctorApplications.length} pending doctor applications`);
    }

    res.status(200).json({
      success: true,
      data: doctorApplications,
      count: doctorApplications.length,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching doctor applications:", error);
    } else {
      console.error("❌ Error fetching doctor applications");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch doctor applications",
    });
  }
});

// Get all approved doctors
app.get("/admin/approved-doctors", authenticateJWT, async (req, res) => {
  try {
    const currentUser = (req as any).user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Load full user with roles
    const user = await User.findByPk(currentUser.userId, {
      include: [{ model: UserRoles, as: "userRoles" }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only admin, superAdmin, or brand can access approved doctors
    if (!user.hasAnyRoleSync(["admin", "superAdmin", "brand"])) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Only admins or brand users can view approved doctors",
      });
    }

    // Get all users with doctor role who are approved
    const approvedDoctors = await User.findAll({
      where: {
        role: "doctor",
        isApprovedDoctor: true,
      },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "phoneNumber",
        "npiNumber",
        "doctorLicenseStatesCoverage",
        "createdAt",
        "activated",
        "website",
        "businessType",
        "city",
        "state",
        "isApprovedDoctor",
      ],
      order: [["createdAt", "DESC"]],
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`✅ Found ${approvedDoctors.length} approved doctors`);
    }

    res.status(200).json({
      success: true,
      data: approvedDoctors,
      count: approvedDoctors.length,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching approved doctors:", error);
    } else {
      console.error("❌ Error fetching approved doctors");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch approved doctors",
    });
  }
});

// Approve a doctor application
app.post(
  "/admin/doctor-applications/:userId/approve",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const { userId } = req.params;

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Load full user with roles
      const adminUser = await User.findByPk(currentUser.userId, {
        include: [{ model: UserRoles, as: "userRoles" }],
      });

      if (!adminUser) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Only admin, superAdmin, or brand can approve doctors
      if (!adminUser.hasAnyRoleSync(["admin", "superAdmin", "brand"])) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: Only admins or brand users can approve doctor applications",
        });
      }

      // Find the doctor to approve
      const doctor = await User.findByPk(userId);

      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found",
        });
      }

      // Verify the user is actually a doctor
      if (doctor.role !== "doctor") {
        return res.status(400).json({
          success: false,
          message: "User is not a doctor",
        });
      }

      // Check if already approved
      if (doctor.isApprovedDoctor) {
        return res.status(400).json({
          success: false,
          message: "Doctor is already approved",
        });
      }

      // Approve the doctor
      doctor.isApprovedDoctor = true;
      await doctor.save();

      if (process.env.NODE_ENV === "development") {
        console.log(`✅ Doctor ${doctor.id} approved by admin ${adminUser.id}`);
      }

      // Send approval email to the doctor
      const emailSent = await MailsSender.sendDoctorApprovedEmail(
        doctor.email,
        doctor.firstName
      );

      if (emailSent) {
        console.log("📧 Doctor approval email sent successfully");
      } else {
        console.log("❌ Failed to send doctor approval email, but doctor was approved");
      }

      // HIPAA Audit: Log doctor approval
      await AuditService.log({
        userId: adminUser.id,
        userEmail: adminUser.email,
        action: AuditAction.UPDATE,
        resourceType: AuditResourceType.USER,
        resourceId: doctor.id,
        ipAddress: AuditService.getClientIp(req),
        details: {
          action: "doctor_approved",
          approvedBy: adminUser.id,
          doctorEmail: doctor.email,
        },
        success: true,
      });

      res.status(200).json({
        success: true,
        message: "Doctor application approved successfully",
        emailSent,
        doctor: {
          id: doctor.id,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          email: doctor.email,
          isApprovedDoctor: doctor.isApprovedDoctor,
        },
      });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error approving doctor application:", error);
      } else {
        console.error("❌ Error approving doctor application");
      }
      res.status(500).json({
        success: false,
        message: "Failed to approve doctor application",
      });
    }
  }
);

// In-memory store for email verification codes
// Format: { email: { code: string, expiresAt: number, firstName?: string } }
const verificationCodes = new Map<
  string,
  { code: string; expiresAt: number; firstName?: string }
>();

// In-memory store for password reset codes
// Format: { email: { code: string, expiresAt: number, firstName?: string, verified: boolean } }
const passwordResetCodes = new Map<
  string,
  { code: string; expiresAt: number; firstName?: string; verified: boolean }
>();

// Clean up expired codes every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [email, data] of verificationCodes.entries()) {
      if (data.expiresAt < now) {
        verificationCodes.delete(email);
      }
    }
    for (const [email, data] of passwordResetCodes.entries()) {
      if (data.expiresAt < now) {
        passwordResetCodes.delete(email);
      }
    }
  },
  5 * 60 * 1000
);


// Clinic routes
// Public endpoint to get clinic by slug (for subdomain routing)
app.get("/clinic/by-slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const clinic = await Clinic.findOne({
      where: { slug },
      attributes: ["id", "name", "slug", "logo", "defaultFormColor", "patientPortalDashboardFormat"], // Only return public fields
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Find the brand owner of this clinic for analytics tracking
    const brandOwner = await User.findOne({
      where: {
        clinicId: clinic.id,
        role: "brand",
      },
      attributes: ["id"], // Only need the ID for analytics
    });

    const clinicData = clinic.toJSON();

    // Normalize patientPortalDashboardFormat to ensure it's always a string value
    const dashboardFormat = clinicData.patientPortalDashboardFormat;
    const normalizedFormat = dashboardFormat === MedicalCompanySlug.MD_INTEGRATIONS || dashboardFormat === 'MD_INTEGRATIONS'
      ? MedicalCompanySlug.MD_INTEGRATIONS
      : MedicalCompanySlug.FUSE;

    if (process.env.NODE_ENV === 'development') {
      console.log('[CLINIC] GET /clinic/by-slug/:slug response:', {
        slug: slug,
        clinicId: clinic.id,
        clinicName: clinic.name,
        rawFormat: dashboardFormat,
        normalizedFormat: normalizedFormat,
        willRedirectTo: normalizedFormat === MedicalCompanySlug.MD_INTEGRATIONS ? '/mdi-dashboard?tab=messages' : '/fuse-dashboard',
      });
    }

    res.json({
      success: true,
      data: {
        ...clinicData,
        patientPortalDashboardFormat: normalizedFormat,
        userId: brandOwner?.id || null, // Add userId for analytics tracking
      },
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching clinic by slug:", error);
    } else {
      console.error("❌ Error fetching clinic by slug");
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Public: allow custom domain (placed before /clinic/:id to avoid param route capture)
// This endpoint is called by Caddy's on_demand_tls "ask" feature to validate domains before issuing certs
app.get("/clinic/allow-custom-domain", async (req, res) => {
  try {
    const domainParam = (req.query as any).domain as string | undefined;
    if (!domainParam) {
      return res.status(400).send("domain required");
    }

    // Normalize to hostname
    let baseDomain = domainParam;
    try {
      const url = new URL(
        domainParam.startsWith("http") ? domainParam : `https://${domainParam}`
      );
      baseDomain = url.hostname;
    } catch {
      baseDomain = domainParam.split("/")[0].split("?")[0];
    }

    // 1. Check for custom vanity domain (e.g., myclinic.com)
    const customDomainClinic = await Clinic.findOne({
      where: { customDomain: baseDomain, isCustomDomain: true },
      attributes: ["id"],
    });

    if (customDomainClinic) {
      console.log(`✅ [allow-custom-domain] Allowing custom domain: ${baseDomain}`);
      return res.status(200).send("ok");
    }

    // 2. Check for valid subdomain patterns on our platform domains
    const platformDomains = ['.fusehealth.com', '.fuse.health', '.fusehealthstaging.xyz'];

    for (const platformDomain of platformDomains) {
      if (baseDomain.endsWith(platformDomain)) {
        const withoutPlatform = baseDomain.slice(0, -platformDomain.length);
        const parts = withoutPlatform.split('.');

        // Handle single-part subdomain: <brand>.fusehealth.com
        if (parts.length === 1) {
          const brandSlug = parts[0];

          // Check if clinic exists with this slug
          const brandClinic = await Clinic.findOne({
            where: { slug: brandSlug },
            attributes: ["id"],
          });

          if (brandClinic) {
            console.log(`✅ [allow-custom-domain] Allowing brand subdomain: ${baseDomain}`);
            return res.status(200).send("ok");
          }
        }

        // Handle 2-part subdomains: <affiliate>.<brand> or admin.<brand>
        if (parts.length === 2) {
          const [firstPart, brandSlug] = parts;

          // Find the brand clinic
          const brandClinic = await Clinic.findOne({
            where: { slug: brandSlug, affiliateOwnerClinicId: null }, // Must be a brand, not an affiliate
            attributes: ["id"],
          });

          if (brandClinic) {
            // Allow admin.<brand> for affiliate portal
            if (firstPart === 'admin') {
              console.log(`✅ [allow-custom-domain] Allowing admin portal: ${baseDomain}`);
              return res.status(200).send("ok");
            }

            // Check if affiliate exists under this brand
            const affiliateClinic = await Clinic.findOne({
              where: {
                slug: firstPart,
                affiliateOwnerClinicId: brandClinic.id
              },
              attributes: ["id"],
            });

            if (affiliateClinic) {
              console.log(`✅ [allow-custom-domain] Allowing affiliate subdomain: ${baseDomain}`);
              return res.status(200).send("ok");
            }
          }
        }

        // For this platform domain, we checked and it didn't match - don't allow
        // console.log(`❌ [allow-custom-domain] Rejecting invalid subdomain: ${baseDomain}`);
        return res.status(404).send("not allowed");
      }
    }

    // Not a platform domain and not a custom domain - reject
    //console.log(`❌ [allow-custom-domain] Rejecting unknown domain: ${baseDomain}`);
    return res.status(404).send("not allowed");
  } catch (error) {
    console.error("❌ Error in /clinic/allow-custom-domain:", error);
    return res.status(500).send("error");
  }
});

app.get("/clinic/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow users to access their own clinic data (doctors and patients)
    if (user.clinicId !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const clinic = await Clinic.findByPk(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Normalize patientPortalDashboardFormat to ensure it's always a string value
    const dashboardFormat = (clinic as any).patientPortalDashboardFormat;
    const normalizedFormat = dashboardFormat === MedicalCompanySlug.MD_INTEGRATIONS || dashboardFormat === 'MD_INTEGRATIONS'
      ? MedicalCompanySlug.MD_INTEGRATIONS
      : MedicalCompanySlug.FUSE;

    if (process.env.NODE_ENV === 'development') {
      console.log('[CLINIC] GET /clinic/:id response:', {
        clinicId: clinic.id,
        clinicName: clinic.name,
        rawFormat: dashboardFormat,
        normalizedFormat: normalizedFormat,
        willRedirectTo: normalizedFormat === MedicalCompanySlug.MD_INTEGRATIONS ? '/mdi-dashboard?tab=messages' : '/fuse-dashboard',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
        customDomain: (clinic as any).customDomain,
        isCustomDomain: (clinic as any).isCustomDomain,
        patientPortalDashboardFormat: normalizedFormat,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching clinic data:", error);
    } else {
      console.error("❌ Error fetching clinic data");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic data",
    });
  }
});

app.put("/clinic/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using clinicUpdateSchema
    const validation = clinicUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { name, logo } = validation.data;

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow doctors and brand users to update clinic data, and only their own clinic
    if (!user.hasAnyRoleSync(["doctor", "brand"]) || user.clinicId !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Clinic name is required",
      });
    }

    const clinic = await Clinic.findByPk(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Generate new slug if name changed
    let newSlug = clinic.slug;
    if (name.trim() !== clinic.name) {
      newSlug = await generateUniqueSlug(name.trim(), clinic.id);
      if (process.env.NODE_ENV === "development") {
        console.log("🏷️ Generated new slug:", newSlug);
      }
    }

    // Update clinic data
    await clinic.update({
      name: name.trim(),
      slug: newSlug,
      logo: logo?.trim() || "",
    });

    if (process.env.NODE_ENV === "development") {
      console.log("🏥 Clinic updated:", {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
      });
    }

    res.status(200).json({
      success: true,
      message: "Clinic updated successfully",
      data: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating clinic data:", error);
    } else {
      console.error("❌ Error updating clinic data");
    }
    res.status(500).json({
      success: false,
      message: "Failed to update clinic data",
    });
  }
});

// Clinic logo upload endpoint
app.post(
  "/clinic/:id/upload-logo",
  authenticateJWT,
  upload.single("logo"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Fetch full user data from database to get clinicId
      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Only allow doctors and brand users to upload logos for their own clinic
      if (!user.hasAnyRoleSync(["doctor", "brand"]) || user.clinicId !== id) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      // Validate file size (additional check)
      if (!isValidFileSize(req.file.size)) {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 5MB.",
        });
      }

      const clinic = await Clinic.findByPk(id);
      if (!clinic) {
        return res.status(404).json({
          success: false,
          message: "Clinic not found",
        });
      }

      // Delete old logo from S3 if it exists
      if (clinic.logo && clinic.logo.trim() !== "") {
        try {
          await deleteFromS3(clinic.logo);
          console.log("🗑️ Old logo deleted from S3");
        } catch (error) {
          // HIPAA: Do not log detailed errors in production
          if (process.env.NODE_ENV === "development") {
            console.error(
              "❌ Warning: Failed to delete old logo from S3:",
              error
            );
          } else {
            console.error("❌ Warning: Failed to delete old logo from S3");
          }
          // Don't fail the entire request if deletion fails
        }
      }

      // Upload new logo to S3
      const logoUrl = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Update clinic with new logo URL
      await clinic.update({ logo: logoUrl });

      console.log("🏥 Logo uploaded for clinic:", { id: clinic.id, logoUrl });

      res.status(200).json({
        success: true,
        message: "Logo uploaded successfully",
        data: {
          id: clinic.id,
          name: clinic.name,
          slug: clinic.slug,
          logo: clinic.logo,
        },
      });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error uploading logo:", error);
      } else {
        console.error("❌ Error uploading logo");
      }
      res.status(500).json({
        success: false,
        message: "Failed to upload logo",
      });
    }
  }
);

// ==========================================
// Custom Website Portal Routes
// ==========================================

// Get custom website settings for the authenticated user's clinic
app.get("/custom-website", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    let customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    // If no custom website exists, return default values
    if (!customWebsite) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: customWebsite
    });
  } catch (error) {
    console.error('Error fetching custom website:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch custom website settings"
    });
  }
});

// Create or update custom website settings
app.post("/custom-website", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }]
    });
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    // Only allow brand users to modify portal settings
    if (!user.hasAnyRoleSync(['brand', 'doctor', 'admin', 'superAdmin'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const {
      portalTitle,
      portalDescription,
      primaryColor,
      fontFamily,
      logo,
      heroImageUrl,
      heroTitle,
      heroSubtitle,
      isActive,
      footerColor,
      footerCategories,
      section1,
      section2,
      section3,
      section4,
      socialMediaSection,
      useDefaultDisclaimer,
      footerDisclaimer,
      socialMediaLinks
    } = req.body;

    let customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (customWebsite) {
      // Update existing
      await customWebsite.update({
        portalTitle,
        portalDescription,
        primaryColor,
        fontFamily,
        logo,
        heroImageUrl,
        heroTitle,
        heroSubtitle,
        isActive: isActive !== undefined ? isActive : customWebsite.isActive,
        footerColor,
        footerCategories: footerCategories !== undefined ? footerCategories : customWebsite.footerCategories,
        section1: section1 !== undefined ? section1 : customWebsite.section1,
        section2: section2 !== undefined ? section2 : customWebsite.section2,
        section3: section3 !== undefined ? section3 : customWebsite.section3,
        section4: section4 !== undefined ? section4 : customWebsite.section4,
        socialMediaSection: socialMediaSection !== undefined ? socialMediaSection : customWebsite.socialMediaSection,
        useDefaultDisclaimer: useDefaultDisclaimer !== undefined ? useDefaultDisclaimer : customWebsite.useDefaultDisclaimer,
        footerDisclaimer: footerDisclaimer !== undefined ? footerDisclaimer : customWebsite.footerDisclaimer,
        socialMediaLinks: socialMediaLinks !== undefined ? socialMediaLinks : customWebsite.socialMediaLinks
      });
    } else {
      // Create new
      customWebsite = await CustomWebsite.create({
        clinicId: user.clinicId,
        portalTitle,
        portalDescription,
        primaryColor,
        fontFamily,
        logo,
        heroImageUrl,
        heroTitle,
        heroSubtitle,
        isActive: isActive !== undefined ? isActive : true,
        footerColor,
        footerCategories,
        section1: section1 ?? 'NAVIGATION',
        section2: section2 ?? 'SECTION 2',
        section3: section3 ?? 'SECTION 3',
        section4: section4 ?? 'SECTION 4',
        socialMediaSection: socialMediaSection ?? 'SOCIAL MEDIA',
        useDefaultDisclaimer: useDefaultDisclaimer ?? true,
        footerDisclaimer: footerDisclaimer ?? null,
        socialMediaLinks: socialMediaLinks ?? {
          instagram: { enabled: true, url: '' },
          facebook: { enabled: true, url: '' },
          twitter: { enabled: true, url: '' },
          tiktok: { enabled: true, url: '' },
          youtube: { enabled: true, url: '' }
        }
      });
    }

    console.log('🌐 Custom website settings saved for clinic:', user.clinicId);

    res.status(200).json({
      success: true,
      message: "Portal settings saved successfully",
      data: customWebsite
    });
  } catch (error) {
    console.error('Error saving custom website:', error);
    res.status(500).json({
      success: false,
      message: "Failed to save portal settings"
    });
  }
});

// Toggle custom website active status
app.post("/custom-website/toggle-active", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }]
    });
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    // Only allow brand users to toggle portal status
    if (!user.hasAnyRoleSync(['brand', 'doctor', 'admin', 'superAdmin'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean"
      });
    }

    let customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (customWebsite) {
      await customWebsite.update({ isActive });
    } else {
      // Create a new custom website with default values and the specified isActive state
      customWebsite = await CustomWebsite.create({
        ...getDefaultCustomWebsiteValues(user.clinicId),
        isActive
      });
    }

    console.log(`🌐 Custom website ${isActive ? 'activated' : 'deactivated'} for clinic:`, user.clinicId);

    res.status(200).json({
      success: true,
      message: `Portal ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: customWebsite
    });
  } catch (error) {
    console.error('Error toggling custom website status:', error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle portal status"
    });
  }
});

// Reset footer section to defaults
app.post("/custom-website/reset-footer", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }]
    });
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    // Only allow brand users to modify portal settings
    if (!user.hasAnyRoleSync(['brand', 'doctor', 'admin', 'superAdmin'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (!customWebsite) {
      return res.status(404).json({
        success: false,
        message: "Custom website not found"
      });
    }

    // Reset footer section to defaults
    const defaultFooterValues = getDefaultFooterValues();
    await customWebsite.update(defaultFooterValues);

    console.log('🔄 Footer section reset to defaults for clinic:', user.clinicId);

    res.status(200).json({
      success: true,
      message: "Footer section reset to defaults successfully",
      data: customWebsite
    });
  } catch (error) {
    console.error('Error resetting footer section:', error);
    res.status(500).json({
      success: false,
      message: "Failed to reset footer section"
    });
  }
});

// Reset social media section to defaults
app.post("/custom-website/reset-social-media", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }]
    });
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    // Only allow brand users to modify portal settings
    if (!user.hasAnyRoleSync(['brand', 'doctor', 'admin', 'superAdmin'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (!customWebsite) {
      return res.status(404).json({
        success: false,
        message: "Custom website not found"
      });
    }

    // Reset social media section to defaults
    const defaultSocialMediaValues = getDefaultSocialMediaValues();
    await customWebsite.update(defaultSocialMediaValues);

    console.log('🔄 Social media section reset to defaults for clinic:', user.clinicId);

    res.status(200).json({
      success: true,
      message: "Social media section reset to defaults successfully",
      data: customWebsite
    });
  } catch (error) {
    console.error('Error resetting social media section:', error);
    res.status(500).json({
      success: false,
      message: "Failed to reset social media section"
    });
  }
});

// Upload portal logo to S3
app.post("/custom-website/upload-logo", authenticateJWT, upload.single('logo'), async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }]
    });
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    // Only allow brand, doctor, or affiliate users to upload portal images
    if (!user.hasAnyRoleSync(['brand', 'doctor', 'affiliate', 'admin', 'superAdmin'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    if (!isValidFileSize(req.file.size)) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB."
      });
    }

    // Get existing custom website to delete old logo if exists
    const customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (customWebsite?.logo) {
      try {
        await deleteFromS3(customWebsite.logo);
        console.log('🗑️ Old portal logo deleted from S3');
      } catch (error) {
        console.error('Warning: Failed to delete old portal logo from S3:', error);
      }
    }

    // Upload new logo to S3
    const logoUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'portal-logos'
    );

    console.log('🌐 Portal logo uploaded for clinic:', { clinicId: user.clinicId, logoUrl });

    res.status(200).json({
      success: true,
      message: "Portal logo uploaded successfully",
      data: { logoUrl }
    });
  } catch (error) {
    console.error('Error uploading portal logo:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload portal logo"
    });
  }
});

// Upload portal hero image to S3
app.post("/custom-website/upload-hero", authenticateJWT, upload.single('heroImage'), async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }]
    });
    if (!user || !user.clinicId) {
      return res.status(404).json({
        success: false,
        message: "User or clinic not found"
      });
    }

    // Only allow brand, doctor, or affiliate users to upload portal images
    if (!user.hasAnyRoleSync(['brand', 'doctor', 'affiliate', 'admin', 'superAdmin'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    if (!isValidFileSize(req.file.size)) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB."
      });
    }

    // Get existing custom website to delete old hero image if exists
    const customWebsite = await CustomWebsite.findOne({
      where: { clinicId: user.clinicId }
    });

    if (customWebsite?.heroImageUrl) {
      try {
        await deleteFromS3(customWebsite.heroImageUrl);
        console.log('🗑️ Old portal hero image deleted from S3');
      } catch (error) {
        console.error('Warning: Failed to delete old portal hero image from S3:', error);
      }
    }

    // Upload new hero image to S3
    const heroImageUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'portal-hero-images'
    );

    console.log('🌐 Portal hero image uploaded for clinic:', { clinicId: user.clinicId, heroImageUrl });

    res.status(200).json({
      success: true,
      message: "Portal hero image uploaded successfully",
      data: { heroImageUrl }
    });
  } catch (error) {
    console.error('Error uploading portal hero image:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload portal hero image"
    });
  }
});

// Public endpoint to get first custom website (for localhost testing without subdomain)
app.get("/custom-website/default", async (req, res) => {
  try {
    // For localhost testing: return the first available active custom website
    const customWebsite = await CustomWebsite.findOne({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    if (!customWebsite) {
      return res.status(404).json({
        success: false,
        message: "No custom website found"
      });
    }

    res.status(200).json({
      success: true,
      data: customWebsite
    });
  } catch (error) {
    console.error('Error fetching default custom website:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch custom website"
    });
  }
});

// Public endpoint to get custom website by clinic slug (for landing page)
app.get("/custom-website/by-slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const clinic = await Clinic.findOne({
      where: { slug }
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found"
      });
    }

    const customWebsite = await CustomWebsite.findOne({
      where: { clinicId: clinic.id }
    });

    // If this is an affiliate clinic, get the parent clinic's logo and hero image
    let parentClinicLogo: string | null = null;
    let parentClinicName: string | null = null;
    let parentClinicHeroImageUrl: string | null = null;

    console.log('📍 [custom-website/by-slug] Clinic:', {
      id: clinic.id,
      slug: clinic.slug,
      affiliateOwnerClinicId: clinic.affiliateOwnerClinicId || 'none'
    });

    if (clinic.affiliateOwnerClinicId) {
      const parentClinic = await Clinic.findByPk(clinic.affiliateOwnerClinicId, {
        attributes: ['id', 'name', 'logo']
      });

      // Also fetch parent's CustomWebsite for the logo and hero image
      const parentCustomWebsite = await CustomWebsite.findOne({
        where: { clinicId: clinic.affiliateOwnerClinicId }
      });

      console.log('📍 [custom-website/by-slug] Parent clinic:', parentClinic ? {
        id: parentClinic.id,
        name: parentClinic.name,
        clinicLogo: parentClinic.logo || 'none',
        customWebsiteLogo: parentCustomWebsite?.logo || 'none',
        customWebsiteHeroImage: parentCustomWebsite?.heroImageUrl || 'none'
      } : 'not found');

      if (parentClinic) {
        // Prefer CustomWebsite logo, fallback to Clinic logo
        parentClinicLogo = parentCustomWebsite?.logo || parentClinic.logo || null;
        parentClinicName = parentClinic.name || null;
        parentClinicHeroImageUrl = parentCustomWebsite?.heroImageUrl || null;
      }
    }

    // If useDefaultDisclaimer is true, fetch and include the default disclaimer
    let responseData = customWebsite ? customWebsite.toJSON() : null;
    if (responseData && responseData.useDefaultDisclaimer) {
      const globalConfig = await WebsiteBuilderConfigs.findOne();
      if (globalConfig) {
        responseData.footerDisclaimer = globalConfig.defaultFooterDisclaimer;
      }
    }

    res.status(200).json({
      success: true,
      data: responseData,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
        isAffiliate: !!clinic.affiliateOwnerClinicId,
        parentClinicLogo,
        parentClinicName,
        parentClinicHeroImageUrl,
        patientPortalDashboardFormat: clinic.patientPortalDashboardFormat,
        defaultFormColor: clinic.defaultFormColor,
      }
    });
  } catch (error) {
    console.error('Error fetching custom website by slug:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch portal settings"
    });
  }
});

// ==========================================
// Website Builder Global Configs
// ==========================================

// Get website builder configs (tenant/organization admin only)
app.get("/website-builder-configs", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow organizationUser or superAdmin to access website builder configs
    if (!user.hasAnyRoleSync(['organizationUser', 'superAdmin'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only tenant administrators can access website builder configs."
      });
    }

    // Get or create the single config row
    let config = await WebsiteBuilderConfigs.findOne();

    if (!config) {
      // Create default config if it doesn't exist
      config = await WebsiteBuilderConfigs.create({
        defaultFooterDisclaimer: DEFAULT_FOOTER_DISCLAIMER
      });
    }

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching website builder configs:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch website builder configs"
    });
  }
});

// Update website builder configs (tenant/organization admin only)
app.post("/website-builder-configs", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow organizationUser or superAdmin to update website builder configs
    if (!user.hasAnyRoleSync(['organizationUser', 'superAdmin'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only tenant administrators can update website builder configs."
      });
    }

    const { defaultFooterDisclaimer } = req.body;

    // Get or create the single config row
    let config = await WebsiteBuilderConfigs.findOne();

    if (config) {
      // Update existing config
      await config.update({
        defaultFooterDisclaimer: defaultFooterDisclaimer !== undefined ? defaultFooterDisclaimer : config.defaultFooterDisclaimer
      });
    } else {
      // Create new config
      config = await WebsiteBuilderConfigs.create({
        defaultFooterDisclaimer: defaultFooterDisclaimer || DEFAULT_FOOTER_DISCLAIMER
      });
    }

    console.log('🌐 Website builder configs updated by:', user.email);

    res.status(200).json({
      success: true,
      message: "Website builder configs saved successfully",
      data: config
    });
  } catch (error) {
    console.error('Error saving website builder configs:', error);
    res.status(500).json({
      success: false,
      message: "Failed to save website builder configs"
    });
  }
});

// Restore default footer disclaimer (tenant/organization admin only)
app.post("/website-builder-configs/restore-default", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow organizationUser or superAdmin to restore defaults
    if (!user.hasAnyRoleSync(['organizationUser', 'superAdmin'])) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only tenant administrators can restore defaults."
      });
    }

    // Get or create the single config row
    let config = await WebsiteBuilderConfigs.findOne();

    if (config) {
      // Update existing config with default value
      await config.update({
        defaultFooterDisclaimer: DEFAULT_FOOTER_DISCLAIMER
      });
    } else {
      // Create new config with default value
      config = await WebsiteBuilderConfigs.create({
        defaultFooterDisclaimer: DEFAULT_FOOTER_DISCLAIMER
      });
    }

    console.log('🔄 Website builder configs restored to default by:', user.email);

    res.status(200).json({
      success: true,
      message: "Default footer disclaimer restored successfully",
      data: config
    });
  } catch (error) {
    console.error('Error restoring default configs:', error);
    res.status(500).json({
      success: false,
      message: "Failed to restore default configs"
    });
  }
});

// Get standardized templates (authenticated version)
app.get("/questionnaires/standardized", authenticateJWT, async (req, res) => {
  try {
    const { category } = req.query;

    const where: any = {
      isTemplate: true,
      formTemplateType: "standardized_template",
    };
    if (typeof category === "string" && category.trim().length > 0) {
      where.category = category.trim();
    }

    const questionnaires = await Questionnaire.findAll({
      where,
      include: [
        {
          model: QuestionnaireStep,
          as: "steps",
          include: [
            {
              model: Question,
              as: "questions",
              include: [{ model: QuestionOption, as: "options" }],
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
    });

    res.status(200).json({ success: true, data: questionnaires });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching standardized templates:", error);
    } else {
      console.error("❌ Error fetching standardized templates");
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch standardized templates",
      });
  }
});

// Get global form structures
app.get("/global-form-structures", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Query from GlobalFormStructures table
    const structures = await GlobalFormStructure.findAll({
      where: {
        isActive: true,
      },
      order: [
        ["isDefault", "DESC"], // Default structures first
        ["createdAt", "ASC"],
      ],
    });

    // Transform to match frontend expectations
    const formattedStructures = structures.map((s) => ({
      id: s.structureId,
      name: s.name,
      description: s.description,
      sections: s.sections,
      isDefault: s.isDefault,
      createdAt: s.createdAt,
    }));

    res.status(200).json({ success: true, data: formattedStructures });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching global form structures:", error);
    } else {
      console.error("❌ Error fetching global form structures");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch structures" });
  }
});

// Save global form structures for clinic
app.post("/global-form-structures", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const { structures } = req.body;
    if (!Array.isArray(structures)) {
      return res
        .status(400)
        .json({ success: false, message: "Structures must be an array" });
    }

    // Get existing structures to track what needs to be created/updated/deleted
    const existingStructures = await GlobalFormStructure.findAll();

    const existingIds = new Set(existingStructures.map((s) => s.structureId));
    const incomingIds = new Set(structures.map((s: any) => s.id));

    // Delete structures that are no longer in the incoming data
    const toDelete = existingStructures.filter(
      (s) => !incomingIds.has(s.structureId)
    );
    for (const structure of toDelete) {
      await structure.destroy();
    }

    // Create or update structures
    for (const structureData of structures) {
      if (existingIds.has(structureData.id)) {
        // Update existing
        await GlobalFormStructure.update(
          {
            name: structureData.name,
            description: structureData.description || "",
            sections: structureData.sections,
            isDefault: structureData.isDefault || false,
          },
          {
            where: {
              structureId: structureData.id,
            },
          }
        );
      } else {
        // Create new
        await GlobalFormStructure.create({
          structureId: structureData.id,
          name: structureData.name,
          description: structureData.description || "",
          sections: structureData.sections,
          isDefault: structureData.isDefault || false,
          isActive: true,
        });
      }
    }

    console.log("✅ Saved global form structures");

    res
      .status(200)
      .json({
        success: true,
        message: "Structures saved successfully",
        data: structures,
      });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error saving global form structures:", error);
    } else {
      console.error("❌ Error saving global form structures");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to save structures" });
  }
});

// Products by clinic endpoint
app.get("/products/by-clinic/:clinicId", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const clinicId = req.params.clinicId;

    const productService = new ProductService();
    const result = await productService.getProductsByClinic(
      clinicId,
      currentUser.id
    );

    // Fetch full user to check role/clinic access
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!result.success) {
      const statusCode =
        result.message === "Access denied"
          ? 403
          : result.message === "User not found"
            ? 401
            : 500;
      return res.status(statusCode).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    // Only allow doctors and brand users to access products for their own clinic
    if (!user.hasAnyRoleSync(["doctor", "brand"])) {
      const roles = user.userRoles?.getActiveRoles() || [user.role];
      return res.status(403).json({
        success: false,
        message: `Access denied. Only doctors and brand users can access products. Your roles: ${roles.join(", ")}`,
      });
    }

    // Verify the user has access to this clinic
    if (user.clinicId !== clinicId) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You can only access products for your own clinic.",
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`🛍️ Fetching products for clinic: ${clinicId}`);
    }

    // First, let's see all products in the database for debugging
    const allProducts = await Product.findAll({
      include: [
        {
          model: Treatment,
          as: "treatments",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
      ],
      order: [["name", "ASC"]],
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`📊 Total products in database: ${allProducts.length}`);
    }

    // Fetch products associated to treatments belonging to this clinic
    const clinicProducts = await Product.findAll({
      include: [
        {
          model: Treatment,
          as: "treatments",
          where: { clinicId },
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
      ],
      order: [["name", "ASC"]],
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        `✅ Found ${clinicProducts.length} products linked to treatments for clinic ${clinicId}`
      );
    }

    // Build base list from clinic-linked products
    const baseProducts = clinicProducts.map((product) => ({
      id: product.id,
      name: product.name,
      price:
        typeof product.price === "string"
          ? parseFloat(product.price as any)
          : product.price,
      pharmacyProductId: product.pharmacyProductId,
      placeholderSig: product.placeholderSig,
      imageUrl: product.imageUrl,
      active: (product as any).isActive ?? true,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      treatments: (product as any).treatments || [],
    }));

    // Map tenant overrides by productId (price, tenantProductId)
    const overrides = new Map<
      string,
      { price?: number; tenantProductId?: string }
    >();
    for (const item of result.items || []) {
      const productId = item.product?.id;
      if (productId) {
        overrides.set(productId, {
          price:
            typeof item.tenantProductPrice === "string"
              ? parseFloat(item.tenantProductPrice as any)
              : item.tenantProductPrice,
          tenantProductId: item.tenantProductId,
        });
      }
    }

    // Apply overrides where available, keep others as base
    const mergedProducts = baseProducts.map((p) => {
      const o = overrides.get(p.id);
      if (o) {
        return {
          ...p,
          price: o.price ?? p.price,
          tenantProductId: o.tenantProductId,
        } as any;
      }
      return p as any;
    });

    res.status(200).json({
      success: true,
      message: result.message,
      data: mergedProducts,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching products by clinic:", error);
    } else {
      console.error("❌ Error fetching products by clinic");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
});

// Single product endpoint
app.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Support special virtual id "new" so the admin UI can preload defaults without hitting the DB
    if (id === "new") {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const payload = verifyJWTToken(token);

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // Fetch full user data from database to get role
    const user = await User.findByPk(payload.userId);
    console.log("user", user);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow doctors and brand users to access products
    if (!user.hasAnyRoleSync(["doctor", "brand"])) {
      const roles = user.userRoles?.getActiveRoles() || [user.role];
      return res.status(403).json({
        success: false,
        message: `Access denied. Only doctors and brand users can access products. Your roles: ${roles.join(", ")}`,
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`🛍️ Fetching single product: ${id}, user role: ${user.role}`);
    }

    // Fetch product with associated treatments and pharmacy products
    const product = await Product.findByPk(id, {
      include: [
        {
          model: Treatment,
          as: "treatments",
          through: { attributes: [] }, // Don't include junction table attributes
          attributes: ["id", "name"], // Only include needed fields
        },
      ],
    });

    // If product has no pharmacyWholesaleCost, try to get it from PharmacyProduct
    if (product && !product.pharmacyWholesaleCost) {
      const PharmacyProduct = (await import("./models/PharmacyProduct"))
        .default;
      const pharmacyProduct = await PharmacyProduct.findOne({
        where: { productId: id },
        order: [["createdAt", "DESC"]], // Get the most recent one
      });

      if (pharmacyProduct && pharmacyProduct.pharmacyWholesaleCost) {
        // Update the product's pharmacyWholesaleCost for future queries
        await product.update({
          pharmacyWholesaleCost: pharmacyProduct.pharmacyWholesaleCost,
        });
        console.log(
          `✅ Synced pharmacyWholesaleCost from PharmacyProduct: $${pharmacyProduct.pharmacyWholesaleCost}`
        );
      }
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Ensure slug is persisted if missing (with uniqueness fallback)
    if (!product.slug && product.name) {
      const baseSlug = product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      let uniqueSlug = baseSlug;
      let attempt = 0;
      const maxAttempts = 10;

      while (attempt < maxAttempts) {
        try {
          await product.update({ slug: uniqueSlug });
          break; // success
        } catch (e: any) {
          const isUniqueViolation = Boolean(
            e?.name === "SequelizeUniqueConstraintError" ||
            e?.parent?.code === "23505"
          );
          if (!isUniqueViolation) {
            if (process.env.NODE_ENV === "development") {
              console.warn(
                "⚠️ Failed to persist computed slug for product (non-unique error)",
                id,
                e
              );
            } else {
              console.warn(
                "⚠️ Failed to persist computed slug for product (non-unique error)"
              );
            }
            break;
          }
          attempt += 1;
          uniqueSlug = `${baseSlug}-${attempt}`;
        }
      }
    }

    // Transform data to match frontend expectations
    const categories = Array.isArray((product as any).categories)
      ? ((product as any).categories as string[]).filter(Boolean)
      : [];

    const transformedProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug || null,
      price: product.price,
      pharmacyProductId: product.pharmacyProductId,
      pharmacyWholesaleCost: (product as any).pharmacyWholesaleCost || null,
      suggestedRetailPrice: (product as any).suggestedRetailPrice || null,
      placeholderSig: product.placeholderSig,
      medicationSize: (product as any).medicationSize || null,
      description: product.description,
      activeIngredients: product.activeIngredients,
      imageUrl: product.imageUrl,
      isActive: product.isActive, // Return actual isActive status from database
      category: categories[0] ?? null,
      categories,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      treatments: product.treatments || [],
    };

    res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: transformedProduct,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching product:", error);
    } else {
      console.error("❌ Error fetching product");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
});

// Create product endpoint
app.post("/products", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using productCreateSchema
    const validation = productCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      name,
      price,
      description,
      pharmacyProductId,
      placeholderSig,
      activeIngredients,
      isActive,
    } = validation.data;

    // Fetch full user data from database to get role and clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow doctors and brand users to create products
    if (!user.hasAnyRoleSync(["doctor", "brand"])) {
      const roles = user.userRoles?.getActiveRoles() || [user.role];
      return res.status(403).json({
        success: false,
        message: `Access denied. Only doctors and brand users can create products. Your roles: ${roles.join(", ")}`,
      });
    }

    console.log(
      `🛍️ Creating product for clinic: ${user.clinicId}, user role: ${user.role}`
    );

    // Create the product
    const newProduct = await Product.create({
      name,
      price: price,
      description,
      pharmacyProductId,
      placeholderSig,
      activeIngredients: activeIngredients || [],
      active: isActive !== undefined ? isActive : true,
      isActive: isActive !== undefined ? isActive : true,
      clinicId: user.clinicId,
      imageUrl: "", // Set empty string as default since imageUrl is now nullable
    });

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Product created successfully:", {
        id: newProduct.id,
        name: newProduct.name,
      });
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: newProduct,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error creating product:", error);
    } else {
      console.error("❌ Error creating product");
    }
    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
});

// Delete product endpoint
app.delete("/products/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Fetch full user data from database to get role and clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow doctors and brand users to delete products
    if (!user.hasAnyRoleSync(["doctor", "brand"])) {
      const roles = user.userRoles?.getActiveRoles() || [user.role];
      return res.status(403).json({
        success: false,
        message: `Access denied. Only doctors and brand users can delete products. Your roles: ${roles.join(", ")}`,
      });
    }

    console.log(`🗑️ Deleting product: ${id}, user role: ${user.role}`);

    // Find the product
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete associated image from S3 if it exists
    if (product.imageUrl && product.imageUrl.trim() !== "") {
      try {
        await deleteFromS3(product.imageUrl);
        console.log("🗑️ Product image deleted from S3");
      } catch (error) {
        // HIPAA: Do not log detailed errors in production
        if (process.env.NODE_ENV === "development") {
          console.error(
            "❌ Warning: Failed to delete product image from S3:",
            error
          );
        } else {
          console.error("❌ Warning: Failed to delete product image from S3");
        }
        // Don't fail the entire request if image deletion fails
      }
    }

    // Delete the product
    try {
      await product.destroy();
      console.log("✅ Product deleted successfully:", {
        id: product.id,
        name: product.name,
      });
    } catch (deleteError) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error deleting product from database:", deleteError);
      } else {
        console.error("❌ Error deleting product from database");
      }
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete product because it is being used by treatments. Please remove it from all treatments first.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error deleting product:", error);
    } else {
      console.error("❌ Error deleting product");
    }
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
});

// Update product endpoint
app.put("/products/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using productUpdateSchema
    const validation = productUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      name,
      price,
      description,
      pharmacyProductId,
      placeholderSig,
      activeIngredients,
      isActive,
    } = validation.data;

    // Fetch full user data from database to get role
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow doctors and brand users to update products
    if (!user.hasAnyRoleSync(["doctor", "brand"])) {
      const roles = user.userRoles?.getActiveRoles() || [user.role];
      return res.status(403).json({
        success: false,
        message: `Access denied. Only doctors and brand users can update products. Your roles: ${roles.join(", ")}`,
      });
    }

    console.log(`🛍️ Updating product: ${id}, user role: ${user.role}`);

    // Find the product
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Update the product
    const updatedProduct = await product.update({
      name,
      price: price,
      description,
      pharmacyProductId,
      placeholderSig,
      activeIngredients: activeIngredients || [],
      active: isActive !== undefined ? isActive : true,
      isActive: isActive !== undefined ? isActive : true,
      // Only update imageUrl if it's explicitly provided in the request
      ...(req.body.imageUrl !== undefined && { imageUrl: req.body.imageUrl }),
    });

    console.log("✅ Product updated successfully:", {
      id: updatedProduct.id,
      name: updatedProduct.name,
    });

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating product:", error);
    } else {
      console.error("❌ Error updating product");
    }
    res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
});

// Product image upload endpoint
app.post(
  "/products/:id/upload-image",
  authenticateJWT,
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Fetch full user data from database to get role
      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Only allow doctors and brand users to upload product images for their own clinic's products
      if (!user.hasAnyRoleSync(["doctor", "brand"])) {
        return res.status(403).json({
          success: false,
          message: "Only doctors and brand users can upload product images",
        });
      }

      // Check tier permissions for uploading custom product images
      if (user.role === "brand") {
        // Get the user's active subscription
        const subscription = await BrandSubscription.findOne({
          where: { userId: user.id, status: BrandSubscriptionStatus.ACTIVE },
          order: [["createdAt", "DESC"]],
        });

        if (!subscription) {
          return res.status(403).json({
            success: false,
            message: "No active subscription found",
          });
        }

        // Get custom features for this tenant (overrides tier config)
        const customFeatures = await TenantCustomFeatures.findOne({
          where: { userId: user.id },
        });

        // If custom features exist and explicitly allow/deny, use that
        let canUpload = false;
        if (customFeatures) {
          canUpload = customFeatures.canUploadCustomProductImages;
          console.log(
            "🎨 Using custom features for image upload permission:",
            canUpload
          );
        } else {
          // Otherwise, check the tier configuration
          const plan = await BrandSubscriptionPlans.findOne({
            where: { planType: subscription.planType },
          });

          if (plan) {
            const tierConfig = await TierConfiguration.findOne({
              where: { brandSubscriptionPlanId: plan.id },
            });

            if (tierConfig) {
              canUpload = tierConfig.canUploadCustomProductImages;
              console.log(
                "🎯 Using tier config for image upload permission:",
                canUpload
              );
            }
          }
        }

        if (!canUpload) {
          return res.status(403).json({
            success: false,
            message:
              "Your current plan does not allow uploading custom product images. Please upgrade to a higher tier.",
            code: "FEATURE_NOT_AVAILABLE",
          });
        }
      }

      // Check if this is a removal request (no file provided)
      const removeImage =
        req.body &&
        typeof req.body === "object" &&
        "removeImage" in req.body &&
        req.body.removeImage === true;

      if (removeImage) {
        // Remove the image
        const product = await Product.findByPk(id);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: "Product not found",
          });
        }

        if (product.imageUrl && product.imageUrl.trim() !== "") {
          try {
            await deleteFromS3(product.imageUrl);
            console.log("🗑️ Product image deleted from S3");
          } catch (error) {
            // HIPAA: Do not log detailed errors in production
            if (process.env.NODE_ENV === "development") {
              console.error(
                "❌ Warning: Failed to delete product image from S3:",
                error
              );
            } else {
              console.error(
                "❌ Warning: Failed to delete product image from S3"
              );
            }
            // Don't fail the entire request if deletion fails
          }
        }

        // Update product to remove the image URL
        await product.update({ imageUrl: null });

        console.log("🖼️ Image removed from product:", { id: product.id });

        return res.status(200).json({
          success: true,
          message: "Product image removed successfully",
          data: {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
          },
        });
      }

      // Check if file was uploaded for new image
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      // Validate file size (additional check)
      if (!isValidFileSize(req.file.size)) {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 5MB.",
        });
      }

      const product = await Product.findByPk(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      // Delete old image from S3 if it exists (1 product = 1 image policy)
      if (product.imageUrl && product.imageUrl.trim() !== "") {
        try {
          await deleteFromS3(product.imageUrl);
          console.log(
            "🗑️ Old product image deleted from S3 (clean storage policy)"
          );
        } catch (error) {
          // HIPAA: Do not log detailed errors in production
          if (process.env.NODE_ENV === "development") {
            console.error(
              "❌ Warning: Failed to delete old product image from S3:",
              error
            );
          } else {
            console.error(
              "❌ Warning: Failed to delete old product image from S3"
            );
          }
          // Don't fail the entire request if deletion fails
        }
      }

      // Upload new image to S3
      const imageUrl = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Update product with new image URL
      await product.update({ imageUrl });

      console.log("🖼️ Image uploaded for product:", {
        id: product.id,
        imageUrl,
      });

      res.status(200).json({
        success: true,
        message: "Product image uploaded successfully",
        data: {
          id: product.id,
          name: product.name,
          imageUrl: imageUrl, // Use the local variable, not the stale product instance
        },
      });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error uploading product image:", error);
      } else {
        console.error("❌ Error uploading product image");
      }
      res.status(500).json({
        success: false,
        message: "Failed to upload product image",
      });
    }
  }
);

// ============================================
// NEW PRODUCT MANAGEMENT ENDPOINTS
// ============================================

// List all products with enhanced pharmacy metadata
app.get("/products-management", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const productService = new ProductService();

    // Validate query parameters using paginationSchema
    const validation = listProductsSchema.safeParse({
      page: req.query.page,
      limit: req.query.limit,
      category: req.query.category,
      categories: req.query.categories,
      isActive:
        req.query.isActive === undefined
          ? undefined
          : req.query.isActive === "true",
      pharmacyProvider: req.query.pharmacyProvider,
      isAutoImported:
        req.query.isAutoImported === undefined
          ? undefined
          : req.query.isAutoImported === "true",
      hasMdiOffering:
        req.query.hasMdiOffering === undefined
          ? undefined
          : req.query.hasMdiOffering === "true",
    });

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { page, limit, category, isActive, pharmacyProvider, isAutoImported, hasMdiOffering } =
      validation.data;

    const result = await productService.listProducts(currentUser.id, {
      page,
      limit,
      category,
      isActive,
      pharmacyProvider,
      isAutoImported,
      hasMdiOffering,
    });
    res.status(200).json(result);
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error listing products:", error);
    } else {
      console.error("❌ Error listing products");
    }
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to list products",
      });
  }
});

// Get single product with full details
app.get("/products-management/:id", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    console.log(`📦 Fetching product: ${req.params.id} for user: ${currentUser.id}`);

    const productService = new ProductService();
    const result = await productService.getProduct(
      req.params.id,
      currentUser.id
    );

    if (!result.success) {
      console.log(`❌ Product not found: ${req.params.id}`);
      return res.status(404).json(result);
    }

    console.log(`✅ Product fetched successfully: ${req.params.id}`);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("❌ Error fetching product:", error?.message || error);
    console.error("Stack:", error?.stack);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch product",
      });
  }
});

// Create new product with pharmacy metadata
app.post("/products-management", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Validate request body using productCreateSchema
    const validation = productCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const productService = new ProductService();
    const result = await productService.createProduct(
      validation.data,
      currentUser.id
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error creating product:", error);
    } else {
      console.error("❌ Error creating product");
    }
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to create product",
      });
  }
});

// Update product with pharmacy metadata
app.put("/products-management/:id", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Validate request body using productUpdateSchema
    const validation = productUpdateSchema.safeParse({
      ...req.body,
      id: req.params.id,
    });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const productService = new ProductService();
    const result = await productService.updateProduct(
      validation.data,
      currentUser.id
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating product:", error);
    } else {
      console.error("❌ Error updating product");
    }
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to update product",
      });
  }
});

// Deactivate product (soft delete)
app.delete("/products-management/:id", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Check if request is from tenant-admin portal
    const portalContext = req.headers['x-portal-context'];
    const isTenantAdmin = portalContext === 'tenant-admin';

    const productService = new ProductService();
    const result = await productService.deleteProduct(
      req.params.id,
      currentUser.id,
      { isTenantAdmin }
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.status(200).json(result);
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error deleting product:", error);
    } else {
      console.error("❌ Error deleting product");
    }
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to delete product",
      });
  }
});

// List available product categories
app.get(
  "/products-management/categories/list",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const productService = new ProductService();
      const result = await productService.listCategories(currentUser.id);
      res.status(200).json(result);
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error listing categories:", error);
      } else {
        console.error("❌ Error listing categories");
      }
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to list categories",
        });
    }
  }
);

// List available pharmacy vendors
app.get(
  "/products-management/vendors/list",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const productService = new ProductService();
      const result = await productService.listPharmacyVendors(currentUser.id);
      res.status(200).json(result);
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error listing pharmacy vendors:", error);
      } else {
        console.error("❌ Error listing pharmacy vendors");
      }
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to list pharmacy vendors",
        });
    }
  }
);

// ============================================
// END NEW PRODUCT MANAGEMENT ENDPOINTS
// ============================================

// Treatment logo upload endpoint
app.post(
  "/treatment/:id/upload-logo",
  authenticateJWT,
  upload.single("logo"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Fetch full user data from database to get clinicId
      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Only allow doctors and brand users to upload treatment logos for their own clinic's treatments
      if (!user.hasAnyRoleSync(["doctor", "brand"])) {
        return res.status(403).json({
          success: false,
          message: "Only doctors and brand users can upload treatment logos",
        });
      }

      const treatment = await Treatment.findByPk(id);
      if (!treatment) {
        return res.status(404).json({
          success: false,
          message: "Treatment not found",
        });
      }

      // Verify treatment belongs to user's clinic
      if (treatment.clinicId !== user.clinicId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Check if this is a logo removal request
      const removeLogo =
        req.body &&
        typeof req.body === "object" &&
        "removeLogo" in req.body &&
        req.body.removeLogo === true;

      if (removeLogo) {
        // Remove the logo
        if (treatment.treatmentLogo && treatment.treatmentLogo.trim() !== "") {
          try {
            await deleteFromS3(treatment.treatmentLogo);
            console.log("🗑️ Treatment logo deleted from S3");
          } catch (error) {
            // HIPAA: Do not log detailed errors in production
            if (process.env.NODE_ENV === "development") {
              console.error(
                "❌ Warning: Failed to delete treatment logo from S3:",
                error
              );
            } else {
              console.error(
                "❌ Warning: Failed to delete treatment logo from S3"
              );
            }
            // Don't fail the entire request if deletion fails
          }
        }

        // Update treatment to remove the logo URL
        await treatment.update({ treatmentLogo: "" });

        console.log("💊 Logo removed from treatment:", { id: treatment.id });

        return res.status(200).json({
          success: true,
          message: "Treatment logo removed successfully",
          data: {
            id: treatment.id,
            name: treatment.name,
            treatmentLogo: treatment.treatmentLogo,
          },
        });
      }

      // Check if file was uploaded for new logo
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      // Validate file size (additional check)
      if (!isValidFileSize(req.file.size)) {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 5MB.",
        });
      }

      // Delete old logo from S3 if it exists (1 product = 1 image policy)
      if (treatment.treatmentLogo && treatment.treatmentLogo.trim() !== "") {
        try {
          await deleteFromS3(treatment.treatmentLogo);
          console.log(
            "🗑️ Old treatment logo deleted from S3 (clean storage policy)"
          );
        } catch (error) {
          // HIPAA: Do not log detailed errors in production
          if (process.env.NODE_ENV === "development") {
            console.error(
              "❌ Warning: Failed to delete old treatment logo from S3:",
              error
            );
          } else {
            console.error(
              "❌ Warning: Failed to delete old treatment logo from S3"
            );
          }
          // Don't fail the entire request if deletion fails
        }
      }

      // Upload new logo to S3
      const logoUrl = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Update treatment with new logo URL
      await treatment.update({ treatmentLogo: logoUrl });

      console.log("💊 Logo uploaded for treatment:", {
        id: treatment.id,
        logoUrl,
      });

      res.status(200).json({
        success: true,
        message: "Treatment logo uploaded successfully",
        data: {
          id: treatment.id,
          name: treatment.name,
          treatmentLogo: treatment.treatmentLogo,
        },
      });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error uploading treatment logo:", error);
      } else {
        console.error("❌ Error uploading treatment logo");
      }
      res.status(500).json({
        success: false,
        message: "Failed to upload treatment logo",
      });
    }
  }
);

// Treatments routes
// Public endpoint to get treatments by clinic slug
app.get("/treatments/by-clinic-slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // First find the clinic by slug
    const clinic = await Clinic.findOne({
      where: { slug },
      include: [
        {
          model: Treatment,
          as: "treatments",
          attributes: ["id", "name", "treatmentLogo", "createdAt", "updatedAt"],
        },
      ],
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    console.log(
      `✅ Found ${clinic.treatments?.length || 0} treatments for clinic "${slug}"`
    );

    res.json({
      success: true,
      data: clinic.treatments || [],
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching treatments by clinic slug:", error);
    } else {
      console.error("❌ Error fetching treatments by clinic slug");
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Protected endpoint to get treatments by clinic ID (for authenticated users)
app.get(
  "/treatments/by-clinic-id/:clinicId",
  authenticateJWT,
  async (req, res) => {
    try {
      const { clinicId } = req.params;
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Fetch full user data from database to get clinicId
      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Only allow users to access their own clinic's treatments
      // For doctors: they can access their clinic's treatments
      // For patients: they can access their clinic's treatments
      if (user.clinicId !== clinicId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Find treatments for the clinic
      const treatments = await Treatment.findAll({
        where: { clinicId },
        include: [
          {
            model: Product,
            as: "products",
            through: { attributes: [] },
          },
          {
            model: Clinic,
            as: "clinic",
          },
        ],
      });

      const treatmentIds = treatments.map((treatment) => treatment.id);

      const brandTreatments = treatmentIds.length
        ? await BrandTreatment.findAll({
          where: {
            userId: currentUser.id,
            treatmentId: treatmentIds,
          },
        })
        : [];

      const brandTreatmentByTreatmentId = new Map(
        brandTreatments.map((selection) => [selection.treatmentId, selection])
      );

      console.log(
        `✅ Found ${treatments?.length || 0} treatments for clinic ID "${clinicId}"`
      );

      // Recalculate productsPrice for each treatment
      const updatedTreatments = await Promise.all(
        treatments.map(async (treatment) => {
          if (treatment.products && treatment.products.length > 0) {
            const totalProductsPrice = treatment.products.reduce(
              (sum, product) => {
                const price = parseFloat(String(product.price || 0)) || 0;
                return sum + price;
              },
              0
            );

            const markupAmount = (totalProductsPrice * 10) / 100; // 10% markup
            const finalProductsPrice = totalProductsPrice + markupAmount;

            // Update the stored value if it's different or NaN
            if (
              isNaN(treatment.productsPrice) ||
              Math.abs(treatment.productsPrice - finalProductsPrice) > 0.01
            ) {
              console.log(
                `💊 Updating productsPrice for ${treatment.name} from ${treatment.productsPrice} to ${finalProductsPrice}`
              );
              await treatment.update({ productsPrice: finalProductsPrice });
              treatment.productsPrice = finalProductsPrice;
            }
          }

          const treatmentData = treatment.toJSON();
          delete treatmentData.products; // Remove the full products array to reduce response size

          const selection = brandTreatmentByTreatmentId.get(treatment.id);
          const clinicData = treatment.clinic
            ? treatment.clinic.toJSON
              ? treatment.clinic.toJSON()
              : treatment.clinic
            : null;
          treatmentData.selected = Boolean(selection);
          treatmentData.brandColor = selection?.brandColor ?? null;
          treatmentData.brandLogo = selection?.brandLogo ?? null;
          treatmentData.clinicSlug = clinicData?.slug ?? null;
          treatmentData.slug =
            treatmentData.slug ||
            treatmentData.name
              ?.toLowerCase?.()
              ?.replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");

          return treatmentData;
        })
      );

      res.json({
        success: true,
        data: updatedTreatments,
      });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching treatments by clinic ID:", error);
      } else {
        console.error("❌ Error fetching treatments by clinic ID");
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Create new treatment
app.post("/treatments", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using treatmentCreateSchema
    const validation = treatmentCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { name, defaultQuestionnaire } = validation.data;

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only allow doctors and brand users to create treatments
    if (!user.hasAnyRoleSync(["doctor", "brand"]) || !user.clinicId) {
      return res.status(403).json({
        success: false,
        message:
          "Only doctors and brand users with a clinic can create treatments",
      });
    }

    // Create treatment
    const treatment = await Treatment.create({
      name: name.trim(),
      userId: user.id,
      clinicId: user.clinicId,
      treatmentLogo: "",
    });

    const stripeService = new StripeService();

    const stripeProduct = await stripeService.createProduct({
      name: name.trim(),
    });

    treatment.update({
      stripeProductId: stripeProduct.id,
    });

    console.log("💊 Treatment created:", {
      id: treatment.id,
      name: treatment.name,
    });

    if (defaultQuestionnaire) {
      const questionnaireService = new QuestionnaireService();

      console.log("Creating default questionnaire");
      questionnaireService.createDefaultQuestionnaire(treatment.id, true, null);
    }

    res.status(201).json({
      success: true,
      message: "Treatment created successfully",
      data: {
        id: treatment.id,
        name: treatment.name,
        treatmentLogo: treatment.treatmentLogo,
      },
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error creating treatment:", error);
    } else {
      console.error("❌ Error creating treatment");
    }
    res.status(500).json({
      success: false,
      message: "Failed to create treatment",
    });
  }
});

// Update treatment
app.put(
  ["/treatments/:treatmentId", "/treatments"],
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Get treatmentId from URL param or body
      const treatmentId = req.params.treatmentId || req.body.treatmentId;

      if (!treatmentId) {
        return res.status(400).json({
          success: false,
          message: "treatmentId is required in URL or request body",
        });
      }

      // Validate request body using treatmentUpdateSchema
      const validation = treatmentUpdateSchema.safeParse({
        ...req.body,
        treatmentId,
      });
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const treatment = await treatmentService.updateTreatment(
        treatmentId,
        validation.data,
        currentUser.id
      );

      res.status(200).json({
        success: true,
        message: "Treatment updated successfully",
        data: {
          id: treatment?.data?.id,
          name: treatment?.data?.name,
          treatmentLogo: treatment?.data?.treatmentLogo,
        },
      });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating treatment:", error);
      } else {
        console.error("❌ Error updating treatment");
      }
      res.status(500).json({
        success: false,
        message: "Failed to update treatment",
      });
    }
  }
);

// Get single treatment with products
app.get("/treatments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (id === "new") {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    const treatment = await Treatment.findByPk(id, {
      include: [
        {
          model: TreatmentProducts,
          as: "treatmentProducts",
        },
        {
          model: Product,
          as: "products",
        },
        {
          model: TreatmentPlan,
          as: "treatmentPlans",
        },
        {
          model: Clinic,
          as: "clinic",
        },
      ],
    });

    if (!treatment) {
      return res
        .status(404)
        .json({ success: false, message: "Treatment not found" });
    }

    let questionnaires: any[] | undefined;

    const token = extractTokenFromHeader(req.headers.authorization);
    if (token) {
      const payload = verifyJWTToken(token);
      if (payload) {
        try {
          const userRecord = await User.findByPk(payload.userId);
          if (userRecord) {
            // Always fetch user's questionnaires for this treatment, regardless of clinic association
            // This allows users to see their cloned questionnaires for any treatment template
            questionnaires = await questionnaireService.listForTreatment(
              id,
              userRecord.id
            );
            console.log("📋 Fetched user questionnaires for treatment:", {
              treatmentId: id,
              userId: userRecord.id,
              questionnaireCount: questionnaires?.length || 0,
            });
          }
        } catch (authError) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "⚠️ Optional auth failed for /treatments/:id",
              authError
            );
          } else {
            console.warn("⚠️ Optional auth failed for /treatments/:id");
          }
        }
      }
    }

    console.log("💊 Treatment fetched:", {
      id: treatment.id,
      name: treatment.name,
      productsCount: treatment.products?.length || 0,
    });

    if (treatment.products && treatment.products.length > 0) {
      const totalProductsPrice = treatment.products.reduce((sum, product) => {
        const price = parseFloat(String(product.price || 0)) || 0;
        return sum + price;
      }, 0);

      const markupAmount = (totalProductsPrice * 10) / 100;
      const finalProductsPrice = totalProductsPrice + markupAmount;

      if (
        isNaN(treatment.productsPrice) ||
        Math.abs(treatment.productsPrice - finalProductsPrice) > 0.01
      ) {
        console.log(
          "💊 Updating productsPrice from",
          treatment.productsPrice,
          "to",
          finalProductsPrice
        );
        await treatment.update({ productsPrice: finalProductsPrice });
        treatment.productsPrice = finalProductsPrice;
      }
    }

    const treatmentData = treatment.toJSON ? treatment.toJSON() : treatment;
    if (questionnaires) {
      treatmentData.questionnaires = questionnaires;
    }

    res.status(200).json({
      success: true,
      data: treatmentData,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching treatment:", error);
    } else {
      console.error("❌ Error fetching treatment");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch treatment",
    });
  }
});

// Get treatments for current authenticated user based on their orders
app.get("/getTreatments", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    console.log("🔍 Fetching treatments for user:", currentUser.id);

    // Find all orders for this user that have a treatmentId
    const orders = await Order.findAll({
      where: {
        userId: currentUser.id,
      },
      include: [
        {
          model: Treatment,
          as: "treatment",
          required: true, // Only include orders that have a treatment
          include: [
            {
              model: Product,
              as: "products",
              through: { attributes: ["placeholderSig"] },
            },
            {
              model: Clinic,
              as: "clinic",
            },
          ],
        },
        {
          model: TreatmentPlan,
          as: "treatmentPlan",
        },
        {
          model: Subscription,
          as: "subscription",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    console.log(
      `✅ Found ${orders.length} orders with treatments for user ${currentUser.id}`
    );

    // Transform orders to unique treatments with subscription info
    const treatmentMap = new Map();

    for (const order of orders) {
      if (!order.treatment) continue;

      const treatmentId = order.treatment.id;

      // If we already have this treatment, keep the most recent order with active subscription
      if (treatmentMap.has(treatmentId)) {
        const existing = treatmentMap.get(treatmentId);
        // Update if this order has an active subscription
        if (
          order.subscription &&
          order.subscription.status !== "cancelled" &&
          order.subscription.status !== "deleted"
        ) {
          existing.subscription = order.subscription;
          existing.order = order;
        }
      } else {
        // Add new treatment entry
        treatmentMap.set(treatmentId, {
          treatment: order.treatment,
          treatmentPlan: order.treatmentPlan,
          subscription: order.subscription,
          order: order,
        });
      }
    }

    // Convert map to array and format response
    const treatments = Array.from(treatmentMap.values()).map(
      ({ treatment, treatmentPlan, subscription, order }) => {
        const treatmentData = treatment.toJSON();

        // Determine status from subscription or order
        let status = "active";
        if (subscription) {
          switch (subscription.status.toLowerCase()) {
            case "paid":
            case "processing":
              status = "active";
              break;
            case "pending":
            case "payment_due":
              status = "paused";
              break;
            case "cancelled":
            case "deleted":
              status = "cancelled";
              break;
          }
        } else if (order.status === "cancelled") {
          status = "cancelled";
        } else if (
          order.status === "pending" ||
          order.status === "payment_due"
        ) {
          status = "paused";
        }

        return {
          id: treatment.id,
          name: treatment.name,
          treatmentLogo: treatment.treatmentLogo,
          status: status, // Status derived from subscription/order
          clinicId: treatment.clinicId,
          clinicName: treatment.clinic?.name || null,
          clinicSlug: treatment.clinic?.slug || null,
          // Treatment Plan info
          treatmentPlan: treatmentPlan
            ? {
              id: treatmentPlan.id,
              name: treatmentPlan.name,
              price: treatmentPlan.price,
              billingInterval: treatmentPlan.billingInterval,
            }
            : null,
          // Subscription info
          subscription: subscription
            ? {
              id: subscription.id,
              status: subscription.status,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              cancelledAt: subscription.cancelledAt,
              paymentDue: subscription.paymentDue,
              paidAt: subscription.paidAt,
            }
            : null,
          // Order info
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          orderCreatedAt: order.createdAt,
          // Products
          products: treatment.products || [],
          productsCount: treatment.products?.length || 0,
        };
      }
    );

    console.log(`✅ Returning ${treatments.length} unique treatments`);

    res.json({
      success: true,
      data: treatments,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching user treatments:", error);
    } else {
      console.error("❌ Error fetching user treatments");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch user treatments",
    });
  }
});

// Get products from user's active treatments
app.get("/getProductsByTreatment", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    console.log(
      "🔍 Fetching products from treatments for user:",
      currentUser.id
    );

    // Find all orders for this user that have a treatmentId
    const orders = await Order.findAll({
      where: {
        userId: currentUser.id,
      },
      include: [
        {
          model: Treatment,
          as: "treatment",
          required: true,
          include: [
            {
              model: Product,
              as: "products",
              through: {
                attributes: ["placeholderSig"],
              },
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    console.log(`✅ Found ${orders.length} orders for user ${currentUser.id}`);

    // Collect all products from active treatments
    const productsList: any[] = [];
    const processedProducts = new Set(); // To avoid duplicates

    for (const order of orders) {
      console.log("🔍 Order:", order);
      if (!order.treatment || !order.treatment.products) continue;
      console.log("has treatment and products");
      // Determine if treatment is active
      let isActive = true;
      if (order.subscription) {
        isActive =
          order.subscription.status === "paid" ||
          order.subscription.status === "processing";
      } else if (order.status === "cancelled") {
        isActive = false;
      }
      console.log("isActive:", isActive);

      // Only include products from active treatments
      // if (!isActive) continue;

      // Map each product
      for (const product of order.treatment.products) {
        const productKey = `${product.id}-${order.treatment.id}`;
        console.log("productKey:", productKey);
        // Skip if already processed
        if (processedProducts.has(productKey)) continue;
        processedProducts.add(productKey);
        console.log("has product and treatment");
        // Get placeholder signature value from TreatmentProducts junction table
        const placeholderSig =
          (product as any).TreatmentProducts?.placeholderSig ||
          product.placeholderSig ||
          "As prescribed";
        console.log("placeholderSig:", placeholderSig);
        // Determine status from subscription or order
        let status = "active";
        if (order.subscription) {
          switch (order.subscription.status.toLowerCase()) {
            case "paid":
            case "processing":
              status = "active";
              break;
            case "pending":
            case "payment_due":
              status = "paused";
              break;
            case "cancelled":
            case "deleted":
              status = "cancelled";
              break;
          }
        } else if (order.status === "cancelled") {
          status = "cancelled";
        } else if (
          order.status === "pending" ||
          order.status === "payment_due"
        ) {
          status = "paused";
        }

        productsList.push({
          id: product.id,
          name: order.treatment.name, // Treatment name
          subtitle: product.name, // Product name as subtitle
          placeholderSig,
          refills: 0, // TODO: Add refills logic if available
          status: status,
          expiryDate: "N/A", // TODO: Add expiry date logic if available
          image:
            product.imageUrl ||
            `https://img.heroui.chat/image/medicine?w=100&h=100&u=${product.id.slice(-1)}`,
        });
      }
    }

    console.log(
      `✅ Returning ${productsList.length} products from active treatments`
    );

    res.json({
      success: true,
      data: productsList,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching products by treatment:", error);
    } else {
      console.error("❌ Error fetching products by treatment");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch products by treatment",
    });
  }
});

// Treatment Plan routes
// List treatment plans for a treatment
app.get(
  "/treatment-plans/treatment/:treatmentId",
  authenticateJWT,
  async (req, res) => {
    try {
      const { treatmentId } = req.params;
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Create treatment plan service instance
      const treatmentPlanService = new TreatmentPlanService();

      // List treatment plans
      const treatmentPlans = await treatmentPlanService.listTreatmentPlans(
        treatmentId,
        currentUser.id
      );

      console.log("✅ Treatment plans listed:", {
        treatmentId,
        plansCount: treatmentPlans.length,
        userId: currentUser.id,
      });

      res.status(200).json({
        success: true,
        data: treatmentPlans,
      });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error listing treatment plans:", error);
      } else {
        console.error("❌ Error listing treatment plans");
      }

      if (error instanceof Error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("does not belong to your clinic")
        ) {
          return res.status(404).json({
            success: false,
            message: error.message,
          });
        }
      }

      res.status(500).json({
        success: false,
        message: "Failed to list treatment plans",
      });
    }
  }
);

// Create treatment plan
app.post("/treatment-plans", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using treatmentPlanCreateSchema
    const validation = treatmentPlanCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      name,
      description,
      billingInterval,
      price,
      active,
      popular,
      sortOrder,
      treatmentId,
    } = validation.data;

    // Create treatment plan service instance
    const treatmentPlanService = new TreatmentPlanService();

    // Create treatment plan
    const newTreatmentPlan = await treatmentPlanService.createTreatmentPlan(
      {
        name,
        description,
        billingInterval: billingInterval as BillingInterval,
        price,
        active,
        popular,
        sortOrder,
        treatmentId,
      },
      currentUser.id
    );

    console.log("✅ Treatment plan created:", {
      planId: newTreatmentPlan.id,
      name: newTreatmentPlan.name,
      treatmentId: newTreatmentPlan.treatmentId,
      userId: currentUser.id,
    });

    res.status(201).json({
      success: true,
      message: "Treatment plan created successfully",
      data: newTreatmentPlan,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error creating treatment plan:", error);
    } else {
      console.error("❌ Error creating treatment plan");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to create treatment plan",
    });
  }
});

// Update treatment plan
app.put("/treatment-plans", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using treatmentPlanUpdateSchema
    const validation = treatmentPlanUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      planId,
      name,
      description,
      billingInterval,
      price,
      active,
      popular,
      sortOrder,
    } = validation.data;

    // Create treatment plan service instance
    const treatmentPlanService = new TreatmentPlanService();

    // Update treatment plan
    const updatedTreatmentPlan = await treatmentPlanService.updateTreatmentPlan(
      planId,
      {
        name,
        description,
        billingInterval: billingInterval as BillingInterval,
        price,
        active,
        popular,
        sortOrder,
      },
      currentUser.id
    );

    console.log("✅ Treatment plan updated:", {
      planId: updatedTreatmentPlan.id,
      name: updatedTreatmentPlan.name,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Treatment plan updated successfully",
      data: updatedTreatmentPlan,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating treatment plan:", error);
    } else {
      console.error("❌ Error updating treatment plan");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to update treatment plan",
    });
  }
});

// Delete treatment plan
app.delete("/treatment-plans", authenticateJWT, async (req, res) => {
  try {
    const { planId } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate required fields
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }

    // Create treatment plan service instance
    const treatmentPlanService = new TreatmentPlanService();

    // Delete treatment plan
    const result = await treatmentPlanService.deleteTreatmentPlan(
      planId,
      currentUser.id
    );

    console.log("✅ Treatment plan deleted:", {
      planId: result.planId,
      deleted: result.deleted,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Treatment plan deleted successfully",
      data: result,
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error deleting treatment plan:", error);
    } else {
      console.error("❌ Error deleting treatment plan");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete treatment plan",
    });
  }
});

// Confirm payment completion
app.post("/confirm-payment", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment confirmed successfully",
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error confirming payment:", error);
    } else {
      console.error("❌ Error confirming payment");
    }
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
    });
  }
});

// Create subscription-based product purchase with payment intent
app.post(
  "/products/create-payment-intent",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Validate request body using createProductSubscriptionSchema
      const validation = createProductSubscriptionSchema.safeParse(req.body);

      console.log(" validation ", validation);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { productId, shippingInfo, questionnaireAnswers, useOnBehalfOf } =
        validation.data;

      // Get tenant product configuration (includes clinic pricing and questionnaire)
      const tenantProduct = await TenantProduct.findByPk(productId, {
        include: [
          {
            model: Clinic,
            as: "clinic",
            required: true,
          },
          {
            model: Product,
            as: "product",
            required: true,
          },
        ],
      });

      if (!tenantProduct) {
        return res.status(404).json({
          success: false,
          message: "Product not available for subscription",
        });
      }

      // Use tenant product price if available, otherwise use base product price
      const unitPrice = tenantProduct.price;
      const totalAmount = unitPrice;

      // Get or create Stripe customer
      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const userService = new UserService();
      const stripeCustomerId = await userService.getOrCreateCustomerId(user, {
        userId: user.id,
        productId,
      });

      // Calculate fee breakdown (Stripe fee not subtracted: FUSE pays Stripe)
      const fees = await useGlobalFees();
      
      // Get platform fee percent based on clinic's tier (or global fallback)
      const platformFeePercent = tenantProduct.clinicId 
        ? await getPlatformFeePercent(tenantProduct.clinicId)
        : fees.platformFeePercent;
      
      const doctorFlatUsd = fees.doctorFlatFeeUsd;
      const totalPaid = Number(totalAmount) || 0;
      const platformFeeUsd = Math.max(
        0,
        (platformFeePercent / 100) * totalPaid
      );

      // Get pharmacy wholesale cost from the product
      const pharmacyWholesaleUsd = Number(
        tenantProduct.product?.pharmacyWholesaleCost || 0
      );

      // Doctor receives flat fee
      const doctorUsd = Math.max(0, doctorFlatUsd);

      // Brand gets the residual after platform, doctor, pharmacy (no Stripe deduction)
      const brandAmountUsd = Math.max(
        0,
        totalPaid -
        platformFeeUsd -
        doctorUsd -
        pharmacyWholesaleUsd
      );

      if (process.env.NODE_ENV === "development") {
        console.log("💰 Fee breakdown calculated:", {
          totalPaid,
          platformFeeUsd,
          pharmacyWholesaleUsd,
          doctorUsd,
          brandAmountUsd,
        });
      }

      // Detect affiliate from hostname if not provided
      let validAffiliateId: string | undefined = undefined;
      const hostname = req.get("host") || req.hostname;
      if (hostname) {
        const parts = hostname.split(".");
        // Check for pattern: affiliateslug.brandslug.domain.extension
        // e.g., checktwo.limitless.fusehealth.com
        if (parts.length >= 4) {
          const affiliateSlug = parts[0];
          console.log("🔍 Detecting affiliate from hostname (product subscription):", { hostname, affiliateSlug });

          // Find affiliate by website (slug) field
          const affiliateBySlug = await User.findOne({
            where: {
              website: affiliateSlug,
            },
            include: [
              {
                model: UserRoles,
                as: "userRoles",
                required: true,
              },
            ],
          });

          if (affiliateBySlug) {
            await affiliateBySlug.getUserRoles();
            if (affiliateBySlug.userRoles?.hasRole("affiliate")) {
              validAffiliateId = affiliateBySlug.id;
              console.log("✅ Found affiliate from hostname (product subscription):", { affiliateId: validAffiliateId, slug: affiliateSlug });
            }
          }
        }
      }

      // Create order
      const orderNumber = await Order.generateOrderNumber();
      const order = await Order.create({
        orderNumber,
        userId: currentUser.id,
        clinicId: tenantProduct.clinicId, // Product subscription order linked to clinic
        questionnaireId: tenantProduct.questionnaireId || null,
        status: "pending",
        billingInterval: BillingInterval.MONTHLY,
        subtotalAmount: totalAmount,
        discountAmount: 0,
        taxAmount: 0,
        ...(validAffiliateId && { affiliateId: validAffiliateId }),
        shippingAmount: 0,
        totalAmount: totalAmount,
        questionnaireAnswers,
        stripePriceId: tenantProduct.stripePriceId,
        tenantProductId: tenantProduct.id,
        platformFeeAmount: Number(platformFeeUsd.toFixed(2)),
        platformFeePercent: Number(platformFeePercent.toFixed(2)),
        stripeAmount: 0,
        doctorAmount: Number(doctorUsd.toFixed(2)),
        pharmacyWholesaleAmount: Number(pharmacyWholesaleUsd.toFixed(2)),
        brandAmount: Number(brandAmountUsd.toFixed(2)),
      });

      // Create order item
      await OrderItem.create({
        orderId: order.id,
        productId: tenantProduct.product.id,
        quantity: 1,
        unitPrice: unitPrice,
        totalPrice: totalAmount,
        placeholderSig: tenantProduct.product.placeholderSig,
      });

      // Create shipping address if provided
      if (
        shippingInfo.address &&
        shippingInfo.city &&
        shippingInfo.state &&
        shippingInfo.zipCode
      ) {
        await ShippingAddress.create({
          orderId: order.id,
          address: shippingInfo.address,
          apartment: shippingInfo.apartment || null,
          city: shippingInfo.city,
          state: shippingInfo.state,
          zipCode: shippingInfo.zipCode,
          country: shippingInfo.country || "US",
          userId: currentUser.id,
        });
      }

      // Create payment intent with Stripe (manual capture)
      const authPaymentIntentParams: any = {
        amount: Math.round(totalAmount * 100),
        currency: "usd",
        customer: stripeCustomerId,
        capture_method: "manual",
        metadata: {
          userId: currentUser.id,
          tenantProductId: tenantProduct.id,
          orderId: order.id,
          orderNumber: orderNumber,
          orderType: "product_subscription_initial_authorization",
          brandAmountUsd: brandAmountUsd.toFixed(2),
          platformFeePercent: String(platformFeePercent),
          platformFeeUsd: platformFeeUsd.toFixed(2),
          doctorFlatUsd: doctorUsd.toFixed(2),
          pharmacyWholesaleUsd: pharmacyWholesaleUsd.toFixed(2),
        },
        // HIPAA: Generic description only; no product/treatment names (Payment Processing Exemption)
        description: `Subscription Authorization ${orderNumber}`,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        setup_future_usage: "off_session",
      };

      // Add transfer_data to automatically transfer brandAmount to clinic
      if (tenantProduct.clinic?.stripeAccountId && brandAmountUsd > 0) {
        authPaymentIntentParams.transfer_data = {
          destination: tenantProduct.clinic.stripeAccountId,
          amount: Math.round(brandAmountUsd * 100), // Only brand's portion
        };
        console.log(
          `💸 Adding transfer_data: $${brandAmountUsd.toFixed(2)} to clinic Stripe account ${tenantProduct.clinic.stripeAccountId}`
        );
      }

      // Add on_behalf_of if clinic is merchant of record
      if (useOnBehalfOf && tenantProduct.clinic?.stripeAccountId) {
        authPaymentIntentParams.on_behalf_of =
          tenantProduct.clinic.stripeAccountId;
        console.log(
          `💳 Using on_behalf_of parameter for clinic ${tenantProduct.clinic.id} with Stripe account ${tenantProduct.clinic.stripeAccountId}`
        );

        // Card payment intents must use statement_descriptor_suffix (not statement_descriptor)
        const descriptorClinic = buildStatementDescriptor(tenantProduct.clinic?.name);
        if (descriptorClinic) {
          authPaymentIntentParams.statement_descriptor_suffix = descriptorClinic;
          console.log(
            `💳 Clinic is MOR - Using statement descriptor suffix: "${descriptorClinic}"`
          );
        }
      } else {
        // Card payment intents must use statement_descriptor_suffix
        const descriptorClinic = buildStatementDescriptorSuffix(tenantProduct.clinic?.name);
        if (descriptorClinic) {
          authPaymentIntentParams.statement_descriptor_suffix = descriptorClinic;
          console.log(
            `💳 Fuse is MOR - Using statement descriptor suffix: "${descriptorClinic}"`
          );
        }
      }

      // Docs: https://docs.stripe.com/api/payment_intents/create#create_payment_intent-on_behalf_of
      const paymentIntent = await stripe.paymentIntents.create(
        authPaymentIntentParams
      );

      // Create payment record
      await Payment.create({
        orderId: order.id,
        stripePaymentIntentId: paymentIntent.id,
        status: "pending",
        paymentMethod: "card",
        amount: totalAmount,
        currency: "USD",
      });

      console.log("💳 Product subscription order and payment intent created:", {
        orderId: order.id,
        orderNumber: orderNumber,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        userId: currentUser.id,
        productId,
      });

      res.status(200).json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          orderId: order.id,
          orderNumber: orderNumber,
        },
      });
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error(
          "❌ Error creating product subscription order and payment intent:",
          error
        );
      } else {
        console.error(
          "❌ Error creating product subscription order and payment intent"
        );
      }

      // Log specific error details for debugging
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }

      // Check if it's a Stripe error
      if (error && typeof error === "object" && "type" in error) {
        console.error("Stripe error type:", (error as any).type);
        console.error("Stripe error code:", (error as any).code);
      }

      res.status(500).json({
        success: false,
        message:
          "Failed to create product subscription order and payment intent",
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      });
    }
  }
);

// Public product subscription: creates manual-capture PaymentIntent and Order
app.post("/payments/product/sub", async (req, res) => {
  try {
    const {
      tenantProductId,
      stripePriceId,
      userDetails,
      questionnaireAnswers,
      shippingInfo,
      useOnBehalfOf,
      clinicName,
    } = req.body || {};

    if (!tenantProductId || typeof tenantProductId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "tenantProductId is required" });
    }

    // Try authenticated user from JWT; if none, create/find from userDetails
    let currentUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        currentUser = getCurrentUser(req);
      } catch { }
    }

    if (!currentUser) {
      const { firstName, lastName, email, phoneNumber } = userDetails || {};
      if (!email || !firstName || !lastName) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "userDetails with firstName, lastName, and email is required for public checkout",
          });
      }
      // Find or create patient user
      currentUser = await User.findByEmail(email);
      if (!currentUser) {
        currentUser = await User.createUser({
          firstName,
          lastName,
          email,
          password: "TempPassword123!",
          role: "patient",
          phoneNumber,
        });
      }
    }

    // Load tenant product configuration
    const tenantProduct = await TenantProduct.findByPk(tenantProductId, {
      include: [
        { model: Clinic, as: "clinic", required: false },
        { model: Product, as: "product", required: true },
      ],
    });

    if (!tenantProduct) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Product not available for subscription",
        });
    }

    const unitPrice = (tenantProduct as any).price;
    const totalAmount = unitPrice;

    // If no stripePriceId is provided or exists on the tenant product, create one
    let finalStripePriceId =
      stripePriceId || (tenantProduct as any).stripePriceId;

    if (!finalStripePriceId) {
      console.log(
        "💰 No Stripe price found, creating one for tenant product:",
        tenantProductId
      );

      const product = (tenantProduct as any).product;

      // Step 1: Create or get Stripe product
      let stripeProductId = (tenantProduct as any).stripeProductId;
      if (!stripeProductId) {
        console.log(
          "📦 Creating Stripe product for tenant product:",
          tenantProductId
        );

        // HIPAA: Do not send product name/description to Stripe (could be PHI). Use generic label only.
        const productParams: any = {
          name: `Subscription - ${(tenantProduct as any).clinic?.name || "Service"}`,
          metadata: {
            productId: product.id,
            tenantProductId: (tenantProduct as any).id,
            clinicId: (tenantProduct as any).clinicId,
          },
        };

        const stripeProduct = await stripe.products.create(productParams);

        stripeProductId = stripeProduct.id;
        await tenantProduct.update({ stripeProductId });

        console.log("✅ Stripe product created:", stripeProductId);
      } else {
        console.log("✅ Using existing Stripe product:", stripeProductId);
      }

      // Step 2: Create new Stripe price
      console.log(
        "💰 Creating Stripe price for tenant product:",
        tenantProductId
      );

      const stripePrice = await stripe.prices.create({
        product: stripeProductId,
        currency: "usd",
        unit_amount: Math.round(unitPrice * 100), // Convert to cents
        recurring: {
          interval: "month",
          interval_count: 1,
        },
        metadata: {
          productId: product.id,
          tenantProductId: (tenantProduct as any).id,
          clinicId: (tenantProduct as any).clinicId,
          priceType: "base_price",
        },
      });

      finalStripePriceId = stripePrice.id;
      await tenantProduct.update({ stripePriceId: finalStripePriceId });

      console.log("✅ Stripe price created and saved:", finalStripePriceId);
    }

    // Ensure Stripe customer
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const userService = new UserService();
    const stripeCustomerId = await userService.getOrCreateCustomerId(user, {
      userId: user.id,
      tenantProductId,
    });

    // Calculate fee breakdown (Stripe fee not subtracted: FUSE pays Stripe)
    const fees = await useGlobalFees();
    
    // Get platform fee percent based on clinic's tier (or global fallback)
    const platformFeePercent = (tenantProduct as any).clinicId 
      ? await getPlatformFeePercent((tenantProduct as any).clinicId)
      : fees.platformFeePercent;
    
    const doctorFlatUsd = fees.doctorFlatFeeUsd;
    const totalPaid = Number(totalAmount) || 0;
    const platformFeeUsd = Math.max(0, (platformFeePercent / 100) * totalPaid);

    // Get pharmacy wholesale cost from the product (quantity is 1 for subscriptions)
    const pharmacyWholesaleUsd = Number(
      (tenantProduct as any).product?.pharmacyWholesaleCost || 0
    );

    // Doctor receives flat fee
    const doctorUsd = Math.max(0, doctorFlatUsd);

    // Brand gets the residual after platform, doctor, pharmacy (no Stripe deduction)
    const brandAmountUsd = Math.max(
      0,
      totalPaid -
      platformFeeUsd -
      doctorUsd -
      pharmacyWholesaleUsd
    );

    console.log("💰 Fee breakdown calculated:", {
      totalPaid,
      platformFeeUsd,
      pharmacyWholesaleUsd,
      doctorUsd,
      brandAmountUsd,
    });

    // Detect affiliate from body or hostname
    let validAffiliateId: string | undefined = undefined;
    const affiliateSlugFromBody = req.body.affiliateSlug;

    if (affiliateSlugFromBody) {
      // Prefer affiliate slug from request body (sent by frontend)
      console.log("🔍 Detecting affiliate from request body:", { affiliateSlug: affiliateSlugFromBody });

      const affiliateBySlug = await User.findOne({
        where: {
          website: affiliateSlugFromBody,
        },
        include: [
          {
            model: UserRoles,
            as: "userRoles",
            required: true,
          },
        ],
      });

      if (affiliateBySlug) {
        await affiliateBySlug.getUserRoles();
        if (affiliateBySlug.userRoles?.hasRole("affiliate")) {
          validAffiliateId = affiliateBySlug.id;
          console.log("✅ Found affiliate from request body:", { affiliateId: validAffiliateId, slug: affiliateSlugFromBody });
        }
      }
    } else {
      // Fallback: try to detect from hostname
      const hostname = req.get("host") || req.hostname;
      if (hostname) {
        const parts = hostname.split(".");
        // Check for pattern: affiliateslug.brandslug.domain.extension
        // e.g., checktwo.limitless.fusehealth.com
        if (parts.length >= 4) {
          const affiliateSlug = parts[0];
          console.log("🔍 Detecting affiliate from hostname (fallback):", { hostname, affiliateSlug });

          // Find affiliate by website (slug) field
          const affiliateBySlug = await User.findOne({
            where: {
              website: affiliateSlug,
            },
            include: [
              {
                model: UserRoles,
                as: "userRoles",
                required: true,
              },
            ],
          });

          if (affiliateBySlug) {
            await affiliateBySlug.getUserRoles();
            if (affiliateBySlug.userRoles?.hasRole("affiliate")) {
              validAffiliateId = affiliateBySlug.id;
              console.log("✅ Found affiliate from hostname (fallback):", { affiliateId: validAffiliateId, slug: affiliateSlug });
            }
          }
        }
      }
    }

    // Create order
    const orderNumber = await Order.generateOrderNumber();

    console.log("📝 [ORDER CREATION] Creating order with:", {
      orderNumber,
      userId: currentUser.id,
      clinicId: (tenantProduct as any).clinicId,
      affiliateId: validAffiliateId || 'NO AFFILIATE',
      hasAffiliateSlugFromBody: !!affiliateSlugFromBody,
      affiliateSlugValue: affiliateSlugFromBody,
    });

    const order = await Order.create({
      orderNumber,
      userId: currentUser.id,
      clinicId: (tenantProduct as any).clinicId || null,
      questionnaireId: (tenantProduct as any).questionnaireId || null,
      status: "pending",
      billingInterval: BillingInterval.MONTHLY,
      subtotalAmount: totalAmount,
      discountAmount: 0,
      taxAmount: 0,
      ...(validAffiliateId && { affiliateId: validAffiliateId }),
      shippingAmount: 0,
      totalAmount: totalAmount,
      questionnaireAnswers,
      stripePriceId: finalStripePriceId,
      tenantProductId: (tenantProduct as any).id,
      platformFeeAmount: Number(platformFeeUsd.toFixed(2)),
      platformFeePercent: Number(platformFeePercent.toFixed(2)),
      stripeAmount: 0,
      doctorAmount: Number(doctorUsd.toFixed(2)),
      pharmacyWholesaleAmount: Number(pharmacyWholesaleUsd.toFixed(2)),
      brandAmount: Number(brandAmountUsd.toFixed(2)),
    });

    console.log("✅ [ORDER CREATION] Order created successfully:", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      affiliateId: order.affiliateId || 'NO AFFILIATE ASSIGNED',
      status: order.status,
    });

    // Order item
    await OrderItem.create({
      orderId: order.id,
      productId: (tenantProduct as any).product.id,
      quantity: 1,
      unitPrice: unitPrice,
      totalPrice: totalAmount,
      placeholderSig: (tenantProduct as any).product.placeholderSig,
    });

    // Shipping address
    if (
      shippingInfo?.address &&
      shippingInfo?.city &&
      shippingInfo?.state &&
      shippingInfo?.zipCode
    ) {
      const createdAddress = await ShippingAddress.create({
        orderId: order.id,
        address: shippingInfo.address,
        apartment: shippingInfo.apartment || null,
        city: shippingInfo.city,
        state: shippingInfo.state,
        zipCode: shippingInfo.zipCode,
        country: shippingInfo.country || "US",
        userId: currentUser.id,
      });
      await order.update({ shippingAddressId: createdAddress.id });
    }

    // Update user with DOB and gender from questionnaire if present
    try {
      if (questionnaireAnswers) {
        const updateData: any = {};

        // Check if questionnaireAnswers has structured format
        const answers = questionnaireAnswers.answers || [];

        // Extract DOB from questionnaire answers
        const dobAnswer = answers.find(
          (a: any) =>
            a.questionText?.toLowerCase().includes("date of birth") ||
            a.questionText?.toLowerCase().includes("birthday") ||
            a.questionText?.toLowerCase().includes("dob")
        );

        // Extract gender from questionnaire answers
        const genderAnswer = answers.find(
          (a: any) =>
            a.questionText?.toLowerCase().includes("gender") ||
            a.questionText?.toLowerCase().includes("sex")
        );

        // Only update if user doesn't have these values already
        if (dobAnswer?.answer && !user.dob) {
          // Normalize DOB to YYYY-MM-DD format
          let normalized = String(dobAnswer.answer);
          const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
          const usMatch = mmddyyyy.exec(normalized);
          if (usMatch) {
            const mm = usMatch[1].padStart(2, "0");
            const dd = usMatch[2].padStart(2, "0");
            const yyyy = usMatch[3];
            normalized = `${yyyy}-${mm}-${dd}`;
          }
          updateData.dob = normalized;
          console.log(`📋 Extracted DOB from questionnaire: ${normalized}`);
        }

        if (genderAnswer?.answer && !user.gender) {
          // Extract gender value (could be from selectedOptions or direct answer)
          let genderValue = genderAnswer.answer;
          if (
            genderAnswer.selectedOptions &&
            genderAnswer.selectedOptions.length > 0
          ) {
            genderValue = genderAnswer.selectedOptions[0].optionText;
          }
          updateData.gender = String(genderValue).toLowerCase();
          console.log(`📋 Extracted gender from questionnaire: ${genderValue}`);
        }

        // Update user if we have new data
        if (Object.keys(updateData).length > 0) {
          await user.update(updateData);
          console.log(
            `✅ Updated user ${user.id} with questionnaire data:`,
            updateData
          );
        }
      }
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error(
          "❌ Error updating user from questionnaire answers:",
          error
        );
      } else {
        console.error("❌ Error updating user from questionnaire answers");
      }
      // Don't fail the order creation if user update fails
    }

    // Manual-capture PaymentIntent
    // Check if we should use On Behalf Of (OBO) parameter for clinic as merchant of record
    const paymentIntentParams: any = {
      amount: Math.round(totalAmount * 100),
      currency: "usd",
      customer: stripeCustomerId,
      capture_method: "manual",
      metadata: {
        userId: currentUser.id,
        tenantProductId: (tenantProduct as any).id,
        orderId: order.id,
        orderNumber: orderNumber,
        orderType: "product_subscription_initial_authorization",
        brandAmountUsd: brandAmountUsd.toFixed(2),
        platformFeePercent: String(platformFeePercent),
        platformFeeUsd: platformFeeUsd.toFixed(2),
        doctorFlatUsd: doctorUsd.toFixed(2),
        pharmacyWholesaleUsd: pharmacyWholesaleUsd.toFixed(2),
      },
      // HIPAA: Generic description only; no product/treatment names (Payment Processing Exemption)
      description: `Subscription Authorization ${orderNumber}`,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      setup_future_usage: "off_session",
    };

    // Add transfer_data to automatically transfer brandAmount to clinic
    if ((tenantProduct as any).clinic?.stripeAccountId && brandAmountUsd > 0) {
      paymentIntentParams.transfer_data = {
        destination: (tenantProduct as any).clinic.stripeAccountId,
        amount: Math.round(brandAmountUsd * 100), // Only brand's portion
      };
      console.log(
        `💸 Adding transfer_data: $${brandAmountUsd.toFixed(2)} to clinic Stripe account ${(tenantProduct as any).clinic.stripeAccountId}`
      );
    }

    // Add on_behalf_of if clinic is merchant of record
    if (useOnBehalfOf && (tenantProduct as any).clinic?.stripeAccountId) {
      paymentIntentParams.on_behalf_of = (
        tenantProduct as any
      ).clinic.stripeAccountId;
      console.log(
        `💳 Using on_behalf_of parameter for clinic ${(tenantProduct as any).clinic.id} with Stripe account ${(tenantProduct as any).clinic.stripeAccountId}`
      );

      // Card payment intents must use statement_descriptor_suffix (not statement_descriptor)
      const descriptorName = buildStatementDescriptor(
        clinicName || (tenantProduct as any).clinic?.name
      );
      if (descriptorName) {
        paymentIntentParams.statement_descriptor_suffix = descriptorName;
        console.log(
          `💳 Clinic is MOR - Using statement descriptor suffix: "${descriptorName}"`
        );
      }
    } else {
      // Card payment intents must use statement_descriptor_suffix
      const descriptorName = buildStatementDescriptorSuffix(
        clinicName || (tenantProduct as any).clinic?.name
      );
      if (descriptorName) {
        paymentIntentParams.statement_descriptor_suffix = descriptorName;
        console.log(
          `💳 Fuse is MOR - Using statement descriptor suffix: "${descriptorName}"`
        );
      }
    }

    // Docs: https://docs.stripe.com/api/payment_intents/create#create_payment_intent-on_behalf_of
    const paymentIntent =
      await stripe.paymentIntents.create(paymentIntentParams);

    // Store stripePriceId on order for subscription creation after capture
    await order.update({
      stripePriceId: finalStripePriceId,
    });

    // Create Payment record - this is the single source of truth for payment intent ID
    await Payment.create({
      orderId: order.id,
      stripePaymentIntentId: paymentIntent.id,
      status: "pending",
      paymentMethod: "card",
      amount: totalAmount,
      currency: "USD",
    });

    return res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: order.id,
        orderNumber,
      },
    });
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error in /payments/product/sub:", error);
    } else {
      console.error("❌ Error in /payments/product/sub");
    }
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to create product subscription",
      });
  }
});

// Program subscription: creates PaymentIntent for program with multiple products
app.post("/payments/program/sub", async (req, res) => {
  try {
    const {
      programId,
      selectedProductIds,
      totalAmount,
      productsTotal,
      nonMedicalServicesFee,
      userDetails,
      questionnaireAnswers,
      shippingInfo,
      clinicId,
      clinicName,
    } = req.body || {};

    const safeTotalAmount = Number(totalAmount) || 0;
    const safeProductsTotal = Number(productsTotal) || 0;
    const safeNonMedicalServicesFee = Number(nonMedicalServicesFee) || 0;

    console.log("🚀 Program subscription request:", {
      programId,
      selectedProductIds,
      totalAmount,
      productsTotal,
      nonMedicalServicesFee,
    });

    if (!programId || !selectedProductIds?.length || !safeTotalAmount) {
      return res.status(400).json({
        success: false,
        message: "programId, selectedProductIds, and totalAmount are required",
      });
    }

    // Find or create user
    let currentUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        currentUser = getCurrentUser(req);
      } catch { }
    }

    if (!currentUser) {
      const { firstName, lastName, email, phoneNumber } = userDetails || {};
      if (!email || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: "userDetails with firstName, lastName, and email is required",
        });
      }
      currentUser = await User.findByEmail(email);
      if (!currentUser) {
        currentUser = await User.createUser({
          firstName,
          lastName,
          email,
          password: "TempPassword123!",
          role: "patient",
          phoneNumber,
        });
      }
    }

    // Fetch program
    const program = await Program.findByPk(programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    // Fetch clinic
    const clinic = await Clinic.findByPk(clinicId || program.clinicId);

    // Ensure Stripe customer
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const userService = new UserService();
    const stripeCustomerId = await userService.getOrCreateCustomerId(user, {
      userId: user.id,
      programId,
    });

    // Create dynamic Stripe product and price for this program subscription
    console.log("📦 Creating Stripe product for program subscription...");

    // HIPAA: Do not send program name to Stripe (could be PHI). Use generic label only.
    const stripeProduct = await stripe.products.create({
      name: `Program Subscription`,
      metadata: {
        programId: program.id,
        clinicId: program.clinicId || '',
        selectedProductIds: selectedProductIds.join(","),
      },
    });

    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      currency: "usd",
      unit_amount: Math.round(safeTotalAmount * 100), // Convert to cents
      recurring: {
        interval: "month",
        interval_count: 1,
      },
      metadata: {
        programId: program.id,
        clinicId: program.clinicId || '',
        productsTotal: String(safeProductsTotal),
        nonMedicalServicesFee: String(safeNonMedicalServicesFee),
      },
    });

    console.log("✅ Stripe product and price created:", {
      productId: stripeProduct.id,
      priceId: stripePrice.id,
      amount: safeTotalAmount,
    });

    // Calculate fee breakdown (Stripe fee not subtracted: FUSE pays Stripe)
    const fees = await useGlobalFees();
    
    // Get platform fee percent based on clinic's tier (or global fallback)
    const programClinicId = clinicId || program.clinicId;
    const platformFeePercent = programClinicId 
      ? await getPlatformFeePercent(programClinicId)
      : fees.platformFeePercent;
    const nonMedicalProfitPercent = programClinicId
      ? await getNonMedicalServicesProfitPercent(programClinicId)
      : 0;
    
    const doctorFlatUsd = fees.doctorFlatFeeUsd;
    // Fuse Fee = % of total order; Non-Medical Profit = % of non-medical services only; then other fees; rest to brand
    const platformFeeUsd = Math.max(0, (platformFeePercent / 100) * safeTotalAmount);
    const nonMedicalProfitShareUsd = Math.max(
      0,
      (nonMedicalProfitPercent / 100) * safeNonMedicalServicesFee
    );
    const doctorUsd = Math.max(0, doctorFlatUsd);
    const totalFuseFeeUsd = platformFeeUsd + nonMedicalProfitShareUsd;
    const brandAmountUsd = Math.max(
      0,
      safeTotalAmount - totalFuseFeeUsd - doctorUsd
    );

    if (process.env.NODE_ENV === "development") {
      console.log("💰 [program/sub] Fee breakdown:", {
        programClinicId,
        platformFeePercent,
        nonMedicalProfitPercent,
        safeTotalAmount: safeTotalAmount.toFixed(2),
        safeNonMedicalServicesFee: safeNonMedicalServicesFee.toFixed(2),
        platformFeeUsd: platformFeeUsd.toFixed(2),
        nonMedicalProfitShareUsd: nonMedicalProfitShareUsd.toFixed(2),
        totalFuseFeeUsd: totalFuseFeeUsd.toFixed(2),
        doctorUsd: doctorUsd.toFixed(2),
        brandAmountUsd: brandAmountUsd.toFixed(2),
      });
    }

    // Calculate visit fee based on patient state and program's questionnaire
    let visitFeeAmount = 0;
    let visitType: 'synchronous' | 'asynchronous' | null = null;
    
    try {
      const patientState = shippingInfo?.state?.toUpperCase();
      
      if (patientState && program.medicalTemplateId && program.clinicId) {
        // Get questionnaire with visit type configuration
        const questionnaire = await Questionnaire.findByPk(program.medicalTemplateId, {
          attributes: ['id', 'visitTypeByState', 'medicalCompanySource'],
        });

        if (questionnaire && questionnaire.visitTypeByState) {
          // Determine visit type required for this state
          visitType = (questionnaire.visitTypeByState as any)[patientState] || 'asynchronous';
          
          // Resolve fees by medical company (platform) with clinic fallback
          const clinicWithFees = await Clinic.findByPk(program.clinicId, {
            attributes: ['id', 'visitTypeFees', 'patientPortalDashboardFormat'],
          });

          const medicalCompanySlug =
            (questionnaire as any)?.medicalCompanySource ||
            clinicWithFees?.patientPortalDashboardFormat;
          const medicalCompany = medicalCompanySlug
            ? await MedicalCompany.findOne({
                where: { slug: medicalCompanySlug },
                attributes: ['id', 'slug', 'visitTypeFees'],
              })
            : null;

          if (visitType) {
            const medicalCompanyFee =
              Number((medicalCompany?.visitTypeFees as any)?.[visitType]) || 0;
            const clinicFallbackFee =
              Number((clinicWithFees?.visitTypeFees as any)?.[visitType]) || 0;
            visitFeeAmount = medicalCompanyFee || clinicFallbackFee;
            
            if (visitFeeAmount > 0) {
              console.log(`✅ Visit fee calculated for program:`, {
                programId,
                patientState,
                visitType,
                visitFeeAmount,
                source: medicalCompanyFee ? 'medical-company' : 'clinic-fallback',
                resolvedMedicalCompanySlug: medicalCompanySlug,
                medicalCompanySlug: medicalCompany?.slug,
                clinicId: program.clinicId,
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn("⚠️ Failed to calculate visit fee for program, defaulting to 0:", error);
      visitFeeAmount = 0;
    }

    // Add visit fee to total amount
    const finalTotalAmount = safeTotalAmount + visitFeeAmount;

    // Create order
    const orderNumber = await Order.generateOrderNumber();
    const order = await Order.create({
      orderNumber,
      userId: currentUser.id,
      clinicId: program.clinicId,
      status: "pending",
      billingInterval: BillingInterval.MONTHLY,
      subtotalAmount: safeTotalAmount,
      discountAmount: 0,
      taxAmount: 0,
      shippingAmount: 0,
      totalAmount: finalTotalAmount,
      visitType,
      visitFeeAmount,
      questionnaireAnswers,
      stripePriceId: stripePrice.id,
      programId: program.id,
      questionnaireId: program.medicalTemplateId, // Link to questionnaire for Beluga/MDI
      platformFeeAmount: Number(totalFuseFeeUsd.toFixed(2)),
      platformFeePercent: Number(platformFeePercent.toFixed(2)),
      stripeAmount: 0,
      doctorAmount: Number(doctorUsd.toFixed(2)),
      brandAmount: Number(brandAmountUsd.toFixed(2)),
    });

    // Create order items for each selected product
    let firstTenantProductId: string | null = null;
    for (const productId of selectedProductIds) {
      const product = await Product.findByPk(productId);
      if (product) {
        // Get tenant product for this product/clinic for pricing
        const tenantProduct = await TenantProduct.findOne({
          where: { productId, clinicId: program.clinicId },
        });
        const unitPrice = tenantProduct?.price || product.price || 0;

        // Save first tenantProductId for linking to Beluga/MDI
        if (!firstTenantProductId && tenantProduct) {
          firstTenantProductId = tenantProduct.id;
        }

        await OrderItem.create({
          orderId: order.id,
          productId: product.id,
          quantity: 1,
          unitPrice: unitPrice,
          totalPrice: unitPrice,
          placeholderSig: product.placeholderSig,
        });
      }
    }

    // Update order with first tenantProductId for Beluga/MDI integration
    if (firstTenantProductId) {
      await order.update({ tenantProductId: firstTenantProductId });
    }

    // Shipping address
    if (
      shippingInfo?.address &&
      shippingInfo?.city &&
      shippingInfo?.state &&
      shippingInfo?.zipCode
    ) {
      const createdAddress = await ShippingAddress.create({
        orderId: order.id,
        address: shippingInfo.address,
        apartment: shippingInfo.apartment || null,
        city: shippingInfo.city,
        state: shippingInfo.state,
        zipCode: shippingInfo.zipCode,
        country: shippingInfo.country || "US",
        userId: currentUser.id,
      });
      await order.update({ shippingAddressId: createdAddress.id });
    }

    // Create PaymentIntent
    const paymentIntentParams: any = {
      amount: Math.round(finalTotalAmount * 100),
      currency: "usd",
      customer: stripeCustomerId,
      capture_method: "manual",
      metadata: {
        userId: currentUser.id,
        programId: program.id,
        orderId: order.id,
        orderNumber: orderNumber,
        orderType: "program_subscription_initial_authorization",
        visitType: visitType || 'none',
        visitFeeAmount: visitFeeAmount.toFixed(2),
        brandAmountUsd: brandAmountUsd.toFixed(2),
        platformFeePercent: String(platformFeePercent),
        platformFeeUsd: platformFeeUsd.toFixed(2),
        nonMedicalProfitPercent: String(nonMedicalProfitPercent),
        nonMedicalProfitShareUsd: nonMedicalProfitShareUsd.toFixed(2),
        doctorFlatUsd: doctorUsd.toFixed(2),
        productsTotal: safeProductsTotal.toFixed(2),
      },
      // HIPAA: Generic description only; no program/treatment names (Payment Processing Exemption)
      description: `Program Subscription ${orderNumber}`,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      setup_future_usage: "off_session",
    };

    // Add transfer_data to automatically transfer brandAmount to clinic
    if (clinic?.stripeAccountId && brandAmountUsd > 0) {
      paymentIntentParams.transfer_data = {
        destination: clinic.stripeAccountId,
        amount: Math.round(brandAmountUsd * 100), // Only brand's portion
      };
      console.log(
        `💸 Adding transfer_data: $${brandAmountUsd.toFixed(2)} to clinic Stripe account ${clinic.stripeAccountId}`
      );
    }

    // Card payment intents must use statement_descriptor_suffix
    const programStatementDescriptor = buildStatementDescriptorSuffix(
      clinicName || clinic?.name
    );
    if (programStatementDescriptor) {
      paymentIntentParams.statement_descriptor_suffix = programStatementDescriptor;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Create Payment record
    await Payment.create({
      orderId: order.id,
      stripePaymentIntentId: paymentIntent.id,
      status: "pending",
      paymentMethod: "card",
      amount: finalTotalAmount,
      currency: "USD",
    });

    console.log("✅ Program subscription created:", {
      orderId: order.id,
      orderNumber,
      paymentIntentId: paymentIntent.id,
      visitType,
      visitFeeAmount,
      finalTotalAmount,
    });

    return res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: order.id,
        orderNumber,
      },
    });
  } catch (error) {
    console.error("❌ Error in /payments/program/sub:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create program subscription",
    });
  }
});

// Create subscription for treatment
app.post("/payments/treatment/sub", async (req, res) => {
  try {
    // Validate request body using treatmentSubscriptionSchema
    const validation = treatmentSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      treatmentId,
      stripePriceId,
      userDetails,
      questionnaireAnswers,
      shippingInfo,
    } = validation.data;

    let currentUser: any = null;

    // Try to get user from auth token if provided
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        currentUser = getCurrentUser(req);
      } catch (error) {
        // Ignore auth errors for public endpoint
      }
    }

    // If no authenticated user and userDetails provided, create/find user
    if (!currentUser && userDetails) {
      const { firstName, lastName, email, phoneNumber } = userDetails;

      // Try to find existing user by email
      currentUser = await User.findByEmail(email);

      if (!currentUser) {
        // Create new user account
        console.log("🔐 Creating user account for subscription:", email);
        currentUser = await User.createUser({
          firstName,
          lastName,
          email,
          password: "TempPassword123!", // Temporary password
          role: "patient",
          phoneNumber,
        });
        console.log("✅ User account created:", currentUser.id);
      }
    }

    if (!currentUser) {
      return res.status(400).json({
        success: false,
        message: "User authentication or user details required",
      });
    }

    // Look up the treatment plan to get the billing interval
    const treatmentPlan = await TreatmentPlan.findOne({
      where: { stripePriceId },
    });

    if (!treatmentPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid stripe price ID - no matching treatment plan found",
      });
    }

    const billingInterval = treatmentPlan.billingInterval;
    console.log(
      `💳 Using billing plan: ${billingInterval} for stripePriceId: ${stripePriceId}`
    );

    const paymentService = new PaymentService();

    const result = await paymentService.subscribeTreatment({
      treatmentId,
      treatmentPlanId: treatmentPlan.id,
      userId: currentUser.id,
      billingInterval,
      stripePriceId,
      questionnaireAnswers,
      shippingInfo,
    });

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error creating treatment subscription:", error);
    } else {
      console.error("❌ Error creating treatment subscription");
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Create subscription for clinic
app.post("/payments/clinic/sub", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using clinicSubscriptionSchema
    const validation = clinicSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { clinicId } = validation.data;

    const paymentService = new PaymentService();
    const result = await paymentService.subscribeClinic(
      clinicId,
      currentUser.id
    );

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    // HIPAA: Do not log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error creating clinic subscription:", error);
    } else {
      console.error("❌ Error creating clinic subscription");
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// app.post("/stripe/connect/session", authenticateJWT, async (req, res) => {
//   try {
//     const currentUser = getCurrentUser(req);

//     if (!currentUser) {
//       return res.status(401).json({
//         success: false,
//         message: "Not authenticated",
//       });
//     }

//     const userWithClinic: any = currentUser;
//     const clinicId = userWithClinic?.clinicId;

//     if (!clinicId) {
//       return res.status(400).json({
//         success: false,
//         message: "No clinic associated with user",
//       });
//     }

//     // Get merchant model from request body (defaults to 'platform')
//     const { merchantModel } = req.body;
//     const validMerchantModel =
//       merchantModel === "direct" ? "direct" : "platform";

//     console.log(
//       `🔄 Creating Stripe Connect session for clinic: ${clinicId} (${validMerchantModel} model)`
//     );

//     // Create account session with merchant model
//     const clientSecret = await StripeConnectService.createAccountSession(
//       clinicId,
//       validMerchantModel
//     );

//     if (!clientSecret) {
//       throw new Error("Client secret was not generated");
//     }

//     res.status(200).json({
//       success: true,
//       data: {
//         client_secret: clientSecret,
//       },
//     });
//   } catch (error: any) {
//     console.error("❌ Error creating Stripe Connect session:", error);
//     if (error.type === 'StripeInvalidRequestError') {
//       console.error("❌ Stripe error details:", JSON.stringify(error.raw, null, 2));
//     }
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create Connect session",
//       error: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// });

// Webhook deduplication cache (in production, use Redis or database)
// const processedWebhooks = new Set<string>();

// Stripe webhook endpoint
// app.post(
//   "/webhook/stripe",
//   express.raw({ type: "application/json" }),
//   async (req, res) => {
//     const sig = req.headers["stripe-signature"];
//     const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

//     // HIPAA: Do not log webhook body or secrets in production
//     if (process.env.NODE_ENV === "development") {
//       console.log("🔍 Webhook received - Body length:", req.body?.length);
//     }

//     // Extract timestamp from signature for deduplication
//     const sigString = Array.isArray(sig) ? sig[0] : sig;
//     const timestampMatch = sigString?.match(/t=(\d+)/);
//     const webhookTimestamp = timestampMatch ? timestampMatch[1] : null;
//     if (process.env.NODE_ENV === "development") {
//       console.log("🔍 Webhook timestamp:", webhookTimestamp);
//     }

//     if (!endpointSecret) {
//       console.error("❌ STRIPE_WEBHOOK_SECRET not configured");
//       return res.status(400).send("Webhook secret not configured");
//     }

//     let event;

//     try {
//       const signature = Array.isArray(sig) ? sig[0] : sig;
//       if (!signature) {
//         throw new Error("No signature provided");
//       }
//       event = stripe.webhooks.constructEvent(
//         req.body,
//         signature,
//         endpointSecret
//       );
//     } catch (err: any) {
//       // SECURITY: Generic error message - don't reveal internal details
//       console.error("❌ Webhook signature verification failed");
//       // SECURITY: Log details internally but don't expose to caller
//       if (process.env.NODE_ENV === "development") {
//         console.error("Debug - Error:", err.message);
//       }
//       return res.status(400).send("Invalid request");
//     }

//     // Check for duplicate webhook events
//     const eventId = event.id;
//     if (processedWebhooks.has(eventId)) {
//       console.log("⚠️ Duplicate webhook event detected, skipping:", eventId);
//       return res.status(200).json({ received: true, duplicate: true });
//     }

//     // Add to processed webhooks (keep only last 1000 to prevent memory leaks)
//     processedWebhooks.add(eventId);
//     if (processedWebhooks.size > 1000) {
//       const firstEvent = processedWebhooks.values().next().value;
//       if (firstEvent) {
//         processedWebhooks.delete(firstEvent);
//       }
//     }

//     console.log(
//       "🎣 Stripe webhook event received:",
//       event.type,
//       "ID:",
//       eventId
//     );

//     try {
//       // Process the event using the webhook service
//       await processStripeWebhook(event);

//       // Return a 200 response to acknowledge receipt of the event
//       res.status(200).json({ received: true });
//     } catch (error) {
//       // HIPAA: Do not log detailed errors in production
//       if (process.env.NODE_ENV === "development") {
//         console.error("❌ Error processing webhook:", error);
//       } else {
//         console.error("❌ Error processing webhook");
//       }
//       res.status(500).json({ error: "Webhook processing failed" });
//     }
//   }
// );

// Get customers/users for a clinic
app.get("/users/by-clinic/:clinicId", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { clinicId } = req.params;

    // Verify user has access to this clinic
    const user = await User.findByPk(currentUser.id);
    if (!user || user.clinicId !== clinicId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this clinic",
      });
    }

    // Fetch all users who have placed orders with this clinic
    const orders = await Order.findAll({
      where: { clinicId },
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "phoneNumber",
            "createdAt",
            "updatedAt",
          ],
        },
      ],
      attributes: ["userId"],
      group: ["userId", "user.id"],
    });

    // Get unique users and count their orders
    const userIds = new Set<string>();
    orders.forEach((order) => userIds.add(order.userId));

    const customers = await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const customer = await User.findByPk(userId, {
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "phoneNumber",
            "createdAt",
            "updatedAt",
          ],
        });

        if (!customer) return null;

        // Get all orders for this customer with products
        const customerOrders = await Order.findAll({
          where: { userId, clinicId, status: "paid" },
          include: [
            {
              model: OrderItem,
              as: "orderItems",
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["id", "categories"],
                },
              ],
            },
          ],
        });

        // Calculate total revenue
        const totalRevenue = customerOrders.reduce(
          (sum, order) => sum + (order.totalAmount || 0),
          0
        );

        // Get unique product categories this customer has ordered
        const categories = new Set<string>();
        customerOrders.forEach((order) => {
          order.orderItems?.forEach((item) => {
            if (Array.isArray((item.product as any)?.categories)) {
              (item.product as any).categories.forEach(
                (category: string | null | undefined) => {
                  if (category) {
                    categories.add(category);
                  }
                }
              );
            }
          });
        });

        // Check for active subscription
        // Subscription has orderId, not userId, so we need to check through orders
        // An active subscription is one that is "paid" or "processing"
        const orderIds = customerOrders.map(order => order.id);
        let hasActiveSubscription = false;

        if (orderIds.length > 0) {
          const subscription = await Subscription.findOne({
            where: {
              orderId: {
                [Op.in]: orderIds,
              },
              status: {
                [Op.in]: ["paid", "processing"],
              },
            },
          });
          hasActiveSubscription = !!subscription;
        }

        return {
          ...customer.toJSON(),
          orderCount: customerOrders.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          categories: Array.from(categories),
          hasActiveSubscription,
        };
      })
    );

    const validCustomers = customers.filter((c) => c !== null);

    // HIPAA Audit: Log bulk PHI access (viewing all patients in a clinic)
    await AuditService.logFromRequest(req, {
      action: AuditAction.VIEW,
      resourceType: AuditResourceType.PATIENT,
      details: {
        bulkAccess: true,
        clinicId,
        patientCount: validCustomers.length,
      },
    });

    res.status(200).json({
      success: true,
      data: validCustomers,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching customers:", error);
    } else {
      console.error("❌ Error fetching customers");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
});

// Get orders for a user
app.get("/orders", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const orders = await Order.findAll({
      where: { userId: currentUser.id },
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            {
              model: Product,
              as: "product",
              include: [
                {
                  model: PharmacyCoverage,
                  as: "pharmacyCoverages",
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: Payment,
          as: "payment",
        },
        {
          model: ShippingAddress,
          as: "shippingAddress",
        },
        {
          model: Treatment,
          as: "treatment",
        },
        {
          model: ShippingOrder,
          as: "shippingOrders",
          required: false, // Left join - orders may not have shipping orders yet
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // HIPAA Audit: Log PHI access (patient viewing their orders)
    await AuditService.logFromRequest(req, {
      action: AuditAction.VIEW,
      resourceType: AuditResourceType.ORDER,
      details: { orderCount: orders.length, selfAccess: true },
    });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching orders:", error);
    } else {
      console.error("❌ Error processing orders");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
});

// Brand Subscription routes

// Get available subscription plans
app.get("/brand-subscriptions/plans", async (req, res) => {
  try {
    const plans = await BrandSubscriptionPlans.getActivePlans();

    // Fetch tier configurations for all plans
    const formattedPlans = await Promise.all(
      plans.map(async (plan) => {
        const tierConfig = await TierConfiguration.findOne({
          where: { brandSubscriptionPlanId: plan.id },
        });

        return {
          id: plan.id,
          name: plan.name,
          description: plan.description || "",
          monthlyPrice: Number(plan.monthlyPrice),
          planType: plan.planType,
          stripePriceId: plan.stripePriceId,
          introMonthlyPrice: plan.introMonthlyPrice != null ? Number(plan.introMonthlyPrice) : null,
          introMonthlyPriceDurationMonths: plan.introMonthlyPriceDurationMonths || null,
          introMonthlyPriceStripeId: plan.introMonthlyPriceStripeId || null,
          features: plan.getFeatures(),
          tierConfig: tierConfig ? tierConfig.toJSON() : null,
        };
      })
    );

    res.json({ success: true, plans: formattedPlans });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching subscription plans:", error);
    } else {
      console.error("❌ Error fetching subscription plans");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription plans",
    });
  }
});

// Get current user's brand subscription
app.get("/brand-subscriptions/current", authenticateJWT, async (req, res) => {
  try {
    // Return successful response with no subscription (empty)
    return res.status(200).json({
      success: true,
      subscription: null,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching brand subscription:", error);
    } else {
      console.error("❌ Error fetching brand subscription");
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription",
    });
  }
});

// Get basic subscription info (status, tutorialFinished, stripeCustomerId)
app.get(
  "/brand-subscriptions/basic-info",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const brandSubscriptionService = new BrandSubscriptionService();
      const subscriptionInfo =
        await brandSubscriptionService.getBasicSubscriptionInfo(currentUser.id);

      if (!subscriptionInfo) {
        return res.status(404).json({
          success: false,
          message: "No subscription found",
        });
      }

      return res.status(200).json({
        success: true,
        data: subscriptionInfo,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error getting basic subscription info:", error);
      } else {
        console.error("❌ Error getting basic subscription info");
      }
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Mark tutorial as finished
app.post(
  "/brand-subscriptions/mark-tutorial-finished",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { step } = req.body;
      const brandSubscriptionService = new BrandSubscriptionService();
      // step is optional, so only pass it if it's defined
      const success = await brandSubscriptionService.markTutorialFinished(
        currentUser.id,
        step !== undefined ? step : undefined
      );

      if (!success) {
        return res.status(404).json({
          success: false,
          message: "No subscription found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Tutorial marked as finished",
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error marking tutorial as finished:", error);
      } else {
        console.error("❌ Error marking tutorial as finished");
      }
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Update tutorial step
app.put(
  "/brand-subscriptions/tutorial-step",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { step } = req.body;

      if (step === undefined || step === null) {
        return res.status(400).json({
          success: false,
          message: "Step is required",
        });
      }

      const brandSubscriptionService = new BrandSubscriptionService();
      // Ensure step is a number
      const stepNumber = typeof step === 'number' ? step : parseInt(String(step), 10);
      const success = await brandSubscriptionService.updateTutorialStep(
        currentUser.id,
        stepNumber
      );

      if (!success) {
        return res.status(404).json({
          success: false,
          message: "No subscription found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Tutorial step updated",
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating tutorial step:", error);
      } else {
        console.error("❌ Error updating tutorial step");
      }
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Update brand subscription features (admin only)
app.put("/brand-subscriptions/features", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using updateBrandSubscriptionFeaturesSchema
    const validation = updateBrandSubscriptionFeaturesSchema.safeParse(
      req.body
    );
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const brandSubscriptionService = new BrandSubscriptionService();
    const result = await brandSubscriptionService.updateFeatures(
      currentUser.id,
      validation.data
    );

    if (!result.success) {
      const statusCode =
        result.message === "Access denied"
          ? 403
          : result.message === "Subscription not found"
            ? 404
            : 400;
      return res.status(statusCode).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    res.status(200).json(result);
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating subscription features:", error);
    } else {
      console.error("❌ Error updating subscription features");
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update subscription features",
    });
  }
});

// Create payment intent for direct card processing
app.post(
  "/brand-subscriptions/create-payment-intent",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("brand")) {
        console.error("❌ BACKEND CREATE: Access denied - not brand role");
        return res.status(403).json({
          success: false,
          message: "Access denied. Brand role required.",
        });
      }

      // Validate request body using brandPaymentIntentSchema
      const validation = brandPaymentIntentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { brandSubscriptionPlanId } = validation.data;

      const selectedPlan = await BrandSubscriptionPlans.findByPk(
        brandSubscriptionPlanId
      );

      if (!selectedPlan) {
        return res.status(404).json({
          success: false,
          message: "Plan not found",
        });
      }

      // User already fetched above

      // Create or retrieve Stripe customer
      let stripeCustomerId = await userService.getOrCreateCustomerId(user, {
        userId: user.id,
        role: user.role,
        brandSubscriptionPlanId,
      });

      // Check if plan has intro pricing
      const hasIntroPricing = selectedPlan.introMonthlyPrice != null 
        && selectedPlan.introMonthlyPriceDurationMonths 
        && selectedPlan.introMonthlyPriceStripeId;

      const brandSubscription = await BrandSubscription.create({
        userId: user.id,
        status: BrandSubscriptionStatus.PENDING,
        stripeCustomerId: stripeCustomerId,
        stripePriceId: selectedPlan.stripePriceId,
        monthlyPrice: selectedPlan.monthlyPrice,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        planType: selectedPlan.planType,
      });

      if (hasIntroPricing) {
        // Intro pricing: use SetupIntent to collect payment method
        // The subscription schedule will handle all billing (including first charge)
        console.log(`📋 Plan has intro pricing: $${selectedPlan.introMonthlyPrice}/mo for ${selectedPlan.introMonthlyPriceDurationMonths} months, then $${selectedPlan.monthlyPrice}/mo`);

        const setupIntent = await stripe.setupIntents.create({
          customer: stripeCustomerId,
          metadata: {
            userId: currentUser.id,
            brandSubscriptionPlanId,
            brandSubscriptionId: brandSubscription.id,
          },
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
        });

        res.status(200).json({
          success: true,
          clientSecret: setupIntent.client_secret,
          type: "setup_intent",
          brandSubscriptionId: brandSubscription.id,
        });
      } else {
        // No intro pricing: use PaymentIntent for first month (existing flow)
        const amount = selectedPlan.monthlyPrice;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: "usd",
          customer: stripeCustomerId,
          metadata: {
            userId: currentUser.id,
            brandSubscriptionPlanId,
            amount: amount.toString(),
          },
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
          setup_future_usage: "off_session",
          receipt_email: user.email || undefined,
          // HIPAA: Generic description only; no plan names that could imply condition (Payment Processing Exemption)
          description: `Subscription`,
        });

        // Create payment record (only for PaymentIntent flow)
        await Payment.create({
          stripePaymentIntentId: paymentIntent.id,
          status: "pending",
          paymentMethod: "card",
          amount: amount,
          currency: "usd",
          stripeMetadata: {
            userId: currentUser.id,
            brandSubscriptionPlanId: brandSubscriptionPlanId,
            stripePriceId: selectedPlan.stripePriceId,
            amount: amount.toString(),
          },
          brandSubscriptionId: brandSubscription.id,
        });

        res.status(200).json({
          success: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          type: "payment_intent",
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error creating payment intent:", error);
      } else {
        console.error("❌ Error creating payment intent");
      }
      res.status(500).json({
        success: false,
        message: "Failed to create payment intent",
      });
    }
  }
);

// Confirm payment intent with payment method
app.post("/confirm-payment-intent", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });
    if (!user || !user.hasRoleSync("brand")) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Brand role required.",
      });
    }

    // Return success - webhook will handle subscription creation
    res.status(200).json({
      success: true,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error confirming payment intent:", error);
    } else {
      console.error("❌ Error confirming payment intent");
    }
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment intent",
    });
  }
});

// Activate subscription schedule after SetupIntent confirmation (for intro pricing plans)
app.post("/brand-subscriptions/activate-schedule", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });
    if (!user || !user.hasRoleSync("brand")) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Brand role required.",
      });
    }

    const { paymentMethodId, brandSubscriptionPlanId, brandSubscriptionId } = req.body;

    if (!paymentMethodId || !brandSubscriptionPlanId || !brandSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: paymentMethodId, brandSubscriptionPlanId, brandSubscriptionId",
      });
    }

    // Find the plan
    const selectedPlan = await BrandSubscriptionPlans.findByPk(brandSubscriptionPlanId);
    if (!selectedPlan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // Verify plan has intro pricing
    if (!selectedPlan.introMonthlyPriceStripeId || !selectedPlan.introMonthlyPriceDurationMonths) {
      return res.status(400).json({
        success: false,
        message: "Plan does not have intro pricing configured",
      });
    }

    // Find the brand subscription
    const brandSubscription = await BrandSubscription.findByPk(brandSubscriptionId);
    if (!brandSubscription || brandSubscription.userId !== currentUser.id) {
      return res.status(404).json({
        success: false,
        message: "Brand subscription not found",
      });
    }

    // Get or create Stripe customer
    let stripeCustomerId = await userService.getOrCreateCustomerId(user);

    // Attach payment method to customer and set as default
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
    } catch (attachError: any) {
      // Payment method might already be attached
      if (!attachError.message?.includes("already been attached")) {
        throw attachError;
      }
    }

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    console.log(`📋 Creating 2-phase subscription schedule for ${selectedPlan.name}:`);
    console.log(`   Phase 1: $${selectedPlan.introMonthlyPrice}/mo (${selectedPlan.introMonthlyPriceStripeId}) for ${selectedPlan.introMonthlyPriceDurationMonths} months`);
    console.log(`   Phase 2: $${selectedPlan.monthlyPrice}/mo (${selectedPlan.stripePriceId}) ongoing`);

    // Create 2-phase subscription schedule
    const stripeService = new StripeService();
    const schedule = await stripeService.createSchedule({
      customerId: stripeCustomerId,
      paymentMethodId: paymentMethodId,
      metadata: {
        userId: currentUser.id,
        brandSubscriptionPlanId: brandSubscriptionPlanId,
        brandSubscriptionId: brandSubscriptionId,
        introMonthlyPriceDurationMonths: selectedPlan.introMonthlyPriceDurationMonths.toString(),
      },
      phases: [
        {
          items: [{ price: selectedPlan.introMonthlyPriceStripeId }],
          iterations: selectedPlan.introMonthlyPriceDurationMonths,
        },
        {
          items: [{ price: selectedPlan.stripePriceId }],
        },
      ],
    });

    console.log(`✅ Subscription schedule created: ${schedule.id}`);

    // Get subscription from the schedule
    const subscriptionFromSchedule = schedule.subscription as any;
    const subscriptionId = typeof subscriptionFromSchedule === 'string'
      ? subscriptionFromSchedule
      : subscriptionFromSchedule?.id;

    // Update brand subscription with schedule and subscription info
    const planFeatures = selectedPlan.getFeatures();
    await brandSubscription.update({
      status: BrandSubscriptionStatus.ACTIVE,
      stripeSubscriptionId: subscriptionId || null,
      stripeCustomerId: stripeCustomerId,
      features: {
        ...planFeatures,
        subscriptionSchedule: {
          id: schedule.id,
          currentPhasePriceId: selectedPlan.introMonthlyPriceStripeId,
          introductoryPlanType: selectedPlan.planType,
        },
      },
    });

    console.log(`✅ Brand subscription activated with schedule: ${brandSubscription.id}`);

    res.status(200).json({
      success: true,
      message: "Subscription schedule created successfully",
      subscriptionId: subscriptionId,
      scheduleId: schedule.id,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error creating subscription schedule:", error);
    } else {
      console.error("❌ Error creating subscription schedule");
    }
    res.status(500).json({
      success: false,
      message: "Failed to create subscription schedule",
    });
  }
});

// Onboarding add-ons are handled separately, no combined checkout needed
// Cancel brand subscription
app.post("/brand-subscriptions/cancel", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });
    if (!user || !user.hasRoleSync("brand")) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Brand role required.",
      });
    }

    const subscription = await BrandSubscription.findOne({
      where: {
        userId: currentUser.id,
        status: ["active", "processing", "past_due"],
      },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    // Cancel subscription in Stripe
    if (subscription.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (stripeError) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error canceling Stripe subscription:", stripeError);
        } else {
          console.error("❌ Error canceling Stripe subscription");
        }
        // Continue with local cancellation even if Stripe fails
      }
    }

    // Cancel subscription in database
    await subscription.cancel();

    res.status(200).json({
      success: true,
      message: "Subscription canceled successfully",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error canceling subscription:", error);
    } else {
      console.error("❌ Error canceling subscription");
    }
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
    });
  }
});

// Change brand subscription plan
app.post("/brand-subscriptions/change", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { newPlanId } = req.body;

    if (!newPlanId) {
      return res.status(400).json({
        success: false,
        message: "New plan ID is required",
      });
    }

    // Instantiate service
    const brandSubscriptionService = new BrandSubscriptionService();

    // Upgrade the subscription
    const result = await brandSubscriptionService.upgradeSubscription(
      currentUser.id,
      newPlanId
    );

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error changing brand subscription:", error);
    } else {
      console.error("❌ Error changing brand subscription");
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Upgrade subscriptions for a treatment to a new treatment plan
app.post("/subscriptions/upgrade", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Validate request body using upgradeSubscriptionSchema
    const validation = upgradeSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { treatmentId } = validation.data;

    const subscriptionService = new SubscriptionService();
    await subscriptionService.upgradeSubscription(treatmentId, currentUser.id);

    res.json({
      success: true,
      message: "Subscriptions upgraded successfully",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error upgrading subscription:", error);
    } else {
      console.error("❌ Error upgrading subscription");
    }
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to upgrade subscriptions",
    });
  }
});

// Cancel all subscriptions for a treatment
app.post("/subscriptions/cancel", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Validate request body using cancelSubscriptionSchema
    const validation = cancelSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { treatmentId } = validation.data;

    const subscriptionService = new SubscriptionService();
    await subscriptionService.cancelSubscriptions(treatmentId, currentUser.id);

    res.json({
      success: true,
      message: "Subscriptions cancelled successfully",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error cancelling subscriptions:", error);
    } else {
      console.error("❌ Error cancelling subscriptions");
    }
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to cancel subscriptions",
    });
  }
});

// Questionnaire routes
// Add questionnaire step
const questionnaireService = new QuestionnaireService();

// Admin routes: list tenants (users with clinic) and questionnaires by tenant
app.get("/admin/tenants", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Only admins can list tenants
    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });
    if (!user || !user.hasRoleSync("admin")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const tenants = await User.findAll({
      where: {
        clinicId: { [Op.ne]: null },
      },
      attributes: ["id", "firstName", "lastName", "email", "clinicId"],
      include: [
        {
          model: Clinic,
          attributes: ["id", "name", "slug"],
        },
      ],
      order: [
        [Clinic, "name", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    res.status(200).json({ success: true, data: tenants });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error listing tenants:", error);
    } else {
      console.error("❌ Error listing tenants");
    }
    res.status(500).json({ success: false, message: "Failed to list tenants" });
  }
});

app.get(
  "/admin/tenants/:userId/questionnaires",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      // Only admins can view questionnaires for a tenant
      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("admin")) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const { userId } = req.params;
      const questionnaires = await questionnaireService.listForUser(userId);
      res.status(200).json({ success: true, data: questionnaires });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching questionnaires for tenant:", error);
      } else {
        console.error("❌ Error fetching questionnaires for tenant");
      }
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch questionnaires for tenant",
        });
    }
  }
);

// Admin: Get list of patients for impersonation
app.get("/admin/patients/list", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Only superAdmins can impersonate
    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });
    if (!user || !user.hasRoleSync("superAdmin")) {
      return res.status(403).json({ success: false, message: "Forbidden: SuperAdmin access required" });
    }

    // Fetch all users with patient role (excluding current user)
    const patients = await User.findAll({
      where: {
        id: { [Op.ne]: currentUser.id }, // Exclude current user
      },
      include: [
        {
          model: UserRoles,
          as: "userRoles",
          where: {
            patient: true,
          },
          required: true,
        },
      ],
      attributes: ["id", "email", "firstName", "lastName"],
      order: [["email", "ASC"]],
      limit: 500, // Reasonable limit
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`📋 Found ${patients.length} patients available for impersonation`);
    }

    res.status(200).json({
      success: true,
      data: {
        patients: patients.map((p) => ({
          id: p.id,
          email: p.email,
          firstName: p.firstName,
          lastName: p.lastName,
        })),
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error listing patients:", error);
    }
    res.status(500).json({ success: false, message: "Failed to list patients" });
  }
});

app.get("/questionnaires/templates", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const templates = await questionnaireService.listTemplates();

    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching questionnaire templates:", error);
    } else {
      console.error("❌ Error fetching questionnaire templates");
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch questionnaire templates",
      });
  }
});

app.get(
  "/questionnaires/templates/product-forms",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const forms = await questionnaireService.listAllProductForms();

      res.status(200).json({ success: true, data: forms });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching product forms:", error);
      } else {
        console.error("❌ Error fetching product forms");
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch product forms" });
    }
  }
);

app.get(
  "/questionnaires/templates/assigned",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const treatmentId =
        typeof req.query.treatmentId === "string"
          ? req.query.treatmentId
          : undefined;

      if (!treatmentId) {
        return res
          .status(400)
          .json({ success: false, message: "treatmentId is required" });
      }

      const assignment = await formTemplateService.getTenantProductForm(
        currentUser.id,
        treatmentId
      );

      res.status(200).json({ success: true, data: assignment });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "❌ Error fetching tenant product form assignment:",
          error
        );
      } else {
        console.error("❌ Error fetching tenant product form assignment");
      }
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to fetch assignment",
        });
    }
  }
);

app.get(
  "/questionnaires/templates/assignments",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const assignments = await formTemplateService.listTenantProductForms(
        currentUser.id
      );

      res.status(200).json({ success: true, data: assignments });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "❌ Error listing tenant product form assignments:",
          error
        );
      } else {
        console.error("❌ Error listing tenant product form assignments");
      }
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to list assignments",
        });
    }
  }
);

app.post("/questionnaires/templates", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const {
      title,
      description,
      treatmentId,
      productId,
      category,
      formTemplateType,
    } = req.body;

    if (!title) {
      return res
        .status(400)
        .json({ success: false, message: "Title is required" });
    }

    // Check if a template with this title already exists for this user
    // If so, make the title unique by appending a timestamp
    let uniqueTitle = title;
    const existingTemplate = await Questionnaire.findOne({
      where: {
        title: uniqueTitle,
        userId: currentUser.id,
      },
    });

    if (existingTemplate) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      uniqueTitle = `${title} ${timestamp}`;
      console.log(`📝 Duplicate title detected, using unique title: ${uniqueTitle}`);
    }

    const template = await questionnaireService.createTemplate({
      title: uniqueTitle,
      description,
      treatmentId: typeof treatmentId === "string" ? treatmentId : null,
      productId,
      category,
      formTemplateType:
        formTemplateType === "normal" ||
          formTemplateType === "user_profile" ||
          formTemplateType === "doctor" ||
          formTemplateType === "master_template" ||
          formTemplateType === "standardized_template"
          ? formTemplateType
          : null,
      createdById: currentUser.id,
    });

    // Audit: Log template creation
    console.log(
      "📝 [AUDIT] Attempting to log template CREATE for id:",
      template.id
    );
    try {
      await AuditService.logFromRequest(req, {
        action: AuditAction.CREATE,
        resourceType: AuditResourceType.QUESTIONNAIRE_TEMPLATE,
        resourceId: template.id,
        details: {
          templateName: uniqueTitle,
          formTemplateType: formTemplateType || "normal",
          productId: productId || null,
          category: category || null,
          createdBy: currentUser.id,
        },
      });
      console.log("✅ [AUDIT] Template CREATE audit log created successfully");
    } catch (auditError) {
      console.error(
        "❌ [AUDIT] Failed to create template CREATE audit log:",
        auditError
      );
    }

    res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    // Always log errors for debugging questionnaire creation issues
    console.error("❌ Error creating questionnaire template:", error?.message || error);
    if (error?.parent) {
      console.error("❌ Database error details:", error.parent?.message || error.parent);
    }
    res
      .status(500)
      .json({
        success: false,
        message: error?.message || "Failed to create questionnaire template",
      });
  }
});

// Get all product-to-form assignments
app.get(
  "/questionnaires/product-assignments",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const assignments = await FormProducts.findAll({
        attributes: ["id", "questionnaireId", "productId", "createdAt"],
      });

      // Transform to simpler format
      const formattedAssignments = assignments.map((a: any) => ({
        id: a.id,
        formTemplateId: a.questionnaireId,
        productId: a.productId,
        createdAt: a.createdAt,
      }));

      res.status(200).json({ success: true, data: formattedAssignments });
    } catch (error) {
      console.error("❌ Error fetching product assignments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch product assignments",
      });
    }
  }
);

// Assign products to a form template
app.post(
  "/questionnaires/:id/assign-products",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { id: formTemplateId } = req.params;
      const { productIds, productOfferType } = req.body;

      if (!Array.isArray(productIds)) {
        return res.status(400).json({
          success: false,
          message: "productIds must be an array",
        });
      }

      // Find the questionnaire to update productOfferType
      const questionnaire = await Questionnaire.findByPk(formTemplateId);
      if (!questionnaire) {
        return res.status(404).json({
          success: false,
          message: "Form template not found",
        });
      }

      // Update productOfferType if provided
      // Force single_choice if less than 2 products
      const effectiveOfferType = productIds.length < 2
        ? 'single_choice'
        : (productOfferType === 'multiple_choice' ? 'multiple_choice' : 'single_choice');

      await questionnaire.update({ productOfferType: effectiveOfferType });

      // Delete existing assignments for this form
      await FormProducts.destroy({
        where: { questionnaireId: formTemplateId },
      });

      // Create new assignments
      const assignments = await Promise.all(
        productIds.map((productId: string) =>
          FormProducts.create({
            questionnaireId: formTemplateId,
            productId,
          })
        )
      );

      res.status(200).json({
        success: true,
        message: `Assigned ${productIds.length} products to form`,
        data: {
          assignments,
          productOfferType: effectiveOfferType,
        },
      });
    } catch (error) {
      console.error("❌ Error assigning products:", error);
      res.status(500).json({
        success: false,
        message: "Failed to assign products",
      });
    }
  }
);

// Create Account Template by cloning user_profile steps from master_template
app.post(
  "/questionnaires/templates/account-from-master",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      // Find master template
      const masters = await Questionnaire.findAll({
        where: { formTemplateType: "master_template" },
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
              },
            ],
          },
        ],
      });
      if (masters.length !== 1) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "There should be 1 and only 1 master_template questionnaire",
          });
      }

      const master = masters[0] as any;

      // Create the new questionnaire (account template clone; not a template itself)
      const newQ = await Questionnaire.create({
        title: `Account Template - ${new Date().toISOString()}`,
        description: "Cloned from master_template (user_profile steps)",
        checkoutStepPosition: -1,
        treatmentId: null,
        isTemplate: false,
        userId: currentUser.id,
        productId: null,
        formTemplateType: "user_profile",
        personalizationQuestionsSetup: false,
        createAccountQuestionsSetup: true,
        doctorQuestionsSetup: false,
        color: null,
      });

      // Clone only user_profile steps and descendants
      const steps: any[] = (master.steps || []).filter(
        (s: any) => s.category === "user_profile"
      );
      for (const step of steps) {
        const clonedStep = await QuestionnaireStep.create({
          title: step.title,
          description: step.description,
          category: step.category,
          stepOrder: step.stepOrder,
          questionnaireId: newQ.id,
        });

        for (const question of step.questions || []) {
          const clonedQuestion = await Question.create({
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
          });

          if (question.options?.length) {
            await QuestionOption.bulkCreate(
              question.options.map((opt: any) => ({
                optionText: opt.optionText,
                optionValue: opt.optionValue,
                optionOrder: opt.optionOrder,
                questionId: clonedQuestion.id,
              }))
            );
          }
        }
      }

      const full = await Questionnaire.findByPk(newQ.id, {
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
              },
            ],
          },
        ],
      });

      return res.status(201).json({ success: true, data: full });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error cloning account template:", error);
      } else {
        console.error("❌ Error cloning account template");
      }
      return res
        .status(500)
        .json({ success: false, message: "Failed to clone account template" });
    }
  }
);

// Save a product-specific questionnaire as a reusable template
app.post(
  "/questionnaires/:id/save-as-template",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { id: questionnaireId } = req.params;
      const { templateName } = req.body;

      if (!questionnaireId || !templateName) {
        return res
          .status(400)
          .json({
            success: false,
            message: "questionnaireId and templateName are required",
          });
      }

      // Fetch the questionnaire to convert to template
      const questionnaire = await Questionnaire.findByPk(questionnaireId, {
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
              },
            ],
          },
        ],
      });

      if (!questionnaire) {
        return res
          .status(404)
          .json({ success: false, message: "Questionnaire not found" });
      }

      // Create the new template (clone of the questionnaire)
      const newTemplate = await Questionnaire.create({
        title: templateName,
        description: questionnaire.description,
        checkoutStepPosition: questionnaire.checkoutStepPosition,
        treatmentId: questionnaire.treatmentId,
        productId: null, // Templates don't belong to specific products
        category: questionnaire.category,
        formTemplateType: "normal",
        isTemplate: true, // Mark as template for reuse
        userId: currentUser.id,
        personalizationQuestionsSetup:
          questionnaire.personalizationQuestionsSetup,
        createAccountQuestionsSetup: questionnaire.createAccountQuestionsSetup,
        doctorQuestionsSetup: questionnaire.doctorQuestionsSetup,
        color: questionnaire.color,
      });

      // Clone all steps with their questions and options
      const steps: any[] = (questionnaire as any).steps || [];
      for (const step of steps) {
        const clonedStep = await QuestionnaireStep.create({
          title: step.title,
          description: step.description,
          category: step.category,
          stepOrder: step.stepOrder,
          isDeadEnd: step.isDeadEnd,
          conditionalLogic: step.conditionalLogic,
          questionnaireId: newTemplate.id,
        });

        // Clone all questions in this step
        for (const question of step.questions || []) {
          const clonedQuestion = await Question.create({
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
          });

          // Clone all options for this question
          if (question.options?.length) {
            await QuestionOption.bulkCreate(
              question.options.map((opt: any) => ({
                optionText: opt.optionText,
                optionValue: opt.optionValue,
                optionOrder: opt.optionOrder,
                riskLevel: opt.riskLevel,
                questionId: clonedQuestion.id,
              }))
            );
          }
        }
      }

      console.log("✅ Saved questionnaire as template:", {
        originalQuestionnaireId: questionnaireId,
        newTemplateId: newTemplate.id,
        templateName: templateName,
      });

      return res.status(201).json({
        success: true,
        data: { id: newTemplate.id, title: templateName },
        message: `Template "${templateName}" created successfully!`,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error saving as template:", error);
      } else {
        console.error("❌ Error saving as template");
      }
      return res
        .status(500)
        .json({ success: false, message: "Failed to save as template" });
    }
  }
);

// Update an existing template with structure from a product form
app.put(
  "/questionnaires/templates/:id/update-from-product-form",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { id: templateId } = req.params;
      const { sourceQuestionnaireId } = req.body;

      if (!templateId || !sourceQuestionnaireId) {
        return res
          .status(400)
          .json({
            success: false,
            message: "templateId and sourceQuestionnaireId are required",
          });
      }

      // Fetch the source questionnaire (product form)
      const sourceQuestionnaire = await Questionnaire.findByPk(
        sourceQuestionnaireId,
        {
          include: [
            {
              model: QuestionnaireStep,
              as: "steps",
              include: [
                {
                  model: Question,
                  as: "questions",
                  include: [{ model: QuestionOption, as: "options" }],
                },
              ],
            },
          ],
        }
      );

      if (!sourceQuestionnaire) {
        return res
          .status(404)
          .json({ success: false, message: "Source questionnaire not found" });
      }

      // Fetch the template to update
      const template = await Questionnaire.findByPk(templateId, {
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
              },
            ],
          },
        ],
      });

      if (!template) {
        return res
          .status(404)
          .json({ success: false, message: "Template not found" });
      }

      // Delete existing steps, questions, and options from the template
      const existingSteps: any[] = (template as any).steps || [];
      for (const step of existingSteps) {
        for (const question of step.questions || []) {
          await QuestionOption.destroy({ where: { questionId: question.id } });
          await Question.destroy({ where: { id: question.id } });
        }
        await QuestionnaireStep.destroy({ where: { id: step.id } });
      }

      // Clone all steps from source to template
      const sourceSteps: any[] = (sourceQuestionnaire as any).steps || [];
      for (const step of sourceSteps) {
        const clonedStep = await QuestionnaireStep.create({
          title: step.title,
          description: step.description,
          category: step.category,
          stepOrder: step.stepOrder,
          isDeadEnd: step.isDeadEnd,
          conditionalLogic: step.conditionalLogic,
          questionnaireId: template.id,
        });

        // Clone all questions in this step
        for (const question of step.questions || []) {
          const clonedQuestion = await Question.create({
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
          });

          // Clone all options for this question
          if (question.options?.length) {
            await QuestionOption.bulkCreate(
              question.options.map((opt: any) => ({
                optionText: opt.optionText,
                optionValue: opt.optionValue,
                optionOrder: opt.optionOrder,
                riskLevel: opt.riskLevel,
                questionId: clonedQuestion.id,
              }))
            );
          }
        }
      }

      console.log("✅ Updated template from product form:", {
        templateId: templateId,
        sourceQuestionnaireId: sourceQuestionnaireId,
      });

      return res.status(200).json({
        success: true,
        message: "Template updated successfully!",
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating template from product form:", error);
      } else {
        console.error("❌ Error updating template from product form");
      }
      return res
        .status(500)
        .json({ success: false, message: "Failed to update template" });
    }
  }
);

// Clone a template for a specific product (creates independent copy)
app.post(
  "/questionnaires/templates/:id/clone-for-product",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { id: templateId } = req.params;
      const { productId } = req.body;

      if (!templateId || !productId) {
        return res
          .status(400)
          .json({
            success: false,
            message: "templateId and productId are required",
          });
      }

      // Fetch the template to clone
      const template = await Questionnaire.findByPk(templateId, {
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
              },
            ],
          },
        ],
      });

      if (!template) {
        return res
          .status(404)
          .json({ success: false, message: "Template not found" });
      }

      // Create the cloned questionnaire for this specific product
      const clonedQuestionnaire = await Questionnaire.create({
        title: template.title,
        description: template.description || "",
        checkoutStepPosition: template.checkoutStepPosition ?? -1,
        treatmentId: template.treatmentId || null,
        productId: productId, // Link to specific product
        category: template.category || null,
        formTemplateType: "normal", // Clones are not templates themselves
        isTemplate: false, // This is a product-specific instance, not a template
        // Product clones should not be tied to the creator's userId to avoid unique title conflicts
        userId: null,
        personalizationQuestionsSetup:
          template.personalizationQuestionsSetup ?? false,
        createAccountQuestionsSetup:
          template.createAccountQuestionsSetup ?? false,
        doctorQuestionsSetup: template.doctorQuestionsSetup ?? false,
        color: template.color || null,
      }).catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error creating cloned questionnaire:", err);
          console.error("Template data:", JSON.stringify(template, null, 2));
        } else {
          console.error("❌ Error creating cloned questionnaire");
        }
        throw new Error(`Failed to create questionnaire: ${err.message}`);
      });

      // Clone all steps with their questions and options
      const steps: any[] = (template as any).steps || [];
      for (const step of steps) {
        const clonedStep = await QuestionnaireStep.create({
          title: step.title || "",
          description: step.description || "",
          category: step.category || "normal",
          stepOrder: step.stepOrder || 0,
          isDeadEnd: step.isDeadEnd || false,
          conditionalLogic: step.conditionalLogic || null,
          questionnaireId: clonedQuestionnaire.id,
        }).catch((err) => {
          if (process.env.NODE_ENV === "development") {
            console.error("❌ Error creating cloned step:", err);
          } else {
            console.error("❌ Error creating cloned step");
          }
          throw new Error(`Failed to create step: ${err.message}`);
        });

        // Clone all questions in this step
        for (const question of step.questions || []) {
          const clonedQuestion = await Question.create({
            questionText: question.questionText || "",
            answerType: question.answerType || "radio",
            questionSubtype: question.questionSubtype || null,
            isRequired:
              question.isRequired !== undefined ? question.isRequired : true,
            questionOrder: question.questionOrder || 0,
            subQuestionOrder: question.subQuestionOrder || null,
            conditionalLevel: question.conditionalLevel || null,
            placeholder: question.placeholder || null,
            helpText: question.helpText || null,
            footerNote: question.footerNote || null,
            conditionalLogic: question.conditionalLogic || null,
            stepId: clonedStep.id,
          }).catch((err) => {
            if (process.env.NODE_ENV === "development") {
              console.error("❌ Error creating cloned question:", err);
            } else {
              console.error("❌ Error creating cloned question");
            }
            throw new Error(`Failed to create question: ${err.message}`);
          });

          // Clone all options for this question
          if (question.options?.length) {
            await QuestionOption.bulkCreate(
              question.options.map((opt: any) => ({
                optionText: opt.optionText || "",
                optionValue: opt.optionValue || opt.optionText || "",
                optionOrder: opt.optionOrder || 0,
                riskLevel: opt.riskLevel || null,
                questionId: clonedQuestion.id,
              }))
            ).catch((err) => {
              if (process.env.NODE_ENV === "development") {
                console.error("❌ Error creating cloned options:", err);
              } else {
                console.error("❌ Error creating cloned options");
              }
              throw new Error(`Failed to create options: ${err.message}`);
            });
          }
        }
      }

      console.log("✅ Successfully cloned template for product:", {
        templateId,
        productId,
        clonedQuestionnaireId: clonedQuestionnaire.id,
        stepsCloned: steps.length,
      });

      // Return the full cloned questionnaire
      const fullClone = await Questionnaire.findByPk(clonedQuestionnaire.id, {
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
              },
            ],
          },
        ],
      });

      console.log("✅ Cloned template for product:", {
        originalTemplateId: templateId,
        clonedQuestionnaireId: clonedQuestionnaire.id,
        productId: productId,
      });

      return res.status(201).json({ success: true, data: fullClone });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error cloning template for product:", error);
      } else {
        console.error("❌ Error cloning template for product");
      }
      const errorMessage =
        error?.message || "Failed to clone template for product";
      return res.status(500).json({
        success: false,
        message: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
);

// Import template steps into an existing questionnaire (replaces current steps)
app.post(
  "/questionnaires/:id/import-template-steps",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { id: questionnaireId } = req.params;
      const { templateId } = req.body;

      if (!questionnaireId || !templateId) {
        return res
          .status(400)
          .json({
            success: false,
            message: "questionnaireId and templateId are required",
          });
      }

      console.log(
        `📋 Starting template import: ${templateId} -> ${questionnaireId}`
      );

      // Fetch the target questionnaire
      const questionnaire = await Questionnaire.findByPk(questionnaireId, {
        include: [
          {
            model: QuestionnaireStep,
            as: "steps",
            include: [
              {
                model: Question,
                as: "questions",
                include: [{ model: QuestionOption, as: "options" }],
              },
            ],
          },
        ],
      });

      if (!questionnaire) {
        return res
          .status(404)
          .json({ success: false, message: "Questionnaire not found" });
      }

      // Fetch ALL steps from the template (don't use Sequelize include, it's buggy with ordering)
      const template = await Questionnaire.findByPk(templateId);

      if (!template) {
        return res
          .status(404)
          .json({ success: false, message: "Template not found" });
      }

      // Manually fetch all steps
      const templateSteps = await QuestionnaireStep.findAll({
        where: { questionnaireId: templateId },
        order: [
          ["stepOrder", "ASC"],
          ["createdAt", "ASC"],
        ],
      });

      console.log(
        `📋 Template has ${templateSteps.length} steps (fetched manually)`
      );

      // Fetch questions for each step
      for (const step of templateSteps) {
        (step as any).questions = await Question.findAll({
          where: { stepId: step.id },
          order: [["questionOrder", "ASC"]],
        });

        // Fetch options for each question
        for (const question of (step as any).questions) {
          (question as any).options = await QuestionOption.findAll({
            where: { questionId: question.id },
            order: [["optionOrder", "ASC"]],
          });
        }
      }

      if (templateSteps.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Template has no steps to import" });
      }

      // Delete existing steps, questions, and options from the questionnaire
      console.log(
        `🗑️ Deleting existing steps from questionnaire ${questionnaireId}...`
      );
      const existingSteps: any[] = (questionnaire as any).steps || [];
      for (const step of existingSteps) {
        const questions = step.questions || [];
        console.log(
          `🗑️ Deleting ${questions.length} questions from step ${step.id}...`
        );
        for (const question of questions) {
          await QuestionOption.destroy({
            where: { questionId: question.id },
            force: true,
          });
          await Question.destroy({ where: { id: question.id }, force: true });
        }
        await QuestionnaireStep.destroy({ where: { id: step.id } });
      }

      // Copy all steps from template to questionnaire
      // IMPORTANT: Create NEW IDs so we don't modify the template when editing
      console.log(
        `📋 Copying ${templateSteps.length} steps from template ${templateId}...`
      );
      for (const step of templateSteps as any[]) {
        const questions = step.questions || [];
        console.log(
          `📋 Copying step "${step.title}" with ${questions.length} questions (creating NEW IDs)...`
        );

        // Create NEW step (Sequelize automatically creates a new ID)
        const newStep = await QuestionnaireStep.create({
          title: step.title,
          description: step.description,
          category: step.category,
          stepOrder: step.stepOrder,
          isDeadEnd: step.isDeadEnd,
          conditionalLogic: step.conditionalLogic,
          questionnaireId: questionnaire.id,
        });

        console.log(
          `  ✅ Created new step with ID: ${newStep.id} (original: ${step.id})`
        );

        // Copy all questions in this step
        for (const question of questions) {
          console.log(
            `  📋 Copying question: "${question.questionText}" (creating NEW ID)...`
          );

          // Create NEW question (Sequelize automatically creates a new ID)
          const newQuestion = await Question.create({
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
            stepId: newStep.id, // Link to NEW step
          });

          console.log(
            `    ✅ Created new question with ID: ${newQuestion.id} (original: ${question.id})`
          );

          // Copy all options for this question
          const options = question.options || [];
          if (options.length > 0) {
            console.log(
              `    📋 Copying ${options.length} options (creating NEW IDs)...`
            );
            await QuestionOption.bulkCreate(
              options.map((opt: any) => ({
                optionText: opt.optionText,
                optionValue: opt.optionValue,
                optionOrder: opt.optionOrder,
                riskLevel: opt.riskLevel,
                questionId: newQuestion.id, // Link to NEW question
              }))
            );
          }
        }
      }

      // Touch the questionnaire to update its updatedAt timestamp
      await questionnaire.update({ updatedAt: new Date() });
      console.log(
        `✅ Imported ${templateSteps.length} steps into questionnaire ${questionnaireId}, updatedAt touched`
      );

      // Return the updated questionnaire with manually fetched steps
      const updatedQuestionnaire =
        await Questionnaire.findByPk(questionnaireId);

      // Manually fetch all steps (avoiding Sequelize include bug)
      const updatedSteps = await QuestionnaireStep.findAll({
        where: { questionnaireId: questionnaireId },
        order: [
          ["stepOrder", "ASC"],
          ["createdAt", "ASC"],
        ],
      });

      console.log(`📋 Fetched ${updatedSteps.length} steps for response`);

      // Fetch questions for each step
      for (const step of updatedSteps) {
        (step as any).questions = await Question.findAll({
          where: { stepId: step.id },
          order: [["questionOrder", "ASC"]],
        });

        // Fetch options for each question
        for (const question of (step as any).questions) {
          (question as any).options = await QuestionOption.findAll({
            where: { questionId: question.id },
            order: [["optionOrder", "ASC"]],
          });
        }
      }

      // Convert to plain object and attach steps
      const result = {
        ...(updatedQuestionnaire as any).toJSON(),
        steps: updatedSteps.map((step: any) => ({
          ...step.toJSON(),
          stepType: step.category === "info" ? "info" : "question", // Add stepType for frontend
          questions: (step.questions || []).map((q: any) => ({
            ...q.toJSON(),
            options: (q.options || []).map((opt: any) => opt.toJSON()),
          })),
        })),
      };

      console.log(
        `✅ Returning questionnaire with ${result.steps.length} steps`
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error importing template steps:", error);
        console.error("Stack:", error.stack);
      } else {
        console.error("❌ Error importing template steps");
      }
      return res.status(500).json({
        success: false,
        message: error?.message || "Failed to import template steps",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
);

// Update visit type configuration for a questionnaire
app.put(
  "/questionnaires/:id/visit-types",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { id } = req.params;
      const { visitTypeByState } = req.body;

      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "Questionnaire ID is required" });
      }

      if (!visitTypeByState || typeof visitTypeByState !== "object") {
        return res.status(400).json({
          success: false,
          message:
            "visitTypeByState is required and must be an object with state codes as keys",
        });
      }

      // Validate visit types
      const validVisitTypes = ["synchronous", "asynchronous"];
      for (const [state, visitType] of Object.entries(visitTypeByState)) {
        if (!validVisitTypes.includes(visitType as string)) {
          return res.status(400).json({
            success: false,
            message: `Invalid visit type "${visitType}" for state ${state}. Must be "synchronous" or "asynchronous"`,
          });
        }
      }

      // Find and update the questionnaire
      const questionnaire = await Questionnaire.findByPk(id);

      if (!questionnaire) {
        return res
          .status(404)
          .json({ success: false, message: "Questionnaire not found" });
      }

      // Check ownership (user must be the creator or have appropriate permissions)
      if (questionnaire.userId && questionnaire.userId !== currentUser.id) {
        // For templates or if no userId, allow anyone to update
        // Otherwise check if user is authorized (admin or provider)
        if (currentUser.role !== 'admin' && currentUser.role !== 'provider') {
          return res.status(403).json({
            success: false,
            message: "Not authorized to update this questionnaire",
          });
        }
      }

      await questionnaire.update({ visitTypeByState });

      console.log(`✅ Updated visit types for questionnaire ${id}:`, {
        visitTypeByState,
        userId: currentUser.id,
      });

      res.status(200).json({
        success: true,
        data: {
          id: questionnaire.id,
          visitTypeByState: questionnaire.visitTypeByState,
        },
      });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating visit types:", error);
      } else {
        console.error("❌ Error updating visit types");
      }
      return res.status(500).json({
        success: false,
        message: error?.message || "Failed to update visit types",
      });
    }
  }
);

// Get visit type configuration for a questionnaire
app.get(
  "/questionnaires/:id/visit-types",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "Questionnaire ID is required" });
      }

      const questionnaire = await Questionnaire.findByPk(id, {
        attributes: ["id", "title", "visitTypeByState"],
      });

      if (!questionnaire) {
        return res
          .status(404)
          .json({ success: false, message: "Questionnaire not found" });
      }

      res.status(200).json({
        success: true,
        data: {
          id: questionnaire.id,
          title: questionnaire.title,
          visitTypeByState: questionnaire.visitTypeByState || {},
        },
      });
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching visit types:", error);
      } else {
        console.error("❌ Error fetching visit types");
      }
      return res.status(500).json({
        success: false,
        message: error?.message || "Failed to fetch visit types",
      });
    }
  }
);

// IMPORTANT: This route must come AFTER all specific /questionnaires/templates/* routes
app.get("/questionnaires/templates/:id", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Template ID is required" });
    }

    const template = await questionnaireService.getTemplateById(id);

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching questionnaire template:", error);
    } else {
      console.error("❌ Error fetching questionnaire template");
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch questionnaire template",
      });
  }
});

app.put("/questionnaires/templates/:id", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const { id } = req.params;
    const { name, description, schema, status, productId, medicalCompanySource, medicalTemplateApprovedByFuseAdmin } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Template ID is required" });
    }

    const template = await questionnaireService.updateTemplate(id, {
      title: name,
      description,
      status,
      productId,
      medicalCompanySource,
      medicalTemplateApprovedByFuseAdmin,
    });

    // Audit: Log template update
    console.log("📝 [AUDIT] Attempting to log template UPDATE for id:", id);
    try {
      await AuditService.logFromRequest(req, {
        action: AuditAction.UPDATE,
        resourceType: AuditResourceType.QUESTIONNAIRE_TEMPLATE,
        resourceId: id,
        details: {
          templateName: template?.title || name || "Unknown",
          updatedFields: Object.keys(req.body).filter(
            (k) => req.body[k] !== undefined
          ),
          newStatus: status || null,
        },
      });
      console.log("✅ [AUDIT] Template UPDATE audit log created successfully");
    } catch (auditError) {
      console.error(
        "❌ [AUDIT] Failed to create template UPDATE audit log:",
        auditError
      );
    }

    res.status(200).json({ success: true, data: template });
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating questionnaire template:", error);
    } else {
      console.error("❌ Error updating questionnaire template");
    }
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to update questionnaire template",
      });
  }
});

app.get("/questionnaires", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const questionnaires = await questionnaireService.listForUser(
      currentUser.id
    );
    res.status(200).json({ success: true, data: questionnaires });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching questionnaires for user:", error);
    } else {
      console.error("❌ Error fetching questionnaires for user");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch questionnaires" });
  }
});

app.get(
  "/questionnaires/product/:productId",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { productId } = req.params;

      if (!productId) {
        return res
          .status(400)
          .json({ success: false, message: "productId is required" });
      }

      const templates =
        await questionnaireService.listTemplatesByProduct(productId);

      res.status(200).json({ success: true, data: templates });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching questionnaires for product:", error);
      } else {
        console.error("❌ Error fetching questionnaires for product");
      }
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch questionnaires for product",
        });
    }
  }
);

const isProductionEnvironment = process.env.NODE_ENV === "production";

const sanitizeSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function ensureProductSlug(product: Product): Promise<string> {
  if (product.slug) {
    return product.slug;
  }

  const base =
    sanitizeSlug(product.name || "product") || `product-${Date.now()}`;
  let candidate = base;
  let attempt = 1;

  while (await Product.findOne({ where: { slug: candidate } })) {
    candidate = `${base}-${Date.now()}${attempt > 1 ? `-${attempt}` : ""}`;
    attempt += 1;
  }

  await product.update({ slug: candidate });
  return candidate;
}

async function ensureTenantFormPublishedUrl(
  form: TenantProductForm
): Promise<string | null> {
  if (form.publishedUrl) {
    return form.publishedUrl;
  }

  if (!form.productId || !form.clinicId) {
    return null;
  }

  const [product, clinic] = await Promise.all([
    Product.findByPk(form.productId),
    Clinic.findByPk(form.clinicId),
  ]);

  if (!product || !clinic || !clinic.slug) {
    return null;
  }

  const productSlug = await ensureProductSlug(product);
  const domain = isProductionEnvironment
    ? `${clinic.slug}.fuse.health`
    : `${clinic.slug}.localhost:3000`;
  const protocol = isProductionEnvironment ? "https" : "http";
  const publishedUrl = `${protocol}://${domain}/my-products/${form.id}/${productSlug}`;

  await form.update({
    publishedUrl,
    lastPublishedAt: form.lastPublishedAt ?? new Date(),
  } as any);

  return publishedUrl;
}

// Enable a questionnaire for current user's clinic and product
app.post("/admin/tenant-product-forms", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "User clinic not found" });
    }

    const {
      productId,
      questionnaireId,
      currentFormVariant,
      globalFormStructureId,
    } = req.body || {};
    if (!productId || !questionnaireId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "productId and questionnaireId are required",
        });
    }

    // Fetch product and clinic to generate published URL
    const product = await Product.findByPk(productId);
    const clinic = await Clinic.findByPk(user.clinicId);

    if (!product) {
      return res
        .status(400)
        .json({ success: false, message: "Product not found" });
    }
    if (!clinic) {
      return res
        .status(400)
        .json({ success: false, message: "Clinic not found" });
    }

    // Enforce product slots and ensure a TenantProduct exists
    const tenantProductService = new TenantProductService();
    try {
      await tenantProductService.updateSelection(
        { products: [{ productId, questionnaireId }] } as any,
        currentUser.id
      );
    } catch (e: any) {
      const msg =
        e instanceof Error ? e.message : "Failed to enable product for clinic";
      return res.status(400).json({ success: false, message: msg });
    }

    // Find or create the form - prevent duplicates
    // Multi-tenant isolation: Uses tenantId AND clinicId to ensure forms are clinic-specific
    // Now also includes globalFormStructureId to support multiple structures
    const [record, created] = await TenantProductForm.findOrCreate({
      where: {
        tenantId: currentUser.id,
        clinicId: user.clinicId,
        productId,
        currentFormVariant: currentFormVariant ?? null,
        globalFormStructureId: globalFormStructureId ?? null,
      },
      defaults: {
        treatmentId: null,
        questionnaireId,
        layoutTemplate: "layout_a",
        themeId: null,
        lockedUntil: null,
        publishedUrl: null,
        lastPublishedAt: new Date(),
      },
    });

    // If form already existed, update the questionnaireId if it changed
    if (!created && record.questionnaireId !== questionnaireId) {
      await record.update({
        questionnaireId,
        lastPublishedAt: new Date(),
      } as any);
      console.log(
        `✅ Updated existing form ${record.id} with new questionnaireId`
      );
    }

    if (!clinic.slug) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Clinic does not have a URL slug configured",
        });
    }

    const productSlug = await ensureProductSlug(product);
    const domain = isProductionEnvironment
      ? `${clinic.slug}.fuse.health`
      : `${clinic.slug}.localhost:3000`;
    const protocol = isProductionEnvironment ? "https" : "http";
    const publishedUrl = `${protocol}://${domain}/my-products/${record.id}/${productSlug}`;

    await record.update({
      publishedUrl,
      lastPublishedAt: record.lastPublishedAt ?? new Date(),
    } as any);
    await record.reload();

    console.log(
      `✅ Generated published URL for form ${record.id}: ${publishedUrl}`
    );

    // Handle QuestionnaireCustomization (activate current questionnaire without disabling others)
    try {
      let customization = await QuestionnaireCustomization.findOne({
        where: { userId: currentUser.id, questionnaireId },
      });

      if (customization) {
        if (!customization.isActive) {
          await customization.update({ isActive: true } as any);
          console.log(
            `✅ Reactivated QuestionnaireCustomization for user ${currentUser.id}, questionnaire ${questionnaireId}`
          );
        }
      } else {
        customization = await QuestionnaireCustomization.create({
          userId: currentUser.id,
          questionnaireId,
          customColor: null,
          isActive: true,
        });
        console.log(
          `✅ Created QuestionnaireCustomization for user ${currentUser.id}, questionnaire ${questionnaireId}`
        );
      }
    } catch (customizationError) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "⚠️ Error managing QuestionnaireCustomization:",
          customizationError
        );
      } else {
        console.error("⚠️ Error managing QuestionnaireCustomization");
      }
    }

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error enabling tenant product form:", error);
    } else {
      console.error("❌ Error enabling tenant product form");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to enable product form" });
  }
});

// List enabled forms for current user's clinic and a product
// IMPORTANT: Multi-tenant isolation - only shows forms for the current user's clinic
app.get("/admin/tenant-product-forms", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "User clinic not found" });
    }

    const productId =
      typeof req.query.productId === "string" ? req.query.productId : undefined;
    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "productId is required" });
    }

    // Filter by clinicId to ensure proper multi-tenant isolation
    // This ensures users only see forms for their own clinic, not other companies
    const records = await TenantProductForm.findAll({
      where: { clinicId: user.clinicId, productId },
      order: [["createdAt", "DESC"]],
    });

    const data = [] as any[];
    for (const record of records) {
      await ensureTenantFormPublishedUrl(record);
      data.push(record.toJSON());
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error listing tenant product forms:", error);
    } else {
      console.error("❌ Error listing tenant product forms");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to list enabled forms" });
  }
});

// Disable an enabled form for the current user's clinic/product
app.delete("/admin/tenant-product-forms", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user || !user.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "User clinic not found" });
    }

    const { productId, questionnaireId, tenantProductFormId } = req.body || {};
    if (!tenantProductFormId && (!productId || !questionnaireId)) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "tenantProductFormId or (productId + questionnaireId) is required",
        });
    }

    let record: TenantProductForm | null = null;

    if (tenantProductFormId) {
      record = await TenantProductForm.findOne({
        where: {
          id: tenantProductFormId,
          tenantId: currentUser.id,
          clinicId: user.clinicId,
        },
      });
    }

    if (!record && productId && questionnaireId) {
      record = await TenantProductForm.findOne({
        where: {
          tenantId: currentUser.id,
          clinicId: user.clinicId,
          productId,
          questionnaireId,
        },
      });
    }

    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: "Enabled form not found" });
    }

    const recordProductId = record.productId;
    const recordQuestionnaireId = record.questionnaireId;

    await record.destroy({ force: true } as any);

    // Only deactivate customization if no other forms for this questionnaire remain active
    try {
      const remaining = await TenantProductForm.count({
        where: {
          tenantId: currentUser.id,
          clinicId: user.clinicId,
          productId: recordProductId,
          questionnaireId: recordQuestionnaireId,
        },
      });

      if (remaining === 0) {
        const updated = await QuestionnaireCustomization.update(
          { isActive: false },
          {
            where: {
              userId: currentUser.id,
              questionnaireId: recordQuestionnaireId,
            },
          }
        );
        if (updated[0] > 0) {
          console.log(
            `✅ Deactivated QuestionnaireCustomization for user ${currentUser.id}, questionnaire ${recordQuestionnaireId}`
          );
        }
      }
    } catch (customizationError) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "⚠️ Error deactivating QuestionnaireCustomization:",
          customizationError
        );
      } else {
        console.error("⚠️ Error deactivating QuestionnaireCustomization");
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error disabling tenant product form:", error);
    } else {
      console.error("❌ Error disabling tenant product form");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to disable product form" });
  }
});

// Get all QuestionnaireCustomizations for current user
app.get(
  "/admin/questionnaire-customizations",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const customizations = await QuestionnaireCustomization.findAll({
        where: { userId: currentUser.id },
      });

      res.status(200).json({ success: true, data: customizations });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching questionnaire customizations:", error);
      } else {
        console.error("❌ Error fetching questionnaire customizations");
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch customizations" });
    }
  }
);

// Update color for a QuestionnaireCustomization
app.put(
  "/admin/questionnaire-customization/color",
  authenticateJWT,
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const { questionnaireId, customColor } = req.body || {};

      if (!questionnaireId) {
        return res
          .status(400)
          .json({ success: false, message: "questionnaireId is required" });
      }

      // Validate hex color format
      if (customColor && !/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
        return res.status(400).json({
          success: false,
          message: "customColor must be a valid hex code (e.g. #1A2B3C)",
        });
      }

      // Find the customization
      const customization = await QuestionnaireCustomization.findOne({
        where: { userId: currentUser.id, questionnaireId },
      });

      if (!customization) {
        return res.status(404).json({
          success: false,
          message:
            "QuestionnaireCustomization not found. Please enable the form first.",
        });
      }

      // Update the color (null means "use clinic default")
      const finalColor = customColor || null;
      await customization.update({ customColor: finalColor });

      console.log(
        `🎨 Updated color for user ${currentUser.id}, questionnaire ${questionnaireId} to: ${finalColor || "null (will use clinic default)"}`
      );

      res.status(200).json({
        success: true,
        data: customization,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating questionnaire color:", error);
      } else {
        console.error("❌ Error updating questionnaire color");
      }
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to update questionnaire color",
        });
    }
  }
);

app.get("/questionnaires/:id", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const questionnaireId = req.params.id;

    const questionnaire = await questionnaireService.getByIdForUser(
      questionnaireId,
      currentUser.id
    );

    if (!questionnaire) {
      return res
        .status(404)
        .json({ success: false, message: "Questionnaire not found" });
    }

    res.status(200).json({ success: true, data: questionnaire });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching questionnaire for user:", error);
    } else {
      console.error("❌ Error fetching questionnaire for user");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch questionnaire" });
  }
});

app.put("/questionnaires/:id/color", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const questionnaireId = req.params.id;
    const { color } = req.body ?? {};

    if (color !== undefined && color !== null) {
      if (typeof color !== "string" || !/^#([0-9a-fA-F]{6})$/.test(color)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Color must be a valid hex code (e.g. #1A2B3C)",
          });
      }
    }

    const updated = await questionnaireService.updateColor(
      questionnaireId,
      currentUser.id,
      color ?? null
    );

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating questionnaire color:", error);
    } else {
      console.error("❌ Error updating questionnaire color");
    }

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return res.status(404).json({ success: false, message: error.message });
      }

      if (error.message.includes("does not belong")) {
        return res.status(403).json({ success: false, message: error.message });
      }
    }

    res
      .status(500)
      .json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update questionnaire color",
      });
  }
});

app.post("/questionnaires/import", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const validation = assignTemplatesSchema.safeParse(req.body);

    if (!validation.success) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid request body",
          errors: validation.error.flatten(),
        });
    }

    const assignment = await formTemplateService.assignTemplates({
      tenantId: currentUser.id,
      ...validation.data,
    });

    res.status(201).json({ success: true, data: assignment });
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error assigning questionnaire templates:", error);
    } else {
      console.error("❌ Error assigning questionnaire templates");
    }
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to assign templates",
      });
  }
});

app.post("/questionnaires/step", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using questionnaireStepCreateSchema
    const validation = questionnaireStepCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { questionnaireId } = validation.data;

    // Create questionnaire step service instance
    const questionnaireStepService = new QuestionnaireStepService();

    // Add new questionnaire step
    const newStep = await questionnaireStepService.addQuestionnaireStep(
      questionnaireId,
      currentUser.id
    );

    console.log("✅ Questionnaire step added:", {
      stepId: newStep.id,
      title: newStep.title,
      stepOrder: newStep.stepOrder,
      questionnaireId: newStep.questionnaireId,
    });

    res.status(201).json({
      success: true,
      message: "Questionnaire step added successfully",
      data: newStep,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error adding questionnaire step:", error);
    } else {
      console.error("❌ Error adding questionnaire step");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to add questionnaire step",
    });
  }
});

// Update questionnaire step
app.put("/questionnaires/step", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using questionnaireStepUpdateSchema
    const validation = questionnaireStepUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      stepId,
      title,
      description,
      isDeadEnd,
      conditionalLogic,
      required,
    } = validation.data;

    // Create questionnaire step service instance
    const questionnaireStepService = new QuestionnaireStepService();

    // Update questionnaire step
    const updatedStep = await questionnaireStepService.updateQuestionnaireStep(
      stepId,
      {
        title,
        description,
        isDeadEnd,
        conditionalLogic: conditionalLogic ?? undefined,
        required,
      },
      currentUser.id
    );

    console.log("✅ Questionnaire step updated:", {
      stepId: updatedStep.id,
      title: updatedStep.title,
      description: updatedStep.description,
      isDeadEnd: updatedStep.isDeadEnd,
      conditionalLogic: updatedStep.conditionalLogic,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Questionnaire step updated successfully",
      data: updatedStep,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating questionnaire step:", error);
    } else {
      console.error("❌ Error updating questionnaire step");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to update questionnaire step",
    });
  }
});

// Delete questionnaire step
app.delete("/questionnaires/step", authenticateJWT, async (req, res) => {
  try {
    const { stepId } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate required fields
    if (!stepId) {
      return res.status(400).json({
        success: false,
        message: "stepId is required",
      });
    }

    // Create questionnaire step service instance
    const questionnaireStepService = new QuestionnaireStepService();

    // Delete questionnaire step
    const result = await questionnaireStepService.deleteQuestionnaireStep(
      stepId,
      currentUser.id
    );

    console.log("✅ Questionnaire step deleted:", {
      stepId: result.stepId,
      deleted: result.deleted,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Questionnaire step deleted successfully",
      data: result,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error deleting questionnaire step:", error);
    } else {
      console.error("❌ Error deleting questionnaire step");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete questionnaire step",
    });
  }
});

// Update questionnaire steps order
app.post("/questionnaires/step/order", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using questionnaireStepOrderSchema
    const validation = questionnaireStepOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { steps, questionnaireId } = validation.data;

    // Create questionnaire step service instance
    const questionnaireStepService = new QuestionnaireStepService();

    // Save steps order
    const updatedSteps = await questionnaireStepService.saveStepsOrder(
      steps,
      questionnaireId,
      currentUser.id
    );

    console.log("✅ Questionnaire steps order updated:", {
      stepsCount: updatedSteps.length,
      stepIds: updatedSteps.map((s) => s.id),
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Questionnaire steps order updated successfully",
      data: updatedSteps,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating questionnaire steps order:", error);
    } else {
      console.error("❌ Error updating questionnaire steps order");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("do not belong to your clinic") ||
        error.message.includes("array is required")
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to update questionnaire steps order",
    });
  }
});

// Get questionnaire for a treatment
app.get("/questionnaires/treatment/:treatmentId", async (req, res) => {
  try {
    const { treatmentId } = req.params;

    // Create questionnaire service instance
    const questionnaireService = new QuestionnaireService();

    // Get questionnaire by treatment
    const questionnaire =
      await questionnaireService.getQuestionnaireByTreatment(treatmentId);

    console.log(`✅ Found questionnaire for treatment ID "${treatmentId}"`);

    res.json({
      success: true,
      data: questionnaire,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching questionnaire:", error);
    } else {
      console.error("❌ Error fetching questionnaire");
    }

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Question routes
// List questions in questionnaire step
app.get("/questions/step/:stepId", authenticateJWT, async (req, res) => {
  try {
    const { stepId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Create question service instance
    const questionService = new QuestionService();

    // List questions
    const questions = await questionService.listQuestions(
      stepId,
      currentUser.id
    );

    console.log("✅ Questions listed for step:", {
      stepId,
      questionsCount: questions.length,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      data: questions,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error listing questions:", error);
    } else {
      console.error("❌ Error listing questions");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to list questions",
    });
  }
});

// Create question
app.post("/questions", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using questionCreateSchema
    const validation = questionCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      stepId,
      questionText,
      answerType,
      questionSubtype,
      isRequired,
      placeholder,
      helpText,
      footerNote,
      conditionalLogic,
      conditionalLevel,
      subQuestionOrder,
      parentQuestionId,
      options,
    } = validation.data;

    // Create question service instance
    const questionService = new QuestionService();

    // Create question
    const newQuestion = await questionService.createQuestion(
      stepId,
      {
        questionText,
        answerType,
        questionSubtype,
        isRequired,
        placeholder,
        helpText,
        footerNote,
        conditionalLogic,
        conditionalLevel,
        subQuestionOrder,
        parentQuestionId,
        options,
      },
      currentUser.id
    );

    console.log("✅ Question created:", {
      questionId: newQuestion?.id,
      questionText: newQuestion?.questionText,
      stepId: newQuestion?.stepId,
      userId: currentUser.id,
    });

    res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: newQuestion,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error creating questions:", error);
    } else {
      console.error("❌ Error creating questions");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to create question",
    });
  }
});

app.put("/questions/:questionId", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { questionId } = req.params;

    const questionService = new QuestionService();

    const updated = await questionService.updateQuestion(
      questionId,
      req.body,
      currentUser.id
    );

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("❌ Error updating question:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to update question",
    });
  }
});

// Update question
app.put("/questions", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using questionUpdateSchema
    const validation = questionUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      questionId,
      questionText,
      answerType,
      questionSubtype,
      isRequired,
      placeholder,
      helpText,
      footerNote,
      options,
    } = validation.data;

    // Create question service instance
    const questionService = new QuestionService();

    // Update question
    const updatedQuestion = await questionService.updateQuestion(
      questionId,
      {
        questionText,
        answerType,
        questionSubtype,
        isRequired,
        placeholder,
        helpText,
        footerNote,
        options,
      },
      currentUser.id
    );

    console.log("✅ Question updated:", {
      questionId: updatedQuestion?.id,
      questionText: updatedQuestion?.questionText,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: updatedQuestion,
    });
  } catch (error) {
    console.error("❌ Error updating question (PUT /questions):", error);

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to update question",
    });
  }
});

// Delete question
app.delete("/questions", authenticateJWT, async (req, res) => {
  try {
    const { questionId } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate required fields
    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: "questionId is required",
      });
    }

    // Create question service instance
    const questionService = new QuestionService();

    // Delete question
    const result = await questionService.deleteQuestion(
      questionId,
      currentUser.id
    );

    console.log("✅ Question deleted:", {
      questionId: result.questionId,
      deleted: result.deleted,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Question deleted successfully",
      data: result,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error deleting question:", error);
    } else {
      console.error("❌ Error deleting question");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete question",
    });
  }
});

// Reorder step
app.put("/questionnaires/step/reorder", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { stepId, direction } = req.body;

    // Validate required fields
    if (!stepId || !direction) {
      return res.status(400).json({
        success: false,
        message: "stepId and direction are required",
      });
    }

    if (!["up", "down"].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: "direction must be 'up' or 'down'",
      });
    }

    // Create questionnaire service instance
    const questionnaireService = new QuestionnaireService();

    // Reorder step
    const result = await questionnaireService.reorderStep(
      stepId,
      direction,
      currentUser.id
    );

    console.log("✅ Step reordered:", {
      stepId,
      direction,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Step reordered successfully",
      data: result,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error reordering step:", error);
    } else {
      console.error("❌ Error reordering step");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your clinic") ||
        error.message.includes("cannot move")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to reorder step",
    });
  }
});

// Delete questionnaire
app.delete("/questionnaires/:id", authenticateJWT, async (req, res) => {
  try {
    const { id: questionnaireId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate required fields
    if (!questionnaireId) {
      return res.status(400).json({
        success: false,
        message: "questionnaireId is required",
      });
    }

    // Create questionnaire service instance
    const questionnaireService = new QuestionnaireService();

    // Get template info before deletion for audit log
    const templateToDelete = await Questionnaire.findByPk(questionnaireId);
    const templateName = templateToDelete?.title || "Unknown template";

    // Delete questionnaire
    const result = await questionnaireService.deleteQuestionnaire(
      questionnaireId,
      currentUser.id
    );

    // Audit: Log template deletion
    console.log(
      "📝 [AUDIT] Attempting to log template DELETE for id:",
      questionnaireId
    );
    try {
      await AuditService.logFromRequest(req, {
        action: AuditAction.DELETE,
        resourceType: AuditResourceType.QUESTIONNAIRE_TEMPLATE,
        resourceId: questionnaireId,
        details: {
          templateName,
          deleted: result.deleted,
        },
      });
      console.log("✅ [AUDIT] Template DELETE audit log created successfully");
    } catch (auditError) {
      console.error(
        "❌ [AUDIT] Failed to create template DELETE audit log:",
        auditError
      );
    }

    console.log("✅ Questionnaire deleted:", {
      questionnaireId: result.questionnaireId,
      deleted: result.deleted,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Questionnaire deleted successfully",
      data: result,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error deleting questionnaire:", error);
    } else {
      console.error("❌ Error deleting questionnaire");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("does not belong to your account") ||
        error.message.includes("Cannot delete template questionnaires")
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete questionnaire",
    });
  }
});

// Update questions order
app.post("/questions/order", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using questionOrderSchema
    const validation = questionOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { questions, stepId } = validation.data;

    // Create question service instance
    const questionService = new QuestionService();

    // Save questions order
    const updatedQuestions = await questionService.saveQuestionsOrder(
      questions,
      stepId,
      currentUser.id
    );

    console.log("✅ Questions order updated:", {
      questionsCount: updatedQuestions.length,
      questionIds: updatedQuestions.map((q) => q.id),
      stepId,
      userId: currentUser.id,
    });

    res.status(200).json({
      success: true,
      message: "Questions order updated successfully",
      data: updatedQuestions,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating questions order:", error);
    } else {
      console.error("❌ Error updating questions order");
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("do not belong to your clinic") ||
        error.message.includes("array is required")
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to update questions order",
    });
  }
});

const userService = new UserService();
const treatmentService = new TreatmentService();
const orderService = new OrderService();
const clinicService = new ClinicService();

app.put("/patient", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using patientUpdateSchema
    const validation = patientUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { address, ...data } = validation.data;

    const result = await userService.updateUserPatient(
      currentUser.id,
      data,
      address
    );

    if (result.success) {
      // HIPAA Audit: Log PHI modification (patient updating their own profile)
      await AuditService.logPatientUpdate(
        req,
        currentUser.id,
        Object.keys(data)
      );
      res.status(200).json(result);
    } else {
      res.status(400).json(result.error);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error updating patient:", error);
    } else {
      console.error("❌ Error updating patient");
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.post("/webhook/orders", webhookLimiter, async (req, res) => {
  try {
    // Validate webhook signature using HMAC SHA256
    const providedSignature = req.headers["signature"];

    if (!providedSignature) {
      return res.status(401).json({
        success: false,
        message: "Webhook signature required",
      });
    }

    if (!process.env.APP_WEBHOOK_SECRET) {
      console.error("APP_WEBHOOK_SECRET environment variable is not set");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    // Verify signature using MDWebhookService
    const isValidSignature = MDWebhookService.verifyWebhookSignature(
      providedSignature as string,
      req.body,
      process.env.APP_WEBHOOK_SECRET
    );

    if (!isValidSignature) {
      return res.status(403).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // Process MD Integration webhook
    await MDWebhookService.processMDWebhook(req.body);

    res.json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error processing MD Integration webhook:", error);
    } else {
      console.error("❌ Error processing MD Integration webhook");
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Pharmacy webhook endpoint
app.post("/webhook/pharmacy", webhookLimiter, async (req, res) => {
  try {
    // Validate Authorization header with Bearer token
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header required",
      });
    }

    if (!process.env.APP_WEBHOOK_SECRET) {
      console.error("APP_WEBHOOK_SECRET environment variable is not set");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    // Extract Bearer token
    const expectedAuth = `Bearer ${process.env.APP_WEBHOOK_SECRET}`;

    if (authHeader !== expectedAuth) {
      return res.status(403).json({
        success: false,
        message: "Invalid authorization token",
      });
    }

    // Process pharmacy webhook
    await PharmacyWebhookService.processPharmacyWebhook(req.body);

    res.json({
      success: true,
      message: "Pharmacy webhook processed successfully",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error processing pharmacy webhook:", error);
    } else {
      console.error("❌ Error processing pharmacy webhook");
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Message endpoints
app.get("/messages", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    const { page = 1, per_page = 15, channel } = req.query;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const params: any = {
      page: parseInt(page as string),
      per_page: parseInt(per_page as string),
    };

    // Add channel if provided in query string
    if (channel && typeof channel === 'string') {
      params.channel = channel;
    }

    const messages = await MessageService.getMessagesByUserId(
      currentUser.id,
      params
    );

    // HIPAA Audit: Log message access
    await AuditService.logFromRequest(req, {
      action: AuditAction.VIEW,
      resourceType: AuditResourceType.MESSAGE,
      details: { messageCount: messages.data?.length || 0 },
    });

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching messages:", error);
    } else {
      console.error("❌ Error fetching messages");
    }
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch messages",
    });
  }
});

app.post("/messages", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Validate request body using messageCreateSchema
    const validation = messageCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { text, reference_message_id, files, channel } = validation.data;

    // Default to "patient" channel if not specified
    const messageChannel = channel || "patient";

    const payload = {
      channel: messageChannel,
      text,
      reference_message_id,
      files,
    };

    const message = await MessageService.createMessageForUser(
      currentUser.id,
      payload
    );

    // HIPAA Audit: Log message creation
    await AuditService.logFromRequest(req, {
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.MESSAGE,
      resourceId: message?.id,
    });

    res.json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error creating messages:", error);
    } else {
      console.error("❌ Error creating messages");
    }
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to send message",
    });
  }
});

app.post("/messages/:messageId/read", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required",
      });
    }

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    await MessageService.markMessageAsReadForUser(currentUser.id, messageId);

    res.json({
      success: true,
      message: "Message marked as read",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error marking message as read:", error);
    } else {
      console.error("❌ Error marking message as read");
    }
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to mark message as read",
    });
  }
});

app.delete("/messages/:messageId/read", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required",
      });
    }

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    await MessageService.markMessageAsUnreadForUser(currentUser.id, messageId);

    res.json({
      success: true,
      message: "Message marked as unread",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error marking message as unread:", error);
    } else {
      console.error("❌ Error marking message as unread");
    }
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to mark message as unread",
    });
  }
});

// MD Files endpoints
app.post(
  "/md-files",
  authenticateJWT,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file provided",
        });
      }

      const file = await MDFilesService.createFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // HIPAA Audit: Log medical document upload
      await AuditService.logFromRequest(req, {
        action: AuditAction.CREATE,
        resourceType: AuditResourceType.DOCUMENT,
        resourceId: file?.id,
        details: {
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
        },
      });

      res.json({
        success: true,
        message: "File uploaded successfully",
        data: file,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error uploading file:", error);
      } else {
        console.error("❌ Error uploading file");
      }
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to upload file",
      });
    }
  }
);




// Settings page endpoints
// Get organization/clinic data
app.get("/organization", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: Clinic, as: "clinic" }],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const clinic = user.clinic;

    res.json({
      clinicName: clinic?.name || "",
      businessName: clinic?.name || "",
      businessType: user.businessType || clinic?.businessType || "",
      website: user.website || "",
      phone: user.phoneNumber || "",
      phoneNumber: user.phoneNumber || "",
      address: user.address || "",
      city: user.city || "",
      state: user.state || "",
      zipCode: user.zipCode || "",
      logo: clinic?.logo || "",
      slug: clinic?.slug || "",
      isCustomDomain: (clinic as any)?.isCustomDomain || false,
      customDomain: (clinic as any)?.customDomain || "",
      defaultFormColor: (clinic as any)?.defaultFormColor || "",
      patientPortalDashboardFormat: (clinic as any)?.patientPortalDashboardFormat || "fuse",
      visitTypeFees: (clinic as any)?.visitTypeFees || { synchronous: 0, asynchronous: 0 },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching organization:", error);
    } else {
      console.error("❌ Error fetching organization");
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update organization/clinic data
app.put("/organization/update", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Validate request body using organizationUpdateSchema
    const validation = organizationUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { businessName, phone, address, city, state, zipCode, website } =
      validation.data as any;
    const isCustomDomain = (validation.data as any).isCustomDomain as
      | boolean
      | undefined;
    let customDomain = (validation.data as any).customDomain as
      | string
      | undefined;
    const defaultFormColor = (validation.data as any).defaultFormColor as
      | string
      | undefined;
    const patientPortalDashboardFormat = (validation.data as any).patientPortalDashboardFormat as
      | "fuse"
      | "md-integrations"
      | undefined;
    console.log('📥 Received organization update:', {
      businessName,
      defaultFormColor,
      patientPortalDashboardFormat
    });

    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Update user fields (User model has phoneNumber, address, city, state, zipCode, website)
    await user.update({
      phoneNumber: phone || user.phoneNumber,
      address: address || user.address,
      city: city || user.city,
      state: state || user.state,
      zipCode: zipCode || user.zipCode,
      website: website !== undefined ? website : user.website,
    });

    // Update clinic fields (Clinic has name, slug, logo, active, status, isCustomDomain, customDomain, defaultFormColor)
    let updatedClinic: any = null;
    if (user.clinicId) {
      const clinic = await Clinic.findByPk(user.clinicId);
      if (clinic) {
        const updateData: any = {};

        if (businessName) {
          updateData.name = businessName;
        }

        if (isCustomDomain !== undefined) {
          updateData.isCustomDomain = isCustomDomain;

          // If switching to subdomain (isCustomDomain = false), clear customDomain
          if (isCustomDomain === false) {
            updateData.customDomain = null;
          }
        }

        if (customDomain !== undefined) {
          // Convert empty string to null to avoid unique constraint violations
          if (!customDomain || customDomain.trim() === '') {
            updateData.customDomain = null;
          } else {
            // Normalize custom domain to bare hostname (lowercase, no protocol/path/trailing dot)
            try {
              const candidate = customDomain.trim();
              const url = new URL(
                candidate.startsWith("http") ? candidate : `https://${candidate}`
              );
              let host = url.hostname.toLowerCase();
              if (host.endsWith(".")) host = host.slice(0, -1);
              updateData.customDomain = host;
            } catch {
              // Fallback to raw value (will be validated elsewhere if needed)
              updateData.customDomain = customDomain;
            }
          }
        }

        // Update default form color if provided
        if (defaultFormColor !== undefined) {
          // Validate color format if not empty - allow hex codes or linear-gradient CSS
          if (defaultFormColor) {
            const isHexColor = /^#([0-9a-fA-F]{6})$/.test(defaultFormColor);
            const isGradient = /^linear-gradient\(/.test(defaultFormColor);
            
            if (!isHexColor && !isGradient) {
              return res.status(400).json({
                success: false,
                message:
                  "Default form color must be a valid hex code (e.g. #1A2B3C) or linear gradient (e.g. linear-gradient(90deg, #FF751F 0%, #B11FFF 100%))",
              });
            }
          }
          updateData.defaultFormColor = defaultFormColor || null;
        }

        // Update patient portal dashboard format if provided
        if (patientPortalDashboardFormat !== undefined) {
          if (!(Object.values(MedicalCompanySlug) as string[]).includes(patientPortalDashboardFormat)) {
            return res.status(400).json({
              success: false,
              message: "Patient portal dashboard format must be 'fuse' or 'md-integrations'",
            });
          }
          updateData.patientPortalDashboardFormat = patientPortalDashboardFormat;
        }

        console.log('💾 Updating clinic with data:', updateData);
        await clinic.update(updateData);
        console.log('✅ Clinic updated successfully.');
        updatedClinic = clinic;
      }
    }

    res.json({
      success: true,
      message: "Organization updated successfully",
      data: {
        clinic: updatedClinic
          ? {
            id: updatedClinic.id,
            slug: updatedClinic.slug,
            name: updatedClinic.name,
            isCustomDomain: updatedClinic.isCustomDomain,
            customDomain: updatedClinic.customDomain,
            logo: updatedClinic.logo,
            active: updatedClinic.isActive,
            status: updatedClinic.status,
            defaultFormColor: updatedClinic.defaultFormColor,
            patientPortalDashboardFormat: updatedClinic.patientPortalDashboardFormat,
            visitTypeFees: updatedClinic.visitTypeFees,
          }
          : null,
      },
    });
  } catch (error: any) {
    console.error("❌ Error updating organization:", error?.message || error);
    if (error?.errors) {
      console.error("❌ Sequelize errors:", JSON.stringify(error.errors, null, 2));
    }

    // Handle Sequelize unique constraint violations
    if (error?.name === 'SequelizeUniqueConstraintError') {
      const field = error?.errors?.[0]?.path;
      const value = error?.errors?.[0]?.value;

      if (field === 'customDomain') {
        return res.status(400).json({
          success: false,
          message: `The custom domain "${value}" is already in use by another organization. Please choose a different domain.`
        });
      }

      return res.status(400).json({
        success: false,
        message: `This ${field} is already in use. Please choose a different value.`
      });
    }

    // Handle other validation errors
    if (error?.name === 'SequelizeValidationError') {
      const messages = error?.errors?.map((e: any) => e.message).join(', ');
      return res.status(400).json({
        success: false,
        message: messages || 'Validation error occurred'
      });
    }

    res.status(500).json({
      success: false,
      message: error?.message || "Internal server error"
    });
  }
});

// Verify custom domain CNAME
app.post("/organization/verify-domain", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const { customDomain } = req.body;

    if (!customDomain) {
      return res
        .status(400)
        .json({ success: false, message: "Custom domain is required" });
    }

    // Get user's clinic
    const user = await User.findByPk(currentUser.id, {
      include: [{ model: Clinic, as: "clinic" }],
    });

    if (!user || !user.clinic) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    const expectedCname = `${user.clinic.slug}.fuse.health`;

    try {
      // Try to get CNAME records for the custom domain
      const cnameRecords = await dns.resolveCname(customDomain);

      if (cnameRecords && cnameRecords.length > 0) {
        const actualCname = cnameRecords[0];

        // Check if CNAME points to the correct subdomain
        if (
          actualCname === expectedCname ||
          actualCname === `${expectedCname}.`
        ) {
          return res.json({
            success: true,
            verified: true,
            message: "Domain verified successfully!",
            actualCname: actualCname,
            expectedCname: expectedCname,
          });
        } else {
          // CNAME exists but points to different domain
          return res.json({
            success: true,
            verified: false,
            message: `CNAME is configured but points to a different domain`,
            actualCname: actualCname,
            expectedCname: expectedCname,
            error: "CNAME_MISMATCH",
          });
        }
      } else {
        return res.json({
          success: true,
          verified: false,
          message: "No CNAME record found for this domain",
          expectedCname: expectedCname,
          error: "NO_CNAME",
        });
      }
    } catch (dnsError: any) {
      // DNS lookup failed - domain doesn't exist or no CNAME configured
      if (process.env.NODE_ENV === "development") {
        console.log("DNS lookup error:", dnsError.code);
      } else {
        console.log("DNS lookup error");
      }

      if (dnsError.code === "ENODATA" || dnsError.code === "ENOTFOUND") {
        return res.json({
          success: true,
          verified: false,
          message: "No CNAME record found. Please configure your DNS.",
          expectedCname: expectedCname,
          error: "NO_CNAME",
        });
      }

      return res.json({
        success: true,
        verified: false,
        message: "Unable to verify domain. Please try again later.",
        expectedCname: expectedCname,
        error: "DNS_ERROR",
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error verifying domain:", error);
    } else {
      console.error("❌ Error verifying domain");
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get clinic slug by custom domain
app.post("/clinic/by-custom-domain", async (req, res) => {
  try {
    const { domain } = req.body;
    console.log("clinic/by-custom-domain Edu", domain);
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: "Domain is required",
      });
    }

    // Extract base URL (remove path, query params, etc)
    let baseDomain = domain;
    try {
      const url = new URL(
        domain.startsWith("http") ? domain : `https://${domain}`
      );
      baseDomain = url.hostname;
    } catch (e) {
      // If URL parsing fails, use the domain as is
      baseDomain = domain.split("/")[0].split("?")[0];
    }

    console.log(`🔍 Looking for clinic with custom domain: ${baseDomain}`);

    // Search for clinic with matching customDomain
    // Include parent clinic info if this is an affiliate
    const clinic = await Clinic.findOne({
      where: {
        customDomain: baseDomain,
        isCustomDomain: true,
      },
      attributes: ["id", "slug", "name", "logo", "customDomain", "affiliateOwnerClinicId"],
      include: [
        {
          model: Clinic,
          as: 'affiliateOwnerClinic', // Parent brand clinic
          attributes: ["id", "slug", "name", "customDomain", "isCustomDomain"],
          required: false, // Left join - parent may not exist
        }
      ]
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "No clinic found with this custom domain",
        domain: baseDomain,
      });
    }

    const isAffiliate = !!clinic.affiliateOwnerClinicId;
    const parentClinic = clinic.affiliateOwnerClinic || null;

    console.log(`✅ Found clinic: ${clinic.name} with slug: ${clinic.slug}`, {
      isAffiliate,
      parentClinicSlug: parentClinic?.slug || null
    });

    res.json({
      success: true,
      slug: clinic.slug,
      isAffiliate,
      parentClinic: parentClinic ? {
        id: parentClinic.id,
        name: parentClinic.name,
        slug: parentClinic.slug,
        customDomain: parentClinic.customDomain,
        isCustomDomain: parentClinic.isCustomDomain,
      } : null,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
        customDomain: clinic.customDomain,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error finding clinic by custom domain:", error);
    } else {
      console.error("❌ Error finding clinic by custom domain");
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Upload logo endpoint
app.post(
  "/upload/logo",
  authenticateJWT,
  upload.single("logo"),
  async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      // Upload to S3
      const s3Url = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        "clinic-logos",
        "logo"
      );
      
      // Update clinic logo
      const user = await User.findByPk(currentUser.id);
      if (user && user.clinicId) {
        const clinic = await Clinic.findByPk(user.clinicId);
        if (clinic) {
          // Delete old logo if exists
          if (clinic.logo) {
            try {
              await deleteFromS3(clinic.logo);
            } catch (error) {
              if (process.env.NODE_ENV === "development") {
                console.error("❌ Error deleting old logo:", error);
              } else {
                console.error("❌ Error deleting old logo");
              }
            }
          }

          await clinic.update({ logo: s3Url });
        }
      }

      res.json({
        success: true,
        url: s3Url,
        message: "Logo uploaded successfully",
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error uploading logo:", error);
      } else {
        console.error("❌ Error uploading logo");
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to upload logo" });
    }
  }
);

// Subscription endpoints moved to endpoints/subscription.ts

// Update user profile
app.put("/users/profile", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const { firstName, lastName, phone, currentPassword, newPassword } =
      req.body;

    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // If password change requested, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return res
          .status(400)
          .json({ success: false, message: "Current password is required" });
      }

      // Validate either permanent or temporary password
      const isValidPassword = await user.validateAnyPassword(currentPassword);
      if (!isValidPassword) {
        return res
          .status(400)
          .json({ success: false, message: "Current password is incorrect" });
      }

      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      // Update password and clear temporary password if it exists
      await user.update({
        passwordHash: hashedPassword,
        temporaryPasswordHash: null // Clear temporary password after change
      });

      // Audit log: Password change (CRITICAL security event)
      await AuditService.logFromRequest(req, {
        action: AuditAction.PASSWORD_CHANGE,
        resourceType: AuditResourceType.USER,
        resourceId: user.id,
        details: {
          operation: "in_session_password_change"
        }
      });
    }

    // Update other fields
    await user.update({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      phoneNumber: phone || user.phoneNumber,
    });

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error uploading profile:", error);
    } else {
      console.error("❌ Error uploading profile");
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3001;

// Initialize database connection and start server
async function startServer() {
  const dbConnected = await initializeDatabase();

  if (!dbConnected) {
    console.error("❌ Failed to connect to database. Exiting...");
    process.exit(1);
  }

  // Import WebSocket service early so route handlers can reference it
  const WebSocketService = (await import("./services/websocket.service"))
    .default;

  // ============= QUALIPHY INTEGRATION ENDPOINTS =============

  // Invite patient to Qualiphy exam
  app.post("/qualiphy/exam-invite", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const user = await User.findByPk(currentUser.id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const {
        exams,
        first_name,
        last_name,
        email,
        dob,
        phone_number,
        tele_state,
        pharmacy_id,
        provider_pos_selection,
        webhook_url,
        additional_data,
      } = req.body;

      if (!exams || !Array.isArray(exams) || exams.length === 0) {
        return res.status(400).json({
          success: false,
          message: "exams array is required",
        });
      }

      if (!first_name || !last_name || !email || !dob || !phone_number || !tele_state) {
        return res.status(400).json({
          success: false,
          message: "Required fields: first_name, last_name, email, dob, phone_number, tele_state",
        });
      }

      const QualiphyExamService = (
        await import("./services/qualiphyIntegration/QualiphyExam.service")
      ).default;

      const inviteResponse = await QualiphyExamService.invitePatientToExam({
        exams,
        first_name,
        last_name,
        email,
        dob,
        phone_number,
        tele_state,
        pharmacy_id,
        provider_pos_selection,
        webhook_url,
        additional_data,
      });

      return res.json({ success: true, data: inviteResponse });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error inviting patient to Qualiphy exam:", error);
      } else {
        console.error("❌ Error inviting patient to Qualiphy exam");
      }
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to invite patient to exam",
      });
    }
  });

  // Get exam questions and answers
  app.post("/qualiphy/exam-questions", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { meeting_uuid, patient_exam_id } = req.body;

      if (!meeting_uuid || typeof meeting_uuid !== "string") {
        return res.status(400).json({
          success: false,
          message: "meeting_uuid is required",
        });
      }

      if (!patient_exam_id || typeof patient_exam_id !== "number") {
        return res.status(400).json({
          success: false,
          message: "patient_exam_id is required and must be a number",
        });
      }

      const QualiphyExamService = (
        await import("./services/qualiphyIntegration/QualiphyExam.service")
      ).default;

      const questionsResponse = await QualiphyExamService.getExamQuestions(
        meeting_uuid,
        patient_exam_id
      );

      return res.json({ success: true, data: questionsResponse });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching Qualiphy exam questions:", error);
      } else {
        console.error("❌ Error fetching Qualiphy exam questions");
      }
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch exam questions",
      });
    }
  });

  // ============= PUBLIC ENDPOINTS (No Auth Required) =============
  const { registerPublicEndpoints } = await import("./endpoints/public");
  registerPublicEndpoints(app);

  // ============= AUTH ENDPOINTS =============
  const { registerAuthEndpoints } = await import("./endpoints/auth");
  registerAuthEndpoints(app, authenticateJWT, verificationCodes, passwordResetCodes, generateUniqueSlug, getDefaultCustomWebsiteValues, authLimiter);

  // ============= DOCTOR PORTAL ENDPOINTS =============
  const { registerDoctorEndpoints } = await import("./endpoints/doctor");
  registerDoctorEndpoints(app, authenticateJWT, getCurrentUser);

  // ============= PHARMACY MANAGEMENT ENDPOINTS =============
  const { registerPharmacyEndpoints } = await import("./endpoints/pharmacy");
  registerPharmacyEndpoints(app, authenticateJWT, getCurrentUser);

  // ============= CLIENT MANAGEMENT ENDPOINTS =============
  const { registerClientManagementEndpoints } = await import(
    "./endpoints/client-management"
  );
  registerClientManagementEndpoints(app, authenticateJWT, getCurrentUser);

  const { registerAffiliateEndpoints } = await import(
    "./endpoints/affiliate"
  );
  registerAffiliateEndpoints(app, authenticateJWT, getCurrentUser);

  const { registerBrandInvitationEndpoints } = await import(
    "./endpoints/brand-invitations"
  );
  registerBrandInvitationEndpoints(app, authenticateJWT, getCurrentUser);

  // ============= AUDIT LOGS ENDPOINTS =============
  const { registerAuditLogsEndpoints } = await import("./endpoints/audit-logs");
  registerAuditLogsEndpoints(app, authenticateJWT, getCurrentUser);

  // ============= SUBSCRIPTION ENDPOINTS =============
  const { registerSubscriptionEndpoints } = await import(
    "./endpoints/subscription"
  );
  registerSubscriptionEndpoints(app, authenticateJWT, getCurrentUser);

  // ============= ORDER SUBSCRIPTION ENDPOINTS =============
  const { registerOrderSubscriptionEndpoints } = await import(
    "./endpoints/order-subscription"
  );
  registerOrderSubscriptionEndpoints(app, authenticateJWT, getCurrentUser);

  // ============= TIER MANAGEMENT ENDPOINTS =============
  const { registerTierManagementEndpoints } = await import(
    "./endpoints/tier-management"
  );
  registerTierManagementEndpoints(app, authenticateJWT, getCurrentUser);

  // ============= ANALYTICS ENDPOINTS =============
  const analyticsRouter = (await import("./endpoints/analytics")).default;
  app.use("/", analyticsRouter);

  // ============= ABANDONED CART ENDPOINTS =============
  const abandonedCartRouter = (await import("./endpoints/abandonedCart")).default;
  app.use("/", abandonedCartRouter);

  // ============= CONFIG ENDPOINTS =============
  const configRouter = (await import("./endpoints/config")).default;
  app.use("/config", configRouter);

  // ============= LIKES ENDPOINTS =============
  const likesRouter = (await import("./endpoints/likes")).default;
  app.use("/", likesRouter);

  // ============= FAVORITES ENDPOINTS =============
  const favoritesRouter = (await import("./endpoints/favorites")).default;
  app.use("/", favoritesRouter);

  // ============= PROGRAMS ENDPOINTS =============
  const programsRouter = (await import("./endpoints/programs")).default;
  app.use("/", programsRouter);

  // ============= MEDICAL COMPANIES ENDPOINTS =============
  const medicalCompaniesRouter = (await import("./endpoints/medical-companies")).default;
  app.use("/medical-companies", medicalCompaniesRouter);

  // ============= SUPPORT TICKETS ENDPOINTS =============
  const { registerSupportEndpoints } = await import('./endpoints/support');
  registerSupportEndpoints(app, authenticateJWT, getCurrentUser);

  // ============= IRONSAIL ENDPOINTS =============
  const { registerIronSailAuthEndpoints } = await import('./endpoints/ironsail/ironsail-auth');
  const { registerIronSailAdminEndpoints } = await import('./endpoints/ironsail/ironsail-admin');
  registerIronSailAuthEndpoints(app, authenticateJWT);
  registerIronSailAdminEndpoints(app, authenticateJWT);

  // ============= MD INTEGRATIONS ENDPOINTS =============
  const { registerMDIntegrationsEndpoints } = await import('./endpoints/md-integrations');
  registerMDIntegrationsEndpoints(app, authenticateJWT, getCurrentUser);

  // ============= MD INTEGRATIONS WEBHOOKS =============
  const { registerMDIntegrationsWebhooks } = await import('./endpoints/md-integrations/webhooks');
  registerMDIntegrationsWebhooks(app);

  // ============= OLYMPIA PHARMACY ENDPOINTS =============
  const { registerOlympiaAdminEndpoints } = await import('./endpoints/olympia-pharmacy/olympia-admin');
  registerOlympiaAdminEndpoints(app, authenticateJWT);

  // ============= OLYMPIA PHARMACY WEBHOOKS =============
  const { registerOlympiaPharmacyWebhooks } = await import('./endpoints/olympia-pharmacy/webhook');
  registerOlympiaPharmacyWebhooks(app, webhookLimiter);

  // ============= BELUGA ENDPOINTS =============
  const belugaRouter = (await import('./endpoints/beluga')).default;
  app.use('/beluga', belugaRouter);
  app.use('/beluga-products', belugaProductsRoutes);

  // ============================================
  // DOCTOR-PATIENT CHAT ENDPOINTS
  // ============================================

  // Get all conversations for a doctor
  app.get("/doctor/chats", authenticateJWT, async (req: any, res: any) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("doctor")) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Access denied. Doctor role required.",
          });
      }

      const chats = await DoctorPatientChats.findAll({
        where: { doctorId: currentUser.id },
        order: [["lastMessageAt", "DESC"]],
      });

      // FIX: Previously used Promise.all(chats.map(...)) with a User.findByPk per chat (N+1 pattern).
      // This fired N concurrent queries which could spike Postgres connections and cause
      // "out of shared memory" errors. Replaced with a single bulk query + Map lookup.
      const patientIds = [...new Set(chats.map((c) => c.patientId))];
      const patients = await User.findAll({
        where: { id: patientIds },
        attributes: ["id", "firstName", "lastName", "email"],
      });
      const patientById = new Map(patients.map((p) => [p.id, p]));

      const chatsWithPatients = chats.map((chat) => ({
        ...chat.toJSON(),
        patient: patientById.get(chat.patientId)?.toJSON() || null,
      }));

      // HIPAA Audit: Log PHI access (doctor viewing all patient chats)
      await AuditService.logFromRequest(req, {
        action: AuditAction.VIEW,
        resourceType: AuditResourceType.MESSAGE,
        details: { bulkAccess: true, chatCount: chatsWithPatients.length },
      });

      res.json({
        success: true,
        data: chatsWithPatients,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching doctor chats:", error);
      } else {
        console.error("❌ Error fetching doctor chats");
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch chats" });
    }
  });

  // Get specific conversation messages
  app.get(
    "/doctor/chats/:chatId",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("doctor")) {
          return res
            .status(403)
            .json({
              success: false,
              message: "Access denied. Doctor role required.",
            });
        }

        const { chatId } = req.params;

        const chat = await DoctorPatientChats.findOne({
          where: {
            id: chatId,
            doctorId: currentUser.id,
          },
        });

        if (!chat) {
          return res
            .status(404)
            .json({ success: false, message: "Chat not found" });
        }

        // Manually load patient data
        const patient = await User.findByPk(chat.patientId, {
          attributes: ["id", "firstName", "lastName", "email"],
        });

        const chatWithPatient = {
          ...chat.toJSON(),
          patient: patient ? patient.toJSON() : null,
        };

        // HIPAA Audit: Log PHI access (chat messages may contain health information)
        await AuditService.logMessageView(req, chatId, chat.patientId);

        res.json({
          success: true,
          data: chatWithPatient,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error fetching chat:", error);
        } else {
          console.error("❌ Error fetching chat");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch chat" });
      }
    }
  );

  // Upload file for chat (doctor only)
  app.post(
    "/doctor/chat/upload-file",
    authenticateJWT,
    upload.single("file"),
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("doctor")) {
          return res
            .status(403)
            .json({
              success: false,
              message: "Access denied. Doctor role required.",
            });
        }

        // Check if file was uploaded
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "No file uploaded",
          });
        }

        // Validate file size
        if (!isValidFileSize(req.file.size)) {
          return res.status(400).json({
            success: false,
            message: "File too large. Maximum size is 5MB.",
          });
        }

        // Validate file type (images and PDFs)
        if (!isValidImageFile(req.file.mimetype)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid file type. Only images (JPEG, PNG, WebP) and PDF files are allowed.",
          });
        }

        // Upload to S3 in chat-files folder
        const fileUrl = await uploadToS3(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          "chat-files", // Folder específico para archivos del chat
          `doctor-${currentUser.id}` // Prefix con ID del doctor
        );

        console.log("📎 File uploaded for chat:", {
          userId: currentUser.id,
          fileName: req.file.originalname,
          fileUrl,
        });

        res.json({
          success: true,
          data: {
            url: fileUrl,
            fileName: req.file.originalname,
            contentType: req.file.mimetype,
            size: req.file.size,
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error uploading chat file:", error);
        } else {
          console.error("❌ Error uploading chat file");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to upload file" });
      }
    }
  );

  // Send a message in a conversation
  app.post(
    "/doctor/chats/:chatId/messages",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("doctor")) {
          return res
            .status(403)
            .json({
              success: false,
              message: "Access denied. Doctor role required.",
            });
        }

        const { chatId } = req.params;
        const { message, attachments } = req.body;

        // Validate: message is required OR attachments are provided
        if (
          (!message ||
            typeof message !== "string" ||
            message.trim().length === 0) &&
          (!attachments ||
            !Array.isArray(attachments) ||
            attachments.length === 0)
        ) {
          return res
            .status(400)
            .json({
              success: false,
              message: "Message or attachments are required",
            });
        }

        // Validate attachments if provided
        if (attachments && Array.isArray(attachments)) {
          if (attachments.length > 10) {
            return res
              .status(400)
              .json({
                success: false,
                message: "Maximum 10 attachments allowed per message",
              });
          }
          // Validate that all attachments are valid URLs
          for (const url of attachments) {
            if (typeof url !== "string" || !url.startsWith("https://")) {
              return res
                .status(400)
                .json({
                  success: false,
                  message: "Invalid attachment URL format",
                });
            }
          }
        }

        const chat = await DoctorPatientChats.findOne({
          where: {
            id: chatId,
            doctorId: currentUser.id,
          },
        });

        if (!chat) {
          return res
            .status(404)
            .json({ success: false, message: "Chat not found" });
        }

        // Create new message with optional attachments
        const newMessage: any = {
          id: require("crypto").randomUUID(),
          senderId: currentUser.id,
          senderRole: "doctor" as const,
          message: message ? message.trim() : "",
          createdAt: new Date().toISOString(),
          read: false,
        };

        // Add attachments if provided
        if (
          attachments &&
          Array.isArray(attachments) &&
          attachments.length > 0
        ) {
          newMessage.attachments = attachments;
        }

        // Add message to array
        const updatedMessages = [...(chat.messages || []), newMessage];

        // Update chat - reset doctor's unread count to 0 since they're sending a message
        await chat.update({
          messages: updatedMessages,
          lastMessageAt: new Date(),
          unreadCountPatient: chat.unreadCountPatient + 1,
          unreadCountDoctor: 0,
        });

        // Reload and manually add patient data
        await chat.reload();
        const patient = await User.findByPk(chat.patientId, {
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "phoneNumber",
            "smsOptedOut",
          ],
        });

        const chatWithPatient = {
          ...chat.toJSON(),
          patient: patient
            ? {
              id: patient.id,
              firstName: patient.firstName,
              lastName: patient.lastName,
              email: patient.email,
            }
            : null,
        };

        // Emit WebSocket event for new message
        WebSocketService.emitChatMessage({
          chatId: chat.id,
          doctorId: chat.doctorId,
          patientId: chat.patientId,
          message: newMessage,
        });

        // Emit updated unread count to patient
        WebSocketService.emitUnreadCountUpdate(
          chat.patientId,
          chat.unreadCountPatient
        );

        // Emit doctor's unread count (reset to 0 since they sent the message)
        WebSocketService.emitUnreadCountUpdate(chat.doctorId, 0);

        // Send SMS notification to patient if they have a phone number and haven't opted out
        if (patient && patient.phoneNumber && !patient.smsOptedOut) {
          try {
            const patientName = patient.firstName || "Patient";
            const hasAttachments = attachments && attachments.length > 0;
            const unreadCount = chat.unreadCountPatient;
            let smsBody: string;

            // Build unread count message
            const unreadMessage =
              unreadCount === 1
                ? "You have 1 unread message."
                : `You have ${unreadCount} unread messages.`;

            if (message && message.trim()) {
              // Truncate message preview to 35 characters max for SMS (leave room for unread count and other text)
              const messagePreview =
                message.length > 35
                  ? message.substring(0, 32) + "..."
                  : message;
              const attachmentText = hasAttachments ? " (with attachment)" : "";
              smsBody = `${patientName}, new message from your doctor: "${messagePreview}"${attachmentText}. ${unreadMessage}`;
            } else if (hasAttachments) {
              smsBody = `${patientName}, your doctor sent you a message with an attachment. ${unreadMessage}`;
            } else {
              smsBody = `${patientName}, you have a new message from your doctor. ${unreadMessage}`;
            }

            await SmsService.send(patient.phoneNumber, smsBody);
            if (process.env.NODE_ENV === "development") {
              console.log(`✅ SMS notification sent to patient ${patient.id}`);
            }
          } catch (smsError) {
            // Don't fail the message send if SMS fails - log and continue
            if (process.env.NODE_ENV === "development") {
              console.error(
                "❌ Failed to send SMS notification to patient:",
                smsError
              );
            } else {
              console.error("❌ Failed to send SMS notification to patient");
            }
          }
        } else if (patient && (!patient.phoneNumber || patient.smsOptedOut)) {
          console.log(
            `ℹ️ Skipping SMS notification for patient ${patient.id}: ${!patient.phoneNumber ? "no phone number" : "SMS opted out"}`
          );
        }

        // HIPAA Audit: Log message creation (doctor sending health communication)
        await AuditService.logMessageSent(req, chatId, chat.patientId);

        res.json({
          success: true,
          data: {
            message: newMessage,
            chat: chatWithPatient,
          },
        });
      } catch (error) {
        // HIPAA: Do not log detailed errors in production
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error sending message:", error);
        } else {
          console.error("❌ Error sending message");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to send message" });
      }
    }
  );

  // Mark messages as read
  app.post(
    "/doctor/chats/:chatId/mark-read",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("doctor")) {
          return res
            .status(403)
            .json({
              success: false,
              message: "Access denied. Doctor role required.",
            });
        }

        const { chatId } = req.params;

        const chat = await DoctorPatientChats.findOne({
          where: {
            id: chatId,
            doctorId: currentUser.id,
          },
        });

        if (!chat) {
          return res
            .status(404)
            .json({ success: false, message: "Chat not found" });
        }

        // Mark all messages from patient as read
        const updatedMessages = (chat.messages || []).map((msg: any) => {
          if (msg.senderRole === "patient" && !msg.read) {
            return { ...msg, read: true };
          }
          return msg;
        });

        // Update chat
        await chat.update({
          messages: updatedMessages,
          unreadCountDoctor: 0,
        });

        res.json({
          success: true,
          data: chat,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error marking messages as read:", error);
        } else {
          console.error("❌ Error marking messages as read");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to mark messages as read" });
      }
    }
  );

  // ============================================
  // PATIENT CHAT ENDPOINTS
  // ============================================

  // Get unread messages count for patient (lightweight endpoint)
  app.get(
    "/patient/chat/unread-count",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("patient")) {
          return res
            .status(403)
            .json({
              success: false,
              message: "Access denied. Patient role required.",
            });
        }

        // Find patient's chat
        const chat = await DoctorPatientChats.findOne({
          where: { patientId: currentUser.id },
          attributes: ["unreadCountPatient"], // Only fetch the unread count
        });

        const unreadCount = chat ? chat.unreadCountPatient : 0;

        res.json({
          success: true,
          data: { unreadCount },
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error fetching unread count:", error);
        } else {
          console.error("❌ Error fetching unread count");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch unread count" });
      }
    }
  );

  // Get patient's chat with their doctor
  app.get("/patient/chat", authenticateJWT, async (req: any, res: any) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("patient")) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Access denied. Patient role required.",
          });
      }

      // A patient only has one chat (with their assigned doctor)
      let chat = await DoctorPatientChats.findOne({
        where: { patientId: currentUser.id },
      });

      if (!chat) {
        // Try to auto-assign default doctor
        console.log(
          "📋 No chat found for patient, attempting to auto-assign default doctor..."
        );

        try {
          // Look up the default doctor by email
          const defaultDoctor = await User.findOne({
            where: { email: "dmeursing@yahoo.com", role: "doctor" },
          });

          if (!defaultDoctor) {
            return res.json({
              success: true,
              data: null,
              message: "No chat found. You don't have an assigned doctor yet.",
              autoAssignAttempted: true,
              autoAssignError:
                "Default doctor (dmeursing@yahoo.com) not found in the system.",
            });
          }

          // Create new chat with default doctor
          chat = await DoctorPatientChats.create({
            doctorId: defaultDoctor.id,
            patientId: currentUser.id,
            messages: [],
            unreadCountDoctor: 0,
            unreadCountPatient: 0,
          });

          console.log(
            "✅ Successfully auto-assigned default doctor to patient"
          );

          // Load doctor data for response
          const doctor = await User.findByPk(chat.doctorId, {
            attributes: ["id", "firstName", "lastName", "email"],
          });

          const chatWithDoctor = {
            ...chat.toJSON(),
            doctor: doctor ? doctor.toJSON() : null,
          };

          return res.json({
            success: true,
            data: chatWithDoctor,
            autoAssigned: true,
            message: `Successfully assigned Dr. ${defaultDoctor.firstName} ${defaultDoctor.lastName} as your doctor.`,
          });
        } catch (autoAssignError: any) {
          if (process.env.NODE_ENV === "development") {
            console.error("❌ Error auto-assigning doctor:", autoAssignError);
          } else {
            console.error("❌ Error auto-assigning doctor");
          }
          return res.json({
            success: true,
            data: null,
            message: "No chat found. You don't have an assigned doctor yet.",
            autoAssignAttempted: true,
            autoAssignError: `Failed to auto-assign doctor: ${autoAssignError.message}`,
          });
        }
      }

      // Manually load doctor data
      const doctor = await User.findByPk(chat.doctorId, {
        attributes: ["id", "firstName", "lastName", "email"],
      });

      const chatWithDoctor = {
        ...chat.toJSON(),
        doctor: doctor ? doctor.toJSON() : null,
      };

      // HIPAA Audit: Log PHI access (patient viewing their chat which may contain health info)
      await AuditService.logMessageView(req, chat.id, currentUser.id);

      res.json({
        success: true,
        data: chatWithDoctor,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching patient chat:", error);
      } else {
        console.error("❌ Error fetching patient chat");
      }
      res.status(500).json({ success: false, message: "Failed to fetch chat" });
    }
  });

  // Upload file for chat (patient only)
  app.post(
    "/patient/chat/upload-file",
    authenticateJWT,
    upload.single("file"),
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("patient")) {
          return res
            .status(403)
            .json({
              success: false,
              message: "Access denied. Patient role required.",
            });
        }

        // Check if file was uploaded
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "No file uploaded",
          });
        }

        // Validate file size
        if (!isValidFileSize(req.file.size)) {
          return res.status(400).json({
            success: false,
            message: "File too large. Maximum size is 5MB.",
          });
        }

        // Validate file type (images and PDFs)
        if (!isValidImageFile(req.file.mimetype)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid file type. Only images (JPEG, PNG, WebP) and PDF files are allowed.",
          });
        }

        // Upload to S3 in chat-files folder
        const fileUrl = await uploadToS3(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          "chat-files", // Folder específico para archivos del chat
          `patient-${currentUser.id}` // Prefix con ID del paciente
        );

        console.log("📎 File uploaded for chat:", {
          userId: currentUser.id,
          fileName: req.file.originalname,
          fileUrl,
        });

        res.json({
          success: true,
          data: {
            url: fileUrl,
            fileName: req.file.originalname,
            contentType: req.file.mimetype,
            size: req.file.size,
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error uploading chat file:", error);
        } else {
          console.error("❌ Error uploading chat file");
        }

        res
          .status(500)
          .json({ success: false, message: "Failed to upload file" });
      }
    }
  );

  // Send a message from patient to doctor
  app.post(
    "/patient/chat/messages",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("patient")) {
          return res
            .status(403)
            .json({
              success: false,
              message: "Access denied. Patient role required.",
            });
        }

        const { message, attachments } = req.body;

        // Validate: message is required OR attachments are provided
        if (
          (!message ||
            typeof message !== "string" ||
            message.trim().length === 0) &&
          (!attachments ||
            !Array.isArray(attachments) ||
            attachments.length === 0)
        ) {
          return res
            .status(400)
            .json({
              success: false,
              message: "Message or attachments are required",
            });
        }

        // Validate attachments if provided
        if (attachments && Array.isArray(attachments)) {
          if (attachments.length > 10) {
            return res
              .status(400)
              .json({
                success: false,
                message: "Maximum 10 attachments allowed per message",
              });
          }
          // Validate that all attachments are valid URLs
          for (const url of attachments) {
            if (typeof url !== "string" || !url.startsWith("https://")) {
              return res
                .status(400)
                .json({
                  success: false,
                  message: "Invalid attachment URL format",
                });
            }
          }
        }

        // Find or create chat
        let chat = await DoctorPatientChats.findOne({
          where: { patientId: currentUser.id },
        });

        if (!chat) {
          return res.status(404).json({
            success: false,
            message: "No chat found. You don't have an assigned doctor yet.",
          });
        }

        // Create new message with optional attachments
        const newMessage: any = {
          id: require("crypto").randomUUID(),
          senderId: currentUser.id,
          senderRole: "patient" as const,
          message: message ? message.trim() : "",
          createdAt: new Date().toISOString(),
          read: false,
        };

        // Add attachments if provided
        if (
          attachments &&
          Array.isArray(attachments) &&
          attachments.length > 0
        ) {
          newMessage.attachments = attachments;
        }

        // Add message to array
        const updatedMessages = [...(chat.messages || []), newMessage];

        // Update chat - reset patient's unread count to 0 since they're sending a message
        await chat.update({
          messages: updatedMessages,
          lastMessageAt: new Date(),
          unreadCountDoctor: chat.unreadCountDoctor + 1,
          unreadCountPatient: 0,
        });

        // Reload and manually add doctor data
        await chat.reload();
        const doctor = await User.findByPk(chat.doctorId, {
          attributes: ["id", "firstName", "lastName", "email"],
        });

        const chatWithDoctor = {
          ...chat.toJSON(),
          doctor: doctor ? doctor.toJSON() : null,
        };

        // Emit WebSocket event for new message
        WebSocketService.emitChatMessage({
          chatId: chat.id,
          doctorId: chat.doctorId,
          patientId: chat.patientId,
          message: newMessage,
        });

        // Emit updated unread count to doctor
        WebSocketService.emitUnreadCountUpdate(
          chat.doctorId,
          chat.unreadCountDoctor
        );

        // Emit patient's unread count (reset to 0 since they sent the message)
        WebSocketService.emitUnreadCountUpdate(chat.patientId, 0);

        // HIPAA Audit: Log message creation (patient sending health communication)
        await AuditService.logMessageSent(req, chat.id, chat.doctorId);

        res.json({
          success: true,
          data: {
            message: newMessage,
            chat: chatWithDoctor,
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error sending patient message:", error);
        } else {
          console.error("❌ Error sending patient message");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to send message" });
      }
    }
  );

  // Mark messages as read for patient
  app.post(
    "/patient/chat/mark-read",
    authenticateJWT,
    async (req: any, res: any) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }

        const user = await User.findByPk(currentUser.id, {
          include: [{ model: UserRoles, as: "userRoles", required: false }],
        });
        if (!user || !user.hasRoleSync("patient")) {
          return res
            .status(403)
            .json({
              success: false,
              message: "Access denied. Patient role required.",
            });
        }

        const chat = await DoctorPatientChats.findOne({
          where: { patientId: currentUser.id },
        });

        if (!chat) {
          return res
            .status(404)
            .json({ success: false, message: "Chat not found" });
        }

        // Mark all messages from doctor as read
        const updatedMessages = (chat.messages || []).map((msg: any) => {
          if (msg.senderRole === "doctor" && !msg.read) {
            return { ...msg, read: true };
          }
          return msg;
        });

        // Update chat
        await chat.update({
          messages: updatedMessages,
          unreadCountPatient: 0,
        });

        // Load doctor data
        const doctor = await User.findByPk(chat.doctorId, {
          attributes: ["id", "firstName", "lastName", "email"],
        });

        const chatWithDoctor = {
          ...chat.toJSON(),
          doctor: doctor ? doctor.toJSON() : null,
        };

        // Emit updated unread count to patient (reset to 0)
        WebSocketService.emitUnreadCountUpdate(currentUser.id, 0);

        res.json({
          success: true,
          data: chatWithDoctor,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error marking messages as read:", error);
        } else {
          console.error("❌ Error marking messages as read");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to mark messages as read" });
      }
    }
  );

  // ============================================
  // Ensure new tables exist (targeted sync for new models)
  // ============================================
  try {
    await RefundRequest.sync({ alter: true });
    console.log("✅ RefundRequest table synced");
  } catch (syncErr) {
    console.log("⚠️  RefundRequest sync:", syncErr instanceof Error ? syncErr.message : syncErr);
  }

  try {
    await BelugaProduct.sync({ alter: true });
    console.log("✅ BelugaProduct table synced");
  } catch (syncErr) {
    console.log("⚠️  BelugaProduct sync:", syncErr instanceof Error ? syncErr.message : syncErr);
  }

  // ============================================
  // Start server & initialize services
  // (AFTER all routes are registered)
  // ============================================

  const httpServer = app.listen(PORT, () => {
    console.log(`🚀 API listening on :${PORT}`);
    console.log("📊 Database connected successfully");
    console.log("🔒 HIPAA-compliant security features enabled");
  });

  // Initialize WebSocket server (imported above, initialize with httpServer now)
  WebSocketService.initialize(httpServer);
  console.log("🔌 WebSocket server initialized");

  // Initialize all cron jobs from centralized registry
  const cronJobRegistry = (await import('./cronJobs')).default;
  await cronJobRegistry.registerAll();

  // Start auto-approval service
  const AutoApprovalService = (await import("./services/autoApproval.service"))
    .default;
  AutoApprovalService.start();
  console.log("🤖 Auto-approval service started");
}

startServer();

app.post(
  "/brand-subscriptions/test-upgrade-high-definition",
  async (req, res) => {
    try {
      const { stripeSubscriptionId, nextPriceId } = req.body;

      if (!stripeSubscriptionId || typeof stripeSubscriptionId !== "string") {
        return res
          .status(400)
          .json({
            success: false,
            message: "stripeSubscriptionId is required",
          });
      }

      const brandSub = await BrandSubscription.findOne({
        where: {
          stripeSubscriptionId,
        },
      });

      if (!brandSub) {
        return res
          .status(404)
          .json({ success: false, message: "Subscription not found" });
      }

      const scheduleMetadata = (brandSub.features as any)?.subscriptionSchedule;
      const scheduleId: string | undefined = scheduleMetadata?.id;

      if (!scheduleId) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Subscription schedule not found for this subscription",
          });
      }

      const highDefinitionPlan =
        await BrandSubscriptionPlans.getPlanByType("high-definition");
      if (!highDefinitionPlan) {
        return res
          .status(500)
          .json({
            success: false,
            message: "High Definition plan is not configured",
          });
      }

      const overridePriceId =
        typeof nextPriceId === "string" && nextPriceId.trim().length > 0
          ? nextPriceId.trim()
          : undefined;
      const targetPriceId = overridePriceId || highDefinitionPlan.stripePriceId;

      const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);

      const phases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = (
        schedule.phases || []
      ).map((phase, index, arr) => {
        const phaseAny = phase as any;
        const items = (phase.items || []).map((item) => {
          const itemAny = item as any;
          const desiredPriceId =
            index === arr.length - 1
              ? targetPriceId
              : typeof itemAny.price === "string"
                ? itemAny.price
                : itemAny.price?.id;

          if (!desiredPriceId) {
            throw new Error(
              "Unable to determine price for subscription schedule phase"
            );
          }

          return {
            price: desiredPriceId,
            quantity: itemAny.quantity ?? 1,
          };
        });

        const phaseUpdate: Stripe.SubscriptionScheduleUpdateParams.Phase = {
          items,
        };

        if (typeof phaseAny.iterations === "number") {
          phaseUpdate.iterations = phaseAny.iterations;
        } else if (phaseAny.end_date) {
          phaseUpdate.end_date = phaseAny.end_date;
        }

        if (
          index < arr.length - 1 &&
          !phaseUpdate.iterations &&
          !phaseUpdate.end_date
        ) {
          phaseUpdate.iterations = 1;
        }

        if (phaseAny.start_date && !phaseUpdate.start_date) {
          phaseUpdate.start_date = phaseAny.start_date;
        }

        if (phaseAny.proration_behavior) {
          phaseUpdate.proration_behavior = phaseAny.proration_behavior;
        }

        if (phaseAny.collection_method) {
          phaseUpdate.collection_method = phaseAny.collection_method;
        }

        if (phaseAny.billing_thresholds) {
          phaseUpdate.billing_thresholds = phaseAny.billing_thresholds;
        }

        if (phaseAny.invoice_settings) {
          phaseUpdate.invoice_settings = phaseAny.invoice_settings;
        }

        if (phaseAny.trial) {
          phaseUpdate.trial = phaseAny.trial;
        }

        if (phaseAny.currency) {
          phaseUpdate.currency = phaseAny.currency;
        }

        return phaseUpdate;
      });

      if (phases.length === 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Subscription schedule has no phases to update",
          });
      }

      await stripe.subscriptionSchedules.update(scheduleId, {
        phases,
        proration_behavior: "none",
      });

      const updatedSubscription =
        await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const updatedSubData = updatedSubscription as any;

      const updatedPeriodStart = updatedSubData?.current_period_start
        ? new Date(updatedSubData.current_period_start * 1000)
        : brandSub.currentPeriodStart;
      const updatedPeriodEnd = updatedSubData?.current_period_end
        ? new Date(updatedSubData.current_period_end * 1000)
        : brandSub.currentPeriodEnd;

      const existingFeatures = (brandSub.features as any) || {};
      const subscriptionScheduleFeature =
        existingFeatures.subscriptionSchedule || {};
      const planFeatures = highDefinitionPlan.getFeatures();

      const updatedFeatures = {
        ...existingFeatures,
        ...planFeatures,
        subscriptionSchedule: {
          ...subscriptionScheduleFeature,
          id: scheduleId,
          introductoryPlanType:
            subscriptionScheduleFeature.introductoryPlanType,
          introductoryStripePriceId:
            subscriptionScheduleFeature.introductoryStripePriceId,
          introductoryMonthlyPrice:
            subscriptionScheduleFeature.introductoryMonthlyPrice,
          nextPlanType: "high-definition",
          nextStripePriceId: targetPriceId,
        },
      };

      await brandSub.update({
        planType: "high-definition",
        stripePriceId: targetPriceId,
        monthlyPrice: highDefinitionPlan.monthlyPrice,
        currentPeriodStart: updatedPeriodStart ?? null,
        currentPeriodEnd: updatedPeriodEnd ?? null,
        features: updatedFeatures,
      });

      const user = await User.findByPk(brandSub.userId);
      if (user?.email) {
        const plainMessage = `Hello ${user.firstName || ""},\n\nThis is a confirmation that your Fuse subscription will move to the High Definition plan starting with your next billing cycle. You will be billed $${Number(highDefinitionPlan.monthlyPrice).toFixed(2)} per month going forward.\n\nIf you have any questions, please reach out to our support team.\n\nBest regards,\nThe Fuse Team`;

        const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Upcoming Plan Upgrade</h1>
          </div>
          <div style="padding: 32px; background-color: #f9fafb;">
            <p style="color: #111827; font-size: 16px; line-height: 1.6;">Hello ${user.firstName || ""},</p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              We're letting you know that your Fuse subscription will upgrade to the <strong>High Definition</strong> plan at the start of your next billing cycle.
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              The new plan will be billed at <strong>$${Number(highDefinitionPlan.monthlyPrice).toFixed(2)} per month</strong> and unlocks the following benefits:
            </p>
            <ul style="color: #374151; font-size: 16px; line-height: 1.6; margin-left: 20px;">
              <li>Priority customer support</li>
              <li>Up to 200 products and 20 campaigns</li>
              <li>Advanced analytics access</li>
            </ul>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              If you have any questions or would like help optimizing the new features, please contact our support team any time.
            </p>
          </div>
          <div style="background-color: #111827; padding: 20px; text-align: center;">
            <p style="color: #e5e7eb; margin: 0; font-size: 14px;">Best regards,<br />The Fuse Team</p>
          </div>
        </div>
      `;

        await MailsSender.sendEmail({
          to: user.email,
          subject: "Your Fuse plan will upgrade to High Definition next month",
          text: plainMessage,
          html: htmlMessage,
        });
      }

      res.status(200).json({
        success: true,
        scheduleId,
        updatedPlanType: "high-definition",
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error scheduling High Definition upgrade:", error);
      } else {
        console.error("❌ Error scheduling High Definition upgrade");
      }
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to schedule High Definition upgrade",
        });
    }
  }
);

app.get("/brand-treatments", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [Clinic, { model: UserRoles, as: "userRoles", required: false }],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.hasRoleSync("brand")) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied. Brand role required.",
        });
    }

    const clinicSlug = user.clinic?.slug || null;

    const [treatments, selections] = await Promise.all([
      Treatment.findAll({
        order: [["name", "ASC"]],
      }),
      BrandTreatment.findAll({
        where: { userId: user.id },
      }),
    ]);

    const selectionMap = new Map(selections.map((bt) => [bt.treatmentId, bt]));

    const data = treatments.map((treatment) => {
      const selection = selectionMap.get(treatment.id);
      return {
        id: treatment.id,
        name: treatment.name,
        treatmentLogo: treatment.treatmentLogo,
        active: treatment.isActive,
        selected: Boolean(selection),
        brandLogo: selection?.brandLogo || null,
        brandColor: selection?.brandColor || null,
        clinicSlug,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching brand treatments:", error);
    } else {
      console.error("❌ Error fetching brand treatments");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch brand treatments" });
  }
});

app.post("/brand-treatments", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.hasRoleSync("brand")) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied. Brand role required.",
        });
    }

    // Validate request body using brandTreatmentSchema
    const validation = brandTreatmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const { treatmentId, brandLogo, brandColor } = validation.data;

    const treatment = await Treatment.findByPk(treatmentId);

    if (!treatment) {
      return res
        .status(404)
        .json({ success: false, message: "Treatment not found" });
    }

    const [record, created] = await BrandTreatment.findOrCreate({
      where: { userId: user.id, treatmentId },
      defaults: {
        userId: user.id,
        treatmentId,
        brandLogo: brandLogo || null,
        brandColor: brandColor || null,
      },
    });

    if (!created) {
      record.brandLogo = brandLogo ?? record.brandLogo;
      record.brandColor = brandColor ?? record.brandColor;
      await record.save();
    }

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error saving brand treatment:", error);
    } else {
      console.error("❌ Error saving brand treatment");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to save brand treatment" });
  }
});

app.delete("/brand-treatments", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: "userRoles", required: false }],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.hasRoleSync("brand")) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied. Brand role required.",
        });
    }

    const { treatmentId } = req.body;

    if (!treatmentId) {
      return res
        .status(400)
        .json({ success: false, message: "treatmentId is required" });
    }

    const deleted = await BrandTreatment.destroy({
      where: { userId: user.id, treatmentId },
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Brand treatment not found" });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error removing brand treatment:", error);
    } else {
      console.error("❌ Error removing brand treatment");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to remove brand treatment" });
  }
});

app.get("/brand-treatments/published", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findByPk(currentUser.id, {
      include: [Clinic, { model: UserRoles, as: "userRoles", required: false }],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.hasRoleSync("brand")) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied. Brand role required.",
        });
    }

    const selections = await BrandTreatment.findAll({
      where: { userId: user.id },
      include: [
        {
          model: Treatment,
          include: [
            {
              model: Questionnaire,
              attributes: ["id", "title", "description"],
            },
          ],
        },
      ],
    });

    const data = selections
      .filter((selection) => Boolean(selection.treatment))
      .map((selection) => {
        const treatment = selection.treatment!;
        const slug = treatment.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        return {
          id: treatment.id,
          name: treatment.name,
          slug,
          treatmentLogo: selection.brandLogo || treatment.treatmentLogo || null,
          brandColor: selection.brandColor || null,
          questionnaireId: treatment.questionnaires?.[0]?.id || null,
          questionnaireTitle: treatment.questionnaires?.[0]?.title || null,
          questionnaireDescription:
            treatment.questionnaires?.[0]?.description || null,
          clinicSlug: user.clinic?.slug || null,
        };
      });

    const { slug } = req.query;

    if (typeof slug === "string") {
      const match = data.find((item) => item.slug === slug);
      if (!match) {
        return res
          .status(404)
          .json({ success: false, message: "Offering not found" });
      }
      return res.status(200).json({ success: true, data: match });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching published brand treatments:", error);
    } else {
      console.error("❌ Error fetching published brand treatments");
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch published treatments",
      });
  }
});

// Public: get product form by clinic slug + product slug
app.get("/public/brand-products/:clinicSlug/:slug", async (req, res) => {
  try {
    const { clinicSlug, slug } = req.params;
    const variantParam =
      typeof req.query.variant === "string" ? req.query.variant : undefined;
    const normalizedVariant =
      variantParam === "main" ? undefined : variantParam;

    const clinic = await Clinic.findOne({ where: { slug: clinicSlug } });
    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    const product = await Product.findOne({ where: { slug } });
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Ensure the product is enabled either via TenantProduct or TenantProductForm
    const tenantProduct = await TenantProduct.findOne({
      where: { clinicId: clinic.id, productId: product.id },
    });

    const tenantProductForms = await TenantProductForm.findAll({
      where: { clinicId: clinic.id, productId: product.id },
      order: [["createdAt", "DESC"]] as any,
    });

    if (!tenantProduct && tenantProductForms.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Product not enabled for this brand",
        });
    }

    // Locate the specific form requested (if any)
    let selectedForm: TenantProductForm | null = null;
    if (normalizedVariant) {
      selectedForm =
        tenantProductForms.find((form) => form.id === normalizedVariant) ||
        tenantProductForms.find(
          (form) => (form.currentFormVariant ?? null) === normalizedVariant
        ) ||
        null;

      if (!selectedForm) {
        return res
          .status(404)
          .json({
            success: false,
            message: "Requested form variant not enabled",
          });
      }
    } else if (tenantProductForms.length > 0) {
      selectedForm = tenantProductForms[0];
    }

    // Determine questionnaire
    let questionnaireId =
      selectedForm?.questionnaireId || tenantProduct?.questionnaireId || null;

    console.log('[brand-products] Questionnaire sources:', {
      productId: product.id,
      productSlug: product.slug,
      selectedFormId: selectedForm?.id,
      selectedFormQuestionnaireId: selectedForm?.questionnaireId,
      tenantProductQuestionnaireId: tenantProduct?.questionnaireId,
      initialQuestionnaireId: questionnaireId,
    });

    try {
      const productQuestionnaire = await Questionnaire.findOne({
        where: {
          productId: product.id,
          formTemplateType: "normal",
        },
        order: [["updatedAt", "DESC"]],
      });
      if (productQuestionnaire) {
        questionnaireId = productQuestionnaire.id;
        console.log(
          "✅ Using questionnaire from Questionnaire.productId:",
          questionnaireId
        );
      } else {
        console.log('[brand-products] ⚠️ No questionnaire found for product:', product.id);
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error finding medical questionnaire:", e);
      } else {
        console.error("Error finding medical questionnaire");
      }
    }

    console.log('[brand-products] Final questionnaireId:', questionnaireId);

    const categories = Array.isArray((product as any).categories)
      ? ((product as any).categories as string[]).filter(Boolean)
      : [];

    // Get Global Form Structure if form has one assigned
    let globalFormStructure: any | null = null;
    if (selectedForm?.globalFormStructureId) {
      const structure = await GlobalFormStructure.findOne({
        where: {
          structureId: selectedForm.globalFormStructureId,
          isActive: true,
        },
      });

      if (structure) {
        globalFormStructure = {
          id: structure.structureId,
          name: structure.name,
          description: structure.description,
          sections: structure.sections,
          isDefault: structure.isDefault,
        };
        console.log(
          `✅ Found Global Form Structure: ${globalFormStructure.name} for form ${selectedForm.id}`
        );
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        questionnaireId,
        clinicSlug: clinic.slug,
        category: categories[0] ?? null,
        categories,
        currentFormVariant: selectedForm?.currentFormVariant ?? null,
        tenantProductFormId: selectedForm?.id ?? null,
        globalFormStructureId: selectedForm?.globalFormStructureId ?? null,
        globalFormStructure: globalFormStructure,
        // Expose tenant product pricing + stripe identifiers for checkout when available
        // Return pricing data even if tenantProduct doesn't exist (fallback to product base price)
        price: tenantProduct
          ? ((tenantProduct as any).price ?? (product as any).price ?? null)
          : ((product as any).price ?? null),
        stripeProductId: tenantProduct
          ? ((tenantProduct as any).stripeProductId ??
            (product as any).stripeProductId ??
            null)
          : ((product as any).stripeProductId ?? null),
        stripePriceId: tenantProduct
          ? ((tenantProduct as any).stripePriceId ??
            (product as any).stripePriceId ??
            null)
          : ((product as any).stripePriceId ?? null),
        tenantProductId: tenantProduct
          ? ((tenantProduct as any).id ?? null)
          : null,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching published brand products:", error);
    } else {
      console.error("❌ Error fetching published brand products");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch published products" });
  }
});
// Public: list standardized templates (optionally filtered by category)
app.get("/public/questionnaires/standardized", async (req, res) => {
  try {
    const { category } = req.query;

    const where: any = {
      isTemplate: true,
      formTemplateType: "standardized_template",
    };
    if (typeof category === "string" && category.trim().length > 0) {
      where.category = category.trim();
    }

    const questionnaires = await Questionnaire.findAll({
      where,
      include: [
        {
          model: QuestionnaireStep,
          include: [
            {
              model: Question,
              include: [QuestionOption],
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
    });

    res.status(200).json({ success: true, data: questionnaires });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching standardized questionnaires:", error);
    } else {
      console.error("❌ Error fetching standardized questionnaires");
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch standardized questionnaires",
      });
  }
});

// Public: get the latest questionnaire with formTemplateType = 'user_profile'
app.get("/public/questionnaires/first-user-profile", async (_req, res) => {
  try {
    const questionnaire = await Questionnaire.findOne({
      where: { formTemplateType: "user_profile" },
      include: [
        {
          model: QuestionnaireStep,
          include: [
            {
              model: Question,
              include: [QuestionOption],
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
        ["updatedAt", "DESC"],
      ] as any,
    });

    if (!questionnaire) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No user_profile questionnaire found",
        });
    }

    res.status(200).json({ success: true, data: questionnaire });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "❌ Error fetching first user_profile questionnaires:",
        error
      );
    } else {
      console.error("❌ Error fetching first user_profile questionnaires");
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch user_profile questionnaire",
      });
  }
});

// Public: get questionnaire by id (no auth), includes steps/questions/options
app.get("/public/questionnaires/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const questionnaire = await Questionnaire.findByPk(id, {
      include: [
        {
          model: QuestionnaireStep,
          include: [
            {
              model: Question,
              include: [QuestionOption],
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
    });

    if (!questionnaire) {
      return res
        .status(404)
        .json({ success: false, message: "Questionnaire not found" });
    }

    res.status(200).json({ success: true, data: questionnaire });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching public questionnaires:", error);
    } else {
      console.error("❌ Error fetching public questionnaires");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch questionnaire" });
  }
});

// Public: get active customization for a questionnaire by clinic
app.get(
  "/public/questionnaire-customization/:questionnaireId",
  async (req, res) => {
    try {
      const { questionnaireId } = req.params;
      const clinicId = req.query.clinicId as string;

      console.log(
        `🎨 [PUBLIC] Fetching customization for questionnaire: ${questionnaireId}, clinic: ${clinicId}`
      );

      if (!clinicId) {
        console.log("❌ [PUBLIC] Missing clinicId parameter");
        return res.status(400).json({
          success: false,
          message: "clinicId query parameter is required",
        });
      }

      // Find an active customization for this questionnaire from any user in this clinic
      const customization = await QuestionnaireCustomization.findOne({
        where: {
          questionnaireId,
          isActive: true,
          "$user.clinicId$": clinicId, // Use nested where with Sequelize syntax
        },
        include: [
          {
            model: User,
            as: "user",
            required: true,
            attributes: ["id", "clinicId"], // Return minimal user data for debugging
          },
        ],
      });

      console.log(
        `📦 [PUBLIC] Found customization:`,
        customization
          ? {
            id: customization.id,
            questionnaireId: customization.questionnaireId,
            customColor: customization.customColor,
            isActive: customization.isActive,
            userId: customization.userId,
          }
          : null
      );

      if (!customization) {
        console.log("⚠️ [PUBLIC] No customization found, returning null");

        // Debug: Let's see what's in the table
        const allCustomizations = await QuestionnaireCustomization.findAll({
          where: { questionnaireId },
          include: [
            { model: User, as: "user", attributes: ["id", "clinicId"] },
          ],
        });
        console.log(
          `🔍 [PUBLIC] All customizations for this questionnaire:`,
          allCustomizations.map((c) => ({
            id: c.id,
            questionnaireId: c.questionnaireId,
            customColor: c.customColor,
            isActive: c.isActive,
            userId: c.userId,
            userClinicId: (c as any).user?.clinicId,
          }))
        );

        return res.status(200).json({
          success: true,
          data: null, // No customization found
        });
      }

      const result = {
        customColor: customization.customColor,
        isActive: customization.isActive,
      };

      console.log(`✅ [PUBLIC] Returning customization:`, result);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "❌ [PUBLIC] Error fetching questionnaire customization:",
          error
        );
        console.error("❌ [PUBLIC] Error details:", error);
      } else {
        console.error("❌ [PUBLIC] Error fetching questionnaire customization");
        console.error("❌ [PUBLIC] Error details");
      }

      res
        .status(500)
        .json({ success: false, message: "Failed to fetch customization" });
    }
  }
);

// Public: get the latest questionnaire with formTemplateType = 'user_profile'
app.get("/public/questionnaires/first-user-profile", async (_req, res) => {
  try {
    const questionnaire = await Questionnaire.findOne({
      where: { formTemplateType: "user_profile" },
      include: [
        {
          model: QuestionnaireStep,
          include: [
            {
              model: Question,
              include: [QuestionOption],
            },
          ],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    if (!questionnaire) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No user_profile questionnaire found",
        });
    }

    res.status(200).json({ success: true, data: questionnaire });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "❌ Error fetching first user_profile questionnaire",
        error
      );
    } else {
      console.error("❌ Error fetching first user_profile questionnaire");
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch user_profile questionnaire",
      });
  }
});

// Public: get pharmacy coverages for a product
app.get("/public/products/:productId/pharmacy-coverages", async (req, res) => {
  try {
    const { productId } = req.params;

    console.log(
      "💊 [PUBLIC] Fetching pharmacy coverages for product:",
      productId
    );

    // Fetch all pharmacy coverages for this product
    const coverages = await PharmacyCoverage.findAll({
      where: { productId },
      include: [
        {
          model: Pharmacy,
          as: "pharmacy",
          attributes: ["id", "name", "slug"],
        },
        {
          model: PharmacyProduct,
          as: "assignments",
          attributes: ["id", "pharmacyProductName"],
        },
      ],
      order: [["customName", "ASC"]],
    });

    console.log("💊 [PUBLIC] Found coverages:", coverages.length);

    res.json({
      success: true,
      data: coverages.map((c) => ({
        id: c.id,
        customName: c.customName,
        customSig: c.customSig,
        pharmacy: c.pharmacy,
        pharmacyProduct:
          c.assignments && c.assignments.length > 0
            ? {
              pharmacyProductName: c.assignments[0].pharmacyProductName,
            }
            : null,
      })),
    });
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ [PUBLIC] Error fetching pharmacy coverages:", error);
    } else {
      console.error("❌ [PUBLIC] Error fetching pharmacy coverages");
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pharmacy coverages",
    });
  }
});

app.get("/public/brand-treatments/:clinicSlug/:slug", async (req, res) => {
  try {
    const { clinicSlug, slug } = req.params;

    const clinic = await Clinic.findOne({ where: { slug: clinicSlug } });

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    const brandUser = await User.findOne({
      where: {
        clinicId: clinic.id,
        role: "brand",
      },
    });

    if (!brandUser) {
      return res
        .status(404)
        .json({ success: false, message: "Brand user not found for clinic" });
    }

    const selection = await BrandTreatment.findOne({
      where: {
        userId: brandUser.id,
      },
      include: [
        {
          model: Treatment,
          include: [
            {
              model: Questionnaire,
              attributes: ["id", "title", "description"],
            },
          ],
        },
      ],
    });

    if (!selection || !selection.treatment) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Treatment not enabled for this brand",
        });
    }

    const treatment = selection.treatment;
    const computedSlug = (treatment.slug || treatment.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (computedSlug !== slug) {
      return res
        .status(404)
        .json({ success: false, message: "Offering slug not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        id: treatment.id,
        name: treatment.name,
        slug: computedSlug,
        treatmentLogo: selection.brandLogo || treatment.treatmentLogo || null,
        brandColor: selection.brandColor || null,
        questionnaireId: treatment.questionnaires?.[0]?.id || null,
        questionnaireTitle: treatment.questionnaires?.[0]?.title || null,
        questionnaireDescription:
          treatment.questionnaires?.[0]?.description || null,
        clinicSlug: clinic.slug,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Error fetching public brand treatment:", error);
    } else {
      console.error("❌ Error fetching public brand treatment");
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch treatment" });
  }
});