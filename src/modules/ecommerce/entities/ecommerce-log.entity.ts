import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { randomUUID } from 'crypto';

@Entity('ecommerce_logs')
export class EcommerceLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_ecommerce_logs_automationId')
  @Column({ type: 'varchar' })
  automationId!: string;

  @Index('IDX_ecommerce_logs_sessionId')
  @Column({ type: 'varchar' })
  sessionId!: string;

  @Column({ type: 'varchar', length: 50 })
  eventType!: string;

  @Column({ type: 'varchar', length: 50 })
  platform!: string;

  @Column({ type: 'varchar', length: 100 })
  recipientPhone!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  orderId!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  customerName!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'delivered' })
  status!: 'delivered' | 'failed' | 'skipped';

  @Column({ type: 'text', nullable: true })
  variablesJson!: string | null;

  @Column({ type: 'text', nullable: true })
  messageText!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
