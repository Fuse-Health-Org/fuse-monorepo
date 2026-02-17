import { Sequelize } from 'sequelize-typescript';
import { DataTypes } from 'sequelize';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import User from '../models/User';
import Entity from '../models/Entity';
import Product from '../models/Product';
import Prescription from '../models/Prescription';
import PrescriptionExtension from '../models/PrescriptionExtension';
import Treatment from '../models/Treatment';
import PrescriptionProducts from '../models/PrescriptionProducts';
import TreatmentProducts from '../models/TreatmentProducts';
import Clinic from '../models/Clinic';
import Questionnaire from '../models/Questionnaire';
import QuestionnaireCustomization from '../models/QuestionnaireCustomization';
import QuestionnaireStep from '../models/QuestionnaireStep';
import Question from '../models/Question';
import QuestionOption from '../models/QuestionOption';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Payment from '../models/Payment';
import ShippingAddress from '../models/ShippingAddress';
import BrandSubscription from '../models/BrandSubscription';
import BrandSubscriptionPlans from '../models/BrandSubscriptionPlans';
import ShippingOrder from '../models/ShippingOrder';
import Subscription from '../models/Subscription';
import TreatmentPlan from '../models/TreatmentPlan';
import Physician from '../models/Physician';
import BrandTreatment from '../models/BrandTreatment';
import UserPatient from '../models/UserPatient';
import TenantProduct from '../models/TenantProduct';
import FormSectionTemplate from '../models/FormSectionTemplate';
import TenantProductForm from '../models/TenantProductForm';
import FormProducts from '../models/FormProducts';
import GlobalFormStructure from '../models/GlobalFormStructure';
import Sale from '../models/Sale';
import DoctorPatientChats from '../models/DoctorPatientChats';
import Pharmacy from '../models/Pharmacy';
import PharmacyProduct from '../models/PharmacyProduct';
import PharmacyCoverage from '../models/PharmacyCoverage';
import TenantCustomFeatures from '../models/TenantCustomFeatures';
import TierConfiguration from '../models/TierConfiguration';
import TenantAnalyticsEvents from '../models/TenantAnalyticsEvents';
import FormAnalyticsDaily from '../models/FormAnalyticsDaily';
import MessageTemplate from '../models/MessageTemplate';
import Sequence from '../models/Sequence';
import SequenceRun from '../models/SequenceRun';
import Tag from '../models/Tag';
import UserTag from '../models/UserTag';
import { GlobalFees } from '../models/GlobalFees';
import { WebsiteBuilderConfigs, DEFAULT_FOOTER_DISCLAIMER } from '../models/WebsiteBuilderConfigs';
import AffiliateProductImage from '../models/AffiliateProductImage';
import UserRoles from '../models/UserRoles';
import SupportTicket from '../models/SupportTicket';
import TicketMessage from '../models/TicketMessage';
import AuditLog from '../models/AuditLog';
import MfaToken from '../models/MfaToken';
import CustomWebsite from '../models/CustomWebsite';
import Like from '../models/Like';
import BrandFavoritedProduct from '../models/BrandFavoritedProduct';
import Program from '../models/Program';
import BrandInvitation from '../models/BrandInvitation';
import MedicalCompany from '../models/MedicalCompany';
import MedicalCompanyPharmacy from '../models/MedicalCompanyPharmacy';
import DoctorPharmacy from '../models/DoctorPharmacy';
import { MedicalCompanySlug } from '@fuse/enums';
import ClinicBalance from '../models/ClinicBalance';
import RefundRequest from '../models/RefundRequest';
import { MigrationService } from '../services/migration.service';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Use DEV_DATABASE_URL for development environment, otherwise use DATABASE_URL
const databaseUrl = process.env.NODE_ENV === 'development'
  ? process.env.DEV_DATABASE_URL || process.env.DATABASE_URL
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL (or DEV_DATABASE_URL for development) environment variable is required');
}

// Check if we're connecting to localhost
const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

// HIPAA Compliance: Load AWS RDS CA certificate bundle for proper TLS verification
// Certificate downloaded from: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
const rdsCaCertPath = path.join(__dirname, '../certs/rds-ca-bundle.pem');
let rdsCaCert: string | undefined;

