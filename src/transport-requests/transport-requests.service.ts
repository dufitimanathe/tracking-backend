import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { getSkipTake } from '../common/dto/pagination.dto';
import {
  ConflictDomainException,
  DomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import {
  ErrorCode,
  TransportRequestChannel,
  TransportRequestStatus,
  UserRole,
} from '../common/enums';
import { toPointWkt } from '../common/utils/geo.util';
import { PricingService } from '../billing/pricing.service';
import { Employee } from '../employees/entities/employee.entity';
import { MapsService } from '../maps/maps.service';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateTransportRequestDto } from './dto/create-transport-request.dto';
import { TransportRequestQueryDto } from './dto/transport-request-query.dto';
import { TransportRequestResponseDto } from './dto/transport-request-response.dto';
import { TransportRequest } from './entities/transport-request.entity';

const APPROVAL_CHANNELS = new Set<TransportRequestChannel>([
  TransportRequestChannel.WEB,
  TransportRequestChannel.ADMIN,
]);

const PENDING_STATUSES: TransportRequestStatus[] = [
  TransportRequestStatus.PENDING_CONFIRMATION,
  TransportRequestStatus.PENDING_APPROVAL,
  TransportRequestStatus.APPROVED,
  TransportRequestStatus.DISPATCHING,
];

const CANCELLABLE_STATUSES = new Set<TransportRequestStatus>([
  TransportRequestStatus.PENDING_CONFIRMATION,
  TransportRequestStatus.PENDING_APPROVAL,
  TransportRequestStatus.APPROVED,
  TransportRequestStatus.DISPATCHING,
]);

@Injectable()
export class TransportRequestsService {
  private static readonly SORT_FIELDS = new Set(['createdAt', 'requestedPickupTime', 'status']);

