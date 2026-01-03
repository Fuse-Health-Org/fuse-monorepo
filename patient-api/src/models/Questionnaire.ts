import { Table, Column, DataType, BelongsTo, ForeignKey, HasMany } from 'sequelize-typescript';
import Entity from './Entity';
import Treatment from './Treatment';
import QuestionnaireStep from './QuestionnaireStep';
import User from './User';
import TenantProduct from './TenantProduct';
import Product from './Product';
import FormProducts from './FormProducts';

export type ProductOfferType = 'single_choice' | 'multiple_choice';

@Table({
    freezeTableName: true,
    indexes: [
        {
            unique: true,
            fields: ['title', 'userId'],
            name: 'questionnaire_title_user_unique',
        },
        {
            unique: true,
            fields: ['formTemplateType'],
            name: 'unique_user_profile_formTemplateType',
            // Ensure only a single questionnaire can have formTemplateType = 'user_profile'
            where: { formTemplateType: 'user_profile' } as any,
        },
    ],
})
export default class Questionnaire extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare title: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare description: string;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare personalizationQuestionsSetup: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare createAccountQuestionsSetup: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare doctorQuestionsSetup: boolean;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: -1,
    })
    declare checkoutStepPosition: number;

    @ForeignKey(() => Treatment)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare treatmentId?: string | null;

    @BelongsTo(() => Treatment)
    declare treatment?: Treatment | null;

    @Column({
        type: DataType.ENUM('normal', 'user_profile', 'master_template', 'standardized_template', 'brand_questions'),
        allowNull: true,
        defaultValue: null,
    })
    //NOTE: normal = Product-specific form (one per product)
    //NOTE: user_profile = Global "Create Account" template
    //NOTE: standardized_template = Category-wide questions (weight_loss, hair_growth, etc.) - can have variants
    //NOTE: master_template = System master template (not editable)
    declare formTemplateType: 'normal' | 'user_profile' | 'master_template' | 'standardized_template' | 'brand_questions' | null;

    @Column({
        // Use explicit literals to avoid runtime import/init issues
        type: DataType.ENUM(
            'weight_loss',
            'hair_growth',
            'performance',
            'sexual_health',
            'skincare',
            'wellness',
            'other'
        ),
        allowNull: true,
    })
    declare category?:
        | 'weight_loss'
        | 'hair_growth'
        | 'performance'
        | 'sexual_health'
        | 'skincare'
        | 'wellness'
        | 'other'
        | null;


    @ForeignKey(() => Product)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare productId: string | null;

    @BelongsTo(() => Product)
    declare product?: Product | null;

    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare userId: string | null;

    @BelongsTo(() => User)
    declare user?: User | null;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare isTemplate: boolean;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare color: string | null;

    @Column({
        type: DataType.ENUM('in_progress', 'ready_for_review', 'ready'),
        allowNull: false,
        defaultValue: 'in_progress',
    })
    declare status: 'in_progress' | 'ready_for_review' | 'ready';

    @Column({
        type: DataType.ENUM('single_choice', 'multiple_choice'),
        allowNull: false,
        defaultValue: 'single_choice',
    })
    declare productOfferType: ProductOfferType;

    // productId and product already declared above; duplicate declarations removed

    @HasMany(() => QuestionnaireStep)
    declare steps: QuestionnaireStep[];

    @HasMany(() => TenantProduct)
    declare tenantProducts: TenantProduct[];

    @HasMany(() => FormProducts)
    declare formProducts: FormProducts[];
}