try {
  if (fs.existsSync(rdsCaCertPath)) {
    rdsCaCert = fs.readFileSync(rdsCaCertPath, 'utf8');
    // HIPAA: Do not log certificate loading details in production
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ AWS RDS CA certificate bundle loaded for TLS verification');
    }
  } else {
    // HIPAA: Only warn in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  AWS RDS CA certificate bundle not found at:', rdsCaCertPath);
      console.warn('   Run: curl -o patient-api/src/certs/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem');
    }
  }
} catch (certError) {
  // HIPAA: Only warn in development, do not expose error details in production
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️  Failed to load RDS CA certificate:', certError instanceof Error ? certError.message : certError);
  }
}

// HIPAA-compliant database connection with enforced TLS
const sequelizeConfig = {
  dialect: 'postgres' as const,
  dialectOptions: {
    // SSL configuration for HIPAA compliance:
    // - Production: ALWAYS require SSL with strict certificate verification
    // - Development: Allow localhost without SSL, but require SSL for remote connections
    ssl: isLocalhost && process.env.NODE_ENV === 'development'
      ? false  // Local development only
      : {
        require: true,
        rejectUnauthorized: true, // ALWAYS verify certificates in non-local environments
        ca: rdsCaCert, // AWS RDS CA certificate bundle
      },
  },
  logging: false, // HIPAA: Don't log SQL queries (could contain PHI)
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

// SECURITY: Fail if we're in production without CA certificate
if (process.env.NODE_ENV === 'production' && !rdsCaCert) {
  // HIPAA: Do not log paths or detailed instructions in production
  throw new Error('RDS CA certificate is required in production');
}

export const sequelize = new Sequelize(databaseUrl, {
  ...sequelizeConfig,
  models: [
    // Medical companies must be created before User due to foreign key relationship
    MedicalCompany, MedicalCompanyPharmacy, DoctorPharmacy,
    User, Product,
    Prescription, PrescriptionExtension, Treatment, PrescriptionProducts,
    TreatmentProducts, Clinic, Questionnaire, QuestionnaireCustomization,
    QuestionnaireStep, Question, QuestionOption,
    Order, OrderItem, Payment,
    ShippingAddress, ShippingOrder, Subscription,
    TreatmentPlan, BrandSubscription, BrandSubscriptionPlans, Physician, BrandTreatment,
    UserPatient, TenantProduct, FormSectionTemplate,
    TenantProductForm, FormProducts, GlobalFormStructure, Sale, DoctorPatientChats, Pharmacy, PharmacyCoverage, PharmacyProduct,
    TenantCustomFeatures, TierConfiguration, TenantAnalyticsEvents, FormAnalyticsDaily,
    MessageTemplate, Sequence, SequenceRun, Tag, UserTag, GlobalFees, WebsiteBuilderConfigs, UserRoles,
    SupportTicket, TicketMessage, AuditLog, MfaToken, CustomWebsite, Like, BrandFavoritedProduct, Program, AffiliateProductImage, BrandInvitation, ClinicBalance, RefundRequest
  ],
});

async function ensureVisitTypeColumns() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    // 1. Ensure visit_type_by_state column exists on Questionnaire
    const questionnaireTable = await queryInterface.describeTable('Questionnaire');
    if (!Object.prototype.hasOwnProperty.call(questionnaireTable, 'visitTypeByState') && 
        !Object.prototype.hasOwnProperty.call(questionnaireTable, 'visit_type_by_state')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚙️  Adding visit_type_by_state column to Questionnaire table...');
      }
      await queryInterface.addColumn('Questionnaire', 'visitTypeByState', {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ visit_type_by_state column added to Questionnaire');
      }
    }

    // 2. Ensure visit_type_fees column exists on Clinic
    const clinicTable = await queryInterface.describeTable('Clinic');
    if (!Object.prototype.hasOwnProperty.call(clinicTable, 'visitTypeFees') && 
        !Object.prototype.hasOwnProperty.call(clinicTable, 'visit_type_fees')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚙️  Adding visit_type_fees column to Clinic table...');
      }
      await queryInterface.addColumn('Clinic', 'visitTypeFees', {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: { synchronous: 0, asynchronous: 0 },
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ visit_type_fees column added to Clinic');
      }
    }

    // 2b. Ensure visit_type_fees column exists on MedicalCompany
    const medicalCompanyTable = await queryInterface.describeTable('MedicalCompany');
    if (!Object.prototype.hasOwnProperty.call(medicalCompanyTable, 'visitTypeFees') &&
        !Object.prototype.hasOwnProperty.call(medicalCompanyTable, 'visit_type_fees')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚙️  Adding visit_type_fees column to MedicalCompany table...');
      }
      await queryInterface.addColumn('MedicalCompany', 'visitTypeFees', {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: { synchronous: 0, asynchronous: 0 },
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ visit_type_fees column added to MedicalCompany');
      }
    }

    // 3. Ensure visit_type column exists on Order
    const orderTable = await queryInterface.describeTable('Order');
    if (!Object.prototype.hasOwnProperty.call(orderTable, 'visitType') && 
        !Object.prototype.hasOwnProperty.call(orderTable, 'visit_type')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚙️  Adding visit_type column to Order table...');
      }
      await queryInterface.addColumn('Order', 'visitType', {
        type: DataTypes.STRING(50),
        allowNull: true,
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ visit_type column added to Order');
      }
    }

    // 4. Ensure visit_fee_amount column exists on Order
    if (!Object.prototype.hasOwnProperty.call(orderTable, 'visitFeeAmount') && 
        !Object.prototype.hasOwnProperty.call(orderTable, 'visit_fee_amount')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚙️  Adding visit_fee_amount column to Order table...');
      }
      await queryInterface.addColumn('Order', 'visitFeeAmount', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ visit_fee_amount column added to Order');
      }
    }

    // 5. Ensure program_id column exists on Order (for new Program-based architecture)
    if (!Object.prototype.hasOwnProperty.call(orderTable, 'programId') && 
        !Object.prototype.hasOwnProperty.call(orderTable, 'program_id')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚙️  Adding program_id column to Order table...');
      }
      await queryInterface.addColumn('Order', 'programId', {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Program',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ program_id column added to Order');
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Visit type columns check completed');
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Failed to ensure visit type columns:', error);
    }
  }
}

