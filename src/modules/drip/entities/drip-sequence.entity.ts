import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  OneToMany,
} from 'typeorm';
import { randomUUID } from 'crypto';
import { dateColumnType } from '../../../common/utils/column-types';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { DripStep } from './drip-step.entity';

@Entity('drip_sequences')
export class DripSequence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_drip_sequences_sessionId')
  @Column({ type: 'varchar' })
  sessionId!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 100 })
  triggerTag!: string; // Contact tag that triggers auto-enrollment

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'int', default: 0 })
  totalEnrolled!: number;

  @Column({ type: 'int', default: 0 })
  totalCompleted!: number;

  @OneToMany(() => DripStep, (step: DripStep) => step.sequence, { cascade: true })
  steps!: DripStep[];

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
