import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ToStrictBoolean, ToStrictNumber } from '../../../common/utils/strict-boolean';
import type { AiProvider } from '../entities/ai-bot-config.entity';

export class SaveAiBotConfigDto {
  @ApiPropertyOptional({ description: 'Enable or pause AI auto-responder for this session' })
  @IsOptional()
  @ToStrictBoolean()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ['openai', 'gemini', 'claude', 'custom'], default: 'openai' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ description: 'API Key for LLM provider' })
  @IsOptional()
  @IsString()
  apiKey?: string | null;

  @ApiPropertyOptional({ description: 'Model name', default: 'gpt-4o-mini' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ description: 'Custom OpenAI-compatible base URL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseUrl?: string | null;

  @ApiPropertyOptional({ description: 'Business identity and persona instructions' })
  @IsOptional()
  @IsString()
  systemPrompt?: string | null;

  @ApiPropertyOptional({ description: 'Creativity temperature (0.0 to 1.0)', default: 0.7 })
  @IsOptional()
  @ToStrictNumber()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Max completion tokens', default: 800 })
  @IsOptional()
  @ToStrictNumber()
  @IsInt()
  @Min(50)
  @Max(4096)
  maxTokens?: number;

  @ApiPropertyOptional({ description: 'Number of past messages to include as memory', default: 10 })
  @IsOptional()
  @ToStrictNumber()
  @IsInt()
  @Min(0)
  @Max(50)
  memoryDepth?: number;

  @ApiPropertyOptional({ description: 'Keywords that trigger handoff to human agent' })
  @IsOptional()
  humanHandoffKeywords?: string[] | null;

  @ApiPropertyOptional({ description: 'Exclude group chats', default: true })
  @IsOptional()
  @ToStrictBoolean()
  @IsBoolean()
  excludeGroups?: boolean;

  @ApiPropertyOptional({ description: 'Simulated typing delay in seconds', default: 2 })
  @IsOptional()
  @ToStrictNumber()
  @IsInt()
  @Min(0)
  @Max(10)
  typingDelaySeconds?: number;
}

export class TestAiPromptDto {
  @ApiProperty({ enum: ['openai', 'gemini', 'claude', 'custom'] })
  @IsString()
  provider!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiProperty()
  @IsString()
  model!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({ default: 0.7 })
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional({ default: 500 })
  @IsOptional()
  @IsInt()
  maxTokens?: number;

  @ApiProperty({ description: 'Incoming message to test' })
  @IsString()
  message!: string;

  @ApiPropertyOptional({ description: 'Conversation history' })
  @IsOptional()
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}
