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
