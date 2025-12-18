import { Table, Column, DataType, ForeignKey, BelongsTo, Index } from 'sequelize-typescript';
import Entity from './Entity';
import Clinic from './Clinic';
import Product from './Product';

@Table({
    freezeTableName: true,
    tableName: 'BrandFavoritedProduct',
    indexes: [
        {
            unique: true,
            fields: ['clinicId', 'productId'],
            name: 'unique_clinic_product_favorite'
        }
    ]
})
export default class BrandFavoritedProduct extends Entity {
    @ForeignKey(() => Clinic)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare clinicId: string;

    @BelongsTo(() => Clinic)
    declare clinic: Clinic;

    @ForeignKey(() => Product)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare productId: string;

    @BelongsTo(() => Product)
    declare product: Product;
}
