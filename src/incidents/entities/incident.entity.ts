import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
} from '../../common/enums';

@Entity('incidents')
@Index('idx_incidents_company_status', ['companyId', 'status'])
@Index('idx_incidents_motorcycle_type', ['motorcycleId', 'type'])
export class Incident extends TenantEntity {
  @Column({ type: 'uuid', nullable: true })
  motorcycleId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  riderId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  tripId?: string | null;

  @Column({ type: 'enum', enum: IncidentType })
  type!: IncidentType;

  @Column({
    type: 'enum',
    enum: IncidentSeverity,
    default: IncidentSeverity.MEDIUM,
  })
  severity!: IncidentSeverity;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.OPEN,
  })
  status!: IncidentStatus;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'timestamptz' })
  detectedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  acknowledgedById?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedById?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;
}
