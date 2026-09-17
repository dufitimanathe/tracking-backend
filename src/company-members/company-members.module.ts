import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { Rider } from '../riders/entities/rider.entity';
import { UsersModule } from '../users/users.module';
import { CompanyMembersController } from './company-members.controller';
import { CompanyMembersService } from './company-members.service';
import { CompanyMember } from './entities/company-member.entity';

@Module({
  imports: [AuthGuardsModule, TypeOrmModule.forFeature([CompanyMember, Rider]), UsersModule],
  controllers: [CompanyMembersController],
  providers: [CompanyMembersService],
  exports: [CompanyMembersService],
})
export class CompanyMembersModule {}
