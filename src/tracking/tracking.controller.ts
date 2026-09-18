import {
  Body,
  Controller,
  Delete,
  Get,
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
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyScoped, Roles } from '../common/decorators/roles.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { LocationBatchDto } from './dto/location-batch.dto';
import { LocationUpdateDto } from './dto/location-update.dto';
import { StartTrackingDto } from './dto/start-tracking.dto';
import { UpdateGeofenceDto } from './dto/update-geofence.dto';
import { GeofenceService } from './services/geofence.service';
import { LocationIngestionService } from './services/location-ingestion.service';
import { TrackingQueryService } from './services/tracking-query.service';
import { TrackingSessionsService } from './services/tracking-sessions.service';

@ApiTags('tracking')
@Controller()
export class TrackingController {
  constructor(
    private readonly sessionsService: TrackingSessionsService,
    private readonly ingestionService: LocationIngestionService,
    private readonly queryService: TrackingQueryService,
    private readonly geofenceService: GeofenceService,
  ) {}

  // ---- Rider session / location (JWT identity, no companyId in body) ----

  @Post('tracking/sessions/start')
  async startSession(@CurrentUser() user: AuthUser, @Body() dto: StartTrackingDto) {
    const session = await this.sessionsService.start(user.id, dto);
    return successResponse(session);
  }

  @Get('tracking/sessions/active')
  async activeSession(@CurrentUser() user: AuthUser) {
    const rider = await this.sessionsService.resolveActiveRider(user.id);
    const session = await this.sessionsService.findActiveForRider(rider.id);
    return successResponse(session);
  }

  @Post('tracking/sessions/:sessionId/end')
  async endSession(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    const session = await this.sessionsService.end(user.id, sessionId);
    return successResponse(session);
  }

  @Post('tracking/locations')
  async ingestLocation(@CurrentUser() user: AuthUser, @Body() dto: LocationUpdateDto) {
    const result = await this.ingestionService.ingestForUser(user.id, dto);
    return successResponse(result);
  }

  @Post('tracking/locations/batch')
  async ingestBatch(@CurrentUser() user: AuthUser, @Body() dto: LocationBatchDto) {
    const result = await this.ingestionService.ingestBatch(user.id, dto.locations);
    return successResponse(result);
  }

  // ---- Company admin / supervisor live & history ----

  @Get('companies/:companyId/tracking/live')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(Object, true)
  async live(@Param('companyId', ParseUUIDPipe) companyId: string) {
    const items = await this.queryService.getLive(companyId);
    return successResponse(items);
  }

  @Get('companies/:companyId/tracking/statistics')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  async companyStats(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return successResponse(await this.queryService.companyStatistics(companyId));
  }

  @Get('companies/:companyId/tracking/sessions')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  async listSessions(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('riderId') riderId?: string,
    @Query('motorcycleId') motorcycleId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const items = await this.sessionsService.listForCompany(companyId, {
      riderId,
      motorcycleId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return successResponse(items);
  }

  @Get('companies/:companyId/tracking/sessions/:sessionId')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.RIDER)
  async getSession(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return successResponse(await this.sessionsService.getForCompany(companyId, sessionId));
  }

  @Get('companies/:companyId/tracking/sessions/:sessionId/route')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.RIDER)
  async sessionRoute(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    await this.sessionsService.getForCompany(companyId, sessionId);
    const [route, stops] = await Promise.all([
      this.queryService.getSessionRoute(companyId, sessionId, { downsample: true }),
      this.queryService.getSessionStops(companyId, sessionId),
    ]);
    return successResponse({ route, stops });
  }

  @Get('companies/:companyId/tracking/drivers/:riderId/statistics')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  async riderStats(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('riderId', ParseUUIDPipe) riderId: string,
  ) {
    return successResponse(await this.queryService.riderStatistics(companyId, riderId));
  }

  @Get('companies/:companyId/tracking/motorcycles/:motorcycleId/statistics')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  async motoStats(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ) {
    return successResponse(
      await this.queryService.motorcycleStatistics(companyId, motorcycleId),
    );
  }

  @Get('companies/:companyId/tracking/geofences')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  async listGeofences(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return successResponse(await this.geofenceService.list(companyId));
  }

  @Post('companies/:companyId/tracking/geofences')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  async createGeofence(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateGeofenceDto,
  ) {
    return successResponse(await this.geofenceService.create(companyId, dto));
  }

  @Patch('companies/:companyId/tracking/geofences/:geofenceId')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  async updateGeofence(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('geofenceId', ParseUUIDPipe) geofenceId: string,
    @Body() dto: UpdateGeofenceDto,
  ) {
    return successResponse(await this.geofenceService.update(companyId, geofenceId, dto));
  }

  @Delete('companies/:companyId/tracking/geofences/:geofenceId')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  async deleteGeofence(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('geofenceId', ParseUUIDPipe) geofenceId: string,
  ) {
    return successResponse({
      deleted: await this.geofenceService.remove(companyId, geofenceId),
    });
  }
}
