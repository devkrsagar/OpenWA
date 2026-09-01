import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('gateway_settings')
export class GatewaySetting {
  @PrimaryColumn({ type: 'varchar', length: 50, default: 'razorpay' })
  id!: string; // 'razorpay'

  @Column({ type: 'boolean', default: false })
  isEnabled!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  keyId?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  keySecret?: string | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
