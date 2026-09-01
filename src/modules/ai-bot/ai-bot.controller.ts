import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiSecurity } from '@nestjs/swagger';
import { AiBotService } from './ai-bot.service';
import { SaveAiBotConfigDto, TestAiPromptDto } from './dto/ai-bot-config.dto';

@ApiTags('ai-bot')
@ApiSecurity('api_key')
@Controller()
export class AiBotController {
  constructor(private readonly aiBotService: AiBotService) {}

  @Get('sessions/:sessionId/ai-bot')
  @ApiOperation({ summary: 'Get AI Bot settings for session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'AI Bot configuration' })
  async getConfig(@Param('sessionId') sessionId: string) {
    return this.aiBotService.getConfig(sessionId);
  }

  @Post('sessions/:sessionId/ai-bot')
  @ApiOperation({ summary: 'Save or update AI Bot settings for session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Updated AI Bot configuration' })
  async saveConfig(@Param('sessionId') sessionId: string, @Body() dto: SaveAiBotConfigDto) {
    return this.aiBotService.saveConfig(sessionId, dto);
  }

  @Post('ai-bot/test')
  @ApiOperation({ summary: 'Test prompt and model in sandbox simulator' })
  @ApiResponse({ status: 200, description: 'Simulated response from AI provider' })
  async testSimulator(@Body() dto: TestAiPromptDto) {
    return this.aiBotService.testSimulator(dto);
  }
}
