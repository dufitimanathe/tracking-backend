import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { Trip } from '../trips/entities/trip.entity';
import { PricingRule } from './entities/pricing-rule.entity';
import { BillingRecord } from './entities/billing-record.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [
    AuthGuardsModule,
    TypeOrmModule.forFeature([BillingRecord, PricingRule, Trip]),
  ],
  controllers: [BillingController],
  providers: [PricingService, BillingService],
  exports: [PricingService, BillingService],
})
export class BillingModule {}
