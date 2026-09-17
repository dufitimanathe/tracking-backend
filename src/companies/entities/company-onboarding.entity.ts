import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('company_onboarding')
export class CompanyOnboarding extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  companyId!: string;

  @Column({ type: 'boolean', default: false })
  companyProfileCompleted!: boolean;

  @Column({ type: 'boolean', default: false })
  operationalSettingsCompleted!: boolean;

  @Column({ type: 'boolean', default: false })
  fleetAdded!: boolean;

  @Column({ type: 'boolean', default: false })
  teamAdded!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;
}
