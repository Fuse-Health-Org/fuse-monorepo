import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Order from './Order';
import ShippingAddress from './ShippingAddress';
import { PharmacyProvider } from './Product';

export enum OrderShippingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  FILLED = 'filled',
  APPROVED = 'approved',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  PROBLEM = 'problem',
  COMPLETED = 'completed',
  RETRY_PENDING = 'retry_pending',  // Failed to submit, waiting for retry
  FAILED = 'failed',                 // All retries exhausted
}

@Table({
  freezeTableName: true,
  tableName: 'ShippingOrder',
})
export default class ShippingOrder extends Entity {
  @ForeignKey(() => Order)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare orderId: string;

  @BelongsTo(() => Order)
  declare order: Order;

  @ForeignKey(() => ShippingAddress)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare shippingAddressId: string;

  @BelongsTo(() => ShippingAddress)
  declare shippingAddress: ShippingAddress;

  @Column({
    type: DataType.ENUM(...Object.values(OrderShippingStatus)),
    allowNull: false,
    defaultValue: OrderShippingStatus.PENDING,
  })
  declare status: OrderShippingStatus;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare pharmacyOrderId?: string;

  @Column({
    type: DataType.ENUM(...Object.values(PharmacyProvider)),
    allowNull: true,
  })
  declare pharmacy?: PharmacyProvider;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare trackingNumber?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare trackingUrl?: string;

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

  // Retry tracking fields for IronSail order submission
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  declare retryCount: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare lastRetryAt?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare nextRetryAt?: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare retryError?: string;

}