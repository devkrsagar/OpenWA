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
import { jsonColumnType } from '../../../common/utils/column-types';

export type AiProvider = 'openai' | 'gemini' | 'claude' | 'custom';

@Entity('ai_bot_config')
export class AiBotConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_ai_bot_config_sessionId', { unique: true })
  @Column({ type: 'varchar', unique: true })
  sessionId!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 50, default: 'openai' })
  provider!: AiProvider;

  @Column({ type: 'text', nullable: true })
  apiKey!: string | null;

  @Column({ type: 'varchar', length: 100, default: 'gpt-4o-mini' })
  model!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  baseUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  systemPrompt!: string | null;

  @Column({ type: 'float', default: 0.7 })
  temperature!: number;

  @Column({ type: 'int', default: 800 })
  maxTokens!: number;

  @Column({ type: 'int', default: 10 })
  memoryDepth!: number;

  @Column({ type: jsonColumnType(), nullable: true })
  humanHandoffKeywords!: string[] | null;

  @Column({ type: 'boolean', default: true })
  excludeGroups!: boolean;

  @Column({ type: 'int', default: 2 })
  typingDelaySeconds!: number;

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
