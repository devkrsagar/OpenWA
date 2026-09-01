import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

const NAME_MAX_LENGTH = 100;
const BODY_MAX_LENGTH = 4096;
const HEADER_FOOTER_MAX_LENGTH = 1024;

export class CreateTemplateDto {
  @ApiProperty({
    description: 'Unique template name within the session',
    example: 'order-confirmation',
    maxLength: NAME_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({
    description: 'Template body with {{variable}} placeholders',
    example: 'Hi {{customer}}, your order {{orderId}} has shipped.',
    maxLength: BODY_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(BODY_MAX_LENGTH)
  body!: string;

  @ApiPropertyOptional({
    description: 'Optional header text, prepended to the rendered body',
    example: 'OpenWA Store',
    maxLength: HEADER_FOOTER_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(HEADER_FOOTER_MAX_LENGTH)
  header?: string;

  @ApiPropertyOptional({
    description: 'Optional footer text, appended to the rendered body',
    example: 'Reply STOP to unsubscribe.',
    maxLength: HEADER_FOOTER_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(HEADER_FOOTER_MAX_LENGTH)
  footer?: string;

  @ApiPropertyOptional({
    description: 'Meta template category (MARKETING, UTILITY, AUTHENTICATION)',
    enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
    default: 'MARKETING',
  })
  @IsOptional()
  @IsString()
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

  @ApiPropertyOptional({
    description: 'Template language code',
    default: 'en_US',
    example: 'en_US',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Whether to immediately submit this template to Meta for approval',
    default: false,
  })
  @IsOptional()
  submitToMeta?: boolean;

  @ApiPropertyOptional({
    description: 'Optional interactive buttons or structured components',
  })
  @IsOptional()
  components?: Record<string, unknown>[];
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({ description: 'Template name', maxLength: NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ description: 'Template body with {{variable}} placeholders', maxLength: BODY_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(BODY_MAX_LENGTH)
  body?: string;

  @ApiPropertyOptional({ description: 'Optional header text', maxLength: HEADER_FOOTER_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(HEADER_FOOTER_MAX_LENGTH)
  header?: string;

  @ApiPropertyOptional({ description: 'Optional footer text', maxLength: HEADER_FOOTER_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(HEADER_FOOTER_MAX_LENGTH)
  footer?: string;

  @ApiPropertyOptional({ enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] })
  @IsOptional()
  @IsString()
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

  @ApiPropertyOptional({ description: 'Template language code' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class TemplateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  header?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  footer?: string | null;

  @ApiPropertyOptional({ enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] })
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

  @ApiPropertyOptional({ type: String })
  language?: string;

  @ApiPropertyOptional({ enum: ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'LOCAL'] })
  status?: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'LOCAL';

  @ApiPropertyOptional({ type: String, nullable: true })
  metaTemplateId?: string | null;

  @ApiPropertyOptional()
  components?: Record<string, unknown>[] | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
