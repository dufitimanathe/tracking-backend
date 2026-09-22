import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { Company } from '../companies/entities/company.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { Rider } from '../riders/entities/rider.entity';
import { User } from '../users/entities/user.entity';
import { RiderMotorcycleAssignment } from './entities/rider-motorcycle-assignment.entity';
import { RiderMotorcycleAssignmentsController } from './rider-motorcycle-assignments.controller';
import { RiderMotorcycleAssignmentsService } from './rider-motorcycle-assignments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiderMotorcycleAssignment,
      Rider,
      Motorcycle,
      User,
      Company,
    ]),
    AuthGuardsModule,
  ],
  controllers: [RiderMotorcycleAssignmentsController],
  providers: [RiderMotorcycleAssignmentsService],
  exports: [RiderMotorcycleAssignmentsService],
})
export class RiderMotorcycleAssignmentsModule {}
