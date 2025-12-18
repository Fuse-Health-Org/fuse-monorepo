import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Entity from './Entity'
import Product from './Product'
import Questionnaire from './Questionnaire'

@Table({
  freezeTableName: true,
  tableName: 'FormProducts',
  paranoid: true,
})
export default class FormProducts extends Entity {
  @ForeignKey(() => Questionnaire)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare questionnaireId: string

  @BelongsTo(() => Questionnaire)
  declare questionnaire: Questionnaire

  @ForeignKey(() => Product)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare productId: string

  @BelongsTo(() => Product)
  declare product: Product
}

