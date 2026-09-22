import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getSkipTake } from '../common/dto/pagination.dto';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { EmployeeStatus, ErrorCode } from '../common/enums';
import { normalizeRwandaPhone } from '../common/utils/rwanda-phone.util';
import { mapPostgresUniqueViolation } from '../common/utils/postgres-unique.util';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';

export interface EmployeeCountFilters {
  status?: EmployeeStatus;
}

@Injectable()
export class EmployeesService {
  private static readonly SORT_FIELDS = new Set([
    'createdAt',
    'fullName',
    'phone',
    'status',
  ]);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  async findAll(
    companyId: string,
    query: EmployeeQueryDto,
  ): Promise<{ items: EmployeeResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const qb = this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('employee.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(employee.fullName ILIKE :search OR employee.phone ILIKE :search OR employee.email ILIKE :search OR employee.employeeCode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const { field, order } = this.parseSort(query.sort);
    qb.orderBy(`employee.${field}`, order);

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      items: items.map(EmployeeResponseDto.fromEntity),
      total,
    };
  }

  async findOne(companyId: string, employeeId: string): Promise<EmployeeResponseDto> {
    const employee = await this.getEntityOrThrow(companyId, employeeId);
    return EmployeeResponseDto.fromEntity(employee);
  }

  async create(
    companyId: string,
    dto: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const phone = normalizeRwandaPhone(dto.phone) ?? dto.phone;
    const employee = this.employeeRepository.create({
      companyId,
      fullName: dto.fullName,
      phone,
      email: dto.email ?? null,
      employeeCode: dto.employeeCode ?? null,
      department: dto.department ?? null,
      supervisorId: dto.supervisorId ?? null,
      canRequestTransport: dto.canRequestTransport ?? true,
      userId: dto.userId ?? null,
      status: EmployeeStatus.ACTIVE,
    });

    try {
      const saved = await this.employeeRepository.save(employee);
      return EmployeeResponseDto.fromEntity(saved);
    } catch (error) {
      this.handleUniqueViolation(error, phone);
      throw error;
    }
  }

  async update(
    companyId: string,
    employeeId: string,
    dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.getEntityOrThrow(companyId, employeeId);

    if (dto.fullName !== undefined) employee.fullName = dto.fullName;
    if (dto.phone !== undefined) {
      employee.phone = normalizeRwandaPhone(dto.phone) ?? dto.phone;
    }
    if (dto.email !== undefined) employee.email = dto.email ?? null;
    if (dto.employeeCode !== undefined) employee.employeeCode = dto.employeeCode ?? null;
    if (dto.department !== undefined) employee.department = dto.department ?? null;
    if (dto.supervisorId !== undefined) employee.supervisorId = dto.supervisorId ?? null;
    if (dto.canRequestTransport !== undefined) {
      employee.canRequestTransport = dto.canRequestTransport;
    }
    if (dto.userId !== undefined) employee.userId = dto.userId ?? null;
    if (dto.status !== undefined) employee.status = dto.status;

    try {
      const saved = await this.employeeRepository.save(employee);
      return EmployeeResponseDto.fromEntity(saved);
    } catch (error) {
      if (dto.phone) {
        this.handleUniqueViolation(error, dto.phone);
      }
      throw error;
    }
  }

  async deactivate(companyId: string, employeeId: string): Promise<EmployeeResponseDto> {
    const employee = await this.getEntityOrThrow(companyId, employeeId);
    employee.status = EmployeeStatus.INACTIVE;
    const saved = await this.employeeRepository.save(employee);
    return EmployeeResponseDto.fromEntity(saved);
  }

  async countByCompany(
    companyId: string,
    filters: EmployeeCountFilters = {},
  ): Promise<number> {
    const qb = this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.companyId = :companyId', { companyId });

    if (filters.status) {
      qb.andWhere('employee.status = :status', { status: filters.status });
    }

    return qb.getCount();
  }

  private async getEntityOrThrow(
    companyId: string,
    employeeId: string,
  ): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId, companyId },
    });

    if (!employee) {
      throw new NotFoundDomainException('Employee not found.');
    }

    return employee;
  }

  private parseSort(sort?: string): { field: string; order: 'ASC' | 'DESC' } {
    const [rawField, rawOrder] = (sort ?? 'createdAt:DESC').split(':');
    const field = EmployeesService.SORT_FIELDS.has(rawField)
      ? rawField
      : 'createdAt';
    const order = rawOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { field, order };
  }

  private handleUniqueViolation(error: unknown, phone: string): void {
    if (mapPostgresUniqueViolation(error)) {
      throw new ConflictDomainException(
        ErrorCode.CONFLICT,
        `An employee with phone ${phone} already exists in this company.`,
      );
    }
  }
}
