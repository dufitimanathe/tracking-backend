import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import {
  AuthUser,
  CompanyContext,
  CurrentCompany,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { CompanyScoped, Roles } from '../common/decorators/roles.decorator';
import { paginatedResponse, successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { CreateTransportRequestDto } from './dto/create-transport-request.dto';
import { TransportRequestQueryDto } from './dto/transport-request-query.dto';
import { TransportRequestResponseDto } from './dto/transport-request-response.dto';
import { TransportRequestsService } from './transport-requests.service';

@ApiTags('transport-requests')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Controller('companies/:companyId/transport-requests')
export class TransportRequestsController {
  constructor(private readonly transportRequestsService: TransportRequestsService) {}

  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT, UserRole.EMPLOYEE)
  @ApiSuccessResponse(TransportRequestResponseDto)
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTransportRequestDto,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company: CompanyContext,
  ) {
    const request = await this.transportRequestsService.create(
      companyId,
      dto,
      user,
      company.role,
    );
    return successResponse(request);
  }

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT, UserRole.EMPLOYEE)
  @ApiSuccessResponse(TransportRequestResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: TransportRequestQueryDto,
  ) {
    const { items, total } = await this.transportRequestsService.findAll(companyId, query);
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT, UserRole.EMPLOYEE)
  @ApiSuccessResponse(TransportRequestResponseDto)
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const request = await this.transportRequestsService.findOne(companyId, id);
    return successResponse(request);
  }

  @Post(':id/cancel')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT, UserRole.EMPLOYEE)
  @ApiSuccessResponse(TransportRequestResponseDto)
  async cancel(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const request = await this.transportRequestsService.cancel(companyId, id);
    return successResponse(request);
  }

  @Post(':id/confirm')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT, UserRole.EMPLOYEE)
  @ApiSuccessResponse(TransportRequestResponseDto)
  async confirm(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const request = await this.transportRequestsService.confirmRequest(companyId, id);
    return successResponse(request);
  }
}
