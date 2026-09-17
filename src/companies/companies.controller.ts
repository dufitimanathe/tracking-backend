import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import {
  CompanyDashboardDto,
  CompanyOnboardingResponseDto,
  CompanyResponseDto,
} from './dto/company-response.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @ApiSuccessResponse(CompanyResponseDto)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto) {
    const result = await this.companiesService.createForUser(user.id, dto);
    return successResponse(result.company);
  }

  @Get(':companyId')
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.PLATFORM_ADMIN)
  @ApiSuccessResponse(CompanyResponseDto)
  async findOne(@Param('companyId', ParseUUIDPipe) companyId: string) {
    const company = await this.companiesService.getCompanyResponse(companyId);
    return successResponse(company);
  }

  @Patch(':companyId')
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiSuccessResponse(CompanyResponseDto)
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    const company = await this.companiesService.updateCompany(companyId, dto);
    return successResponse(company);
  }

  @Get(':companyId/onboarding')
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.PLATFORM_ADMIN)
  @ApiSuccessResponse(CompanyOnboardingResponseDto)
  async getOnboarding(@Param('companyId', ParseUUIDPipe) companyId: string) {
    const onboarding = await this.companiesService.getOnboarding(companyId);
    return successResponse(onboarding);
  }

  @Patch(':companyId/onboarding')
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiSuccessResponse(CompanyOnboardingResponseDto)
  async updateOnboarding(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateOnboardingDto,
  ) {
    const onboarding = await this.companiesService.updateOnboarding(companyId, dto);
    return successResponse(onboarding);
  }

  @Get(':companyId/dashboard')
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.PLATFORM_ADMIN)
  @ApiSuccessResponse(CompanyDashboardDto)
  async getDashboard(@Param('companyId', ParseUUIDPipe) companyId: string) {
    const dashboard = await this.companiesService.getDashboard(companyId);
    return successResponse(dashboard);
  }
}
