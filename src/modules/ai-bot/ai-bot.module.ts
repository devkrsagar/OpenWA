import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiBotConfig } from './entities/ai-bot-config.entity';
import { Message } from '../message/entities/message.entity';
import { AiBotService } from './ai-bot.service';
import { AiBotController } from './ai-bot.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiBotConfig, Message], 'data')],
  controllers: [AiBotController],
  providers: [AiBotService],
  exports: [AiBotService],
})
export class AiBotModule {}
