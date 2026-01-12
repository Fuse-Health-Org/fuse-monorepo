import { Table, Column, DataType, ForeignKey, HasMany, BelongsTo, BelongsToMany } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import Product from './Product';
import PrescriptionProducts from './PrescriptionProducts';
import PrescriptionExtension from './PrescriptionExtension';

@Table({
    freezeTableName: true,
})
export default class Prescription extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

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

    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare patientId: string;

    @BelongsTo(() => User)
    declare patient: User;

    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare doctorId: string;

    @BelongsTo(() => User)
    declare doctor: User;

    @BelongsToMany(() => Product, () => PrescriptionProducts)
    declare products: Product[];

    @HasMany(() => PrescriptionProducts)
    declare prescriptionProducts: PrescriptionProducts[];

    @HasMany(() => PrescriptionExtension)
    declare extensions: PrescriptionExtension[];
}