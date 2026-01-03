import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Clinic from './Clinic';
import Questionnaire from './Questionnaire';
import Product from './Product';

@Table({
    freezeTableName: true,
    tableName: 'Program',
})
export default class Program extends Entity {
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

    @ForeignKey(() => Clinic)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare clinicId: string;

    @BelongsTo(() => Clinic)
    declare clinic: Clinic;

    @ForeignKey(() => Questionnaire)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare medicalTemplateId?: string;

    @BelongsTo(() => Questionnaire, 'medicalTemplateId')
    declare medicalTemplate?: Questionnaire;

    /**
     * Parent Program ID
     * 
     * When a program is created as a per-product variant (with individualProductId set),
     * it should reference its parent program. This allows:
     * - Organizing child programs under a parent
     * - Filtering out child programs from the main programs list
     * - Cascading updates/deletions from parent to children
     * 
     * If null, this is a parent/standalone program.
     */
    @ForeignKey(() => Program)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare parentProgramId?: string;

    @BelongsTo(() => Program, 'parentProgramId')
    declare parentProgram?: Program;

    /**
     * Individual Product ID
     * 
     * A program is globally tied to a medicalTemplateId (the form/questionnaire).
     * However, if individualProductId is set, this program becomes specific to one
     * particular product that belongs to that form.
     * 
     * The relationship between products and forms is defined in the FormProducts table.
     * When individualProductId is set, this program should only be shown/applied when
     * the user is purchasing that specific product from the form.
     * 
     * If null, the program applies to all products in the form.
     */
    @ForeignKey(() => Product)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare individualProductId?: string;

    @BelongsTo(() => Product, 'individualProductId')
    declare individualProduct?: Product;

    /**
     * Frontend Display Product ID
     * 
     * When a program has multiple products in its medical template, this field allows
     * the admin to select which product's image should be displayed on the frontend
     * (landing page, all-products page) instead of the default program icon.
     * 
     * If set, the program card will show this product's imageUrl.
     * If not set, the program card will show the default stethoscope icon with gradient.
     */
    @ForeignKey(() => Product)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    declare frontendDisplayProductId?: string;

    @BelongsTo(() => Product, 'frontendDisplayProductId')
    declare frontendDisplayProduct?: Product;

    // Non-Medical Services - Patient Portal
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasPatientPortal: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare patientPortalPrice: number;

    // Non-Medical Services - BMI Calculator
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasBmiCalculator: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare bmiCalculatorPrice: number;

    // Non-Medical Services - Protein Intake Calculator
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasProteinIntakeCalculator: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare proteinIntakeCalculatorPrice: number;

    // Non-Medical Services - Calorie Deficit Calculator
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasCalorieDeficitCalculator: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare calorieDeficitCalculatorPrice: number;

    // Non-Medical Services - Easy Shopping
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare hasEasyShopping: boolean;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    })
    declare easyShoppingPrice: number;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare isActive: boolean;
}