async function ensureProductCategoriesColumn() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tableDefinition = await queryInterface.describeTable('Product');
    const hasCategoriesColumn = Object.prototype.hasOwnProperty.call(tableDefinition, 'categories');
    const hasTempColumn = Object.prototype.hasOwnProperty.call(tableDefinition, 'categories_temp');
    const hasLegacyCategoryColumn = Object.prototype.hasOwnProperty.call(tableDefinition, 'category');

    if (!hasCategoriesColumn) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚙️  Updating Product table to support multiple categories (auto-migration)...');
      }

      if (!hasTempColumn) {
        await queryInterface.addColumn('Product', 'categories_temp', {
          type: DataTypes.ARRAY(DataTypes.STRING),
          allowNull: true,
          comment: 'Product categories as array',
        });
      }

      if (hasLegacyCategoryColumn) {
        await sequelize.query(`
          UPDATE "Product"
          SET "categories_temp" = CASE
            WHEN "category" IS NOT NULL THEN ARRAY["category"::text]
            ELSE ARRAY[]::text[]
          END;
        `);
        try {
          await queryInterface.removeColumn('Product', 'category');
          await sequelize.query('DROP TYPE IF EXISTS "enum_Product_category";');
        } catch (removeError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️  Skipped removing legacy category column (already removed?):', removeError instanceof Error ? removeError.message : removeError);
          }
        }
      }

      try {
        await queryInterface.renameColumn('Product', 'categories_temp', 'categories');
      } catch (renameError) {
        if (renameError instanceof Error && renameError.message.includes('already exists')) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️  Categories column already present, skipping rename.');
          }
        } else {
          throw renameError;
        }
      }

      await sequelize.query(`
        ALTER TABLE "Product"
        ALTER COLUMN "categories" SET DEFAULT ARRAY[]::text[];
      `);

      await sequelize.query(`
        UPDATE "Product"
        SET "categories" = ARRAY[]::text[]
        WHERE "categories" IS NULL;
      `);

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Product categories auto-migration completed');
      }
    } else {
      // Ensure column defaults and null handling are correct even if migration already ran
      await sequelize.query(`
        ALTER TABLE "Product"
        ALTER COLUMN "categories" SET DEFAULT ARRAY[]::text[];
      `);

      await sequelize.query(`
        UPDATE "Product"
        SET "categories" = ARRAY[]::text[]
        WHERE "categories" IS NULL;
      `);
    }
  } catch (error) {
    // HIPAA: Do not log detailed error in production
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Failed to ensure Product categories column:', error);
    }
  }
}

