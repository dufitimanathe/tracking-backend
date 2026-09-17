import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  BillingDistanceSource,
  BillingPeriod,
  CompanyStatus,
} from '../../common/enums';

@Entity('companies')
export class Company extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  registrationNumber?: string | null;

  @Column({ type: 'varchar', length: 64, default: 'Africa/Kigali' })
  timezone!: string;

  @Column({ type: 'varchar', length: 3, default: 'RWF' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.ACTIVE,
  })
  status!: CompanyStatus;

  @Column({
    type: 'enum',
    enum: BillingPeriod,
    default: BillingPeriod.MONTHLY,
  })
  billingPeriod!: BillingPeriod;

  @Column({
    type: 'enum',
    enum: BillingDistanceSource,
    default: BillingDistanceSource.ROUTE_ESTIMATE,
  })
  billingDistanceSource!: BillingDistanceSource;
}
