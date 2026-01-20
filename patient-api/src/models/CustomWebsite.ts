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
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: null,
    })
    declare footerCategories?: Array<{
        name: string;
        visible: boolean;
        urls?: Array<{
            label: string;
            url: string;
        }>;
    }>;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
        defaultValue: 'NAVIGATION',
    })
    declare section1?: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
        defaultValue: 'SECTION 2',
    })
    declare section2?: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
        defaultValue: 'SECTION 3',
    })
    declare section3?: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
        defaultValue: 'SECTION 4',
    })
    declare section4?: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
        defaultValue: 'SOCIAL MEDIA',
    })
    declare socialMediaSection?: string | null;

    // Relations
    @BelongsTo(() => Clinic)
    declare clinic: Clinic;
}

