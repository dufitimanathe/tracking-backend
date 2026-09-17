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
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CompanyScoped, Roles } from '../common/decorators/roles.decorator';
import { paginatedResponse, successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { AssignRiderMotorcycleDto } from './dto/assign-rider-motorcycle.dto';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { AssignmentResponseDto } from './dto/assignment-response.dto';
import { RiderMotorcycleAssignmentsService } from './rider-motorcycle-assignments.service';

@ApiTags('rider-motorcycle-assignments')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
@Controller('companies/:companyId/rider-motorcycle-assignments')
export class RiderMotorcycleAssignmentsController {
  constructor(
    private readonly assignmentsService: RiderMotorcycleAssignmentsService,
  ) {}

  @Get()
  @ApiSuccessResponse(AssignmentResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: AssignmentQueryDto,
  ) {
    const { items, total } = await this.assignmentsService.findAll(companyId, query);
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Post('assign')
  @ApiSuccessResponse(AssignmentResponseDto)
  async assign(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: AssignRiderMotorcycleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const assignment = await this.assignmentsService.assign(companyId, dto, user.id);
    return successResponse(assignment);
  }

  @Post(':assignmentId/unassign')
  @ApiSuccessResponse(AssignmentResponseDto)
  async unassign(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    const assignment = await this.assignmentsService.unassign(companyId, assignmentId);
    return successResponse(assignment);
  }
}
