import { Table, Column, DataType, ForeignKey, BelongsTo, Index } from 'sequelize-typescript';
import Entity from './Entity';
import Clinic from './Clinic';
import Questionnaire from './Questionnaire';
import Product from './Product';

@Table({
    freezeTableName: true,
    tableName: 'Program',
})
//
export default class Program extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare description?: string;

    @ForeignKey(() => Clinic)
    @Column({
        type: DataType.UUID,
        allowNull: true, // Allow null for templates (templates are not clinic-specific)
    })
    declare clinicId?: string;

    @BelongsTo(() => Clinic)
    declare clinic?: Clinic;

    @ForeignKey(() => Questionnaire)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare medicalTemplateId?: string;

    @BelongsTo(() => Questionnaire, 'medicalTemplateId')
    declare medicalTemplate?: Questionnaire;

    /**
     * Parent Program ID
     * 
     * When a program is created as a per-product variant (with individualProductId set),
     * it should reference its parent program. This allows:
     * - Organizing child programs under a parent
     * - Filtering out child programs from the main programs list
     * - Cascading updates/deletions from parent to children
     * 
     * If null, this is a parent/standalone program.
     */
    @ForeignKey(() => Program)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare parentProgramId?: string;

    @BelongsTo(() => Program, 'parentProgramId')
    declare parentProgram?: Program;

    /**
     * Individual Product ID
     * 
     * A program is globally tied to a medicalTemplateId (the form/questionnaire).
     * However, if individualProductId is set, this program becomes specific to one
     * particular product that belongs to that form.
     * 
     * The relationship between products and forms is defined in the FormProducts table.
     * When individualProductId is set, this program should only be shown/applied when
     * the user is purchasing that specific product from the form.
     * 
     * If null, the program applies to all products in the form.
     */
    @ForeignKey(() => Product)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare individualProductId?: string;

    @BelongsTo(() => Product, 'individualProductId')
    declare individualProduct?: Product;

    /**
     * Frontend Display Product ID
     * 
     * When a program has multiple products in its medical template, this field allows
     * the admin to select which product's image should be displayed on the frontend
     * (landing page, all-products page) instead of the default program icon.
     * 
     * If set, the program card will show this product's imageUrl.
     * If not set, the program card will show the default stethoscope icon with gradient.
     */
    @ForeignKey(() => Product)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare frontendDisplayProductId?: string;

    @BelongsTo(() => Product, 'frontendDisplayProductId')
    declare frontendDisplayProduct?: Product;

    /**
     * Program form section order
     *
     * Controls high-level intake flow ordering for this program.
     * Allowed section ids:
     * - productSelection
     * - medical
     * - account
     * - payment
     *
     * Payment must always be the last section.
     */
    @Index({ name: 'program_form_step_order_idx', using: 'gin' })
    @Column({
        type: DataType.JSONB,
        allowNull: true,
    })
    declare formStepOrder?: string[] | null;

    // Non-Medical Services - Patient Portal
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasPatientPortal: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare patientPortalPrice: number;

    // Non-Medical Services - BMI Calculator
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasBmiCalculator: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare bmiCalculatorPrice: number;

    // Non-Medical Services - Protein Intake Calculator
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasProteinIntakeCalculator: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare proteinIntakeCalculatorPrice: number;

    // Non-Medical Services - Calorie Deficit Calculator
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasCalorieDeficitCalculator: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare calorieDeficitCalculatorPrice: number;

    // Non-Medical Services - Easy Shopping
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasEasyShopping: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare easyShoppingPrice: number;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare isActive: boolean;

    /**
     * Portal Display Name
     *
     * The brand-customized name shown to patients on the web portal.
     * Separate from the internal `name` field (which is the program/template name).
     * When null, the admin needs to set this before the program appears correctly
     * on their patient-facing site — shown as "Needs attention" in the admin UI.
     */
    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare portalDisplayName?: string;

    /**
     * Hide Additional Products
     *
     * When true, the intake form shows the featured/top-choice product as the primary option
     * and places the remaining products behind a "See additional options" toggle — reducing
     * cognitive load for patients while still allowing them to choose.
     * When false (default), all products are shown equally with no separation.
     */
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hideAdditionalProducts: boolean;

    /**
     * Hero Image URL
     *
     * A brand-uploaded custom image for this specific program, stored in S3.
     * When set, this image is displayed on the patient-facing site instead of the
     * top-choice product's image. Scoped per brand in S3 (brands/{clinicId}/programs/{id}/).
     * When null, the frontend falls back to the featured/top-choice product's imageUrl.
     */
    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare heroImageUrl?: string | null;

    /**
     * Per-Product Non-Medical Service Pricing
     *
     * JSON map of productId → { nonMedicalServiceFee: number }.
     * Stores the brand admin's custom non-medical service fee per product
     * within this program so each product can be priced independently.
     * Example: { "prod-abc": { "nonMedicalServiceFee": 29 } }
     */
    @Column({
        type: DataType.JSON,
        allowNull: true,
        defaultValue: null,
    })
    declare productPricing: Record<string, { nonMedicalServiceFee: number }> | null;

    /**
     * Non-Medical Services Bundle Fee
     *
     * A single monthly fee that bundles all non-medical patient services
     * (Patient Portal, BMI Calculator, Protein Intake Calculator,
     * Calorie Deficit Calculator, Easy Shopping) into one charge.
     * When > 0, all services are considered included for this program.
     * Replaces the per-service pricing model in the brand admin portal.
     */
    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare nonMedicalServiceFee: number;

    /**
     * Product Order
     *
     * Ordered array of product IDs defining how products are listed within
     * this program's intake form. The first product is treated as the top choice.
     * When null/empty, products fall back to default ordering.
     */
    @Column({
        type: DataType.ARRAY(DataType.UUID),
        allowNull: true,
        defaultValue: null,
    })
    declare productOrder?: string[] | null;

    /**
     * Featured Product ID
     *
     * The product explicitly selected by the brand admin as the top choice / hero
     * product for this program. Shown prominently on the intake form and used as
     * the product image when hideAdditionalProducts is true.
     * When null, the first product in productOrder (or default order) is used.
     */
    @ForeignKey(() => Product)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare featuredProductId?: string | null;

    @BelongsTo(() => Product, 'featuredProductId')
    declare featuredProduct?: Product;

    /**
     * Featured Flag
     *
     * When true, this program is pinned to the top of the brand's live program
     * listing and displayed prominently at the top of the patient-facing web portal.
     * Maximum 3 programs per clinic can be featured at once.
     */
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare isFeatured: boolean;

    /**
     * Template Flag
     * 
     * When true, this program is a TEMPLATE created by tenant managers.
     * Templates cannot be modified by brands - they serve as blueprints.
     * 
     * Brands can create their own programs based on templates, but the template
     * itself remains read-only to them.
     */
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare isTemplate: boolean;

    /**
     * Template ID Reference
     * 
     * When a brand creates a program based on a template, this field
     * references the original template program.
     * 
     * This allows:
     * - Tracking which programs are derived from which templates
     * - Potentially cascading updates from templates to derived programs
     * - Filtering brand programs by template
     * 
     * If null, this program was created from scratch (not from a template).
     */
    @ForeignKey(() => Program)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare templateId?: string;

    @BelongsTo(() => Program, 'templateId')
    declare template?: Program;
}
