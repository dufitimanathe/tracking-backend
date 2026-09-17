import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { Rider } from '../riders/entities/rider.entity';
import { RiderMotorcycleAssignment } from './entities/rider-motorcycle-assignment.entity';
import { RiderMotorcycleAssignmentsController } from './rider-motorcycle-assignments.controller';
import { RiderMotorcycleAssignmentsService } from './rider-motorcycle-assignments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiderMotorcycleAssignment,
      Rider,
      Motorcycle,
    ]),
    AuthGuardsModule,
  ],
  controllers: [RiderMotorcycleAssignmentsController],
  providers: [RiderMotorcycleAssignmentsService],
  exports: [RiderMotorcycleAssignmentsService],
})
export class RiderMotorcycleAssignmentsModule {}
