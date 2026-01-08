import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';

@Table({
  freezeTableName: true,
  tableName: 'TenantCustomFeatures',
})
export default class TenantCustomFeatures extends Entity {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    unique: true,
  })
  declare userId: string;

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

  @BelongsTo(() => User)
  declare user?: User;

  // Helper method to get all features as an object
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

