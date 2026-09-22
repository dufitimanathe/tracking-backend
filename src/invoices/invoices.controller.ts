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
import { CompanyScoped, Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { paginatedResponse, successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Controller('companies/:companyId/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT)
  @ApiSuccessResponse(InvoiceResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { items, total } = await this.invoicesService.listForCompany(companyId, query);
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Get(':invoiceId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT)
  @ApiSuccessResponse(InvoiceResponseDto)
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    const invoice = await this.invoicesService.findOne(companyId, invoiceId);
    return successResponse(invoice);
  }

  @Post('generate')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.ACCOUNTANT)
  @ApiSuccessResponse(InvoiceResponseDto)
  async generate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: GenerateInvoiceDto,
  ) {
    const invoice = await this.invoicesService.generateDraft(
      companyId,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
    );
    return successResponse(invoice);
  }
}
