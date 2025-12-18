import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Clinic from './Clinic';
import Questionnaire from './Questionnaire';

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

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    declare isActive: boolean;
}
