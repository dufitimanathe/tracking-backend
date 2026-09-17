import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TripEventType } from '../../common/enums';

@Entity('trip_events')
@Index('idx_trip_events_trip_created', ['tripId', 'createdAt'])
export class TripEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'uuid' })
  tripId!: string;

  @Column({ type: 'enum', enum: TripEventType })
  type!: TripEventType;

  @Column({ type: 'uuid', nullable: true })
  actorId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
