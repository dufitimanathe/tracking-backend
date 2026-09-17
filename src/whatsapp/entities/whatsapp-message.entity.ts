import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum WhatsAppMessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

@Entity('whatsapp_messages')
export class WhatsAppMessage extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  externalMessageId!: string;

  @Column({ type: 'uuid', nullable: true })
  companyId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  employeeId?: string | null;

  @Column({ type: 'varchar', length: 30 })
  phone!: string;

  @Column({
    type: 'enum',
    enum: WhatsAppMessageDirection,
  })
  direction!: WhatsAppMessageDirection;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  conversationState?: Record<string, unknown> | null;
}
