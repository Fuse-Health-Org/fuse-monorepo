import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import MedicalCompany from './MedicalCompany';
import User from './User';

@Table({
    freezeTableName: true,
    tableName: 'DoctorPharmacy'
})
export default class DoctorPharmacy extends Entity {
    @ForeignKey(() => MedicalCompany)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare medicalCompanyId: string;

    @BelongsTo(() => MedicalCompany)
    declare medicalCompany: MedicalCompany;

    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare doctorUserId: string;

    @BelongsTo(() => User)
    declare doctor: User;

    @Column({
        type: DataType.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
    })
    declare doctorApprovedByPharmacy: 'pending' | 'approved' | 'rejected';
}
