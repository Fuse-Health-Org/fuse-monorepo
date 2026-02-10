import { Table, Column, DataType, HasMany } from 'sequelize-typescript';
import Entity from './Entity';

@Table({
    freezeTableName: true,
    tableName: 'MedicalCompany'
})
export default class MedicalCompany extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
        unique: true,
    })
    declare slug: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare apiUrl?: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare dashboardUrl?: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    declare documentationUrl?: string;

    @HasMany(() => require('./MedicalCompanyPharmacy').default)
    declare pharmacies: any[];

    @HasMany(() => require('./DoctorPharmacy').default)
    declare doctors: any[];
}
