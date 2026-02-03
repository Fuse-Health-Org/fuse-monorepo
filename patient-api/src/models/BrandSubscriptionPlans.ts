import { Table, Column, DataType, HasMany, HasOne } from 'sequelize-typescript';
import Entity from './Entity';
import TierConfiguration from './TierConfiguration';

@Table({
  freezeTableName: true,
  tableName: 'BrandSubscriptionPlans',
})
export default class BrandSubscriptionPlans extends Entity {
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare planType: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description?: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare monthlyPrice: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare stripePriceId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: -1, // -1 means unlimited
  })
  declare maxProducts: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: -1, // -1 means unlimited
  })
  declare maxCampaigns: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  declare analyticsAccess: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'email',
  })
  declare customerSupport: string; // 'email', 'priority', 'dedicated'

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare customBranding: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare apiAccess: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare whiteLabel: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare customIntegrations: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  declare sortOrder: number;

  @HasOne(() => TierConfiguration, 'brandSubscriptionPlanId')
  declare tierConfig?: TierConfiguration;

  // Static method to get all active plans
  static async getActivePlans() {
    return BrandSubscriptionPlans.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC']],
    });
  }

  // Static method to get plan by type
  static async getPlanByType(planType: string) {
    return await BrandSubscriptionPlans.findOne({
      where: { planType, isActive: true },
    });
  }

  // Instance method to get features as an object
  public getFeatures() {
    return {
      maxProducts: this.maxProducts,
      maxCampaigns: this.maxCampaigns,
      analyticsAccess: this.analyticsAccess,
      customerSupport: this.customerSupport,
      customBranding: this.customBranding,
      apiAccess: this.apiAccess,
      whiteLabel: this.whiteLabel,
      customIntegrations: this.customIntegrations,
    };
  }
}