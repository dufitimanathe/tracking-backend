import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getSkipTake } from '../common/dto/pagination.dto';
import {
  ConflictDomainException,
  DomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import {
  ErrorCode,
  MembershipStatus,
  RiderAvailabilityStatus,
  RiderStatus,
  UserRole,
  UserStatus,
} from '../common/enums';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { User } from '../users/entities/user.entity';
import { CreateRiderDto } from './dto/create-rider.dto';
import { RiderQueryDto } from './dto/rider-query.dto';
import {
  CreateRiderResultDto,
  RiderResponseDto,
} from './dto/rider-response.dto';
import { UpdateRiderAvailabilityDto } from './dto/update-rider-availability.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { Rider } from './entities/rider.entity';

export interface RiderCountFilters {
  status?: RiderStatus;
  availabilityStatus?: RiderAvailabilityStatus;
}

const MANUAL_AVAILABILITY_TARGETS = new Set<RiderAvailabilityStatus>([
  RiderAvailabilityStatus.OFFLINE,
  RiderAvailabilityStatus.AVAILABLE,
]);

const LOCKED_AVAILABILITY_STATES = new Set<RiderAvailabilityStatus>([
  RiderAvailabilityStatus.RESERVED,
  RiderAvailabilityStatus.ASSIGNED,
  RiderAvailabilityStatus.TO_PICKUP,
  RiderAvailabilityStatus.WAITING_CUSTOMER,
  RiderAvailabilityStatus.ON_TRIP,
]);

@Injectable()
export class RidersService {
  private static readonly SORT_FIELDS = new Set([
    'createdAt',
    'phone',
    'status',
    'availabilityStatus',
  ]);

  constructor(
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
    @InjectRepository(RiderMotorcycleAssignment)
    private readonly assignmentRepository: Repository<RiderMotorcycleAssignment>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    companyId: string,
    query: RiderQueryDto,
  ): Promise<{ items: RiderResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const qb = this.riderRepository
      .createQueryBuilder('rider')
      .where('rider.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('rider.status = :status', { status: query.status });
    }

    if (query.availabilityStatus) {
      qb.andWhere('rider.availabilityStatus = :availabilityStatus', {
        availabilityStatus: query.availabilityStatus,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(rider.phone ILIKE :search OR rider.licenseNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const { field, order } = this.parseSort(query.sort);
    qb.orderBy(`rider.${field}`, order);

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      items: items.map(RiderResponseDto.fromEntity),
      total,
    };
  }

  async findOne(companyId: string, riderId: string): Promise<RiderResponseDto> {
    const rider = await this.getEntityOrThrow(companyId, riderId);
    return RiderResponseDto.fromEntity(rider);
  }

  async create(companyId: string, dto: CreateRiderDto): Promise<CreateRiderResultDto> {
    let temporaryPassword: string | undefined;

    const result = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const riderRepo = manager.getRepository(Rider);
      const memberRepo = manager.getRepository(CompanyMember);

      let user: User;

      if (dto.userId) {
        const existingUser = await userRepo.findOne({ where: { id: dto.userId } });
        if (!existingUser) {
          throw new NotFoundDomainException('User not found.');
        }
        user = existingUser;
      } else {
        const existingByPhone = await userRepo.findOne({ where: { phone: dto.phone } });
        if (existingByPhone) {
          user = existingByPhone;
        } else {
          temporaryPassword = dto.password ?? this.generateTemporaryPassword();
          user = userRepo.create({
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email ?? null,
            phone: dto.phone,
            passwordHash: await argon2.hash(temporaryPassword),
            status: UserStatus.ACTIVE,
          });
          user = await userRepo.save(user);
        }
      }

      const existingMembership = await memberRepo.findOne({
        where: { userId: user.id, companyId },
      });

      if (existingMembership) {
        if (existingMembership.role !== UserRole.RIDER) {
          throw new ConflictDomainException(
            ErrorCode.CONFLICT,
            'User is already a member of this company with a different role.',
          );
        }
        if (existingMembership.status !== MembershipStatus.ACTIVE) {
          existingMembership.status = MembershipStatus.ACTIVE;
          await memberRepo.save(existingMembership);
        }
      } else {
        await memberRepo.save(
          memberRepo.create({
            userId: user.id,
            companyId,
            role: UserRole.RIDER,
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
          }),
        );
      }

      const existingRider = await riderRepo.findOne({
        where: { companyId, userId: user.id },
      });

      if (existingRider) {
        throw new ConflictDomainException(
          ErrorCode.CONFLICT,
          'Rider profile already exists for this user in this company.',
        );
      }

      const rider = await riderRepo.save(
        riderRepo.create({
          companyId,
          userId: user.id,
          phone: dto.phone,
          licenseNumber: dto.licenseNumber ?? null,
          status: RiderStatus.ACTIVE,
          availabilityStatus: RiderAvailabilityStatus.OFFLINE,
        }),
      );

      return rider;
    });

    return {
      ...RiderResponseDto.fromEntity(result),
      temporaryPassword,
    };
  }

  async updateStatus(
    companyId: string,
    riderId: string,
    dto: UpdateRiderDto,
  ): Promise<RiderResponseDto> {
    const rider = await this.getEntityOrThrow(companyId, riderId);
    rider.status = dto.status;

    if (
      dto.status !== RiderStatus.ACTIVE &&
      rider.availabilityStatus !== RiderAvailabilityStatus.OFFLINE
    ) {
      rider.availabilityStatus = RiderAvailabilityStatus.OFFLINE;
    }

    const saved = await this.riderRepository.save(rider);
    return RiderResponseDto.fromEntity(saved);
  }

  async updateAvailability(
    companyId: string,
    riderId: string,
    dto: UpdateRiderAvailabilityDto,
    actor: AuthUser,
    actorRole: UserRole,
  ): Promise<RiderResponseDto> {
    const rider = await this.getEntityOrThrow(companyId, riderId);

    if (actorRole === UserRole.RIDER && rider.userId !== actor.id) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Riders can only update their own availability.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (rider.status !== RiderStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.RIDER_NOT_AVAILABLE,
        'Inactive riders cannot change availability.',
      );
    }

    if (LOCKED_AVAILABILITY_STATES.has(rider.availabilityStatus)) {
      throw new DomainException(
        ErrorCode.TRIP_INVALID_STATE,
        'Availability cannot be changed while the rider is assigned to a trip.',
      );
    }

    if (!MANUAL_AVAILABILITY_TARGETS.has(dto.availabilityStatus)) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Only OFFLINE and AVAILABLE availability statuses can be set manually.',
      );
    }

    if (dto.availabilityStatus === RiderAvailabilityStatus.AVAILABLE) {
      const activeAssignment = await this.assignmentRepository.findOne({
        where: {
          companyId,
          riderId: rider.id,
          active: true,
        },
      });

      if (!activeAssignment) {
        throw new DomainException(
          ErrorCode.MOTORCYCLE_NOT_AVAILABLE,
          'Rider must have an active motorcycle assignment before going available.',
        );
      }
    }

    rider.availabilityStatus = dto.availabilityStatus;
    const saved = await this.riderRepository.save(rider);
    return RiderResponseDto.fromEntity(saved);
  }

  async countByCompany(
    companyId: string,
    filters: RiderCountFilters = {},
  ): Promise<number> {
    const qb = this.riderRepository
      .createQueryBuilder('rider')
      .where('rider.companyId = :companyId', { companyId });

    if (filters.status) {
      qb.andWhere('rider.status = :status', { status: filters.status });
    }

    if (filters.availabilityStatus) {
      qb.andWhere('rider.availabilityStatus = :availabilityStatus', {
        availabilityStatus: filters.availabilityStatus,
      });
    }

    return qb.getCount();
  }

  async countActiveRiders(companyId: string): Promise<number> {
    return this.countByCompany(companyId, { status: RiderStatus.ACTIVE });
  }

  async countAvailableRiders(companyId: string): Promise<number> {
    return this.countByCompany(companyId, {
      status: RiderStatus.ACTIVE,
      availabilityStatus: RiderAvailabilityStatus.AVAILABLE,
    });
  }

  private async getEntityOrThrow(companyId: string, riderId: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { id: riderId, companyId },
    });

    if (!rider) {
      throw new NotFoundDomainException('Rider not found.');
    }

    return rider;
  }

  private parseSort(sort?: string): { field: string; order: 'ASC' | 'DESC' } {
    const [rawField, rawOrder] = (sort ?? 'createdAt:DESC').split(':');
    const field = RidersService.SORT_FIELDS.has(rawField) ? rawField : 'createdAt';
    const order = rawOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { field, order };
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64url');
  }
}
