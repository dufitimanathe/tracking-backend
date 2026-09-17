import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { BillingRecord } from '../billing/entities/billing-record.entity';
import { PricingRule } from '../billing/entities/pricing-rule.entity';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { Rider } from '../riders/entities/rider.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { Trip } from '../trips/entities/trip.entity';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyOnboarding } from './entities/company-onboarding.entity';
import { Company } from './entities/company.entity';

@Module({
  imports: [
    AuthGuardsModule,
    TypeOrmModule.forFeature([
      Company,
      CompanyOnboarding,
      CompanyMember,
      PricingRule,
      Trip,
      Rider,
      Motorcycle,
      TransportRequest,
      Incident,
      BillingRecord,
    ]),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
