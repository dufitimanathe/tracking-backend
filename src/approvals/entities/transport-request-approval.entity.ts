import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApprovalAction } from '../../common/enums';

@Entity('transport_request_approvals')
@Index('idx_transport_request_approvals_request', ['requestId'])
export class TransportRequestApproval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'uuid' })
  requestId!: string;

  @Column({ type: 'uuid' })
  supervisorId!: string;

  @Column({ type: 'enum', enum: ApprovalAction })
  action!: ApprovalAction;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
