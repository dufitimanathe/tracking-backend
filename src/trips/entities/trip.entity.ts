import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { TripStatus } from '../../common/enums';

@Entity('trips')
@Index('idx_trips_company_status', ['companyId', 'status'])
@Index('idx_trips_transport_request', ['transportRequestId'], { unique: true })
export class Trip extends TenantEntity {
  @Column({ type: 'uuid' })
  transportRequestId!: string;

  @Column({ type: 'uuid' })
  employeeId!: string;

  @Column({ type: 'uuid', nullable: true })
  riderId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  motorcycleId?: string | null;

  @Column({
    type: 'enum',
    enum: TripStatus,
    default: TripStatus.SEARCHING_RIDER,
  })
  status!: TripStatus;

  @Column({ type: 'text' })
  pickupAddress!: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  pickupLocation!: string | object;

  @Column({ type: 'double precision' })
  pickupLatitude!: number;

  @Column({ type: 'double precision' })
  pickupLongitude!: number;

  @Column({ type: 'text' })
  destinationAddress!: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  destinationLocation!: string | object;

  @Column({ type: 'double precision' })
  destinationLatitude!: number;

  @Column({ type: 'double precision' })
  destinationLongitude!: number;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  estimatedDistanceKm?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  actualDistanceKm?: string | null;

  @Column({ type: 'int', nullable: true })
  estimatedDurationMinutes?: number | null;

  @Column({ type: 'int', nullable: true })
  actualDurationMinutes?: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  estimatedPrice?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  finalPrice?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  assignedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  arrivedAtPickupAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;
}
