import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ToStrictBoolean, ToStrictNumber } from '../../../common/utils/strict-boolean';

export class CreateEcommerceAutomationDto {
  @ApiProperty({ description: 'Automation title' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ enum: ['shopify', 'woocommerce', 'stripe', 'custom'], default: 'shopify' })
  @IsString()
  platform!: string;

  @ApiProperty({
    enum: ['abandoned_cart', 'order_created', 'order_fulfilled', 'payment_received', 'custom_webhook'],
    default: 'order_created',
  })
  @IsString()
  eventType!: string;

  @ApiPropertyOptional({ description: 'Optional secret token for verifying webhooks' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  webhookSecret?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @ToStrictBoolean()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Custom JSON path for phone (e.g. customer.phone)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  phoneFieldPath?: string | null;

  @ApiProperty({ description: 'Message template with dynamic variables' })
  @IsString()
  templateMessage!: string;

  @ApiPropertyOptional({ description: 'Delay in minutes before sending (e.g. for abandoned cart)', default: 0 })
  @IsOptional()
  @ToStrictNumber()
  @IsInt()
  @Min(0)
  delayMinutes?: number;
}

export class UpdateEcommerceAutomationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ enum: ['shopify', 'woocommerce', 'stripe', 'custom'] })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({
    enum: ['abandoned_cart', 'order_created', 'order_fulfilled', 'payment_received', 'custom_webhook'],
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  webhookSecret?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ToStrictBoolean()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  phoneFieldPath?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToStrictNumber()
  @IsInt()
  @Min(0)
  delayMinutes?: number;
}

export class TestEcommerceWebhookDto {
  @ApiProperty({ enum: ['shopify', 'woocommerce', 'stripe', 'custom'] })
  @IsString()
  platform!: string;

  @ApiProperty({
    enum: ['abandoned_cart', 'order_created', 'order_fulfilled', 'payment_received', 'custom_webhook'],
  })
  @IsString()
  eventType!: string;

  @ApiProperty({ description: 'Template message with variables to evaluate' })
  @IsString()
  templateMessage!: string;

  @ApiProperty({ description: 'Sample JSON payload' })
  @IsObject()
  payload!: Record<string, any>;
}