async function ensureDefaultFormStructures() {
  const defaultStructures = [
    {
      id: "default",
      name: "Default - Short form",
      sections: [
        { id: "product", icon: "📦", type: "product_questions", label: "Product Questions", order: 1, enabled: true, description: "Questions specific to each individual product" },
        { id: "account", icon: "👤", type: "account_creation", label: "Create Account", order: 2, enabled: true, description: "Patient information collection" },
        { id: "productSelection", icon: "🛒", type: "product_selection", label: "Product Selection", order: 3, enabled: true, description: "Select products and quantities" },
        { id: "checkout", icon: "💳", type: "checkout", label: "Payment & Checkout", order: 4, enabled: true, description: "Billing and shipping" },
        { id: "category", icon: "📋", type: "category_questions", label: "Standardized Category Questions", order: 5, enabled: false, description: "Questions shared across all products in a category" }
      ],
      createdAt: "2025-11-06T00:00:00.000Z",
      description: "Standard questionnaire flow for all products"
    },
    {
      id: "1762381752300",
      name: "Personalized Long",
      sections: [
        { id: "category", icon: "📋", type: "category_questions", label: "Standardized Category Questions", order: 1, enabled: true, description: "Questions shared across all products in a category" },
        { id: "product", icon: "📦", type: "product_questions", label: "Product Questions", order: 2, enabled: true, description: "Questions specific to each individual product" },
        { id: "account", icon: "👤", type: "account_creation", label: "Create Account", order: 3, enabled: true, description: "Patient information collection" },
        { id: "productSelection", icon: "🛒", type: "product_selection", label: "Product Selection", order: 4, enabled: true, description: "Select products and quantities" },
        { id: "checkout", icon: "💳", type: "checkout", label: "Payment & Checkout", order: 5, enabled: true, description: "Billing information and payment processing" }
      ],
      createdAt: "2025-11-06T00:00:00.000Z",
      description: "Category questions first for comprehensive intake"
    },
    {
      id: "1762382187889",
      name: "Personalized and Payment First",
      sections: [
        { id: "category", icon: "📋", type: "category_questions", label: "Standardized Category Questions", order: 1, enabled: true, description: "Questions shared across all products in a category" },
        { id: "account", icon: "👤", type: "account_creation", label: "Create Account", order: 2, enabled: true, description: "Patient information collection" },
        { id: "productSelection", icon: "🛒", type: "product_selection", label: "Product Selection", order: 3, enabled: true, description: "Select products and quantities" },
        { id: "checkout", icon: "💳", type: "checkout", label: "Payment & Checkout", order: 4, enabled: true, description: "Billing information and payment processing" },
        { id: "product", icon: "📦", type: "product_questions", label: "Product Questions", order: 5, enabled: true, description: "Questions specific to each individual product" }
      ],
      createdAt: "2025-11-06T00:00:00.000Z",
      description: "Payment after category questions"
    },
    {
      id: "1762382604408",
      name: "Payment First",
      sections: [
        { id: "productSelection", icon: "🛒", type: "product_selection", label: "Product Selection", order: 1, enabled: true, description: "Select products and quantities" },
        { id: "checkout", icon: "💳", type: "checkout", label: "Payment & Checkout", order: 2, enabled: true, description: "Billing information and payment processing" },
        { id: "account", icon: "👤", type: "account_creation", label: "Create Account", order: 3, enabled: true, description: "Patient information collection" },
        { id: "product", icon: "📦", type: "product_questions", label: "Product Questions", order: 4, enabled: true, description: "Questions specific to each individual product" },
        { id: "category", icon: "📋", type: "category_questions", label: "Standardized Category Questions", order: 5, enabled: false, description: "Questions shared across all products in a category" }
      ],
      createdAt: "2025-11-06T00:00:00.000Z",
      description: "Collect payment before medical questions"
    }
  ];

  try {
    for (const structure of defaultStructures) {
      const existing = await GlobalFormStructure.findOne({
        where: { structureId: structure.id }
      });

      if (!existing) {
        await GlobalFormStructure.create({
          structureId: structure.id,
          name: structure.name,
          description: structure.description,
          sections: structure.sections,
          isDefault: structure.id === "default",
          isActive: true
        });
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Created default form structure: ${structure.name}`);
        }
      } else {
        // Backfill existing structures with newly introduced sections (e.g., product_selection)
        const currentSections = Array.isArray(existing.sections) ? existing.sections : [];
        const hasProductSelection = currentSections.some((s: any) => s?.type === "product_selection");

        if (!hasProductSelection) {
          const templateProductSelection = structure.sections.find((s: any) => s.type === "product_selection");
          const templateCheckout = structure.sections.find((s: any) => s.type === "checkout");

          if (templateProductSelection && templateCheckout) {
            const updatedSections = currentSections.map((section: any) => {
              const currentOrder = Number(section?.order) || 0;
              if (currentOrder >= templateCheckout.order) {
                return { ...section, order: currentOrder + 1 };
              }
              return section;
            });

            updatedSections.push({
              ...templateProductSelection,
              enabled: true,
            });

            updatedSections.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

            await existing.update({
              sections: updatedSections,
            });

            if (process.env.NODE_ENV === "development") {
              console.log(`✅ Backfilled product_selection into structure: ${structure.name}`);
            }
          }
        }
      }
    }

    // Backfill all existing custom structures so Product Selection is universally available
    const allStructures = await GlobalFormStructure.findAll();
    for (const structureRecord of allStructures) {
      const currentSections = Array.isArray(structureRecord.sections) ? structureRecord.sections : [];
      const hasProductSelection = currentSections.some((s: any) => s?.type === "product_selection");
      if (hasProductSelection) continue;

      const checkoutSection = currentSections.find((s: any) => s?.type === "checkout");
      const checkoutOrder = Number(checkoutSection?.order) || currentSections.length + 1;

      const shiftedSections = currentSections.map((section: any) => {
        const sectionOrder = Number(section?.order) || 0;
        if (sectionOrder >= checkoutOrder) {
          return { ...section, order: sectionOrder + 1 };
        }
        return section;
      });

      shiftedSections.push({
        id: "productSelection",
        icon: "🛒",
        type: "product_selection",
        label: "Product Selection",
        order: checkoutOrder,
        enabled: true,
        description: "Select products and quantities",
      });

      shiftedSections.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

      await structureRecord.update({ sections: shiftedSections });

      if (process.env.NODE_ENV === "development") {
        console.log(`✅ Backfilled product_selection into custom structure: ${structureRecord.name}`);
      }
    }
  } catch (error) {
    // HIPAA: Do not log detailed error in production
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error ensuring default form structures:', error);
    }
  }
}

export async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Database connection established successfully');
      console.log("Syncing...");
    }

    // Ensure tables with FK dependencies are created in the correct order
    // MedicalCompany must exist before MedicalCompanyPharmacy/DoctorPharmacy
    try {
      await MedicalCompany.sync({ alter: true });
      await MedicalCompanyPharmacy.sync({ alter: true });
      await DoctorPharmacy.sync({ alter: true });
    } catch (depSyncErr) {
      console.log('⚠️  Pre-sync for MedicalCompany tables:', depSyncErr instanceof Error ? depSyncErr.message : depSyncErr);
    }

    // Sync all models to database (safer sync mode)
    await sequelize.sync({ alter: true });
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Database tables synchronized successfully');
    }

    // Ensure GIN index exists on Program.formStepOrder (JSONB)
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS "program_form_step_order_idx"
        ON "Program" USING gin ("formStepOrder");
      `);
    } catch (indexError) {
      console.log('⚠️  Program.formStepOrder index:', indexError instanceof Error ? indexError.message : indexError);
    }

    // Allow Program.clinicId to be NULL for templates
    try {
      console.log('🔄 Allowing Program.clinicId to be NULL for templates...');
      await sequelize.query(`
        ALTER TABLE "Program" ALTER COLUMN "clinicId" DROP NOT NULL;
      `);
      console.log('✅ Program.clinicId constraint updated successfully');
    } catch (constraintError) {
      console.log('⚠️  Program.clinicId constraint update:', constraintError instanceof Error ? constraintError.message : constraintError);
    }

    // Ensure FormProducts table exists for multi-choice forms feature
    try {
      console.log('🔄 Ensuring FormProducts table exists...');
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "FormProducts" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "questionnaireId" UUID NOT NULL REFERENCES "Questionnaire"("id") ON DELETE CASCADE,
          "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deletedAt" TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS "FormProducts_questionnaireId_idx" ON "FormProducts" ("questionnaireId");
        CREATE INDEX IF NOT EXISTS "FormProducts_productId_idx" ON "FormProducts" ("productId");
      `);
      console.log('✅ FormProducts table verified/created successfully');
    } catch (tableError) {
      console.log('⚠️  FormProducts table check:', tableError instanceof Error ? tableError.message : tableError);
    }

    // Add new enum value for amount_capturable_updated status
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Adding amount_capturable_updated to Order status enum...');
      }
      await sequelize.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'amount_capturable_updated' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_Order_status')
          ) THEN
            ALTER TYPE "enum_Order_status" ADD VALUE 'amount_capturable_updated';
          END IF;
        END $$;
      `);
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Order status enum updated successfully');
      }
    } catch (enumError) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Could not add enum value (may already exist):', enumError instanceof Error ? enumError.message : enumError);
      }
    }

    // Add QuestionnaireTemplate to audit_logs resourceType enum
    try {
      console.log('🔄 Adding QuestionnaireTemplate to audit_logs resourceType enum...');
      await sequelize.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'QuestionnaireTemplate' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_audit_logs_resourceType')
          ) THEN
            ALTER TYPE "enum_audit_logs_resourceType" ADD VALUE 'QuestionnaireTemplate';
          END IF;
        END $$;
      `);
      console.log('✅ Audit log resourceType enum updated successfully');
    } catch (enumError) {
      console.log('⚠️  Could not add QuestionnaireTemplate enum value (may already exist):', enumError instanceof Error ? enumError.message : enumError);
    }

    // Ensure TierConfiguration exists for all active BrandSubscriptionPlans
    try {
      await sequelize.query(`
        ALTER TABLE "TierConfiguration"
        ADD COLUMN IF NOT EXISTS "nonMedicalProfitPercent" numeric(5,2) DEFAULT NULL;
      `);

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Checking TierConfiguration for active plans...');
      }
      const activePlans = await BrandSubscriptionPlans.findAll({
        where: { isActive: true }
      });

      for (const plan of activePlans) {
        const existingConfig = await TierConfiguration.findOne({
          where: { brandSubscriptionPlanId: plan.id }
        });

        if (!existingConfig) {
          // Determine default canAddCustomProducts based on plan type
          const isPremiumTier = plan.planType.toLowerCase() === 'premium' ||
            plan.planType.toLowerCase() === 'enterprise';

          await TierConfiguration.create({
            brandSubscriptionPlanId: plan.id,
            canAddCustomProducts: isPremiumTier,
          });
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Created TierConfiguration for plan: ${plan.name} (${plan.planType}) - canAddCustomProducts: ${isPremiumTier}`);
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log(`✓ TierConfiguration already exists for plan: ${plan.name}`);
          }
        }
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ TierConfiguration check complete');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error ensuring TierConfiguration:', error);
      }
    }

    // Ensure GlobalFees row exists (there should only ever be one row)
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Checking GlobalFees configuration...');
      }
      const feesCount = await GlobalFees.count();

      if (feesCount === 0) {
        await GlobalFees.create({
          fuseTransactionFeePercent: 0,
          fuseTransactionDoctorFeeUsd: 0,
          stripeTransactionFeePercent: 0,
        });
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Created default GlobalFees row (all fees set to zero)');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`✓ GlobalFees configuration exists (${feesCount} row${feesCount > 1 ? 's' : ''})`);
          if (feesCount > 1) {
            console.warn('⚠️  Warning: Multiple GlobalFees rows detected. There should only be one row.');
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error ensuring GlobalFees:', error);
      }
    }

    // Ensure PharmacyProduct -> PharmacyCoverage cascade delete
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Ensuring PharmacyProduct → PharmacyCoverage cascade behavior...');
      }
      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            WHERE tc.constraint_name = 'PharmacyProduct_pharmacyCoverageId_fkey'
              AND tc.table_name = 'PharmacyProduct'
              AND tc.constraint_type = 'FOREIGN KEY'
          ) THEN
            ALTER TABLE "PharmacyProduct"
              DROP CONSTRAINT "PharmacyProduct_pharmacyCoverageId_fkey";
          END IF;
        END
        $$;
      `);

      await sequelize.query(`
        ALTER TABLE "PharmacyProduct"
        ADD CONSTRAINT "PharmacyProduct_pharmacyCoverageId_fkey"
        FOREIGN KEY ("pharmacyCoverageId") REFERENCES "PharmacyCoverage" ("id") ON DELETE CASCADE;
      `);

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Cascade delete enforced for PharmacyCoverage → PharmacyProduct');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error enforcing cascade delete for PharmacyCoverage → PharmacyProduct:', error);
      }
    }

    // Ensure unique index for coverage/state combinations
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Ensuring PharmacyProduct coverage/state uniqueness constraint...');
      }
      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'unique_product_state'
          ) THEN
            DROP INDEX "unique_product_state";
          END IF;
        END
        $$;
      `);

      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'unique_coverage_state'
          ) THEN
            DROP INDEX "unique_coverage_state";
          END IF;
        END
        $$;
      `);

      await sequelize.query(`
        CREATE UNIQUE INDEX "unique_coverage_state"
        ON "PharmacyProduct" ("pharmacyCoverageId", "state");
      `);

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Coverage/state uniqueness constraint ensured');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error ensuring coverage/state uniqueness constraint:', error);
      }
    }

    // Backfill UserRoles table from deprecated User.role field
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Backfilling UserRoles table from User.role field...');
      }

      // Get all users
      const users = await User.findAll({
        attributes: ['id', 'role']
      });

      let backfilledCount = 0;
      let skippedCount = 0;

      for (const user of users) {
        // Check if UserRoles entry already exists
        const existingRoles = await UserRoles.findOne({
          where: { userId: user.id }
        });

        if (!existingRoles) {
          // Create UserRoles based on deprecated role field
          await UserRoles.create({
            userId: user.id,
            patient: user.role === 'patient',
            doctor: user.role === 'doctor',
            admin: user.role === 'admin',
            brand: user.role === 'brand',
            affiliate: user.role === 'affiliate',
          });
          backfilledCount++;
        } else {
          skippedCount++;
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ UserRoles backfill complete: ${backfilledCount} created, ${skippedCount} already existed (${users.length} total users)`);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error backfilling UserRoles:', error);
      }
    }

    // Force recreate GlobalFormStructure table (drop and recreate)
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Ensuring GlobalFormStructure table exists...');
      }
      await GlobalFormStructure.sync(); // Creates if not exists, never drops
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ GlobalFormStructure table ready');
      }
    } catch (syncError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error syncing GlobalFormStructure:', syncError);
      }
      throw syncError;
    }

    await ensureDefaultFormStructures();
    await ensureProductCategoriesColumn();
    await ensureVisitTypeColumns();

    // Run active to isActive migration
    try {
      const migrationService = new MigrationService(sequelize);
      await migrationService.runActiveToIsActiveMigration();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error during active to isActive migration:', error);
      }
      // Don't throw - let the app continue
    }

    // Ensure optional columns are nullable even if previous schema had NOT NULL
    try {
      await sequelize.query('ALTER TABLE "TenantProduct" ALTER COLUMN "questionnaireId" DROP NOT NULL;');
    } catch (e) {
      // ignore if already nullable or if statement not applicable
    }
    try {
      await sequelize.query('ALTER TABLE "Order" ALTER COLUMN "treatmentId" DROP NOT NULL;');
    } catch (e) {
      // ignore
    }
    try {
      // Change doctorNotes from JSONB to TEXT for single editable note
      await sequelize.query('ALTER TABLE "Order" ALTER COLUMN "doctorNotes" TYPE TEXT USING "doctorNotes"::text;');
    } catch (e) {
      // ignore
    }
    try {
      // Clean up any soft-deleted TenantProductForms by hard-deleting
      await sequelize.query('DELETE FROM "TenantProductForms" WHERE "deletedAt" IS NOT NULL;');
    } catch (e) {
      // ignore
    }

    // Ensure customMaxProducts column exists on BrandSubscription
    try {
      await sequelize.query(`
        ALTER TABLE "BrandSubscription"
        ADD COLUMN IF NOT EXISTS "customMaxProducts" INTEGER;
      `);
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Ensured customMaxProducts column exists on BrandSubscription');
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  customMaxProducts column may already exist or error:', e instanceof Error ? e.message : e);
      }
    }

    // Reset retry flag at the start of a new billing cycle
    try {
      await sequelize.query(`
        UPDATE "BrandSubscription"
        SET "retriedProductSelectionForCurrentCycle" = false,
            "productsChangedAmountOnCurrentCycle" = 0
        WHERE "currentPeriodStart" IS NOT NULL
          AND "currentPeriodEnd" IS NOT NULL
          AND NOW() >= "currentPeriodStart"
          AND NOW() < "currentPeriodEnd"
          AND (
            "lastProductChangeAt" IS NULL OR "lastProductChangeAt" < "currentPeriodStart"
          )
      `);
    } catch (e) {
      // ignore
    }

    // Ensure Absolute RX pharmacy exists
    try {
      const existingPharmacy = await Pharmacy.findOne({
        where: { name: 'Absolute RX' }
      });

      if (!existingPharmacy) {
        await Pharmacy.create({
          name: 'Absolute RX',
          slug: 'absoluterx',
          supportedStates: ['CA'], // Can be expanded to include more states
          isActive: true
        });
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Created Absolute RX pharmacy');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Absolute RX pharmacy already exists');
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error creating Absolute RX pharmacy:', e);
      }
      // ignore - don't fail startup
    }

    // Ensure IronSail pharmacy exists
    try {
      const existingIronSail = await Pharmacy.findOne({
        where: { name: 'IronSail' }
      });

      if (!existingIronSail) {
        await Pharmacy.create({
          name: 'IronSail',
          slug: 'ironsail',
          supportedStates: [
            'AL', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
            'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
            'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
            'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
            'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
            'WV', 'WI', 'WY', 'DC'
          ], // All US states except Alaska (AK) and Hawaii (HI)
          isActive: true
        });
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Created IronSail pharmacy');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ IronSail pharmacy already exists');
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error creating IronSail pharmacy:', e);
      }
      // ignore - don't fail startup
    }

    // Ensure ClinicBalance table exists
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Checking if ClinicBalance table exists...');
      }
      const queryInterface = sequelize.getQueryInterface();
      const tables = await queryInterface.showAllTables();
      
      if (!tables.includes('ClinicBalance')) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 Creating ClinicBalance table...');
        }
        
        await queryInterface.createTable('ClinicBalance', {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
          },
          clinicId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
              model: 'Clinic',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          orderId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
              model: 'Order',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
          },
          type: {
            type: DataTypes.ENUM('refund_debt', 'payment', 'adjustment'),
            allowNull: false,
            defaultValue: 'refund_debt',
          },
          status: {
            type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
            allowNull: false,
            defaultValue: 'pending',
          },
          stripeTransferId: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          stripeRefundId: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          description: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          notes: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          paidAt: {
            type: DataTypes.DATE,
            allowNull: true,
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
          },
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ ClinicBalance table created successfully');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ ClinicBalance table already exists');
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error creating ClinicBalance table:', e);
      }
      // ignore - don't fail startup
    }

    // Ensure WebsiteBuilderConfigs has a default row
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Ensuring WebsiteBuilderConfigs default row exists...');
      }
      const existingConfig = await WebsiteBuilderConfigs.findOne();
      if (!existingConfig) {
        await WebsiteBuilderConfigs.create({
          defaultFooterDisclaimer: DEFAULT_FOOTER_DISCLAIMER,
        });
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ WebsiteBuilderConfigs default row created');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ WebsiteBuilderConfigs default row already exists');
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error creating WebsiteBuilderConfigs default row:', e);
      }
      // ignore - don't fail startup
    }

    // Ensure unique indexes for Likes table (partial indexes for user/anonymous)
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Ensuring Likes table unique indexes...');
      }

      // Create partial unique index for logged-in users (includes sourceType and affiliateId for brand/affiliate separation)
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "likes_tenant_product_user_unique"
        ON "likes" ("tenantProductId", "userId", "sourceType", "affiliateId")
        WHERE "userId" IS NOT NULL;
      `);

      // Create partial unique index for anonymous users (includes sourceType and affiliateId for brand/affiliate separation)
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "likes_tenant_product_anonymous_unique"
        ON "likes" ("tenantProductId", "anonymousId", "sourceType", "affiliateId")
        WHERE "anonymousId" IS NOT NULL;
      `);

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Likes table unique indexes ensured');
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error creating Likes indexes:', e);
      }
      // ignore - don't fail startup
    }

    // Ensure default MedicalCompany records exist
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Checking MedicalCompany records...');
      }

      const defaultCompanies = [
        { name: 'Fuse', slug: MedicalCompanySlug.FUSE },
        { name: 'MDI', slug: MedicalCompanySlug.MD_INTEGRATIONS },
        { name: 'Beluga', slug: MedicalCompanySlug.BELUGA },
      ];

      for (const company of defaultCompanies) {
        const existing = await MedicalCompany.findOne({
          where: { slug: company.slug }
        });

        if (!existing) {
          await MedicalCompany.create({
            name: company.name,
            slug: company.slug,
          });
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Created MedicalCompany: ${company.name} (${company.slug})`);
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ MedicalCompany already exists: ${company.name} (${company.slug})`);
          }
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error seeding MedicalCompany records:', e);
      }
      // ignore - don't fail startup
    }

    return true;
  } catch (error) {
    // Log connection error (safe - no PHI in connection errors)
    console.error('❌ Unable to connect to the database:', error instanceof Error ? error.message : String(error));
    return false;
  }
}