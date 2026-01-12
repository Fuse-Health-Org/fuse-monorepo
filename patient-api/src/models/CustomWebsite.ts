import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Clinic from './Clinic';

@Table({
    freezeTableName: true,
    paranoid: true, // Enables soft deletes (deletedAt)
})
export default class CustomWebsite extends Entity {
    @ForeignKey(() => Clinic)
    @Column({
        type: DataType.UUID,
        allowNull: false,
        unique: true,
    })
    declare clinicId: string;

    @Column({
        type: DataType.STRING(255),
        allowNull: true,
    })
    declare portalTitle?: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare portalDescription?: string;

    @Column({
        type: DataType.STRING(7), // Hex color format #RRGGBB
        allowNull: true,
        defaultValue: '#000000',
    })
    declare primaryColor?: string;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
        defaultValue: 'Playfair Display',
    })
    declare fontFamily?: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare logo?: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare heroImageUrl?: string;

    @Column({
        type: DataType.STRING(255),
        allowNull: true,
    })
    declare heroTitle?: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare heroSubtitle?: string;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare isActive: boolean;

    @Column({
        type: DataType.STRING(7), // Hex color format #RRGGBB
        allowNull: true,
        defaultValue: '#000000',
    })
    declare footerColor?: string;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare footerShowShop?: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare footerShowDailyHealth?: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare footerShowRestRestore?: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare footerShowStore?: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare footerShowLearnMore?: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare footerShowContact?: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare footerShowSupport?: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare footerShowConnect?: boolean;

    // Relations
    @BelongsTo(() => Clinic)
    declare clinic: Clinic;
}

