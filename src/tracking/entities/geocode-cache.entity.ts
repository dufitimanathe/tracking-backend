import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('geocode_cache')
export class GeocodeCache extends BaseEntity {
  @Column({ type: 'varchar', length: 16, unique: true })
  geohash!: string;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  formattedAddress?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  placeId?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  locality?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  adminArea?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country?: string | null;
}
