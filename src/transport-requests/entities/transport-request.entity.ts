import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import {
  TransportRequestChannel,
  TransportRequestStatus,
} from '../../common/enums';

@Entity('transport_requests')
@Index('idx_transport_requests_company_status', ['companyId', 'status'])
export class TransportRequest extends TenantEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @Column({ type: 'uuid', nullable: true })
  createdById?: string | null;

  @Column({ type: 'text' })
  pickupAddress!: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  pickupLocation?: string | object | null;

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
    nullable: true,
  })
  destinationLocation?: string | object | null;

  @Column({ type: 'double precision' })
  destinationLatitude!: number;

  @Column({ type: 'double precision' })
  destinationLongitude!: number;

  @Column({ type: 'timestamptz' })
  requestedAt!: Date;

  @Column({ type: 'timestamptz' })
  requestedPickupTime!: Date;

  @Column({ type: 'enum', enum: TransportRequestChannel })
  channel!: TransportRequestChannel;

  @Column({
    type: 'enum',
    enum: TransportRequestStatus,
    default: TransportRequestStatus.PENDING_CONFIRMATION,
  })
  status!: TransportRequestStatus;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  estimatedDistanceKm?: string | null;

  @Column({ type: 'int', nullable: true })
  estimatedDurationMinutes?: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  estimatedPrice?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pickupPlaceId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  destinationPlaceId?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pickupDisplayName?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  destinationDisplayName?: string | null;

  @Column({ type: 'boolean', default: false })
  aiAssisted!: boolean;
}
