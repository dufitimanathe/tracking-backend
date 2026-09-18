import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { Trip } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';
import { Rider } from './entities/rider.entity';
import { RidersController } from './riders.controller';
import { RidersService } from './riders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rider,
      User,
      CompanyMember,
      RiderMotorcycleAssignment,
      Trip,
    ]),
    AuthGuardsModule,
  ],
  controllers: [RidersController],
  providers: [RidersService],
  exports: [RidersService],
})
export class RidersModule {}
