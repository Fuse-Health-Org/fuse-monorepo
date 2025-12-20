import { Table, Column, DataType, ForeignKey, BelongsTo, Index } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import Product from './Product';

@Table({
  freezeTableName: true,
  tableName: 'affiliate_product_images',
  indexes: [
    {
      unique: true,
      fields: ['affiliateId', 'productId'],
      name: 'affiliate_product_images_unique',
    },
  ],
})
export default class AffiliateProductImage extends Entity {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare affiliateId: string;

  @BelongsTo(() => User)
  declare affiliate: User;

  @ForeignKey(() => Product)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare productId: string;

  @BelongsTo(() => Product)
  declare product: Product;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare customImageUrl: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare useCustomImage: boolean;
}

