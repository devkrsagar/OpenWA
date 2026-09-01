import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledBroadcast } from './entities/scheduled-broadcast.entity';
import { DripSequence } from './entities/drip-sequence.entity';
import { DripStep } from './entities/drip-step.entity';
import { DripSubscriber } from './entities/drip-subscriber.entity';
import { ContactBook } from '../contact/entities/contact-book.entity';
import { Session } from '../session/entities/session.entity';
import { DripService } from './drip.service';
import { DripController } from './drip.controller';
import { SessionModule } from '../session/session.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [ScheduledBroadcast, DripSequence, DripStep, DripSubscriber, ContactBook, Session],
      'data',
    ),
    SessionModule,
    forwardRef(() => BillingModule),
  ],
  controllers: [DripController],
  providers: [DripService],
  exports: [DripService],
})
export class DripModule {}
