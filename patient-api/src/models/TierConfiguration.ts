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

  // Fuse fee percentage for this tier (e.g., 5.0 for 5%, 17.0 for 17%)
  // If null, falls back to GlobalFees.fuseTransactionFeePercent
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: null,
    comment: 'Fuse platform transaction fee percentage for this tier (e.g., 5.0 for 5%, 17.0 for 17%)',
  })
  declare fuseFeePercent: number | null;

  // Non-medical services profit percentage for this tier (e.g., 80.0 for 80%)
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: null,
    comment: 'Non-medical services profit percentage for this tier (e.g., 80.0 for 80%)',
  })
  declare nonMedicalProfitPercent: number | null;

  /** Merchant service fee charged per transaction on this tier (e.g. 2.0 = 2%).
   *  Shown separately from fuseFeePercent. Defaults to 2% system-wide; can be overridden per tier or per brand. */
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 2,
    comment: 'Per-transaction merchant service fee percent for this tier (e.g. 2.0 = 2%). Separate from profit-share fuseFeePercent. Defaults to 2.',
  })
  declare merchantServiceFeePercent: number | null;

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
      fuseFeePercent: this.fuseFeePercent,
      nonMedicalProfitPercent: this.nonMedicalProfitPercent,
      merchantServiceFeePercent: this.merchantServiceFeePercent,
    };
  }
}

