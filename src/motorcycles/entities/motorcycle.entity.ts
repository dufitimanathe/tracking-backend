import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import {
  MotorcycleStatus,
  MotorcycleTrackingStatus,
} from '../../common/enums';

@Entity('motorcycles')
@Index('idx_motorcycles_company_plate', ['companyId', 'plateNumber'], {
  unique: true,
})
export class Motorcycle extends TenantEntity {
  @Column({ type: 'varchar', length: 30 })
  plateNumber!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  internalCode?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string | null;

  @Column({ type: 'int', nullable: true })
  year?: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color?: string | null;

  @Column({
    type: 'enum',
    enum: MotorcycleStatus,
    default: MotorcycleStatus.ACTIVE,
  })
  status!: MotorcycleStatus;

  @Column({
    type: 'enum',
    enum: MotorcycleTrackingStatus,
    default: MotorcycleTrackingStatus.OFFLINE,
  })
  trackingStatus!: MotorcycleTrackingStatus;
}
