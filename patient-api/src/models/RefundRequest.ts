import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Order from './Order';
import Clinic from './Clinic';
import User from './User';

export enum RefundRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
}

@Table({
  freezeTableName: true,
  tableName: 'RefundRequest',
})
export default class RefundRequest extends Entity {
  @ForeignKey(() => Order)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare orderId: string;

  @BelongsTo(() => Order, 'orderId')
  declare order?: Order;

  @ForeignKey(() => Clinic)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare clinicId: string;

  @BelongsTo(() => Clinic, 'clinicId')
  declare clinic?: Clinic;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    comment: 'The brand user who requested the refund',
  })
  declare requestedById: string;

  @BelongsTo(() => User, 'requestedById')
  declare requestedBy?: User;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Total amount to refund to the patient',
  })
  declare amount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'The portion the brand absorbs (since pharmacy/doctor payments cannot be reversed)',
  })
  declare brandCoverageAmount: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    comment: 'Reason provided by the admin for the refund request',
  })
  declare reason?: string;

  @Column({
    type: DataType.ENUM(...Object.values(RefundRequestStatus)),
    allowNull: false,
    defaultValue: RefundRequestStatus.PENDING,
  })
  declare status: RefundRequestStatus;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    comment: 'The tenant admin who reviewed the request',
  })
  declare reviewedById?: string;

  @BelongsTo(() => User, 'reviewedById')
  declare reviewedBy?: User;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    comment: 'Notes from the reviewer when approving or denying',
  })
  declare reviewNotes?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare reviewedAt?: Date;
}
