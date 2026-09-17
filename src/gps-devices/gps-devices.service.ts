import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getSkipTake } from '../common/dto/pagination.dto';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { ErrorCode, GPSDeviceStatus } from '../common/enums';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { CreateGpsDeviceDto } from './dto/create-gps-device.dto';
import { GpsDeviceQueryDto } from './dto/gps-device-query.dto';
import { GpsDeviceResponseDto } from './dto/gps-device-response.dto';
import { UpdateGpsDeviceDto } from './dto/update-gps-device.dto';
import { GpsDevice } from './entities/gps-device.entity';

export interface GpsDeviceCountFilters {
  status?: GPSDeviceStatus;
  motorcycleId?: string;
}

@Injectable()
export class GpsDevicesService {
  private static readonly SORT_FIELDS = new Set([
    'createdAt',
    'externalDeviceId',
    'status',
    'lastSeenAt',
  ]);

  constructor(
    @InjectRepository(GpsDevice)
    private readonly gpsDeviceRepository: Repository<GpsDevice>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
  ) {}

  async findAll(
    companyId: string,
    query: GpsDeviceQueryDto,
  ): Promise<{ items: GpsDeviceResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const qb = this.gpsDeviceRepository
      .createQueryBuilder('device')
      .where('device.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('device.status = :status', { status: query.status });
    }

    if (query.motorcycleId) {
      qb.andWhere('device.motorcycleId = :motorcycleId', {
        motorcycleId: query.motorcycleId,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(device.externalDeviceId ILIKE :search OR device.provider ILIKE :search OR device.imei ILIKE :search OR device.simNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const { field, order } = this.parseSort(query.sort);
    qb.orderBy(`device.${field}`, order);

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      items: items.map(GpsDeviceResponseDto.fromEntity),
      total,
    };
  }

  async findOne(companyId: string, deviceId: string): Promise<GpsDeviceResponseDto> {
    const device = await this.getEntityOrThrow(companyId, deviceId);
    return GpsDeviceResponseDto.fromEntity(device);
  }

  async create(
    companyId: string,
    dto: CreateGpsDeviceDto,
  ): Promise<GpsDeviceResponseDto> {
    await this.ensureMotorcycleInCompany(companyId, dto.motorcycleId);
    await this.ensureUniqueExternalDevice(
      companyId,
      dto.provider ?? null,
      dto.externalDeviceId,
    );

    const device = this.gpsDeviceRepository.create({
      companyId,
      motorcycleId: dto.motorcycleId,
      provider: dto.provider ?? null,
      externalDeviceId: dto.externalDeviceId,
      imei: dto.imei ?? null,
      simNumber: dto.simNumber ?? null,
      status: GPSDeviceStatus.ACTIVE,
    });

    const saved = await this.gpsDeviceRepository.save(device);
    return GpsDeviceResponseDto.fromEntity(saved);
  }

  async update(
    companyId: string,
    deviceId: string,
    dto: UpdateGpsDeviceDto,
  ): Promise<GpsDeviceResponseDto> {
    const device = await this.getEntityOrThrow(companyId, deviceId);

    if (dto.motorcycleId !== undefined) {
      await this.ensureMotorcycleInCompany(companyId, dto.motorcycleId);
      device.motorcycleId = dto.motorcycleId;
    }

    const nextProvider = dto.provider !== undefined ? dto.provider ?? null : device.provider ?? null;
    const nextExternalId =
      dto.externalDeviceId !== undefined ? dto.externalDeviceId : device.externalDeviceId;

    if (
      dto.provider !== undefined ||
      dto.externalDeviceId !== undefined
    ) {
      await this.ensureUniqueExternalDevice(
        companyId,
        nextProvider,
        nextExternalId,
        device.id,
      );
    }

    if (dto.provider !== undefined) device.provider = dto.provider ?? null;
    if (dto.externalDeviceId !== undefined) device.externalDeviceId = dto.externalDeviceId;
    if (dto.imei !== undefined) device.imei = dto.imei ?? null;
    if (dto.simNumber !== undefined) device.simNumber = dto.simNumber ?? null;
    if (dto.status !== undefined) device.status = dto.status;

    const saved = await this.gpsDeviceRepository.save(device);
    return GpsDeviceResponseDto.fromEntity(saved);
  }

  async deactivate(companyId: string, deviceId: string): Promise<GpsDeviceResponseDto> {
    const device = await this.getEntityOrThrow(companyId, deviceId);
    device.status = GPSDeviceStatus.INACTIVE;
    const saved = await this.gpsDeviceRepository.save(device);
    return GpsDeviceResponseDto.fromEntity(saved);
  }

  async countByCompany(
    companyId: string,
    filters: GpsDeviceCountFilters = {},
  ): Promise<number> {
    const qb = this.gpsDeviceRepository
      .createQueryBuilder('device')
      .where('device.companyId = :companyId', { companyId });

    if (filters.status) {
      qb.andWhere('device.status = :status', { status: filters.status });
    }

    if (filters.motorcycleId) {
      qb.andWhere('device.motorcycleId = :motorcycleId', {
        motorcycleId: filters.motorcycleId,
      });
    }

    return qb.getCount();
  }

  private async getEntityOrThrow(
    companyId: string,
    deviceId: string,
  ): Promise<GpsDevice> {
    const device = await this.gpsDeviceRepository.findOne({
      where: { id: deviceId, companyId },
    });

    if (!device) {
      throw new NotFoundDomainException('GPS device not found.');
    }

    return device;
  }

  private async ensureMotorcycleInCompany(
    companyId: string,
    motorcycleId: string,
  ): Promise<void> {
    const motorcycle = await this.motorcycleRepository.findOne({
      where: { id: motorcycleId, companyId },
    });

    if (!motorcycle) {
      throw new NotFoundDomainException('Motorcycle not found.');
    }
  }

  private async ensureUniqueExternalDevice(
    companyId: string,
    provider: string | null,
    externalDeviceId: string,
    excludeDeviceId?: string,
  ): Promise<void> {
    const qb = this.gpsDeviceRepository
      .createQueryBuilder('device')
      .where('device.companyId = :companyId', { companyId })
      .andWhere('device.externalDeviceId = :externalDeviceId', { externalDeviceId });

    if (provider) {
      qb.andWhere('device.provider = :provider', { provider });
    } else {
      qb.andWhere('device.provider IS NULL');
    }

    if (excludeDeviceId) {
      qb.andWhere('device.id != :excludeDeviceId', { excludeDeviceId });
    }

    const existing = await qb.getOne();

    if (existing) {
      throw new ConflictDomainException(
        ErrorCode.CONFLICT,
        'A GPS device with this external ID already exists for the provider in this company.',
      );
    }
  }

  private parseSort(sort?: string): { field: string; order: 'ASC' | 'DESC' } {
    const [rawField, rawOrder] = (sort ?? 'createdAt:DESC').split(':');
    const field = GpsDevicesService.SORT_FIELDS.has(rawField) ? rawField : 'createdAt';
    const order = rawOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { field, order };
  }
}
