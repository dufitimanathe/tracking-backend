import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  WhatsAppMessageDirection,
  WhatsAppProcessingStatus,
} from '../../common/enums';

// Re-export direction from enums for callers that imported from entity
export { WhatsAppMessageDirection } from '../../common/enums';

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

  @Column({ type: 'varchar', length: 40, nullable: true })
  messageType?: string | null;

  @Column({ type: 'text', nullable: true })
  messageBody?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language?: string | null;

  @Column({ type: 'uuid', nullable: true })
  requestId?: string | null;

  @Column({
    type: 'enum',
    enum: WhatsAppProcessingStatus,
    default: WhatsAppProcessingStatus.RECEIVED,
  })
  processingStatus!: WhatsAppProcessingStatus;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  conversationState?: Record<string, unknown> | null;
}
