import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { BillingModule } from '../billing/billing.module';
import { Employee } from '../employees/entities/employee.entity';
import { MapsModule } from '../maps/maps.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TransportRequest } from './entities/transport-request.entity';
import { TransportRequestsController } from './transport-requests.controller';
import { TransportRequestsService } from './transport-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransportRequest, Employee]),
    AuthGuardsModule,
    BillingModule,
    MapsModule,
    RealtimeModule,
  ],
  controllers: [TransportRequestsController],
  providers: [TransportRequestsService],
  exports: [TransportRequestsService],
})
export class TransportRequestsModule {}
