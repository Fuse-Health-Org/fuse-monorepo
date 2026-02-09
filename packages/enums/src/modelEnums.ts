/**
 * Shared enums used across models in the Fuse Health platform
 */

export enum PatientPortalDashboardFormat {
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
