import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import appConfig from './config/app.config';
import { envValidationSchema } from './config/env.validation';
import { entities } from './database/entities';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { CompanyMembersModule } from './company-members/company-members.module';
import { EmployeesModule } from './employees/employees.module';
import { RidersModule } from './riders/riders.module';
import { MotorcyclesModule } from './motorcycles/motorcycles.module';
import { RiderMotorcycleAssignmentsModule } from './rider-motorcycle-assignments/rider-motorcycle-assignments.module';
import { GpsDevicesModule } from './gps-devices/gps-devices.module';
import { TransportRequestsModule } from './transport-requests/transport-requests.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { TripsModule } from './trips/trips.module';
import { TripEventsModule } from './trip-events/trip-events.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { LocationsModule } from './locations/locations.module';
import { RealtimeModule } from './realtime/realtime.module';
import { BillingModule } from './billing/billing.module';
import { InvoicesModule } from './invoices/invoices.module';
import { IncidentsModule } from './incidents/incidents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JobsModule } from './jobs/jobs.module';
import { MapsModule } from './maps/maps.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AiModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { ReportsModule } from './reports/reports.module';
import { RedisModule } from './common/redis/redis.module';
import { TrackingModule } from './tracking/tracking.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: envValidationSchema,
    }),
    MailModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get('app.database', { infer: true })!;
        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.name,
          ssl: db.ssl ? { rejectUnauthorized: false } : false,
          entities,
          synchronize: false,
          logging: config.get('app.nodeEnv') === 'development',
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.get('app.redis', { infer: true })!;
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const throttle = config.get('app.throttle', { infer: true })!;
        return [{ ttl: throttle.ttl, limit: throttle.limit }];
      },
    }),
    RedisModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    CompanyMembersModule,
    EmployeesModule,
    RidersModule,
    MotorcyclesModule,
    RiderMotorcycleAssignmentsModule,
    GpsDevicesModule,
    TransportRequestsModule,
    ApprovalsModule,
    TripsModule,
    TripEventsModule,
    DispatchModule,
    LocationsModule,
    RealtimeModule,
    BillingModule,
    InvoicesModule,
    IncidentsModule,
    NotificationsModule,
    JobsModule,
    MapsModule,
    WhatsappModule,
    AiModule,
    AuditModule,
    HealthModule,
    ReportsModule,
    TrackingModule,
    IntegrationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
