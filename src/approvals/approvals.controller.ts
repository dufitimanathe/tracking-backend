import {
  Body,
  Controller,
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
import { ApprovalsService } from './approvals.service';
import { ApproveTransportRequestDto } from './dto/approve-transport-request.dto';
import { ApprovalResponseDto } from './dto/approval-response.dto';
import { RejectTransportRequestDto } from './dto/reject-transport-request.dto';

class ApprovalResultResponseDto {
  approval!: ApprovalResponseDto;
  requestId!: string;
  tripId?: string;
}

@ApiTags('approvals')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Controller('companies/:companyId/transport-requests')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post(':id/approve')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(ApprovalResultResponseDto)
  async approve(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveTransportRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.approvalsService.approve(companyId, id, user.id, dto);
    return successResponse(result);
  }

  @Post(':id/reject')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(ApprovalResultResponseDto)
  async reject(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTransportRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.approvalsService.reject(companyId, id, user.id, dto);
    return successResponse(result);
  }
}
