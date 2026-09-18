import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

@Entity('driver_stops')
@Index('idx_driver_stops_session', ['trackingSessionId', 'startedAt'])
@Index('idx_driver_stops_company', ['companyId', 'startedAt'])
export class DriverStop extends TenantEntity {
  @Column({ type: 'uuid' })
  riderId!: string;

  @Column({ type: 'uuid' })
  motorcycleId!: string;

  @Column({ type: 'uuid' })
  trackingSessionId!: string;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location!: string | object;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt?: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds?: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address?: string | null;
}
