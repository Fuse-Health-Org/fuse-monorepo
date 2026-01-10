import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Prescription from './Prescription';

@Table({
    freezeTableName: true,
})
export default class PrescriptionExtension extends Entity {
    @ForeignKey(() => Prescription)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare originalPrescriptionId: string;

    @BelongsTo(() => Prescription)
    declare originalPrescription: Prescription;

    @Column({
        type: DataType.DATE,
        allowNull: false,
    })
    declare expiresAt: Date;

    @Column({
        type: DataType.DATE,
        allowNull: false,
    })
    declare writtenAt: Date;
}
