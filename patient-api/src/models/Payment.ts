import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Order from './Order';
import BrandSubscription from './BrandSubscription';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

export enum PaymentMethod {
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  DIGITAL_WALLET = 'digital_wallet'
}

export enum PaymentGoesTo {
  FUSE = 'fuse',
  BRAND = 'brand',
  DOCTOR = 'doctor',
  PHARMACY = 'pharmacy'
}

@Table({
  freezeTableName: true,
  tableName: 'Payment',
})
export default class Payment extends Entity {
  @ForeignKey(() => Order)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    unique: true,
  })
  declare orderId?: string;

  @BelongsTo(() => Order, 'orderId')
  declare order?: Order;

  @ForeignKey(() => BrandSubscription)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    unique: true,
  })
  declare brandSubscriptionId?: string;

  @BelongsTo(() => BrandSubscription, 'brandSubscriptionId')
  declare brandSubscription?: BrandSubscription;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare stripePaymentIntentId: string;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentStatus)),
    allowNull: false,
    defaultValue: PaymentStatus.PENDING,
  })
  declare status: PaymentStatus;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: false,
    defaultValue: PaymentMethod.CARD,
  })
  declare paymentMethod: PaymentMethod;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare amount: number;

  @Column({
    type: DataType.STRING(3),
    allowNull: false,
    defaultValue: 'USD',
  })
  declare currency: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  declare refundedAmount?: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare stripeChargeId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare stripeCustomerId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare lastFourDigits?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare cardBrand?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare cardCountry?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare stripeMetadata?: Record<string, any>;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare failureReason?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare paidAt?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare refundedAt?: Date;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentGoesTo)),
    allowNull: false,
    defaultValue: PaymentGoesTo.FUSE,
  })
  declare paymentGoesTo: PaymentGoesTo;

  // Update payment status from Stripe webhook
  public async updateFromStripeEvent(eventData: any): Promise<void> {
    const paymentIntent = eventData.object;

    this.status = this.mapStripeStatus(paymentIntent.status);

    if (paymentIntent.charges?.data?.[0]) {
      const charge = paymentIntent.charges.data[0];
      this.stripeChargeId = charge.id;
      this.stripeCustomerId = charge.customer;

      if (charge.payment_method_details?.card) {
        const card = charge.payment_method_details.card;
        this.lastFourDigits = card.last4;
        this.cardBrand = card.brand;
        this.cardCountry = card.country;
      }
    }

    if (this.status === PaymentStatus.SUCCEEDED) {
      this.paidAt = new Date();
    }

    if (paymentIntent.last_payment_error) {
      this.failureReason = paymentIntent.last_payment_error.message;
    }

    this.stripeMetadata = paymentIntent.metadata;

    await this.save();
  }

  // Map Stripe payment intent status to our enum
  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return PaymentStatus.PENDING;
      case 'processing':
        return PaymentStatus.PROCESSING;
      case 'succeeded':
        return PaymentStatus.SUCCEEDED;
      case 'requires_capture':
        return PaymentStatus.PROCESSING;
      case 'canceled':
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  // Process refund
  public async processRefund(amount?: number): Promise<void> {
    const refundAmount = amount || this.amount;

    if (this.refundedAmount) {
      this.refundedAmount += refundAmount;
    } else {
      this.refundedAmount = refundAmount;
    }

    if (this.refundedAmount >= this.amount) {
      this.status = PaymentStatus.REFUNDED;
    } else {
      this.status = PaymentStatus.PARTIALLY_REFUNDED;
    }

    this.refundedAt = new Date();
    await this.save();
  }
}