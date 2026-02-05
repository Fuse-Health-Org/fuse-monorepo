import { Table, Column, DataType, HasOne, HasMany, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Subscription from './Subscription';
import Treatment from './Treatment';
import TenantProduct from './TenantProduct';
import Sale from './Sale';
import CustomWebsite from './CustomWebsite';
import User from './User';
import BrandSubscriptionPlans from './BrandSubscriptionPlans';


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

export enum PatientPortalDashboardFormat {
    FUSE = 'fuse',
    MD_INTEGRATIONS = 'md-integrations',
    BELUGA = 'beluga',
}

@Table({
    freezeTableName: true,
})
export default class Clinic extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
        unique: true,
    })
    declare slug: string;

    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    declare logo: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    declare businessType?: string;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    declare isActive: boolean;

    @Column({
        type: DataType.ENUM(...Object.values(PaymentStatus)),
        allowNull: false,
        defaultValue: PaymentStatus.PENDING,
    })
    declare status: PaymentStatus;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    declare isCustomDomain: boolean;

    @Column({
        type: DataType.STRING,
        allowNull: true,
        unique: true,
    })
    declare customDomain?: string;

    // Stripe Connect fields
    @Column({
        type: DataType.STRING,
        allowNull: true,
        unique: true,
    })
    declare stripeAccountId?: string;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare stripeOnboardingComplete: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare stripeDetailsSubmitted: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare stripeChargesEnabled: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare stripePayoutsEnabled: boolean;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare stripeAccountType?: string;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    declare stripeOnboardedAt?: Date;

    @Column({
        type: DataType.ENUM(...Object.values(MerchantOfRecord)),
        allowNull: true,
        defaultValue: MerchantOfRecord.FUSE,
    })
    declare merchantOfRecord?: MerchantOfRecord;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare defaultFormColor?: string;

    @Column({
        type: DataType.ENUM(...Object.values(PatientPortalDashboardFormat)),
        allowNull: false,
        defaultValue: PatientPortalDashboardFormat.FUSE,
    })
    declare patientPortalDashboardFormat: PatientPortalDashboardFormat;

    // Affiliate relationship - if this clinic belongs to an affiliate of another clinic
    @ForeignKey(() => Clinic)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare affiliateOwnerClinicId?: string;

    @BelongsTo(() => Clinic, 'affiliateOwnerClinicId')
    declare affiliateOwnerClinic?: Clinic;

    @HasMany(() => Clinic, 'affiliateOwnerClinicId')
    declare affiliateClinics: Clinic[];

    // Referrer doctor - the doctor who invited this brand (for brands invited by doctors)
    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare referrerDoctorId?: string;

    @BelongsTo(() => User, 'referrerDoctorId')
    declare referrerDoctor?: User;

    // Main doctor - the doctor currently responsible for this clinic
    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare mainDoctorId?: string;

    @BelongsTo(() => User, 'mainDoctorId')
    declare mainDoctor?: User;

    // Brand subscription plan (tier) for this clinic
    @ForeignKey(() => BrandSubscriptionPlans)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare brandSubscriptionPlanId?: string;

    @BelongsTo(() => BrandSubscriptionPlans, 'brandSubscriptionPlanId')
    declare brandSubscriptionPlan?: BrandSubscriptionPlans;

    @HasOne(() => Subscription)
    declare subscription?: Subscription;

    @HasMany(() => Treatment)
    declare treatments: Treatment[];

    @HasMany(() => TenantProduct)
    declare tenantProducts: TenantProduct[];

    @HasMany(() => Sale)
    declare sales: Sale[];

    @HasOne(() => CustomWebsite)
    declare customWebsite?: CustomWebsite;
}