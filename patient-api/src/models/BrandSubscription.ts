import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import BrandSubscriptionPlans from './BrandSubscriptionPlans';

export enum BrandSubscriptionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  ACTIVE = 'active',
  PAYMENT_DUE = 'payment_due',
  CANCELLED = 'cancelled',
}

export enum BrandSubscriptionPlanType {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}


type BrandSubscriptionFeatures = {
  apiAccess?: boolean;
  whiteLabel?: boolean;
  maxProducts?: number;
  maxCampaigns?: number;
  customBranding?: boolean;
  analyticsAccess?: boolean;
  customerSupport?: string;
  customIntegrations?: boolean;
  subscriptionSchedule?: {
    id?: string;
    currentPhasePriceId?: string;
    introductoryPlanType?: string;
    currentPhaseLookupKey?: string;
    currentPeriodEnd?: string;
  }
}


@Table({
  freezeTableName: true,
  tableName: 'BrandSubscription',
})
export default class BrandSubscription extends Entity {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare userId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare planType?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare planCategory?: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare customMaxProducts?: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: BrandSubscriptionStatus.PENDING,
  })
  declare status: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare stripeSubscriptionId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare stripeCustomerId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare stripePriceId?: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare monthlyPrice: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  declare downpaymentAmount?: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare currentPeriodStart?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare currentPeriodEnd?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare cancelledAt?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare paymentDue?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare trialStart?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare trialEnd?: Date;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare features?: BrandSubscriptionFeatures;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare lastProductChangeAt?: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  declare productsChangedAmountOnCurrentCycle: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare retriedProductSelectionForCurrentCycle: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare tutorialFinished: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: 0,
  })
  declare tutorialStep?: number;

  @BelongsTo(() => User)
  declare user?: User;

  // Virtual association with BrandSubscriptionPlans (based on planType)
  declare plan?: BrandSubscriptionPlans;

  // Instance methods
  public getMaxProducts(): number {
    // If customMaxProducts is set, use that
    if (this.customMaxProducts !== null && this.customMaxProducts !== undefined) {
      return this.customMaxProducts;
    }
    // Otherwise, use the plan's maxProducts if available
    if (this.plan?.maxProducts !== undefined) {
      return this.plan.maxProducts;
    }
    // Default to -1 (unlimited)
    return -1;
  }
  public async activate(stripeData: {
    subscriptionId: string;
    customerId: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }): Promise<void> {
    await this.update({
      status: BrandSubscriptionStatus.ACTIVE,
      stripeSubscriptionId: stripeData.subscriptionId,
      stripeCustomerId: stripeData.customerId,
      currentPeriodStart: stripeData.currentPeriodStart,
      currentPeriodEnd: stripeData.currentPeriodEnd,
    });
  }

  public async cancel(): Promise<void> {
    await this.update({
      status: BrandSubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
    });
  }

  public isActive(): boolean {
    return this.status === BrandSubscriptionStatus.ACTIVE;
  }

  public isTrialing(): boolean {
    if (!this.trialStart || !this.trialEnd) return false;
    const now = new Date();
    return now >= this.trialStart && now <= this.trialEnd;
  }

  public daysUntilRenewal(): number {
    if (!this.currentPeriodEnd) return 0;
    const now = new Date();
    const diffTime = this.currentPeriodEnd.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public async updateProcessing(subscriptionId: string): Promise<void> {
    await this.update({
      status: BrandSubscriptionStatus.PROCESSING,
      stripeSubscriptionId: subscriptionId,
    });
  }

  public async markPaymentDue(validUntil: Date): Promise<void> {
    await this.update({
      status: BrandSubscriptionStatus.PAYMENT_DUE,
      paymentDue: validUntil,
    });
  }

  public async markPastDue(): Promise<void> {
    await this.update({
      status: BrandSubscriptionStatus.PAYMENT_DUE, // Using PAYMENT_DUE as past due status
      paymentDue: new Date(),
    });
  }
}