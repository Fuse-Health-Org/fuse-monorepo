import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import BrandSubscriptionPlans from './BrandSubscriptionPlans';

@Table({
  freezeTableName: true,
  tableName: 'TierConfiguration',
})
export default class TierConfiguration extends Entity {
  @ForeignKey(() => BrandSubscriptionPlans)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    unique: true,
  })
  declare brandSubscriptionPlanId: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare canAddCustomProducts: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare hasAccessToAnalytics: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare canUploadCustomProductImages: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare hasCustomPortal: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare hasPrograms: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare canCustomizeFormStructure: boolean;

  @BelongsTo(() => BrandSubscriptionPlans)
  declare plan?: BrandSubscriptionPlans;

  // Helper method to get all tier features as an object
  public getFeatures() {
    return {
      canAddCustomProducts: this.canAddCustomProducts,
      hasAccessToAnalytics: this.hasAccessToAnalytics,
      canUploadCustomProductImages: this.canUploadCustomProductImages,
      hasCustomPortal: this.hasCustomPortal,
      hasPrograms: this.hasPrograms,
      canCustomizeFormStructure: this.canCustomizeFormStructure,
    };
  }
}

