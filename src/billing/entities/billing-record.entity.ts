import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { BillingStatus } from '../../common/enums';

@Entity('billing_records')
@Index('idx_billing_records_trip', ['tripId'], { unique: true })
export class BillingRecord extends TenantEntity {
  @Column({ type: 'uuid', unique: true })
  tripId!: string;

  @Column({ type: 'uuid' })
  employeeId!: string;

  @Column({ type: 'uuid' })
  riderId!: string;

  @Column({ type: 'uuid' })
  motorcycleId!: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  distanceKm!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  firstKmCharge!: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  additionalKm!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  additionalKmCharge!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  totalAmount!: string;

  @Column({ type: 'varchar', length: 3, default: 'RWF' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: BillingStatus,
    default: BillingStatus.PENDING,
  })
  billingStatus!: BillingStatus;
}
