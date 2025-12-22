import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import TenantProduct from './TenantProduct';

@Table({
  freezeTableName: true,
  tableName: 'TenantAnalyticsEvents',
})
export default class TenantAnalyticsEvents extends Entity {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare userId: string;

  @ForeignKey(() => TenantProduct)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare productId: string; // This is actually a TenantProduct ID

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare formId: string;

  @Column({
    type: DataType.ENUM('view', 'conversion', 'dropoff'),
    allowNull: false,
  })
  declare eventType: 'view' | 'conversion' | 'dropoff';

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare sessionId?: string;

  @Column({
    type: DataType.ENUM('product', 'payment', 'account'),
    allowNull: true,
  })
  declare dropOffStage?: 'product' | 'payment' | 'account';

  @Column({
    type: DataType.ENUM('brand', 'affiliate'),
    allowNull: false,
    defaultValue: 'brand',
  })
  declare sourceType: 'brand' | 'affiliate';

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare metadata?: Record<string, any>;

  @BelongsTo(() => User)
  declare user?: User;

  @BelongsTo(() => TenantProduct)
  declare tenantProduct?: TenantProduct;
}

