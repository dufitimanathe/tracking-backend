import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import { CompanyScoped, Roles } from '../common/decorators/roles.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { BillingRecordResponseDto } from './dto/billing-record-response.dto';
import { BillingService } from './billing.service';

@ApiTags('billing')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Controller('companies/:companyId/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(BillingRecordResponseDto, true)
  async list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    const records = await this.billingService.listForCompany(companyId);
    return successResponse(records);
  }
}
