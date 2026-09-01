import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionRequest } from './entities/subscription-request.entity';
import { GatewaySetting } from './entities/gateway-setting.entity';
import { User } from '../auth/entities/user.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, Subscription, SubscriptionRequest, GatewaySetting, User], 'main'),
  ],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
