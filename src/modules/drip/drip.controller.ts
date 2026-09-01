import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { DripService } from './drip.service';
import {
  CreateScheduledBroadcastDto,
  CreateDripSequenceDto,
  UpdateDripSequenceDto,
  EnrollDripSubscriberDto,
} from './dto/drip.dto';

@ApiTags('Scheduled Broadcasts & Drip Sequences')
@ApiSecurity('api_key')
@Controller()
export class DripController {
  constructor(private readonly dripService: DripService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // ⏰ Scheduled Broadcasts
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('sessions/:sessionId/scheduled-broadcasts')
  @ApiOperation({ summary: 'List all scheduled broadcasts for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async getScheduledBroadcasts(@Param('sessionId') sessionId: string) {
    return this.dripService.getScheduledBroadcasts(sessionId);
  }

  @Post('sessions/:sessionId/scheduled-broadcasts')
  @ApiOperation({ summary: 'Schedule a new broadcast campaign' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async createScheduledBroadcast(
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateScheduledBroadcastDto,
  ) {
    return this.dripService.createScheduledBroadcast(sessionId, dto);
  }

  @Post('sessions/:sessionId/scheduled-broadcasts/:id/cancel')
  @ApiOperation({ summary: 'Cancel a pending scheduled broadcast' })
  async cancelScheduledBroadcast(@Param('id') id: string) {
    return this.dripService.cancelScheduledBroadcast(id);
  }

  @Delete('sessions/:sessionId/scheduled-broadcasts/:id')
  @ApiOperation({ summary: 'Delete a scheduled broadcast' })
  async deleteScheduledBroadcast(@Param('id') id: string) {
    await this.dripService.deleteScheduledBroadcast(id);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 💧 Drip Sequences
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('sessions/:sessionId/drip-sequences')
  @ApiOperation({ summary: 'List all drip sequences for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async getDripSequences(@Param('sessionId') sessionId: string) {
    return this.dripService.getDripSequences(sessionId);
  }

  @Get('sessions/:sessionId/drip-sequences/:id')
  @ApiOperation({ summary: 'Get a drip sequence by ID' })
  async getDripSequence(@Param('id') id: string) {
    return this.dripService.getDripSequence(id);
  }

  @Post('sessions/:sessionId/drip-sequences')
  @ApiOperation({ summary: 'Create a new multi-step drip sequence' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async createDripSequence(
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateDripSequenceDto,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id;
    return this.dripService.createDripSequence(sessionId, dto, userId);
  }

  @Put('sessions/:sessionId/drip-sequences/:id')
  @ApiOperation({ summary: 'Update a drip sequence' })
  async updateDripSequence(
    @Param('id') id: string,
    @Body() dto: UpdateDripSequenceDto,
  ) {
    return this.dripService.updateDripSequence(id, dto);
  }

  @Delete('sessions/:sessionId/drip-sequences/:id')
  @ApiOperation({ summary: 'Delete a drip sequence' })
  async deleteDripSequence(@Param('id') id: string) {
    await this.dripService.deleteDripSequence(id);
    return { success: true };
  }

  @Get('sessions/:sessionId/drip-sequences/:id/subscribers')
  @ApiOperation({ summary: 'Get subscribers of a drip sequence' })
  async getSubscribers(@Param('id') id: string) {
    return this.dripService.getSubscribers(id);
  }

  @Post('sessions/:sessionId/drip-sequences/:id/enroll')
  @ApiOperation({ summary: 'Manually enroll a subscriber to a drip sequence' })
  async enrollSubscriber(
    @Param('id') id: string,
    @Body() dto: EnrollDripSubscriberDto,
  ) {
    return this.dripService.enrollSubscriber(id, dto.phone, dto.contactName);
  }
}
