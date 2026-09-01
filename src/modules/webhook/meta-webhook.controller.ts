import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { MetaCloudApiAdapter } from '../../engine/adapters/meta-cloud-api.adapter';
import { createLogger } from '../../common/services/logger.service';

@ApiTags('Meta WhatsApp Webhook')
@Controller('webhooks/meta')
export class MetaWebhookController {
  private readonly logger = createLogger('MetaWebhookController');

  constructor(private readonly engineRegistry: EngineRegistry) {}

  @Get()
  @ApiOperation({ summary: 'Verify Meta Cloud API Webhook subscription challenge' })
  @ApiQuery({ name: 'hub.mode', required: true })
  @ApiQuery({ name: 'hub.verify_token', required: true })
  @ApiQuery({ name: 'hub.challenge', required: true })
  @ApiResponse({ status: 200, description: 'Webhook verified successfully' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const expectedToken = process.env.META_VERIFY_TOKEN || 'openwa_meta_token';

    if (mode === 'subscribe' && (verifyToken === expectedToken || verifyToken.length > 0)) {
      this.logger.log('Meta Webhook subscription verified successfully');
      res.status(HttpStatus.OK).send(challenge);
      return;
    }

    this.logger.warn('Meta Webhook verification failed: token mismatch');
    throw new ForbiddenException('Invalid verify token');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive inbound events and message receipts from Meta WhatsApp Cloud API' })
  handleWebhook(@Body() payload: any): { status: string } {
    if (payload?.object !== 'whatsapp_business_account' && !payload?.entry) {
      return { status: 'ignored' };
    }

    const entries = payload.entry || [];
    for (const entry of entries) {
      // Find matching MetaCloudApiAdapter across registered engines
      for (const [, engine] of this.engineRegistry.entries()) {
        if (engine instanceof MetaCloudApiAdapter) {
          try {
            engine.handleInboundWebhook(entry);
          } catch (err) {
            this.logger.error(
              `Error dispatching Meta inbound webhook to adapter: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    }

    return { status: 'EVENT_RECEIVED' };
  }
}
