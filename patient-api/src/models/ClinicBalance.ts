import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Clinic from './Clinic';
import Order from './Order';

export enum ClinicBalanceType {
  REFUND_DEBT = 'refund_debt',
  PAYMENT = 'payment',
  ADJUSTMENT = 'adjustment',
}

export enum ClinicBalanceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

@Table({
  freezeTableName: true,
  tableName: 'ClinicBalance',
})
export default class ClinicBalance extends Entity {
  @ForeignKey(() => Clinic)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare clinicId: string;

  @BelongsTo(() => Clinic, 'clinicId')
  declare clinic?: Clinic;

  @ForeignKey(() => Order)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare orderId?: string;

  @BelongsTo(() => Order, 'orderId')
  declare order?: Order;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare amount: number;

  @Column({
    type: DataType.ENUM(...Object.values(ClinicBalanceType)),
    allowNull: false,
    defaultValue: ClinicBalanceType.REFUND_DEBT,
  })
  declare type: ClinicBalanceType;

  @Column({
    type: DataType.ENUM(...Object.values(ClinicBalanceStatus)),
    allowNull: false,
    defaultValue: ClinicBalanceStatus.PENDING,
  })
  declare status: ClinicBalanceStatus;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare stripeTransferId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare stripeRefundId?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare paidAt?: Date;
}
