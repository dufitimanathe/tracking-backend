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
import { CreateGpsDeviceDto } from './dto/create-gps-device.dto';
import { GpsDeviceQueryDto } from './dto/gps-device-query.dto';
import { GpsDeviceResponseDto } from './dto/gps-device-response.dto';
import { UpdateGpsDeviceDto } from './dto/update-gps-device.dto';
import { GpsDevicesService } from './gps-devices.service';

@ApiTags('gps-devices')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
@Controller('companies/:companyId/gps-devices')
export class GpsDevicesController {
  constructor(private readonly gpsDevicesService: GpsDevicesService) {}

  @Get()
  @ApiSuccessResponse(GpsDeviceResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: GpsDeviceQueryDto,
  ) {
    const { items, total } = await this.gpsDevicesService.findAll(companyId, query);
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Get(':deviceId')
  @ApiSuccessResponse(GpsDeviceResponseDto)
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    const device = await this.gpsDevicesService.findOne(companyId, deviceId);
    return successResponse(device);
  }

  @Post()
  @ApiSuccessResponse(GpsDeviceResponseDto)
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateGpsDeviceDto,
  ) {
    const device = await this.gpsDevicesService.create(companyId, dto);
    return successResponse(device);
  }

  @Patch(':deviceId')
  @ApiSuccessResponse(GpsDeviceResponseDto)
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: UpdateGpsDeviceDto,
  ) {
    const device = await this.gpsDevicesService.update(companyId, deviceId, dto);
    return successResponse(device);
  }

  @Post(':deviceId/deactivate')
  @ApiSuccessResponse(GpsDeviceResponseDto)
  async deactivate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    const device = await this.gpsDevicesService.deactivate(companyId, deviceId);
    return successResponse(device);
  }
}
