import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('invoice_lines')
@Index('idx_invoice_lines_invoice', ['invoiceId'])
export class InvoiceLine extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId!: string;

  @Column({ type: 'uuid', nullable: true })
  billingRecordId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  tripId?: string | null;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 3, default: 'RWF' })
  currency!: string;
}
