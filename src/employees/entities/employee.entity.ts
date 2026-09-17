import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { EmployeeStatus } from '../../common/enums';

@Entity('employees')
@Index('idx_employees_company_phone', ['companyId', 'phone'], { unique: true })
export class Employee extends TenantEntity {
  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ type: 'varchar', length: 30 })
  phone!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  employeeCode?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string | null;

  @Column({ type: 'uuid', nullable: true })
  supervisorId?: string | null;

  @Column({ type: 'boolean', default: true })
  canRequestTransport!: boolean;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.ACTIVE,
  })
  status!: EmployeeStatus;
}
