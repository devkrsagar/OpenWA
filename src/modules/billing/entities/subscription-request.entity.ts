import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Plan } from './plan.entity';
import { BillingCycle } from './subscription.entity';

export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
}

export enum PaymentMethod {
  RAZORPAY = 'razorpay',
  MANUAL = 'manual',
}

@Entity('subscription_requests')
export class SubscriptionRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 50 })
  planId!: string;

  @ManyToOne(() => Plan, { eager: true })
  @JoinColumn({ name: 'planId' })
  plan?: Plan;

  @Column({
    type: 'varchar',
    length: 20,
    default: BillingCycle.MONTHLY,
  })
  billingCycle!: BillingCycle;

  @Column({ type: 'float', default: 0 })
  amount!: number;

  @Column({
    type: 'varchar',
    length: 30,
    default: PaymentMethod.MANUAL,
  })
  paymentMethod!: PaymentMethod;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpayOrderId?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpayPaymentId?: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: RequestStatus.PENDING,
  })
  status!: RequestStatus;

  @Column({ type: 'text', nullable: true })
  adminNotes?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
