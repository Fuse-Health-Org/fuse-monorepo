import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

@Table({
  tableName: 'GlobalFees',
  timestamps: true,
})
export class GlobalFees extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({
    type: DataType.UUID,
  })
  declare id: string;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Fuse platform transaction fee percentage (e.g., 1.0 for 1%)',
  })
  declare fuseTransactionFeePercent: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Fuse flat fee per transaction for doctor (in USD)',
  })
  declare fuseTransactionDoctorFeeUsd: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Stripe transaction fee percentage (e.g., 3.9 for 3.9%)',
  })
  declare stripeTransactionFeePercent: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of days to delay refund processing (e.g., 7 for 7-day delay)',
  })
  declare refundProcessingDelayDays: number;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}

