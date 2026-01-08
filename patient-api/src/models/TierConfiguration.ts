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

  // Custom text to display on the plan card (JSON array of strings)
  // If provided, these will be shown instead of/in addition to auto-generated feature text
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    defaultValue: null,
  })
  declare customTierCardText: string[] | null;

  // Toggle to control whether custom text is active or auto-generated text is used
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare isCustomTierCardTextActive: boolean;

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
      customTierCardText: this.customTierCardText,
      isCustomTierCardTextActive: this.isCustomTierCardTextActive,
    };
  }
}

