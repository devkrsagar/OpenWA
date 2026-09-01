import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id!: string; // 'free', 'starter', 'pro', 'enterprise'

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'float', default: 0 })
  monthlyPrice!: number;

  @Column({ type: 'float', default: 0 })
  yearlyPrice!: number;

  @Column({ type: 'integer', default: 1 })
  maxSessions!: number;

  @Column({ type: 'integer', default: 1000 })
  maxMessagesPerMonth!: number;

  @Column({ type: 'simple-json', nullable: true })
  features?: string[];

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
