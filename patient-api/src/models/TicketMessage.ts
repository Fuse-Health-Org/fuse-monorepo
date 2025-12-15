import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import SupportTicket from './SupportTicket';

export enum MessageSender {
  USER = 'user',
  SUPPORT = 'support',
  SYSTEM = 'system'
}

@Table({
  freezeTableName: true,
  tableName: 'ticket_messages',
})
export default class TicketMessage extends Entity {
  @ForeignKey(() => SupportTicket)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare ticketId: string;

  @BelongsTo(() => SupportTicket, 'ticketId')
  declare ticket: SupportTicket;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare senderId: string;

  @BelongsTo(() => User, 'senderId')
  declare sender: User;

  @Column({
    type: DataType.ENUM(...Object.values(MessageSender)),
    allowNull: false,
    defaultValue: MessageSender.USER,
  })
  declare senderType: MessageSender;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  })
  declare message: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare isInternal: boolean; // Internal notes only visible to support staff

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    defaultValue: [],
  })
  declare attachments?: Array<{
    name: string;
    url: string;
    size: number;
    type: string;
  }>;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare read: boolean;
}

