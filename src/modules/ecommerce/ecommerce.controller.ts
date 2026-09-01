import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiSecurity } from '@nestjs/swagger';
import { Public } from '../auth/decorators/auth.decorators';
import { EcommerceService } from './ecommerce.service';
import {
  CreateEcommerceAutomationDto,
  UpdateEcommerceAutomationDto,
  TestEcommerceWebhookDto,
} from './dto/ecommerce.dto';

@ApiTags('ecommerce')
@Controller()
export class EcommerceController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  @Get('sessions/:sessionId/ecommerce')
  @ApiSecurity('api_key')
  @ApiOperation({ summary: 'List all E-Commerce automations for session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async listAutomations(@Param('sessionId') sessionId: string) {
    return this.ecommerceService.findAll(sessionId);
  }

  @Post('sessions/:sessionId/ecommerce')
  @ApiSecurity('api_key')
  @ApiOperation({ summary: 'Create new E-Commerce automation' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async createAutomation(
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateEcommerceAutomationDto,
  ) {
    return this.ecommerceService.create(sessionId, dto);
  }

  @Put('sessions/:sessionId/ecommerce/:id')
  @ApiSecurity('api_key')
  @ApiOperation({ summary: 'Update E-Commerce automation' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'id', description: 'Automation ID' })
  async updateAutomation(
    @Param('id') id: string,
    @Body() dto: UpdateEcommerceAutomationDto,
  ) {
    return this.ecommerceService.update(id, dto);
  }

  @Delete('sessions/:sessionId/ecommerce/:id')
  @ApiSecurity('api_key')
  @ApiOperation({ summary: 'Delete E-Commerce automation' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'id', description: 'Automation ID' })
  async deleteAutomation(@Param('id') id: string) {
    await this.ecommerceService.remove(id);
    return { success: true };
  }

  @Get('sessions/:sessionId/ecommerce/logs')
  @ApiSecurity('api_key')
  @ApiOperation({ summary: 'Get execution audit logs for session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async getLogs(
    @Param('sessionId') sessionId: string,
    @Query('automationId') automationId?: string,
  ) {
    return this.ecommerceService.getLogs(sessionId, automationId);
  }

  @Public()
  @Post('ecommerce/webhook/:automationId')
  @ApiOperation({ summary: 'Public Webhook Receiver for Shopify / WooCommerce / Stripe / CRMs' })
  @ApiParam({ name: 'automationId', description: 'Automation ID' })
  @ApiResponse({ status: 200, description: 'Webhook acknowledged and processed' })
  async receiveWebhook(
    @Param('automationId') automationId: string,
    @Body() payload: Record<string, any>,
  ) {
    return this.ecommerceService.handleWebhook(automationId, payload);
  }

  @Post('ecommerce/test')
  @ApiSecurity('api_key')
  @ApiOperation({ summary: 'Test webhook payload simulator' })
  @ApiResponse({ status: 200, description: 'Simulated output' })
  async testSimulator(@Body() dto: TestEcommerceWebhookDto) {
    return this.ecommerceService.testSimulator(dto);
  }
}
