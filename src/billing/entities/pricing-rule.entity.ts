import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('pricing_rules')
@Index('idx_pricing_rules_company_active', ['companyId', 'active'])
export class PricingRule extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  companyId?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  firstKilometerPrice!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  additionalKilometerPrice!: string;

  @Column({ type: 'varchar', length: 3, default: 'RWF' })
  currency!: string;

  @Column({ type: 'timestamptz' })
  effectiveFrom!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  effectiveTo?: Date | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
