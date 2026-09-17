import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { BillingRecord } from '../billing/entities/billing-record.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { Trip } from '../trips/entities/trip.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    AuthGuardsModule,
    TypeOrmModule.forFeature([Trip, BillingRecord, Incident]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
