import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyAccessGuard } from './guards/company-access.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyMember])],
  providers: [JwtAuthGuard, RolesGuard, CompanyAccessGuard],
  exports: [JwtAuthGuard, RolesGuard, CompanyAccessGuard],
})
export class AuthGuardsModule {}
