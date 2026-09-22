import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import { CompanyScoped, Roles } from '../common/decorators/roles.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportSummaryDto } from './dto/report-summary.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Controller('companies/:companyId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT)
  @ApiSuccessResponse(ReportSummaryDto)
  async summary(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ReportQueryDto,
  ) {
    const summary = await this.reportsService.getSummary(
      companyId,
      new Date(query.from),
      new Date(query.to),
    );
    return successResponse(summary);
  }

  @Get('export.csv')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="trips-export.csv"')
  async exportCsv(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ReportQueryDto,
  ): Promise<string> {
    return this.reportsService.exportTripsCsv(
      companyId,
      new Date(query.from),
      new Date(query.to),
    );
  }
}