  constructor(
    @InjectRepository(TransportRequest)
    private readonly transportRequestRepository: Repository<TransportRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly mapsService: MapsService,
    private readonly pricingService: PricingService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async create(
    companyId: string,
    dto: CreateTransportRequestDto,
    actor: AuthUser,
    actorRole: UserRole,
  ): Promise<TransportRequestResponseDto> {
    const employeeId = await this.resolveEmployeeId(
      companyId,
      dto.employeeId,
      actor,
      actorRole,
    );

    const channel = dto.channel ?? TransportRequestChannel.ADMIN;
    const status = APPROVAL_CHANNELS.has(channel)
      ? TransportRequestStatus.PENDING_APPROVAL
      : TransportRequestStatus.PENDING_CONFIRMATION;

    const route = await this.mapsService.calculateRoute(
      { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
      { lat: dto.destinationLatitude, lng: dto.destinationLongitude },
    );

    const estimatedDistanceKm = dto.estimatedDistanceKm ?? route.distanceMeters / 1000;
    const estimatedDurationMinutes = Math.ceil(route.durationSeconds / 60);
    const estimatedPrice = await this.pricingService.calculatePriceForCompany(
      companyId,
      estimatedDistanceKm,
    );

    const request = this.transportRequestRepository.create({
      companyId,
      employeeId,
      createdById: dto.createdById ?? actor.id,
      pickupAddress: dto.pickupAddress,
      pickupLocation: toPointWkt({
        lat: dto.pickupLatitude,
        lng: dto.pickupLongitude,
      }),
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      destinationAddress: dto.destinationAddress,
      destinationLocation: toPointWkt({
        lat: dto.destinationLatitude,
        lng: dto.destinationLongitude,
      }),
      destinationLatitude: dto.destinationLatitude,
      destinationLongitude: dto.destinationLongitude,
      requestedAt: new Date(),
      requestedPickupTime: new Date(dto.requestedPickupTime),
      channel,
      status,
      estimatedDistanceKm: estimatedDistanceKm.toFixed(3),
      estimatedDurationMinutes,
      estimatedPrice,
      notes: dto.notes ?? null,
    });

    const saved = await this.transportRequestRepository.save(request);
    const response = TransportRequestResponseDto.fromEntity(saved);

    this.realtimeService.emitToCompany(
      companyId,
      REALTIME_EVENTS.TRANSPORT_REQUEST_CREATED,
      response,
    );

    return response;
  }

  async createFromWhatsApp(
    companyId: string,
    employeeId: string,
    input: {
      pickupAddress: string;
      pickupLatitude: number;
      pickupLongitude: number;
      destinationAddress: string;
      destinationLatitude: number;
      destinationLongitude: number;
      requestedPickupTime?: string;
      notes?: string;
    },
    pendingConfirmation = true,
  ): Promise<TransportRequestResponseDto> {
    const route = await this.mapsService.calculateRoute(
      { lat: input.pickupLatitude, lng: input.pickupLongitude },
      { lat: input.destinationLatitude, lng: input.destinationLongitude },
    );

    const estimatedDistanceKm = route.distanceMeters / 1000;
    const estimatedPrice = await this.pricingService.calculatePriceForCompany(
      companyId,
      estimatedDistanceKm,
    );

    const request = this.transportRequestRepository.create({
      companyId,
      employeeId,
      pickupAddress: input.pickupAddress,
      pickupLocation: toPointWkt({
        lat: input.pickupLatitude,
        lng: input.pickupLongitude,
      }),
      pickupLatitude: input.pickupLatitude,
      pickupLongitude: input.pickupLongitude,
      destinationAddress: input.destinationAddress,
      destinationLocation: toPointWkt({
        lat: input.destinationLatitude,
        lng: input.destinationLongitude,
      }),
      destinationLatitude: input.destinationLatitude,
      destinationLongitude: input.destinationLongitude,
      requestedAt: new Date(),
      requestedPickupTime: new Date(
        input.requestedPickupTime ?? new Date(Date.now() + 30 * 60_000).toISOString(),
      ),
      channel: TransportRequestChannel.WHATSAPP,
      status: pendingConfirmation
        ? TransportRequestStatus.PENDING_CONFIRMATION
        : TransportRequestStatus.PENDING_APPROVAL,
      estimatedDistanceKm: estimatedDistanceKm.toFixed(3),
      estimatedDurationMinutes: Math.ceil(route.durationSeconds / 60),
      estimatedPrice,
      notes: input.notes ?? null,
    });

    const saved = await this.transportRequestRepository.save(request);
    return TransportRequestResponseDto.fromEntity(saved);
  }

  async confirmRequest(
    companyId: string,
    requestId: string,
  ): Promise<TransportRequestResponseDto> {
    const request = await this.findByIdOrFail(companyId, requestId);

    if (request.status !== TransportRequestStatus.PENDING_CONFIRMATION) {
      return TransportRequestResponseDto.fromEntity(request);
    }

    request.status = TransportRequestStatus.PENDING_APPROVAL;
    const saved = await this.transportRequestRepository.save(request);
    return TransportRequestResponseDto.fromEntity(saved);
  }

  async findAll(
    companyId: string,
    query: TransportRequestQueryDto,
  ): Promise<{ items: TransportRequestResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const qb = this.transportRequestRepository
      .createQueryBuilder('request')
      .where('request.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(request.pickupAddress ILIKE :search OR request.destinationAddress ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const { field, order } = this.parseSort(query.sort);
    qb.orderBy(`request.${field}`, order);

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      items: await this.toResponseDtos(items),
      total,
    };
  }

  async findOne(companyId: string, requestId: string): Promise<TransportRequestResponseDto> {
    const request = await this.findByIdOrFail(companyId, requestId);
    const [dto] = await this.toResponseDtos([request]);
    return dto;
  }

  async cancel(
    companyId: string,
    requestId: string,
  ): Promise<TransportRequestResponseDto> {
    const request = await this.findByIdOrFail(companyId, requestId);

    if (!CANCELLABLE_STATUSES.has(request.status)) {
      throw new ConflictDomainException(
        ErrorCode.REQUEST_ALREADY_PROCESSED,
        'Transport request cannot be cancelled in its current state.',
      );
    }

    request.status = TransportRequestStatus.CANCELLED;
    const saved = await this.transportRequestRepository.save(request);
    return TransportRequestResponseDto.fromEntity(saved);
  }

  async findByIdOrFail(companyId: string, requestId: string): Promise<TransportRequest> {
    const request = await this.transportRequestRepository.findOne({
      where: { id: requestId, companyId },
    });

    if (!request) {
      throw new NotFoundDomainException('Transport request not found.');
    }

    return request;
  }

  async countPending(companyId: string): Promise<number> {
    return this.transportRequestRepository.count({
      where: { companyId, status: In(PENDING_STATUSES) },
    });
  }

  private async resolveEmployeeId(
    companyId: string,
    requestedEmployeeId: string | undefined,
    actor: AuthUser,
    actorRole: UserRole,
  ): Promise<string> {
    if (actorRole === UserRole.EMPLOYEE) {
      const employee = await this.employeeRepository.findOne({
        where: { companyId, userId: actor.id },
      });

      if (!employee) {
        throw new DomainException(
          ErrorCode.NOT_FOUND,
          'Employee profile not found for this user.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (requestedEmployeeId && requestedEmployeeId !== employee.id) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'Employees can only create transport requests for themselves.',
          HttpStatus.FORBIDDEN,
        );
      }

      return employee.id;
    }

    if (!requestedEmployeeId) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'employeeId is required when creating a request on behalf of an employee.',
      );
    }

    const employee = await this.employeeRepository.findOne({
      where: { id: requestedEmployeeId, companyId },
    });

    if (!employee) {
      throw new NotFoundDomainException('Employee not found.');
    }

    return employee.id;
  }

  private async toResponseDtos(
    requests: TransportRequest[],
  ): Promise<TransportRequestResponseDto[]> {
    if (requests.length === 0) {
      return [];
    }

    const employeeIds = [...new Set(requests.map((r) => r.employeeId))];
    const employees = await this.employeeRepository.find({
      where: { id: In(employeeIds) },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    return requests.map((request) => {
      const employee = employeeMap.get(request.employeeId);
      return TransportRequestResponseDto.fromEntity(request, {
        employeeName: employee?.fullName ?? null,
        employeePhone: employee?.phone ?? null,
        department: employee?.department ?? null,
      });
    });
  }

  private parseSort(sort?: string): { field: string; order: 'ASC' | 'DESC' } {
    const [rawField, rawOrder] = (sort ?? 'createdAt:DESC').split(':');
    const field = TransportRequestsService.SORT_FIELDS.has(rawField)
      ? rawField
      : 'createdAt';
    const order = rawOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { field, order };
  }
}
