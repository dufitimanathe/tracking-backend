import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { FleetLiveItemDto } from './dto/fleet-live-response.dto';
import { IngestRiderLocationDto } from './dto/ingest-rider-location.dto';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post('locations/rider')
  @ApiSuccessResponse(Object)
  /** Primary tracking path when TRACKING_MODE=phone_primary (rider mobile app). */
  async ingestRiderLocation(
    @CurrentUser() user: AuthUser,
    @Body() dto: IngestRiderLocationDto,
  ) {
    const result = await this.locationsService.ingestRiderLocation(user.id, dto);
    return successResponse(result);
  }

  @Get('companies/:companyId/fleet/live')
  @CompanyScoped()
  @UseGuards(CompanyAccessGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(FleetLiveItemDto, true)
  async getLiveFleet(@Param('companyId', ParseUUIDPipe) companyId: string) {
    const fleet = await this.locationsService.getLiveFleet(companyId);
    return successResponse(fleet);
  }
}
