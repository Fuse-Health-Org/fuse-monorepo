/**
 * Shared enums used across models in the Fuse Health platform
 */

/**
 * Slug values for the MedicalCompany table.
 * The DB table is the source of truth; this enum provides type-safe references.
 */
export enum MedicalCompanySlug {
    FUSE = 'fuse',
    MD_INTEGRATIONS = 'md-integrations',
    BELUGA = 'beluga',
}

export enum PaymentStatus {
    PENDING = 'pending',
    PAID = 'paid',
    PAYMENT_DUE = 'payment_due',
    CANCELLED = 'cancelled',
}

export enum MerchantOfRecord {
    FUSE = 'fuse',
    MYSELF = 'myself',
}
