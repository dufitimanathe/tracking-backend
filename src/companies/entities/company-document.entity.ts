import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import {
  CompanyDocumentStatus,
  CompanyDocumentType,
} from '../../common/enums';

@Entity('company_documents')
export class CompanyDocument extends TenantEntity {
  @Index()
  @Column({
    type: 'enum',
    enum: CompanyDocumentType,
  })
  type!: CompanyDocumentType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 1000 })
  fileUrl!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({
    type: 'enum',
    enum: CompanyDocumentStatus,
    default: CompanyDocumentStatus.SUBMITTED,
  })
  status!: CompanyDocumentStatus;

  @Column({ type: 'text', nullable: true })
  reviewNotes?: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedByUserId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  uploadedByUserId?: string | null;
}
