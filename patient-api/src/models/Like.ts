import { Table, Column, DataType, BelongsTo, ForeignKey, Index } from 'sequelize-typescript';
import Entity from './Entity';
import TenantProduct from './TenantProduct';
import User from './User';

@Table({
    freezeTableName: true,
    tableName: 'likes',
})
export default class Like extends Entity {
    @ForeignKey(() => TenantProduct)
    @Index
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare tenantProductId: string;

    @BelongsTo(() => TenantProduct)
    declare tenantProduct: TenantProduct;

    @ForeignKey(() => User)
    @Index
    @Column({
        type: DataType.UUID,
        allowNull: true, // Null for anonymous users
    })
    declare userId: string | null;

    @BelongsTo(() => User)
    declare user: User | null;

    @Index
    @Column({
        type: DataType.STRING,
        allowNull: true, // Null for logged-in users
        comment: 'UUID stored in localStorage to identify anonymous users',
    })
    declare anonymousId: string | null;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare liked: boolean;

    @Index
    @Column({
        type: DataType.STRING,
        allowNull: true,
        defaultValue: 'brand',
        comment: 'Source of the like: brand or affiliate',
    })
    declare sourceType: string;

    @Index
    @Column({
        type: DataType.UUID,
        allowNull: true,
        comment: 'Clinic ID of the affiliate (if sourceType is affiliate)',
    })
    declare affiliateId: string | null;
}

