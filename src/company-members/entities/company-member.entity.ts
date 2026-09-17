import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { MembershipStatus, UserRole } from '../../common/enums';

@Entity('company_members')
@Index('idx_company_members_user_company', ['userId', 'companyId'], {
  unique: true,
})
export class CompanyMember extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.INVITED,
  })
  status!: MembershipStatus;

  @Column({ type: 'timestamptz' })
  joinedAt!: Date;
}
