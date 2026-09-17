import {
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
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyScoped, Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { paginatedResponse, successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { IncidentResponseDto } from './dto/incident-response.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Controller('companies/:companyId/incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(IncidentResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { items, total } = await this.incidentsService.listForCompany(companyId, query);
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Post(':incidentId/acknowledge')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(IncidentResponseDto)
  async acknowledge(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const incident = await this.incidentsService.acknowledge(companyId, incidentId, user.id);
    return successResponse(incident);
  }

  @Post(':incidentId/resolve')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(IncidentResponseDto)
  async resolve(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const incident = await this.incidentsService.resolve(companyId, incidentId, user.id);
    return successResponse(incident);
  }
}
