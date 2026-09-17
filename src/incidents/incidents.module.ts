import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { GpsDevice } from '../gps-devices/entities/gps-device.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { Trip } from '../trips/entities/trip.entity';
import { IncidentDetectionService } from './incident-detection.service';
import { Incident } from './entities/incident.entity';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [
    AuthGuardsModule,
    RealtimeModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      Incident,
      Trip,
      Motorcycle,
      GpsDevice,
      CompanyMember,
    ]),
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentDetectionService],
  exports: [IncidentsService, IncidentDetectionService],
})
export class IncidentsModule {}
