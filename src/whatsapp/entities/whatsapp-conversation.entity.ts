import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { WhatsAppConversationState } from '../../common/enums';

@Entity('whatsapp_conversations')
@Index('uq_whatsapp_conversations_phone', ['phone'], { unique: true })
@Index('idx_whatsapp_conversations_company', ['companyId', 'state'])
export class WhatsAppConversation extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  companyId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  employeeId?: string | null;

  @Column({ type: 'varchar', length: 30 })
  phone!: string;

  @Column({
    type: 'enum',
    enum: WhatsAppConversationState,
    default: WhatsAppConversationState.NEW,
  })
  state!: WhatsAppConversationState;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language?: string | null;

  /** Draft request fields while clarifying. */
  @Column({ type: 'jsonb', nullable: true })
  draft?: Record<string, unknown> | null;

  /** Pending Places candidates awaiting user selection. */
  @Column({ type: 'jsonb', nullable: true })
  pendingCandidates?: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  transportRequestId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt?: Date | null;
}
