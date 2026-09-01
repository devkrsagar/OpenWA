import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject } from 'class-validator';

export class CreateContactDto {
  @ApiPropertyOptional({ description: 'Optional session ID scoping this contact' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({ description: 'Phone number in international or local format', example: '+15551234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ description: 'Contact full name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'john@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Audience tags', example: ['VIP', 'Lead'] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Custom key-value attributes', example: { company: 'Acme', city: 'NYC' } })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateContactDto {
  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Contact name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Audience tags' })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Custom attributes' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ImportContactRowDto {
  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ImportContactsDto {
  @ApiPropertyOptional({ description: 'Optional session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({ description: 'Array of contact rows to import', type: [ImportContactRowDto] })
  @IsArray()
  contacts!: ImportContactRowDto[];

  @ApiPropertyOptional({ description: 'Default tags to apply to all imported contacts', example: ['Imported_Sept2026'] })
  @IsOptional()
  @IsArray()
  defaultTags?: string[];
}

export class BulkTagDto {
  @ApiProperty({ description: 'Array of contact IDs to update', example: ['uuid1', 'uuid2'] })
  @IsArray()
  contactIds!: string[];

  @ApiPropertyOptional({ description: 'Tags to append' })
  @IsOptional()
  @IsArray()
  addTags?: string[];

  @ApiPropertyOptional({ description: 'Tags to remove' })
  @IsOptional()
  @IsArray()
  removeTags?: string[];
}

export class BulkDeleteDto {
  @ApiProperty({ description: 'Array of contact IDs to delete' })
  @IsArray()
  contactIds!: string[];
}
