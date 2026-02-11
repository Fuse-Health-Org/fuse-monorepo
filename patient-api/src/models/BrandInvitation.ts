import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import Clinic from './Clinic';
import { MedicalCompanySlug } from '@fuse/enums';

export enum InvitationType {
  DOCTOR = 'doctor',
  MDI = 'mdi',
}

@Table({
  freezeTableName: true,
  tableName: 'BrandInvitations',
  indexes: [
    {
      unique: true,
      fields: ['invitationSlug'],
      name: 'brand_invitations_slug_unique',
    },
  ],
})
export default class BrandInvitation extends Entity {
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare invitationSlug: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare doctorId?: string;

  @BelongsTo(() => User, 'doctorId')
  declare doctor?: User;

  @ForeignKey(() => Clinic)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare doctorClinicId?: string;

  @BelongsTo(() => Clinic, 'doctorClinicId')
  declare doctorClinic?: Clinic;

  // Referrer brand - the brand that generated this invitation (for MDI invitations from admin portal)
  @ForeignKey(() => Clinic)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare referrerBrandId?: string;

  @BelongsTo(() => Clinic, 'referrerBrandId')
  declare referrerBrand?: Clinic;

  @Column({
    type: DataType.ENUM(...Object.values(InvitationType)),
    allowNull: false,
  })
  declare invitationType: InvitationType;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: MedicalCompanySlug.FUSE,
  })
  declare patientPortalDashboardFormat: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  declare usageCount: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare expiresAt?: Date;
}
