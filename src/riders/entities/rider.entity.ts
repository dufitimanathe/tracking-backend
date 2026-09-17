import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import {
  RiderAvailabilityStatus,
  RiderStatus,
} from '../../common/enums';

@Entity('riders')
export class Rider extends TenantEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 30 })
  phone!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  licenseNumber?: string | null;

  @Column({
    type: 'enum',
    enum: RiderStatus,
    default: RiderStatus.ACTIVE,
  })
  status!: RiderStatus;

  @Column({
    type: 'enum',
    enum: RiderAvailabilityStatus,
    default: RiderAvailabilityStatus.OFFLINE,
  })
  availabilityStatus!: RiderAvailabilityStatus;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  currentLatitude?: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  currentLongitude?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  locationUpdatedAt?: Date | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  position?: string | object | null;
}
