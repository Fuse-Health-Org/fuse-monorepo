import { Table, Column, DataType, ForeignKey, BelongsTo, HasMany, HasOne } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import Treatment from './Treatment';
import Clinic from './Clinic';
import Questionnaire from './Questionnaire';
import OrderItem from './OrderItem';
import ShippingAddress from './ShippingAddress';
import ShippingOrder from './ShippingOrder';
import Subscription from './Subscription';
import Payment from './Payment';
import Sale from './Sale';
import TreatmentPlan, { BillingInterval } from './TreatmentPlan';
import Physician from './Physician';
import TenantProduct from './TenantProduct';
import Program from './Program';

export enum OrderStatus {
  PENDING = 'pending',
  PAYMENT_PROCESSING = 'payment_processing',
  AMOUNT_CAPTURABLE_UPDATED = 'amount_capturable_updated', // Payment authorized but not captured (awaiting doctor approval)
  PAID = 'paid',
  PAYMENT_DUE = 'payment_due',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}


@Table({
  freezeTableName: true,
  tableName: 'Order',
})
export default class Order extends Entity {
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare orderNumber: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @ForeignKey(() => Treatment)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare treatmentId?: string;

  @BelongsTo(() => Treatment)
  declare treatment?: Treatment;

  @ForeignKey(() => Clinic)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare clinicId?: string;

  @BelongsTo(() => Clinic)
  declare clinic?: Clinic;

  @ForeignKey(() => Questionnaire)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare questionnaireId?: string;

  @BelongsTo(() => Questionnaire)
  declare questionnaire?: Questionnaire;

  @ForeignKey(() => TreatmentPlan)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare treatmentPlanId?: string;

  @BelongsTo(() => TreatmentPlan)
  declare treatmentPlan?: TreatmentPlan;

  @ForeignKey(() => Physician)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare physicianId?: string;

  @BelongsTo(() => Physician)
  declare physician?: Physician;

  @Column({
    type: DataType.ENUM(...Object.values(OrderStatus)),
    allowNull: false,
    defaultValue: OrderStatus.PENDING,
  })
  declare status: OrderStatus;

  @Column({
    type: DataType.ENUM(...Object.values(BillingInterval)),
    allowNull: true,
  })
  declare billingInterval?: BillingInterval;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare subtotalAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare discountAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare taxAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare shippingAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare totalAmount: number;

  // Payout breakdown fields
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare platformFeeAmount: number;

  // Platform fee percentage used for this order (saved for historical record)
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: null,
    comment: 'Platform fee percentage applied to this order (e.g., 5.0 for 5%, 17.0 for 17%)',
  })
  declare platformFeePercent: number | null;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare doctorAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare pharmacyWholesaleAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare brandAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare stripeAmount: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare questionnaireAnswers?: Record<string, any>;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare shippedAt?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare deliveredAt?: Date;

  @HasOne(() => Subscription)
  declare subscription?: Subscription;

  @HasOne(() => Payment, 'orderId')
  declare payment?: Payment;

  @HasMany(() => OrderItem)
  declare orderItems: OrderItem[];

  @HasOne(() => Sale, 'orderId')
  declare sale?: Sale;


  @ForeignKey(() => ShippingAddress)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare shippingAddressId?: string;

  @BelongsTo(() => ShippingAddress)
  declare shippingAddress: ShippingAddress;

  @HasMany(() => ShippingOrder)
  declare shippingOrders: ShippingOrder[];

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare mdCaseId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare stripePriceId?: string;


  @ForeignKey(() => TenantProduct)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare tenantProductId?: string;

  @BelongsTo(() => TenantProduct)
  declare tenantProduct?: TenantProduct;

  @ForeignKey(() => Program)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare programId?: string;

  @BelongsTo(() => Program)
  declare program?: Program;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare affiliateId?: string;

  @BelongsTo(() => User, 'affiliateId')
  declare affiliate?: User;




  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare mdPrescriptions?: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare mdOfferings?: any;

  // Pending actions required from MDI (e.g., driver's license upload, intro video)
  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare mdPendingActions?: {
    driversLicense?: {
      accessLink: string;
      requestedAt: string;
    };
    introVideo?: {
      accessLink: string;
      requestedAt: string;
    };
  };

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare doctorNotes?: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare approvedByDoctor: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare autoApprovedByDoctor: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare autoApprovalReason?: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare approvedByDoctorId?: string;

  @BelongsTo(() => User, 'approvedByDoctorId')
  declare approvedByDoctorUser?: User;

  /**
   * Visit Type
   * 
   * The type of doctor visit required for this order.
   * Determined by the patient's state and the questionnaire's visitTypeByState configuration.
   * 
   * Values: 'synchronous' | 'asynchronous'
   */
  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  declare visitType?: 'synchronous' | 'asynchronous';

  /**
   * Visit Fee Amount
   * 
   * The fee charged for the doctor visit for this order.
   * Based on the visit type and the organization's visitTypeFees configuration.
   */
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare visitFeeAmount: number;


  // Static method to generate order number
  /**
   * Generate an order number without relying on OrderCounter
   * Format: ORD-YYYYMMDD-HHMMSS-XXXXXX
   */
  public static async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const pad = (n: number, w: number = 2) => n.toString().padStart(w, '0');
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
    return `ORD-${date}-${time}-${rand}`;
  }

  // Calculate total amount from items
  public calculateTotal(): number {
    const subtotal = this.subtotalAmount || 0;
    const discount = this.discountAmount || 0;
    const tax = this.taxAmount || 0;
    const shipping = this.shippingAmount || 0;

    return subtotal - discount + tax + shipping;
  }

  // Update order status
  public async updateStatus(status: OrderStatus): Promise<void> {
    this.status = status;

    if (status === OrderStatus.SHIPPED) {
      this.shippedAt = new Date();
    } else if (status === OrderStatus.DELIVERED) {
      this.deliveredAt = new Date();
    }

    await this.save();
  }


}