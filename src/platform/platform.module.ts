import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { CompaniesModule } from '../companies/companies.module';
import { CompanyDocument } from '../companies/entities/company-document.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyMembersModule } from '../company-members/company-members.module';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { User } from '../users/entities/user.entity';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [
    AuthGuardsModule,
    CompaniesModule,
    CompanyMembersModule,
    TypeOrmModule.forFeature([Company, CompanyDocument, CompanyMember, User]),
  ],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformAdminGuard],
  exports: [PlatformService],
})
export class PlatformModule {}
