import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum OtpType {
  SIGNUP = 'signup',
  PASSWORD_RESET = 'password_reset',
  LOGIN = 'login',
}

@Entity('otp_verifications')
export class OtpVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  codeHash!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: OtpType.SIGNUP,
  })
  type!: OtpType;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'datetime' })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
