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
import { AssignTripDto } from './dto/assign-trip.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { TripQueryDto } from './dto/trip-query.dto';
import { TripResponseDto } from './dto/trip-response.dto';
import { TripsService } from './trips.service';

@ApiTags('trips')
@UseGuards(CompanyAccessGuard, RolesGuard)
@Controller()
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('companies/:companyId/trips')
  @CompanyScoped()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT, UserRole.EMPLOYEE, UserRole.RIDER)
  @ApiSuccessResponse(TripResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: TripQueryDto,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company: CompanyContext,
  ) {
    const scopedQuery = { ...query };
    if (company.role === UserRole.RIDER) {
      const rider = await this.tripsService.resolveRiderId(companyId, user.id);
      scopedQuery.riderId = rider;
    }
    const { items, total } = await this.tripsService.findAll(companyId, scopedQuery);
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Get('trips/:id')
  @CompanyScoped()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE, UserRole.RIDER)
  @ApiSuccessResponse(TripResponseDto)
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() company: CompanyContext,
  ) {
    const trip = await this.tripsService.findOne(company.companyId, id);
    return successResponse(trip);
  }

  @Post('trips/:id/accept')
  @CompanyScoped()
  @Roles(UserRole.RIDER)
  @ApiSuccessResponse(TripResponseDto)
  async accept(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company: CompanyContext,
  ) {
    const trip = await this.tripsService.accept(company.companyId, id, user);
    return successResponse(trip);
  }

  @Post('trips/:id/decline')
  @CompanyScoped()
  @Roles(UserRole.RIDER)
  @ApiSuccessResponse(TripResponseDto)
  async decline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company: CompanyContext,
  ) {
    const trip = await this.tripsService.decline(company.companyId, id, user);
    return successResponse(trip);
  }

  @Post('trips/:id/arrive')
  @CompanyScoped()
  @Roles(UserRole.RIDER)
  @ApiSuccessResponse(TripResponseDto)
  async arrive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company: CompanyContext,
  ) {
    const trip = await this.tripsService.arrive(company.companyId, id, user);
    return successResponse(trip);
  }

  @Post('trips/:id/start')
  @CompanyScoped()
  @Roles(UserRole.RIDER)
  @ApiSuccessResponse(TripResponseDto)
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company: CompanyContext,
  ) {
    const trip = await this.tripsService.start(company.companyId, id, user);
    return successResponse(trip);
  }

  @Post('trips/:id/complete')
  @CompanyScoped()
  @Roles(UserRole.RIDER)
  @ApiSuccessResponse(TripResponseDto)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company: CompanyContext,
  ) {
    const trip = await this.tripsService.complete(company.companyId, id, user);
    return successResponse(trip);
  }

  @Post('companies/:companyId/trips/:id/assign')
  @CompanyScoped()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(TripResponseDto)
  async assign(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTripDto,
    @CurrentUser() user: AuthUser,
  ) {
    const trip = await this.tripsService.assign(companyId, id, dto, user);
    return successResponse(trip);
  }

  @Get('companies/:companyId/trips/:id/assignment-candidates')
  @CompanyScoped()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  async assignmentCandidates(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const recommendations = await this.tripsService.getAssignmentCandidates(companyId, id);
    return successResponse(recommendations);
  }

  @Post('companies/:companyId/trips/:id/assign-nearest')
  @CompanyScoped()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(TripResponseDto)
  async assignNearest(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(await this.tripsService.assignNearest(companyId, id, user));
  }

  @Post('companies/:companyId/trips/:id/redispatch')
  @CompanyScoped()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(TripResponseDto)
  async redispatch(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const trip = await this.tripsService.restartDispatch(companyId, id);
    return successResponse(trip);
  }

  @Post('companies/:companyId/trips/:id/reassign')
  @CompanyScoped()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(TripResponseDto)
  async reassign(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTripDto,
    @CurrentUser() user: AuthUser,
  ) {
    const trip = await this.tripsService.reassign(companyId, id, dto, user);
    return successResponse(trip);
  }

  @Post('companies/:companyId/trips/:id/cancel')
  @CompanyScoped()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(TripResponseDto)
  async cancel(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTripDto,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() company: CompanyContext,
  ) {
    const trip = await this.tripsService.cancel(companyId, id, dto, user, company.role);
    return successResponse(trip);
  }
}
