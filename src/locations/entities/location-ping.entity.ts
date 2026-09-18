import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { LocationSource } from '../../common/enums';

@Entity('location_pings')
@Index('idx_location_pings_company_id', ['companyId'])
@Index('idx_location_pings_motorcycle_id', ['motorcycleId'])
@Index('idx_location_pings_recorded_at', ['recordedAt'])
@Index('idx_location_pings_company_recorded', ['companyId', 'recordedAt'])
@Index('idx_location_pings_session_recorded', ['trackingSessionId', 'recordedAt'])
@Index('idx_location_pings_rider_recorded', ['riderId', 'recordedAt'])
export class LocationPing extends TenantEntity {
  @Column({ type: 'uuid' })
  motorcycleId!: string;

  @Column({ type: 'uuid', nullable: true })
  riderId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  tripId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  trackingSessionId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  clientLocationId?: string | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  position!: string | object;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ type: 'double precision', nullable: true })
  speed?: number | null;

  @Column({ type: 'double precision', nullable: true })
  heading?: number | null;

  @Column({ type: 'double precision', nullable: true })
  accuracy?: number | null;

  @Column({ type: 'double precision', nullable: true })
  altitude?: number | null;

  @Column({ type: 'boolean', nullable: true })
  ignition?: boolean | null;

  @Column({ type: 'enum', enum: LocationSource })
  source!: LocationSource;

  @Column({ type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ type: 'timestamptz' })
  receivedAt!: Date;
}
