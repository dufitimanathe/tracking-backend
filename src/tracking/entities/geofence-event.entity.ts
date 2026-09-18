import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { GeofenceEventType } from '../../common/enums';

@Entity('geofence_events')
@Index('idx_geofence_events_company', ['companyId', 'occurredAt'])
@Index('idx_geofence_events_geofence', ['geofenceId', 'occurredAt'])
export class GeofenceEvent extends TenantEntity {
  @Column({ type: 'uuid' })
  geofenceId!: string;

  @Column({ type: 'uuid' })
  riderId!: string;

  @Column({ type: 'uuid' })
  motorcycleId!: string;

  @Column({ type: 'uuid', nullable: true })
  trackingSessionId?: string | null;

  @Column({ type: 'enum', enum: GeofenceEventType })
  type!: GeofenceEventType;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ type: 'timestamptz' })
  occurredAt!: Date;
}
