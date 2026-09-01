import { Module, Global, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ApiKey } from './entities/api-key.entity';
import { User } from './entities/user.entity';
import { OtpVerification } from './entities/otp.entity';
import { AuthService } from './auth.service';
import { UserAuthService } from './user-auth.service';
import { MailService } from './mail.service';
import { ApiKeyUsageTracker } from './api-key-usage-tracker.service';
import { AuthController } from './auth.controller';
import { UserAuthController } from './user-auth.controller';
import { AdminUsersController } from './admin-users.controller';
import { AuthValidateController } from './auth-validate.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ProxyAwareThrottlerGuard } from '../../common/security/proxy-aware-throttler.guard';
import { BillingModule } from '../billing/billing.module';
import { SessionModule } from '../session/session.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, User, OtpVerification], 'main'),
    BillingModule,
    forwardRef(() => SessionModule),
  ],
  controllers: [
    AuthController,
    UserAuthController,
    AdminUsersController,
    AuthValidateController,
  ],
  providers: [
    AuthService,
    UserAuthService,
    MailService,
    ApiKeyUsageTracker,
    {
      provide: APP_GUARD,
      useClass: ProxyAwareThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
  exports: [AuthService, UserAuthService, MailService],
})
export class AuthModule {}
