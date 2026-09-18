import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { GeofenceType } from '../../common/enums';

@Entity('geofences')
@Index('idx_geofences_company', ['companyId', 'active'])
export class Geofence extends TenantEntity {
  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'enum', enum: GeofenceType, default: GeofenceType.OTHER })
  type!: GeofenceType;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  center!: string | object;

  @Column({ type: 'double precision', default: 100 })
  radiusMeters!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
