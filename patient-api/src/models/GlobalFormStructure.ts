import { Table, Column, DataType } from 'sequelize-typescript'
import Entity from './Entity'

@Table({
  freezeTableName: true,
  tableName: 'GlobalFormStructures',
  paranoid: true, // Enables soft deletes
})
export default class GlobalFormStructure extends Entity {
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare structureId: string // e.g., "default", "payment-first"

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description?: string

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare userId?: string

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
  })
  declare sections: Array<{
    id: string
    type: 'product_questions' | 'category_questions' | 'brand_questions' | 'account_creation' | 'product_selection' | 'checkout'
    label: string
    description: string
    order: number
    enabled: boolean
    icon: string
  }>

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare isDefault: boolean

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  declare isActive: boolean
}

