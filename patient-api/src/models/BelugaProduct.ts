import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  freezeTableName: true,
  tableName: 'BelugaProduct',
  paranoid: false,
  indexes: [
    {
      unique: true,
      fields: ['name'],
      name: 'beluga_product_name_unique',
    },
  ],
})
export default class BelugaProduct extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
    allowNull: false,
  })
  declare id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    comment: 'Medication display name (e.g. "NAD+")',
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    comment: 'Dosage strength (e.g. "100mg/ml 10ml")',
  })
  declare strength: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: '1',
    comment: 'Quantity per fill',
  })
  declare quantity: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: '0',
    comment: 'Number of refills',
  })
  declare refills: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'Days supply per fill (optional per Beluga spec)',
  })
  declare daysSupply?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'Beluga-assigned medication ID used in patientPreference.medId (optional until assigned)',
  })
  declare medId?: string;
}
