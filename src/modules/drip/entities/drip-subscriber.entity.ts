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

export type DripSubscriberStatus =
  | 'active'
  | 'completed'
  | 'unsubscribed'
  | 'failed';

@Entity('drip_subscribers')
@Index('IDX_drip_subscribers_seq_phone', ['sequenceId', 'phone'])
export class DripSubscriber {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_drip_subscribers_sequenceId')
  @Column({ type: 'varchar' })
  sequenceId!: string;

  @Index('IDX_drip_subscribers_sessionId')
  @Column({ type: 'varchar' })
  sessionId!: string;

  @Column({ type: 'varchar', length: 50 })
  phone!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  contactName!: string | null;

  @Column({ type: 'int', default: 1 })
  currentStep!: number; // 1-indexed

  @Column({ type: dateColumnType(), transformer: DateTransformer })
  nextRunAt!: Date;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: DripSubscriberStatus;

  @Column({ type: dateColumnType(), nullable: true, transformer: DateTransformer })
  lastMessageSentAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

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
