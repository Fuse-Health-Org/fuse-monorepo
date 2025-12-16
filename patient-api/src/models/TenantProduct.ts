import { Table, Column, DataType, BelongsTo, ForeignKey, HasMany, Index } from 'sequelize-typescript';
import Entity from './Entity';
import Clinic from './Clinic';
import Product from './Product';
import Questionnaire from './Questionnaire';
import TenantAnalyticsEvents from './TenantAnalyticsEvents';
import Like from './Like';

@Table({
    freezeTableName: true,
    paranoid: false,
    indexes: [
        {
            unique: true,
            fields: ['clinicId', 'productId'],
            name: 'tenant_product_clinic_product_unique',
        },
    ],
})
export default class TenantProduct extends Entity {
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

    @ForeignKey(() => Questionnaire)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare questionnaireId: string;

    @BelongsTo(() => Questionnaire)
    declare questionnaire: Questionnaire;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare isActive: boolean;

    @Column({
        type: DataType.FLOAT,
        allowNull: false,
        defaultValue: 0,
    })
    declare price: number;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare stripeProductId?: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare stripePriceId?: string;

    @HasMany(() => TenantAnalyticsEvents)
    declare analyticsEvents: TenantAnalyticsEvents[];

    @HasMany(() => Like)
    declare likes: Like[];
}
