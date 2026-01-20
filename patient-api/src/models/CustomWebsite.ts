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

    @Column({
        type: DataType.TEXT,
        allowNull: true,
        defaultValue: '* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure or prevent any disease. The information provided on this site is for informational purposes only and is not intended as a substitute for advice from your physician or other health care professional. You should not use the information on this site for diagnosis or treatment of any health problem or for prescription of any medication or other treatment. You should consult with a healthcare professional before starting any diet, exercise or supplementation program, before taking any medication, or if you have or suspect you might have a health problem.',
    })
    declare footerDisclaimer?: string | null;

    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: {
            instagram: { enabled: true, url: '' },
            facebook: { enabled: true, url: '' },
            twitter: { enabled: true, url: '' },
            tiktok: { enabled: true, url: '' },
            youtube: { enabled: true, url: '' },
        },
    })
    declare socialMediaLinks?: {
        instagram?: { enabled: boolean; url: string };
        facebook?: { enabled: boolean; url: string };
        twitter?: { enabled: boolean; url: string };
        tiktok?: { enabled: boolean; url: string };
        youtube?: { enabled: boolean; url: string };
    };

    // Relations
    @BelongsTo(() => Clinic)
    declare clinic: Clinic;
}

