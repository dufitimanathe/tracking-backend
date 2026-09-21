import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('transport_request_parsings')
@Index('idx_transport_request_parsings_company', ['companyId', 'createdAt'])
export class TransportRequestParsing extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  companyId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  employeeId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  whatsappMessageId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  transportRequestId?: string | null;

  @Column({ type: 'text' })
  originalText!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  intent?: string | null;

  @Column({ type: 'jsonb' })
  structured!: Record<string, unknown>;

  @Column({ type: 'double precision', default: 0 })
  confidence!: number;

  @Column({ type: 'boolean', default: false })
  needsClarification!: boolean;
}
