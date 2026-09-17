import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LocationSource } from '../../common/enums';

@Entity('motorcycle_current_locations')
@Index('idx_mcl_company_id', ['companyId'])
export class MotorcycleCurrentLocation {
  @PrimaryColumn({ type: 'uuid' })
  motorcycleId!: string;

  @Column({ type: 'uuid' })
  companyId!: string;

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

  @Column({ type: 'enum', enum: LocationSource })
  source!: LocationSource;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz' })
  recordedAt!: Date;
}
