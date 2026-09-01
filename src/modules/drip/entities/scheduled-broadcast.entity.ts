import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { randomUUID } from 'crypto';
import { dateColumnType } from '../../../common/utils/column-types';
import { DateTransformer } from '../../../common/transformers/date.transformer';

export type ScheduledBroadcastStatus =
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type BroadcastTargetType = 'tags' | 'numbers' | 'all';

@Entity('scheduled_broadcasts')
export class ScheduledBroadcast {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_scheduled_broadcasts_sessionId')
  @Column({ type: 'varchar' })
  sessionId!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: dateColumnType(), transformer: DateTransformer })
  scheduledAt!: Date;

  @Column({ type: 'varchar', length: 50, default: 'scheduled' })
  status!: ScheduledBroadcastStatus;

  @Column({ type: 'varchar', length: 50, default: 'tags' })
  targetType!: BroadcastTargetType;

  @Column({ type: 'text' })
  targetAudience!: string; // Comma separated tags or phone numbers

  @Column({ type: 'text' })
  templateMessage!: string;

  @Column({ type: 'int', default: 3 })
  pacingDelaySeconds!: number;

  @Column({ type: 'int', default: 0 })
  totalRecipients!: number;

  @Column({ type: 'int', default: 0 })
  sentCount!: number;

  @Column({ type: 'int', default: 0 })
  failedCount!: number;

  @Column({ type: dateColumnType(), nullable: true, transformer: DateTransformer })
  executedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: dateColumnType(), transformer: DateTransformer })
  createdAt!: Date;

  @UpdateDateColumn({ type: dateColumnType(), transformer: DateTransformer })
  updatedAt!: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
