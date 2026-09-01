import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { randomUUID } from 'crypto';
import { dateColumnType } from '../../../common/utils/column-types';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { DripSequence } from './drip-sequence.entity';

@Entity('drip_steps')
export class DripStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_drip_steps_sequenceId')
  @Column({ type: 'varchar' })
  sequenceId!: string;

  @ManyToOne(() => DripSequence, sequence => sequence.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sequenceId' })
  sequence!: DripSequence;

  @Column({ type: 'int', default: 1 })
  stepOrder!: number; // 1, 2, 3...

  @Column({ type: 'int', default: 0 })
  delayHours!: number; // Delay in hours from previous step / enrollment

  @Column({ type: 'text' })
  templateMessage!: string;

  @Column({ type: 'int', default: 0 })
  sentCount!: number;

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
