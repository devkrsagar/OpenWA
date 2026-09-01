import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Plan } from './plan.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  TRIALING = 'trialing',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId?: string;

  @OneToOne(() => User, user => user.subscription, { onDelete: 'CASCADE' })
  user?: User;

  @Column({ type: 'varchar', length: 50, default: 'free' })
  planId!: string;

  @ManyToOne(() => Plan, { eager: true, nullable: true })
  @JoinColumn({ name: 'planId' })
  plan?: Plan;

  @Column({
    type: 'varchar',
    length: 20,
    default: BillingCycle.MONTHLY,
  })
  billingCycle!: BillingCycle;

  @Column({
    type: 'varchar',
    length: 20,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({ type: 'datetime', nullable: true })
  startDate?: Date;

  @Column({ type: 'datetime', nullable: true })
  endDate?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentReference?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
