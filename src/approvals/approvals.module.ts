import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEventsModule } from '../trip-events/trip-events.module';
import { Trip } from '../trips/entities/trip.entity';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { TransportRequestApproval } from './entities/transport-request-approval.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransportRequestApproval, TransportRequest, Trip]),
    AuthGuardsModule,
    TripEventsModule,
    forwardRef(() => DispatchModule),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
