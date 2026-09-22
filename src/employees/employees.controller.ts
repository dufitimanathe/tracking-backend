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
import { CompanyScoped } from '../common/decorators/roles.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { paginatedResponse, successResponse } from '../common/dto/api-response.dto';
import { UserRole } from '../common/enums';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@CompanyScoped()
@UseGuards(CompanyAccessGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR)
@Controller('companies/:companyId/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiSuccessResponse(EmployeeResponseDto, true)
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: EmployeeQueryDto,
  ) {
    const { items, total } = await this.employeesService.findAll(companyId, query);
    return paginatedResponse(items, query.page, query.limit, total);
  }

  @Get(':employeeId')
  @ApiSuccessResponse(EmployeeResponseDto)
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    const employee = await this.employeesService.findOne(companyId, employeeId);
    return successResponse(employee);
  }

  @Post()
  @Roles(UserRole.COMPANY_ADMIN)
  @ApiSuccessResponse(EmployeeResponseDto)
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    const employee = await this.employeesService.create(companyId, dto);
    return successResponse(employee);
  }

  @Patch(':employeeId')
  @Roles(UserRole.COMPANY_ADMIN)
  @ApiSuccessResponse(EmployeeResponseDto)
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const employee = await this.employeesService.update(companyId, employeeId, dto);
    return successResponse(employee);
  }

  @Post(':employeeId/deactivate')
  @Roles(UserRole.COMPANY_ADMIN)
  @ApiSuccessResponse(EmployeeResponseDto)
  async deactivate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    const employee = await this.employeesService.deactivate(companyId, employeeId);
    return successResponse(employee);
  }
}
