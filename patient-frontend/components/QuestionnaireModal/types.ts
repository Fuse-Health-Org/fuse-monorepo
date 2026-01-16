export interface QuestionOption {
    id: string;
    optionText: string;
    optionValue: string;
    optionOrder: number;
}

export interface Question {
    id: string;
    questionText: string;
    answerType: string;
    questionSubtype?: string | null;
    isRequired: boolean;
    questionOrder: number;
    placeholder?: string;
    helpText?: string;
    options?: QuestionOption[];
    conditionalLogic?: string;
    conditionalLevel?: number;
    subQuestionOrder?: number;
    [key: string]: any;
}

export interface QuestionnaireStep {
    id: string;
    title: string;
    description?: string;
    stepOrder: number;
    category?: 'normal' | 'user_profile' | 'doctor';
    isDeadEnd?: boolean;
    required?: boolean;
    questions?: Question[];
}

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    placeholderSig: string;
    imageUrl: string;
}

export type ShippingInfoUpdater = (field: string, value: string) => void;

export interface TreatmentPlan {
    id: string;
    billingInterval: string;
    sortOrder: number;
    price: number;
    name: string;
    description?: string;
    popular?: boolean;
    active?: boolean;
    stripePriceId?: string;
    features?: string[];
    [key: string]: any;
}

export interface QuestionnaireData {
    id: string;
    title: string;
    description?: string;
    checkoutStepPosition: number;
    color?: string | null;
    steps: QuestionnaireStep[];
    treatment?: {
        products: Product[];
        treatmentPlans?: TreatmentPlan[];
        [key: string]: any;
    };
    [key: string]: any;
}

// Program-related types
export interface ProgramProductWithPricing {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
    basePrice: number;
    displayPrice: number;
    categories?: string[];
    tenantProduct?: {
        id: string;
        price: number;
        isActive: boolean;
    };
    /** Per-product program with individual non-medical services pricing */
    perProductProgram?: {
        programId: string;
        programName: string;
        nonMedicalServices: ProgramNonMedicalServices;
        nonMedicalServicesFee: number;
    };
}

export interface NonMedicalService {
    enabled: boolean;
    price: number;
}

export interface ProgramNonMedicalServices {
    patientPortal: NonMedicalService;
    bmiCalculator: NonMedicalService;
    proteinIntakeCalculator: NonMedicalService;
    calorieDeficitCalculator: NonMedicalService;
    easyShopping: NonMedicalService;
}

export interface ProgramData {
    id: string;
    name: string;
    description?: string;
    clinicId: string;
    medicalTemplateId: string;
    medicalTemplate?: {
        id: string;
        title: string;
        description?: string;
        productOfferType?: 'single_choice' | 'multiple_choice';
    };
    isActive: boolean;
    products: ProgramProductWithPricing[];
    nonMedicalServices: ProgramNonMedicalServices;
    nonMedicalServicesFee: number;
    /** Controls whether user can select one or multiple products */
    productOfferType?: 'single_choice' | 'multiple_choice';
    /** Whether this program has per-product pricing (child programs) */
    hasPerProductPricing?: boolean;
}

export interface QuestionnaireModalProps {
    isOpen: boolean;
    onClose: () => void;
    treatmentId?: string;
    treatmentName?: string;
    questionnaireId?: string; // when provided, load questionnaire directly (product-based)
    productName?: string; // optional label when questionnaire is product-based
    productCategory?: string; // optional product category (e.g., weight_loss)
    productFormVariant?: string; // '1' | '2' when product-based; if '2' prepend standardized steps
    globalFormStructure?: any; // Global Form Structure to control section ordering
    // Product checkout fallback pricing
    productPrice?: number;
    productStripePriceId?: string;
    productStripeProductId?: string;
    tenantProductId?: string;
    tenantProductFormId?: string; // Unique ID for this specific form variant (used for analytics)
    // Program data for program checkout flow
    programData?: ProgramData;
}

export interface ThemePalette {
    primary: string;
    primaryDark: string;
    primaryDarker: string;
    primaryLight: string;
    primaryLighter: string;
    text: string;
}

export interface PlanOption {
    id: string;
    uuid?: string;
    name: string;
    description?: string;
    price: number;
    badge?: string;
    badgeColor?: "success" | "primary";
    stripePriceId?: string;
    billingInterval?: string;
    features?: string[];
}

export interface PharmacyCoverage {
    id: string;
    customName: string;
    customSig: string;
    pharmacy?: {
        id: string;
        name: string;
        slug: string;
    };
}

export type PaymentStatus = "idle" | "processing" | "succeeded" | "creatingMDCase" | "ready" | "failed";

export interface CheckoutViewProps {
    plans: PlanOption[];
    selectedPlan: string;
    onPlanChange: (planId: string) => void;
    paymentStatus: PaymentStatus;
    clientSecret: string | null;
    shippingInfo: Record<string, string>;
    onShippingInfoChange: ShippingInfoUpdater;
    onRetryPaymentSetup: () => void;
    onCreateSubscription: (planId: string) => Promise<void>;
    onPaymentSuccess: () => Promise<void>;
    onPaymentError: (error: string) => void;
    onPaymentConfirm?: () => void;
    stripePromise: any;
    theme: ThemePalette;
    questionnaireProducts?: Product[];
    selectedProducts: Record<string, number>;
    treatmentName: string;
    pharmacyCoverages?: PharmacyCoverage[];
    // Program checkout props
    programData?: ProgramData;
    selectedProgramProducts?: Record<string, boolean>;
    onProgramProductToggle?: (productId: string) => void;
    onCreateProgramSubscription?: () => Promise<void>;
}


