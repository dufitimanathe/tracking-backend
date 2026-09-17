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
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import { paginatedResponse, successResponse } from '../common/dto/api-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { CompanyMembersService } from './company-members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@ApiTags('company-members')
@Controller('companies/:companyId/members')
@UseGuards(CompanyAccessGuard, RolesGuard)
export class CompanyMembersController {
  constructor(private readonly companyMembersService: CompanyMembersService) {}

  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiSuccessResponse(MemberResponseDto)
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateMemberDto,
  ) {
    const member = await this.companyMembersService.createMember(companyId, dto);
    return successResponse(member);
  }

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.PLATFORM_ADMIN)
  @ApiSuccessResponse(MemberResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { items, total } = await this.companyMembersService.listMembers(
      companyId,
      query.page,
      query.limit,
      query.search,
    );
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Patch(':memberId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiSuccessResponse(MemberResponseDto)
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const member = await this.companyMembersService.updateMember(companyId, memberId, dto);
    return successResponse(member);
  }
}
