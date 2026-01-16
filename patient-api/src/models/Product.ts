import { Table, Column, DataType, BelongsToMany, HasMany, BeforeValidate, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Prescription from './Prescription';
import PrescriptionProducts from './PrescriptionProducts';
import Treatment from './Treatment';
import TreatmentProducts from './TreatmentProducts';
import TenantProduct from './TenantProduct';
import Questionnaire from './Questionnaire';
import PharmacyProduct from './PharmacyProduct';
import PharmacyCoverage from './PharmacyCoverage';
import User from './User';

export enum PharmacyProvider {
    ABSOLUTERX = 'absoluterx',
    TRUEPILL = 'truepill',
    PILLPACK = 'pillpack',
    IRONSAIL = 'ironsail',
}

export enum ProductCategory {
    WEIGHT_LOSS = 'weight_loss',
    HAIR_GROWTH = 'hair_growth',
    PERFORMANCE = 'performance',
    SEXUAL_HEALTH = 'sexual_health',
    SKINCARE = 'skincare',
    WELLNESS = 'wellness',
    OTHER = 'other',
}




@Table({
    freezeTableName: true,
})
export default class Product extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: true,
        unique: true,
    })
    declare slug?: string | null;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare description: string;

    @Column({
        type: DataType.FLOAT,
        allowNull: false,
    })
    declare price: number;

    @Column({
        type: DataType.ARRAY(DataType.STRING),
        allowNull: false,
    })
    declare activeIngredients: string[];

    @Column({
        type: DataType.STRING,
        allowNull: true,
        defaultValue: 'As prescribed',
    })
    declare placeholderSig?: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare imageUrl?: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare pharmacyProductId?: string;

    @Column({
        type: DataType.ENUM(...Object.values(PharmacyProvider)),
        allowNull: false,
        defaultValue: PharmacyProvider.ABSOLUTERX
    })
    declare pharmacyProvider: PharmacyProvider;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: true,
    })
    declare pharmacyWholesaleCost?: number;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare medicationSize?: string;

    @Column({
        type: DataType.ARRAY(DataType.STRING),
        allowNull: true,
        defaultValue: [],
    })
    declare categories?: string[];

    get primaryCategory(): string | null {
        return Array.isArray(this.categories) && this.categories.length > 0 ? this.categories[0] ?? null : null;
    }

    set primaryCategory(value: string | null) {
        if (!value) {
            this.categories = [];
            return;
        }

        if (Array.isArray(this.categories) && this.categories.length > 0) {
            const [, ...rest] = this.categories;
            this.categories = [value, ...rest];
        } else {
            this.categories = [value];
        }
    }

    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: [],
    })
    declare requiredDoctorQuestions?: any[];


    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare isActive: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare isAutoImported: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: true,
    })
    declare suggestedRetailPrice?: number;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare mdCaseId?: string;

    // MD Integrations Offering ID - links this product to an MDI offering
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare mdOfferingId?: string;

    // MD Integrations Offering Name (cached for display)
    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare mdOfferingName?: string;

    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare brandId?: string;

    @BelongsTo(() => User)
    declare brand?: User;

    @BelongsToMany(() => Prescription, () => PrescriptionProducts)
    declare prescriptions: Prescription[];

    @HasMany(() => PrescriptionProducts)
    declare prescriptionProducts: PrescriptionProducts[];

    @BelongsToMany(() => Treatment, () => TreatmentProducts)
    declare treatments: Treatment[];

    @HasMany(() => TreatmentProducts)
    declare treatmentProducts: TreatmentProducts[];

    @HasMany(() => TenantProduct)
    declare tenantProducts: TenantProduct[];

    @HasMany(() => Questionnaire)
    declare questionnaires: Questionnaire[];

    @HasMany(() => PharmacyProduct)
    declare pharmacyProducts: PharmacyProduct[];

    @HasMany(() => PharmacyCoverage)
    declare pharmacyCoverages: PharmacyCoverage[];

    // Auto-generate slug from product name if not provided
    @BeforeValidate
    static ensureSlug(instance: Product) {
        if (!instance.slug && instance.name) {
            const base = instance.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            // Add timestamp to ensure uniqueness for products with same name
            const timestamp = Date.now();
            instance.slug = base ? `${base}-${timestamp}` : `product-${timestamp}`;
        }
    }
}
