import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

@Entity('rider_motorcycle_assignments')
@Index('idx_rma_active_motorcycle', ['companyId', 'motorcycleId'], {
  unique: true,
  where: '"active" = true',
})
@Index('idx_rma_active_rider', ['companyId', 'riderId'], {
  unique: true,
  where: '"active" = true',
})
export class RiderMotorcycleAssignment extends TenantEntity {
  @Column({ type: 'uuid' })
  riderId!: string;

  @Column({ type: 'uuid' })
  motorcycleId!: string;

  @Column({ type: 'uuid' })
  assignedById!: string;

  @Column({ type: 'timestamptz' })
  assignedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  unassignedAt?: Date | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
