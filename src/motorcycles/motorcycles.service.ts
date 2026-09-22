import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getSkipTake } from '../common/dto/pagination.dto';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { ErrorCode, MotorcycleStatus } from '../common/enums';
import { mapPostgresUniqueViolation } from '../common/utils/postgres-unique.util';
import { CreateMotorcycleDto } from './dto/create-motorcycle.dto';
import { MotorcycleQueryDto } from './dto/motorcycle-query.dto';
import {
  MotorcycleFleetTotalsDto,
  MotorcycleResponseDto,
} from './dto/motorcycle-response.dto';
import { UpdateMotorcycleStatusDto } from './dto/update-motorcycle-status.dto';
import { UpdateMotorcycleDto } from './dto/update-motorcycle.dto';
import { Motorcycle } from './entities/motorcycle.entity';

export interface MotorcycleCountFilters {
  status?: MotorcycleStatus;
}

@Injectable()
export class MotorcyclesService {
  private static readonly SORT_FIELDS = new Set([
    'createdAt',
    'plateNumber',
    'status',
  ]);

  constructor(
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
  ) {}

  async findAll(
    companyId: string,
    query: MotorcycleQueryDto,
  ): Promise<{ items: MotorcycleResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const qb = this.motorcycleRepository
      .createQueryBuilder('motorcycle')
      .where('motorcycle.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('motorcycle.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(motorcycle.plateNumber ILIKE :search OR motorcycle.internalCode ILIKE :search OR motorcycle.brand ILIKE :search OR motorcycle.model ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const { field, order } = this.parseSort(query.sort);
    qb.orderBy(`motorcycle.${field}`, order);

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      items: items.map(MotorcycleResponseDto.fromEntity),
      total,
    };
  }

  async findOne(
    companyId: string,
    motorcycleId: string,
  ): Promise<MotorcycleResponseDto> {
    const motorcycle = await this.getEntityOrThrow(companyId, motorcycleId);
    return MotorcycleResponseDto.fromEntity(motorcycle);
  }

  async create(
    companyId: string,
    dto: CreateMotorcycleDto,
  ): Promise<MotorcycleResponseDto> {
    const motorcycle = this.motorcycleRepository.create({
      companyId,
      plateNumber: dto.plateNumber,
      internalCode: dto.internalCode ?? null,
      brand: dto.brand ?? null,
      model: dto.model ?? null,
      year: dto.year ?? null,
      color: dto.color ?? null,
      status: MotorcycleStatus.ACTIVE,
    });

    try {
      const saved = await this.motorcycleRepository.save(motorcycle);
      return MotorcycleResponseDto.fromEntity(saved);
    } catch (error) {
      this.handleUniqueViolation(error, dto.plateNumber);
      throw error;
    }
  }

  async update(
    companyId: string,
    motorcycleId: string,
    dto: UpdateMotorcycleDto,
  ): Promise<MotorcycleResponseDto> {
    const motorcycle = await this.getEntityOrThrow(companyId, motorcycleId);

    if (dto.plateNumber !== undefined) motorcycle.plateNumber = dto.plateNumber;
    if (dto.internalCode !== undefined) motorcycle.internalCode = dto.internalCode ?? null;
    if (dto.brand !== undefined) motorcycle.brand = dto.brand ?? null;
    if (dto.model !== undefined) motorcycle.model = dto.model ?? null;
    if (dto.year !== undefined) motorcycle.year = dto.year ?? null;
    if (dto.color !== undefined) motorcycle.color = dto.color ?? null;

    try {
      const saved = await this.motorcycleRepository.save(motorcycle);
      return MotorcycleResponseDto.fromEntity(saved);
    } catch (error) {
      if (dto.plateNumber) {
        this.handleUniqueViolation(error, dto.plateNumber);
      }
      throw error;
    }
  }

  async updateStatus(
    companyId: string,
    motorcycleId: string,
    dto: UpdateMotorcycleStatusDto,
  ): Promise<MotorcycleResponseDto> {
    const motorcycle = await this.getEntityOrThrow(companyId, motorcycleId);
    motorcycle.status = dto.status;
    const saved = await this.motorcycleRepository.save(motorcycle);
    return MotorcycleResponseDto.fromEntity(saved);
  }

  async countByCompany(
    companyId: string,
    filters: MotorcycleCountFilters = {},
  ): Promise<number> {
    const qb = this.motorcycleRepository
      .createQueryBuilder('motorcycle')
      .where('motorcycle.companyId = :companyId', { companyId });

    if (filters.status) {
      qb.andWhere('motorcycle.status = :status', { status: filters.status });
    }

    return qb.getCount();
  }

  async countFleetTotals(companyId: string): Promise<MotorcycleFleetTotalsDto> {
    const rows = await this.motorcycleRepository
      .createQueryBuilder('motorcycle')
      .select('motorcycle.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('motorcycle.companyId = :companyId', { companyId })
      .groupBy('motorcycle.status')
      .getRawMany<{ status: MotorcycleStatus; count: string }>();

    const totals: MotorcycleFleetTotalsDto = {
      total: 0,
      active: 0,
      inactive: 0,
      maintenance: 0,
      suspended: 0,
    };

    for (const row of rows) {
      const count = Number(row.count);
      totals.total += count;

      switch (row.status) {
        case MotorcycleStatus.ACTIVE:
          totals.active = count;
          break;
        case MotorcycleStatus.INACTIVE:
          totals.inactive = count;
          break;
        case MotorcycleStatus.MAINTENANCE:
          totals.maintenance = count;
          break;
        case MotorcycleStatus.SUSPENDED:
          totals.suspended = count;
          break;
      }
    }

    return totals;
  }

  private async getEntityOrThrow(
    companyId: string,
    motorcycleId: string,
  ): Promise<Motorcycle> {
    const motorcycle = await this.motorcycleRepository.findOne({
      where: { id: motorcycleId, companyId },
    });

    if (!motorcycle) {
      throw new NotFoundDomainException('Motorcycle not found.');
    }

    return motorcycle;
  }

  private parseSort(sort?: string): { field: string; order: 'ASC' | 'DESC' } {
    const [rawField, rawOrder] = (sort ?? 'createdAt:DESC').split(':');
    const field = MotorcyclesService.SORT_FIELDS.has(rawField)
      ? rawField
      : 'createdAt';
    const order = rawOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { field, order };
  }

  private handleUniqueViolation(error: unknown, plateNumber: string): void {
    if (mapPostgresUniqueViolation(error)) {
      throw new ConflictDomainException(
        ErrorCode.CONFLICT,
        `A motorcycle with plate ${plateNumber} already exists in this company.`,
      );
    }
  }
}
