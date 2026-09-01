import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcommerceAutomation } from './entities/ecommerce-automation.entity';
import { EcommerceLog } from './entities/ecommerce-log.entity';
import { EcommerceService } from './ecommerce.service';
import { EcommerceController } from './ecommerce.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EcommerceAutomation, EcommerceLog], 'data')],
  controllers: [EcommerceController],
  providers: [EcommerceService],
  exports: [EcommerceService],
})
export class EcommerceModule {}
