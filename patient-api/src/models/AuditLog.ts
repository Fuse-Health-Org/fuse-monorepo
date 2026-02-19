import { Table, Column, DataType, ForeignKey, BelongsTo, Index } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';

/**
 * HIPAA Audit Log Model
 * 
 * Records all access to Protected Health Information (PHI) for compliance
 * with 45 CFR § 164.312(b) - Audit Controls
 * 
 * Retention requirement: 6 years minimum (45 CFR § 164.530(j))
 */

export enum AuditAction {
  // Authentication events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',

  // MFA events (HIPAA compliance)
  MFA_CODE_SENT = 'MFA_CODE_SENT',
  MFA_VERIFIED = 'MFA_VERIFIED',
  MFA_FAILED = 'MFA_FAILED',
  MFA_RESEND = 'MFA_RESEND',

  // PHI Access events
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXPORT = 'EXPORT',

  // Communication events
  EMAIL_SENT = 'EMAIL_SENT',
  SMS_SENT = 'SMS_SENT',

  // Administrative events
  ROLE_CHANGE = 'ROLE_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
}

export enum AuditResourceType {
  USER = 'User',
  PATIENT = 'Patient',
  ORDER = 'Order',
  PRESCRIPTION = 'Prescription',
  TREATMENT = 'Treatment',
  MESSAGE = 'Message',
  QUESTIONNAIRE_RESPONSE = 'QuestionnaireResponse',
  QUESTIONNAIRE_TEMPLATE = 'QuestionnaireTemplate',
  PAYMENT = 'Payment',
  SUBSCRIPTION = 'Subscription',
  SESSION = 'Session',
  CLINIC = 'Clinic',
  PRODUCT = 'Product',
  DOCUMENT = 'Document',
  PROGRAM = 'Program',
}

@Table({
  freezeTableName: true,
  tableName: 'audit_logs',
  // Audit logs should NEVER be deleted - HIPAA requires 6 year retention
  paranoid: false,
  timestamps: true,
  updatedAt: false, // Audit logs are immutable - no updates allowed
})
@Index(['userId', 'createdAt'])
@Index(['resourceType', 'resourceId'])
@Index(['action', 'createdAt'])
@Index(['createdAt']) // For retention queries
export default class AuditLog extends Entity {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true, // Null for failed login attempts where user doesn't exist
  })
  declare userId: string | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare userEmail: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(AuditAction)),
    allowNull: false,
  })
  declare action: AuditAction;

  @Column({
    type: DataType.ENUM(...Object.values(AuditResourceType)),
    allowNull: false,
  })
  declare resourceType: AuditResourceType;

  @Column({
    type: DataType.UUID,
    allowNull: true, // Null for login/logout events
  })
  declare resourceId: string | null;

  @Column({
    type: DataType.STRING(45), // IPv6 max length
    allowNull: true,
  })
  declare ipAddress: string | null;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  declare userAgent: string | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare details: Record<string, any> | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare clinicId: string | null;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  declare success: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare errorMessage: string | null;

  @BelongsTo(() => User)
  declare user?: User;

  // Static helper to create audit log entry
  static async log(params: {
    userId?: string | null;
    userEmail?: string | null;
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    details?: Record<string, any> | null;
    clinicId?: string | null;
    success?: boolean;
    errorMessage?: string | null;
  }): Promise<AuditLog> {
    return this.create({
      userId: params.userId || null,
      userEmail: params.userEmail || null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      details: params.details || null,
      clinicId: params.clinicId || null,
      success: params.success ?? true,
      errorMessage: params.errorMessage || null,
    });
  }
}

