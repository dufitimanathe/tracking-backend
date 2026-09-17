import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { InvoiceStatus } from '../../common/enums';

@Entity('invoices')
@Index('idx_invoices_company_number', ['companyId', 'invoiceNumber'], {
  unique: true,
})
export class Invoice extends TenantEntity {
  @Column({ type: 'varchar', length: 50 })
  invoiceNumber!: string;

  @Column({ type: 'timestamptz' })
  periodStart!: Date;

  @Column({ type: 'timestamptz' })
  periodEnd!: Date;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status!: InvoiceStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  subtotal!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total!: string;

  @Column({ type: 'varchar', length: 3, default: 'RWF' })
  currency!: string;

  @Column({ type: 'timestamptz', nullable: true })
  issuedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;
}
