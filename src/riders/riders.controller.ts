import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { DomainException } from '../common/exceptions/domain.exception';
import { ErrorCode, UserRole } from '../common/enums';
import { CreateRiderDto } from './dto/create-rider.dto';
import { RiderQueryDto } from './dto/rider-query.dto';
import {
  CreateRiderResultDto,
  RiderResponseDto,
} from './dto/rider-response.dto';
import { UpdateRiderAvailabilityDto } from './dto/update-rider-availability.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { RidersService } from './riders.service';

@ApiTags('riders')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Controller('companies/:companyId/riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(RiderResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: RiderQueryDto,
  ) {
    const { items, total } = await this.ridersService.findAll(companyId, query);
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Get(':riderId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.RIDER)
  @ApiSuccessResponse(RiderResponseDto)
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('riderId', ParseUUIDPipe) riderId: string,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company?: CompanyContext,
  ) {
    const rider = await this.ridersService.findOne(companyId, riderId);

    if (company?.role === UserRole.RIDER && rider.userId !== user.id) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You can only view your own rider profile.',
        HttpStatus.FORBIDDEN,
      );
    }

    return successResponse(rider);
  }

  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(CreateRiderResultDto)
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateRiderDto,
  ) {
    const rider = await this.ridersService.create(companyId, dto);
    return successResponse(rider);
  }

  @Patch(':riderId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(RiderResponseDto)
  async updateStatus(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('riderId', ParseUUIDPipe) riderId: string,
    @Body() dto: UpdateRiderDto,
  ) {
    const rider = await this.ridersService.updateStatus(companyId, riderId, dto);
    return successResponse(rider);
  }

  @Post(':riderId/availability')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.RIDER)
  @ApiSuccessResponse(RiderResponseDto)
  async updateAvailability(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('riderId', ParseUUIDPipe) riderId: string,
    @Body() dto: UpdateRiderAvailabilityDto,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company: CompanyContext,
  ) {
    const rider = await this.ridersService.updateAvailability(
      companyId,
      riderId,
      dto,
      user,
      company.role,
    );
    return successResponse(rider);
  }
}
