import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import MedicalCompany from './MedicalCompany';
import Pharmacy from './Pharmacy';
import User from './User';

@Table({
    freezeTableName: true,
    tableName: 'DoctorPharmacy'
})
export default class DoctorPharmacy extends Entity {
    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare doctorUserId: string;

    @BelongsTo(() => User)
    declare doctor: User;

    @ForeignKey(() => Pharmacy)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare pharmacyId: string;

    @BelongsTo(() => Pharmacy)
    declare pharmacy: Pharmacy;

    @Column({
        type: DataType.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
    })
    declare doctorApprovedByPharmacy: 'pending' | 'approved' | 'rejected';
}
