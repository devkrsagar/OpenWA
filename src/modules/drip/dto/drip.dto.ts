import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsDateString,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScheduledBroadcastDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;

  @IsIn(['tags', 'numbers', 'all'])
  targetType!: 'tags' | 'numbers' | 'all';

  @IsString()
  @IsNotEmpty()
  targetAudience!: string;

  @IsString()
  @IsNotEmpty()
  templateMessage!: string;

  @IsInt()
  @IsOptional()
  pacingDelaySeconds?: number;
}

export class DripStepDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsInt()
  stepOrder!: number;

  @IsInt()
  delayHours!: number;

  @IsString()
  @IsNotEmpty()
  templateMessage!: string;
}

export class CreateDripSequenceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  triggerTag!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DripStepDto)
  steps!: DripStepDto[];
}

export class UpdateDripSequenceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  triggerTag?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DripStepDto)
  steps?: DripStepDto[];
}

export class EnrollDripSubscriberDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsOptional()
  contactName?: string;
}
