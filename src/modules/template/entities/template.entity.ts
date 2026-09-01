import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Session } from '../../session/entities/session.entity';

// One template name per session: makes resolve-by-name deterministic and rejects duplicates.
// Mirrored by the AddTemplateNameUnique migration for non-synchronize (Postgres / opted-out) DBs.
@Index('IDX_templates_session_name', ['sessionId', 'name'], { unique: true })
@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // varchar (not uuid) to match the authoritative migration DDL and sessions.id; the data connection
  // runs synchronize:false, so a 'uuid' decorator here would only mislead schema diffs / a stray sync.
  @Column({ type: 'varchar' })
  sessionId!: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session!: Session;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'text', nullable: true })
  header!: string | null;

  @Column({ type: 'text', nullable: true })
  footer!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'MARKETING' })
  category!: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

  @Column({ type: 'varchar', length: 20, default: 'en_US' })
  language!: string;

  @Column({ type: 'varchar', length: 30, default: 'LOCAL' })
  status!: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'LOCAL';

  @Column({ type: 'varchar', length: 100, nullable: true })
  metaTemplateId!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  components!: Record<string, unknown>[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
