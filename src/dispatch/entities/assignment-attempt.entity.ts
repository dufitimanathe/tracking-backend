import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { AssignmentMethod } from '../../common/enums';

@Entity('assignment_attempts')
@Index('idx_assignment_attempts_trip', ['tripId', 'createdAt'])
@Index('idx_assignment_attempts_company', ['companyId', 'createdAt'])
export class AssignmentAttempt extends TenantEntity {
  @Column({ type: 'uuid' })
  tripId!: string;

  @Column({ type: 'uuid', nullable: true })
  transportRequestId?: string | null;

  @Column({ type: 'jsonb', default: [] })
  candidates!: Array<Record<string, unknown>>;

  @Column({ type: 'uuid', nullable: true })
  selectedRiderId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  selectedMotorcycleId?: string | null;

  @Column({ type: 'enum', enum: AssignmentMethod })
  method!: AssignmentMethod;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'boolean', default: false })
  success!: boolean;
}
