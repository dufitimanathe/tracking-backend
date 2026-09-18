import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import {
  TrackingMovementState,
  TrackingSessionStatus,
} from '../../common/enums';

@Entity('tracking_sessions')
@Index('idx_tracking_sessions_company_started', ['companyId', 'startedAt'])
@Index('idx_tracking_sessions_rider_status', ['riderId', 'status'])
@Index('idx_tracking_sessions_motorcycle_started', ['motorcycleId', 'startedAt'])
export class TrackingSession extends TenantEntity {
  @Column({ type: 'uuid' })
  riderId!: string;

  @Column({ type: 'uuid' })
  motorcycleId!: string;

  @Column({ type: 'uuid', nullable: true })
  tripId?: string | null;

  @Column({
    type: 'enum',
    enum: TrackingSessionStatus,
    default: TrackingSessionStatus.ACTIVE,
  })
  status!: TrackingSessionStatus;

  @Column({
    type: 'enum',
    enum: TrackingMovementState,
    default: TrackingMovementState.TRACKING,
  })
  movementState!: TrackingMovementState;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLocationAt?: Date | null;

  @Column({ type: 'double precision', nullable: true })
  startLatitude?: number | null;

  @Column({ type: 'double precision', nullable: true })
  startLongitude?: number | null;

  @Column({ type: 'double precision', nullable: true })
  endLatitude?: number | null;

  @Column({ type: 'double precision', nullable: true })
  endLongitude?: number | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  startLocation?: string | object | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  endLocation?: string | object | null;

  @Column({ type: 'double precision', default: 0 })
  totalDistanceMeters!: number;

  @Column({ type: 'int', default: 0 })
  movingDurationSeconds!: number;

  @Column({ type: 'int', default: 0 })
  stoppedDurationSeconds!: number;

  @Column({ type: 'double precision', nullable: true })
  maxSpeed?: number | null;

  @Column({ type: 'double precision', nullable: true })
  averageSpeed?: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  startAddress?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  endAddress?: string | null;
}
