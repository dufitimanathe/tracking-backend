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
import { CompanyScoped, Roles } from '../common/decorators/roles.decorator';
import { paginatedResponse, successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { CreateMotorcycleDto } from './dto/create-motorcycle.dto';
import { MotorcycleQueryDto } from './dto/motorcycle-query.dto';
import { MotorcycleResponseDto } from './dto/motorcycle-response.dto';
import { UpdateMotorcycleStatusDto } from './dto/update-motorcycle-status.dto';
import { UpdateMotorcycleDto } from './dto/update-motorcycle.dto';
import { MotorcyclesService } from './motorcycles.service';

@ApiTags('motorcycles')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT)
@Controller('companies/:companyId/motorcycles')
export class MotorcyclesController {
  constructor(private readonly motorcyclesService: MotorcyclesService) {}

  @Get()
  @ApiSuccessResponse(MotorcycleResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: MotorcycleQueryDto,
  ) {
    const { items, total } = await this.motorcyclesService.findAll(companyId, query);
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Get(':motorcycleId')
  @ApiSuccessResponse(MotorcycleResponseDto)
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ) {
    const motorcycle = await this.motorcyclesService.findOne(companyId, motorcycleId);
    return successResponse(motorcycle);
  }

  @Post()
  @Roles(UserRole.COMPANY_ADMIN)
  @ApiSuccessResponse(MotorcycleResponseDto)
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateMotorcycleDto,
  ) {
    const motorcycle = await this.motorcyclesService.create(companyId, dto);
    return successResponse(motorcycle);
  }

  @Patch(':motorcycleId')
  @Roles(UserRole.COMPANY_ADMIN)
  @ApiSuccessResponse(MotorcycleResponseDto)
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('motorcycleId', ParseUUIDPipe) motorcycleId: string,
    @Body() dto: UpdateMotorcycleDto,
  ) {
    const motorcycle = await this.motorcyclesService.update(companyId, motorcycleId, dto);
    return successResponse(motorcycle);
  }

  @Patch(':motorcycleId/status')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
  @ApiSuccessResponse(MotorcycleResponseDto)
  async updateStatus(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('motorcycleId', ParseUUIDPipe) motorcycleId: string,
    @Body() dto: UpdateMotorcycleStatusDto,
  ) {
    const motorcycle = await this.motorcyclesService.updateStatus(
      companyId,
      motorcycleId,
      dto,
    );
    return successResponse(motorcycle);
  }
}
