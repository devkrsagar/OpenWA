import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiSecurity } from '@nestjs/swagger';
import type { Response } from 'express';
import { BulkMessageService } from './bulk-message.service';

@ApiTags('campaigns')
@ApiSecurity('api_key')
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly bulkMessageService: BulkMessageService) {}

  @Get()
  @ApiOperation({ summary: 'List all broadcast campaigns' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Filter by session ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (completed, processing, failed, etc.)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page limit (default 20)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Page offset (default 0)' })
  @ApiResponse({ status: 200, description: 'List of campaigns with summary stats' })
  async listCampaigns(
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.bulkMessageService.listCampaigns({
      sessionId,
      status,
      limit,
      offset,
    });
  }

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Get global campaign performance analytics overview' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Filter by session ID' })
  @ApiResponse({ status: 200, description: 'Campaign performance metrics' })
  async getOverview(@Query('sessionId') sessionId?: string) {
    return this.bulkMessageService.getCampaignAnalyticsOverview(sessionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed campaign report with recipient delivery logs' })
  @ApiParam({ name: 'id', description: 'Campaign/Batch ID or UUID' })
  @ApiResponse({ status: 200, description: 'Full campaign details and recipient breakdown' })
  async getCampaignDetails(@Param('id') id: string) {
    return this.bulkMessageService.getCampaignDetails(id);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export campaign recipient delivery report as CSV' })
  @ApiParam({ name: 'id', description: 'Campaign/Batch ID or UUID' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportCsv(@Param('id') id: string, @Res() res: Response) {
    const csvContent = await this.bulkMessageService.exportCampaignCsv(id);
    const filename = `campaign-${id}-report-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  }
}
