import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import { MembershipStatus } from '../common/enums';
import { paginatedResponse, successResponse } from '../common/dto/api-response.dto';
import { CompanyResponseDto } from '../companies/dto/company-response.dto';
import { MemberResponseDto } from '../company-members/dto/member-response.dto';
import {
  AddCompanyDocumentDto,
  ApproveCompanyDto,
  PlatformCompaniesQueryDto,
  PlatformCreateCompanyDto,
  RejectCompanyDto,
  ReviewDocumentDto,
} from './dto/platform.dto';
import {
  CompanyDocumentResponseDto,
  PlatformCompanyDetailDto,
  PlatformCompanyListItemDto,
  PlatformOverviewDto,
} from './dto/platform-response.dto';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@UseGuards(PlatformAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('overview')
  @ApiSuccessResponse(PlatformOverviewDto)
  async overview() {
    return successResponse(await this.platformService.getOverview());
  }

  @Get('companies')
  @ApiSuccessResponse(PlatformCompanyListItemDto, true)
  async listCompanies(@Query() query: PlatformCompaniesQueryDto) {
    const result = await this.platformService.listCompanies({
      status: query.status,
      search: query.search,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
    });
    return paginatedResponse(result.items, result.page, result.limit, result.total);
  }

  @Post('companies')
  @ApiSuccessResponse(PlatformCompanyDetailDto)
  async createCompany(
    @CurrentUser() user: AuthUser,
    @Body() dto: PlatformCreateCompanyDto,
  ) {
    return successResponse(await this.platformService.createCompany(user.id, dto));
  }

  @Get('companies/:companyId')
  @ApiSuccessResponse(PlatformCompanyDetailDto)
  async getCompany(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return successResponse(await this.platformService.getCompanyDetail(companyId));
  }

  @Post('companies/:companyId/approve')
  @ApiSuccessResponse(CompanyResponseDto)
  async approve(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: ApproveCompanyDto,
  ) {
    return successResponse(
      await this.platformService.approveCompany(companyId, user.id, dto),
    );
  }

  @Post('companies/:companyId/reject')
  @ApiSuccessResponse(CompanyResponseDto)
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: RejectCompanyDto,
  ) {
    return successResponse(
      await this.platformService.rejectCompany(companyId, user.id, dto),
    );
  }

  @Post('companies/:companyId/suspend')
  @ApiSuccessResponse(CompanyResponseDto)
  async suspend(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: ApproveCompanyDto,
  ) {
    return successResponse(
      await this.platformService.suspendCompany(companyId, dto.notes),
    );
  }

  @Post('companies/:companyId/reactivate')
  @ApiSuccessResponse(CompanyResponseDto)
  async reactivate(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return successResponse(await this.platformService.reactivateCompany(companyId));
  }

  @Get('companies/:companyId/admins')
  @ApiSuccessResponse(MemberResponseDto, true)
  async listAdmins(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return successResponse(await this.platformService.listAdmins(companyId));
  }

  @Post('companies/:companyId/admins')
  @ApiSuccessResponse(MemberResponseDto)
  async createAdmin(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    },
  ) {
    return successResponse(await this.platformService.createAdmin(companyId, body));
  }

  @Patch('companies/:companyId/admins/:memberId')
  @ApiSuccessResponse(MemberResponseDto)
  async updateAdmin(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: { status?: MembershipStatus },
  ) {
    return successResponse(
      await this.platformService.updateAdmin(companyId, memberId, body),
    );
  }

  @Post('companies/:companyId/documents')
  @ApiSuccessResponse(CompanyDocumentResponseDto)
  async addDocument(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: AddCompanyDocumentDto,
  ) {
    return successResponse(
      await this.platformService.addDocument(companyId, user.id, dto),
    );
  }

  @Post('companies/:companyId/documents/:documentId/review')
  @ApiSuccessResponse(CompanyDocumentResponseDto)
  async reviewDocument(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return successResponse(
      await this.platformService.reviewDocument(companyId, documentId, user.id, dto),
    );
  }
}
