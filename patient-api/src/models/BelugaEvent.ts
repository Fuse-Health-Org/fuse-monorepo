import { BelongsTo, Column, DataType, ForeignKey, Table } from "sequelize-typescript";
import Entity from "./Entity";
import Order from "./Order";
import User from "./User";

export type BelugaEventType =
  | "DOCTOR_CHAT"
  | "CS_MESSAGE"
  | "PATIENT_CHAT"
  | "PATIENT_CS_MESSAGE"
  | "RX_WRITTEN"
  | "CONSULT_CONCLUDED"
  | "CONSULT_CANCELED"
  | "NAME_UPDATE";

export type BelugaSenderRole = "patient" | "doctor" | "beluga_admin" | "system";
export type BelugaMessageChannel = "patient_chat" | "customer_service" | "system";
export type BelugaEventSource = "webhook" | "outbound";

@Table({
  freezeTableName: true,
  tableName: "BelugaEvent",
  indexes: [
    { name: "beluga_event_master_idx", fields: ["masterId"] },
    { name: "beluga_event_user_idx", fields: ["userId"] },
    { name: "beluga_event_order_idx", fields: ["orderId"] },
    { name: "beluga_event_type_idx", fields: ["eventType"] },
  ],
})
export default class BelugaEvent extends Entity {
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true })
  declare userId?: string | null;

  @BelongsTo(() => User)
  declare user?: User;

  @ForeignKey(() => Order)
  @Column({ type: DataType.UUID, allowNull: true })
  declare orderId?: string | null;

  @BelongsTo(() => Order)
  declare order?: Order;

  @Column({ type: DataType.STRING, allowNull: false })
  declare masterId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare eventType: BelugaEventType;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: "system" })
  declare senderRole: BelugaSenderRole;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: "system" })
  declare channel: BelugaMessageChannel;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare message?: string | null;

  @Column({ type: DataType.STRING, allowNull: false })
  declare source: BelugaEventSource;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare payload?: Record<string, any> | null;
}
