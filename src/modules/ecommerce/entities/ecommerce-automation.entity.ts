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

export type EcommercePlatform = 'shopify' | 'woocommerce' | 'stripe' | 'custom';
export type EcommerceEventType =
  | 'abandoned_cart'
  | 'order_created'
  | 'order_fulfilled'
  | 'payment_received'
  | 'custom_webhook';

@Entity('ecommerce_automations')
export class EcommerceAutomation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_ecommerce_automations_sessionId')
  @Column({ type: 'varchar' })
  sessionId!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 50, default: 'shopify' })
  platform!: EcommercePlatform;

  @Column({ type: 'varchar', length: 50, default: 'order_created' })
  eventType!: EcommerceEventType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  webhookSecret!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phoneFieldPath!: string | null;

  @Column({ type: 'text' })
  templateMessage!: string;

  @Column({ type: 'int', default: 0 })
  delayMinutes!: number;

  @Column({ type: 'int', default: 0 })
  triggerCount!: number;

  @Column({ type: dateColumnType(), nullable: true, transformer: DateTransformer })
  lastTriggeredAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
