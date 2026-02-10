import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import MedicalCompany from './MedicalCompany';
import Pharmacy from './Pharmacy';

@Table({
    freezeTableName: true,
    tableName: 'MedicalCompanyPharmacy'
})
export default class MedicalCompanyPharmacy extends Entity {
    @ForeignKey(() => MedicalCompany)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare medicalCompanyId: string;

    @BelongsTo(() => MedicalCompany)
    declare medicalCompany: MedicalCompany;

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
    declare doctorCompanyApprovedByPharmacy: 'pending' | 'approved' | 'rejected';
}
