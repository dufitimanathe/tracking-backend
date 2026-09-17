import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { GPSDeviceStatus } from '../../common/enums';

@Entity('gps_devices')
export class GpsDevice extends TenantEntity {
  @Column({ type: 'uuid' })
  motorcycleId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider?: string | null;

  @Column({ type: 'varchar', length: 255 })
  externalDeviceId!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  imei?: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  simNumber?: string | null;

  @Column({
    type: 'enum',
    enum: GPSDeviceStatus,
    default: GPSDeviceStatus.INACTIVE,
  })
  status!: GPSDeviceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt?: Date | null;
}
