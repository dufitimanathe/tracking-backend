import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
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
  TripStatus,
  UserRole,
  UserStatus,
} from '../common/enums';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { normalizeRwandaPhone } from '../common/utils/rwanda-phone.util';
import { mapPostgresUniqueViolation } from '../common/utils/postgres-unique.util';
import { generateActivationCode } from '../common/utils/activation-code.util';
import { EmailActivationToken } from '../auth/entities/email-activation-token.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { MailService } from '../mail/mail.service';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { Trip } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';
import { CreateRiderDto } from './dto/create-rider.dto';
import { RiderQueryDto } from './dto/rider-query.dto';
import {
  CreateRiderResultDto,
  RiderMeResponseDto,
  RiderResponseDto,
} from './dto/rider-response.dto';
import { UpdateRiderAvailabilityDto } from './dto/update-rider-availability.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { Rider } from './entities/rider.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';

export interface RiderCountFilters {
  status?: RiderStatus;
  availabilityStatus?: RiderAvailabilityStatus;
}

const MANUAL_AVAILABILITY_TARGETS = new Set<RiderAvailabilityStatus>([
  RiderAvailabilityStatus.OFFLINE,
  RiderAvailabilityStatus.AVAILABLE,
  RiderAvailabilityStatus.BUSY,
]);

const LOCKED_AVAILABILITY_STATES = new Set<RiderAvailabilityStatus>([
  RiderAvailabilityStatus.RESERVED,
  RiderAvailabilityStatus.ASSIGNED,
  RiderAvailabilityStatus.TO_PICKUP,
  RiderAvailabilityStatus.WAITING_CUSTOMER,
  RiderAvailabilityStatus.ON_TRIP,
]);

const ACTIVE_TRIP_STATUSES: TripStatus[] = [
  TripStatus.SEARCHING_RIDER,
  TripStatus.RIDER_ASSIGNED,
  TripStatus.RIDER_ACCEPTED,
  TripStatus.RIDER_TO_PICKUP,
  TripStatus.RIDER_ARRIVED,
  TripStatus.IN_PROGRESS,
];

@Injectable()
export class RidersService {
  private readonly logger = new Logger(RidersService.name);

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
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
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
    } else {
      // Deleted riders stay in DB for trip history but are hidden from the list.
      qb.andWhere('rider.status != :inactiveStatus', {
        inactiveStatus: RiderStatus.INACTIVE,
      });
    }

    if (query.availabilityStatus) {
      qb.andWhere('rider.availabilityStatus = :availabilityStatus', {
        availabilityStatus: query.availabilityStatus,
      });
    }

    // Hide riders whose membership was marked LEFT (legacy soft-delete path).
    qb.andWhere(
      `NOT EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm."userId" = rider."userId"
          AND cm."companyId" = rider."companyId"
          AND cm.role = :riderRole
          AND cm.status = :leftStatus
      )`,
      { riderRole: UserRole.RIDER, leftStatus: MembershipStatus.LEFT },
    );

    if (query.search) {
      qb.leftJoin(User, 'user', 'user.id = rider.userId').andWhere(
        `(rider.phone ILIKE :search
          OR rider.licenseNumber ILIKE :search
          OR user.firstName ILIKE :search
          OR user.lastName ILIKE :search
          OR CONCAT(user.firstName, ' ', user.lastName) ILIKE :search)`,
        { search: `%${query.search}%` },
      );
    }

    const { field, order } = this.parseSort(query.sort);
    qb.orderBy(`rider.${field}`, order);

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      items: await this.toResponseDtos(items),
      total,
    };
  }

  async findOne(companyId: string, riderId: string): Promise<RiderResponseDto> {
    const rider = await this.getEntityOrThrow(companyId, riderId);
    const [dto] = await this.toResponseDtos([rider]);
    return dto;
  }

  async findMe(companyId: string, userId: string): Promise<RiderMeResponseDto> {
    const rider = await this.riderRepository.findOne({
      where: { companyId, userId },
    });
    if (!rider) {
      throw new NotFoundDomainException('Rider profile not found for this user.');
    }

    const [dto] = await this.toResponseDtos([rider]);
    const assignment = await this.assignmentRepository.findOne({
      where: { companyId, riderId: rider.id, active: true },
    });

    let motorcycle: RiderMeResponseDto['motorcycle'] = null;
    if (assignment) {
      const moto = await this.dataSource.getRepository(Motorcycle).findOne({
        where: { id: assignment.motorcycleId, companyId },
      });
      if (moto) {
        motorcycle = {
          id: moto.id,
          plateNumber: moto.plateNumber,
          internalCode: moto.internalCode ?? null,
          brand: moto.brand ?? null,
          model: moto.model ?? null,
          year: moto.year ?? null,
          color: moto.color ?? null,
          status: moto.status,
          trackingStatus: moto.trackingStatus,
        };
      }
    }

    return {
      ...dto,
      motorcycle,
      assignmentId: assignment?.id ?? null,
    };
  }

  async create(companyId: string, dto: CreateRiderDto): Promise<CreateRiderResultDto> {
    const phone = normalizeRwandaPhone(dto.phone) ?? dto.phone;
    const email = dto.email.trim().toLowerCase();

    if (!email) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Email is required so the rider can activate the FleetOps mobile app.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundDomainException('Company not found.');
    }

    if (dto.userId) {
      // Linking an existing platform user — no invite email.
      const rider = await this.createLinkedRider(companyId, dto, phone);
      return { ...RiderResponseDto.fromEntity(rider), inviteSent: false };
    }

    if (!this.mailService.isConfigured()) {
      throw new DomainException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Email service is not configured. Set MAILER_* so riders can activate on the mobile app.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let tx: {
      rider: Rider;
      user: User;
      membership: CompanyMember;
      rawToken: string | undefined;
      createdNewUser: boolean;
      needsInvite: boolean;
    };
    try {
      tx = await this.dataSource.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const riderRepo = manager.getRepository(Rider);
        const memberRepo = manager.getRepository(CompanyMember);
        const tokenRepo = manager.getRepository(EmailActivationToken);

        const userByEmail = await userRepo.findOne({ where: { email } });
        const userByPhone = await userRepo.findOne({ where: { phone } });

        if (
          userByEmail &&
          userByPhone &&
          userByEmail.id !== userByPhone.id
        ) {
          throw new ConflictDomainException(
            ErrorCode.CONFLICT,
            'This email and phone belong to two different existing accounts. Use matching contact details, or update the existing user first.',
          );
        }

        let user = userByEmail ?? userByPhone;
        let createdNewUser = false;
        let needsInvite = false;

        const priorRider = user
          ? await riderRepo.findOne({ where: { companyId, userId: user.id } })
          : null;
        const priorMembership = user
          ? await memberRepo.findOne({ where: { userId: user.id, companyId } })
          : null;

        const priorIsGone =
          Boolean(priorRider) &&
          (priorRider!.status === RiderStatus.INACTIVE ||
            priorMembership?.status === MembershipStatus.LEFT);

        // Re-add a previously deleted/left rider instead of inserting a conflicting user.
        if (user && priorRider && priorIsGone) {
          if (priorMembership && priorMembership.role !== UserRole.RIDER) {
            throw new ConflictDomainException(
              ErrorCode.CONFLICT,
              'User is already a member of this company with a different role.',
            );
          }

          needsInvite =
            user.status === UserStatus.PENDING_VERIFICATION ||
            user.status === UserStatus.INACTIVE;
          if (needsInvite) {
            user.status = UserStatus.PENDING_VERIFICATION;
          }
          this.applyContactDetails(user, email, phone);
          user.firstName = dto.firstName.trim();
          user.lastName = dto.lastName.trim();
          await userRepo.save(user);

          let membership = priorMembership;
          if (membership) {
            membership.role = UserRole.RIDER;
            membership.status = needsInvite
              ? MembershipStatus.INVITED
              : MembershipStatus.ACTIVE;
            membership.joinedAt = new Date();
            membership = await memberRepo.save(membership);
          } else {
            membership = await memberRepo.save(
              memberRepo.create({
                userId: user.id,
                companyId,
                role: UserRole.RIDER,
                status: needsInvite
                  ? MembershipStatus.INVITED
                  : MembershipStatus.ACTIVE,
                joinedAt: new Date(),
              }),
            );
          }

          priorRider.phone = phone;
          priorRider.licenseNumber = dto.licenseNumber ?? priorRider.licenseNumber;
          priorRider.status = RiderStatus.ACTIVE;
          priorRider.availabilityStatus = RiderAvailabilityStatus.OFFLINE;
          const rider = await riderRepo.save(priorRider);

          let rawToken: string | undefined;
          if (needsInvite) {
            await tokenRepo.delete({ userId: user.id, companyId });
            rawToken = generateActivationCode();
            const expiresHours =
              this.configService.get<number>('app.activationTokenTtlHours') ?? 72;
            await tokenRepo.save(
              tokenRepo.create({
                userId: user.id,
                companyId,
                membershipId: membership.id,
                tokenHash: this.hashToken(rawToken),
                expiresAt: new Date(Date.now() + expiresHours * 60 * 60 * 1000),
              }),
            );
          }

          return {
            rider,
            user,
            membership,
            rawToken,
            createdNewUser: false,
            needsInvite,
          };
        }

        if (!user) {
          createdNewUser = true;
          needsInvite = true;
          const placeholderPassword = dto.password ?? this.generateTemporaryPassword();
          user = await userRepo.save(
            userRepo.create({
              firstName: dto.firstName.trim(),
              lastName: dto.lastName.trim(),
              email,
              phone,
              passwordHash: await argon2.hash(placeholderPassword),
              status: UserStatus.PENDING_VERIFICATION,
            }),
          );
        } else if (user.status === UserStatus.PENDING_VERIFICATION) {
          needsInvite = true;
          this.applyContactDetails(user, email, phone);
          user.firstName = dto.firstName.trim();
          user.lastName = dto.lastName.trim();
          await userRepo.save(user);
        } else if (user.status === UserStatus.INACTIVE) {
          needsInvite = true;
          user.status = UserStatus.PENDING_VERIFICATION;
          this.applyContactDetails(user, email, phone);
          user.firstName = dto.firstName.trim();
          user.lastName = dto.lastName.trim();
          await userRepo.save(user);
        } else {
          this.applyContactDetails(user, email, phone);
          await userRepo.save(user);
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
          if (existingMembership.status !== MembershipStatus.LEFT) {
            throw new ConflictDomainException(
              ErrorCode.CONFLICT,
              'This user is already a rider in this company.',
            );
          }
        }

        const existingRider = await riderRepo.findOne({
          where: { companyId, userId: user.id },
        });
        if (existingRider && existingRider.status !== RiderStatus.INACTIVE) {
          throw new ConflictDomainException(
            ErrorCode.CONFLICT,
            'Rider profile already exists for this user in this company.',
          );
        }

        let membership: CompanyMember;
        if (existingMembership) {
          existingMembership.status = needsInvite
            ? MembershipStatus.INVITED
            : MembershipStatus.ACTIVE;
          existingMembership.joinedAt = new Date();
          membership = await memberRepo.save(existingMembership);
        } else {
          membership = await memberRepo.save(
            memberRepo.create({
              userId: user.id,
              companyId,
              role: UserRole.RIDER,
              status: needsInvite ? MembershipStatus.INVITED : MembershipStatus.ACTIVE,
              joinedAt: new Date(),
            }),
          );
        }

        let rider: Rider;
        if (existingRider) {
          existingRider.phone = phone;
          existingRider.licenseNumber = dto.licenseNumber ?? null;
          existingRider.status = RiderStatus.ACTIVE;
          existingRider.availabilityStatus = RiderAvailabilityStatus.OFFLINE;
          rider = await riderRepo.save(existingRider);
        } else {
          rider = await riderRepo.save(
            riderRepo.create({
              companyId,
              userId: user.id,
              phone,
              licenseNumber: dto.licenseNumber ?? null,
              status: RiderStatus.ACTIVE,
              availabilityStatus: RiderAvailabilityStatus.OFFLINE,
            }),
          );
        }

        let rawToken: string | undefined;
        if (needsInvite) {
          await tokenRepo.delete({ userId: user.id, companyId });
          rawToken = generateActivationCode();
          const expiresHours =
            this.configService.get<number>('app.activationTokenTtlHours') ?? 72;
          await tokenRepo.save(
            tokenRepo.create({
              userId: user.id,
              companyId,
              membershipId: membership.id,
              tokenHash: this.hashToken(rawToken),
              expiresAt: new Date(Date.now() + expiresHours * 60 * 60 * 1000),
            }),
          );
        }

        return { rider, user, membership, rawToken, createdNewUser, needsInvite };
      });
    } catch (error) {
      const mapped = mapPostgresUniqueViolation(error);
      if (mapped) {
        throw new ConflictDomainException(ErrorCode.CONFLICT, mapped);
      }
      throw error;
    }

    if (tx.needsInvite && tx.rawToken) {
      const expiresHours =
        this.configService.get<number>('app.activationTokenTtlHours') ?? 72;
      const webUrl =
        this.configService.get<string>('app.publicWebUrl') ?? 'http://localhost:3001';
      // Browser activation works without a published app build. Token is also in the email body.
      const activationUrl = `${webUrl}/activate?token=${encodeURIComponent(tx.rawToken)}`;

      try {
        await this.mailService.sendInviteActivationEmail({
          to: email,
          firstName: dto.firstName.trim(),
          companyName: company.name,
          roleLabel: 'Rider',
          activationUrl,
          activationToken: tx.rawToken,
          expiresHours,
          mobileApp: true,
        });
      } catch (error) {
        this.logger.error(`Failed to send rider invite email: ${String(error)}`);
        await this.dataSource.transaction(async (manager) => {
          await manager.getRepository(EmailActivationToken).delete({
            userId: tx.user.id,
            membershipId: tx.membership.id,
          });
          await manager.getRepository(Rider).delete({ id: tx.rider.id });
          await manager.getRepository(CompanyMember).delete({ id: tx.membership.id });
          if (tx.createdNewUser) {
            await manager.getRepository(User).delete({ id: tx.user.id });
          }
        });
        throw new DomainException(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Rider invite email could not be sent. Rider was not created. Check MAILER_* settings and retry.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        ...RiderResponseDto.fromEntity(tx.rider),
        inviteSent: true,
        activationToken: tx.rawToken,
      };
    }

    return {
      ...RiderResponseDto.fromEntity(tx.rider),
      inviteSent: false,
    };
  }

  private async createLinkedRider(
    companyId: string,
    dto: CreateRiderDto,
    phone: string,
  ): Promise<Rider> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const riderRepo = manager.getRepository(Rider);
      const memberRepo = manager.getRepository(CompanyMember);

      const existingUser = await userRepo.findOne({ where: { id: dto.userId } });
      if (!existingUser) {
        throw new NotFoundDomainException('User not found.');
      }

      const existingMembership = await memberRepo.findOne({
        where: { userId: existingUser.id, companyId },
      });
      if (existingMembership) {
        throw new ConflictDomainException(
          ErrorCode.CONFLICT,
          'User is already a member of this company.',
        );
      }

      await memberRepo.save(
        memberRepo.create({
          userId: existingUser.id,
          companyId,
          role: UserRole.RIDER,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        }),
      );

      return riderRepo.save(
        riderRepo.create({
          companyId,
          userId: existingUser.id,
          phone,
          licenseNumber: dto.licenseNumber ?? null,
          status: RiderStatus.ACTIVE,
          availabilityStatus: RiderAvailabilityStatus.OFFLINE,
        }),
      );
    });
  }

  async updateStatus(
    companyId: string,
    riderId: string,
    dto: UpdateRiderDto,
  ): Promise<RiderResponseDto> {
    const rider = await this.getEntityOrThrow(companyId, riderId);
    const user = await this.userRepository.findOne({ where: { id: rider.userId } });
    const changes: string[] = [];

    if (dto.phone && dto.phone !== rider.phone) {
      const phone = normalizeRwandaPhone(dto.phone) ?? dto.phone;
      const phoneTaken = await this.riderRepository.findOne({
        where: { companyId, phone },
      });
      if (phoneTaken && phoneTaken.id !== rider.id) {
        throw new ConflictDomainException(
          ErrorCode.CONFLICT,
          'Another rider already uses this phone in the company.',
        );
      }
      rider.phone = phone;
      changes.push(`Phone updated to ${phone}.`);
      if (user) {
        user.phone = phone;
      }
    }

    if (dto.licenseNumber !== undefined) {
      rider.licenseNumber = dto.licenseNumber;
      changes.push(
        dto.licenseNumber
          ? `License number set to ${dto.licenseNumber}.`
          : 'License number was cleared.',
      );
    }

    if (user) {
      if (dto.firstName) {
        user.firstName = dto.firstName;
        changes.push(`First name updated to ${dto.firstName}.`);
      }
      if (dto.lastName) {
        user.lastName = dto.lastName;
        changes.push(`Last name updated to ${dto.lastName}.`);
      }
      await this.userRepository.save(user);
    }

    if (dto.status) {
      rider.status = dto.status;
      changes.push(`Account status set to ${dto.status}.`);
      if (
        dto.status !== RiderStatus.ACTIVE &&
        rider.availabilityStatus !== RiderAvailabilityStatus.OFFLINE
      ) {
        rider.availabilityStatus = RiderAvailabilityStatus.OFFLINE;
      }
    }

    const saved = await this.riderRepository.save(rider);
    if (changes.length > 0) {
      await this.notifyRider(companyId, rider.userId, {
        subject: 'Your FleetOps rider profile was updated',
        headline: 'Your rider profile was updated by your company admin.',
        bodyLines: changes,
      });
    }
    const [dtoOut] = await this.toResponseDtos([saved]);
    return dtoOut;
  }

  async deactivate(companyId: string, riderId: string): Promise<RiderResponseDto> {
    await this.assertNoActiveTrip(companyId, riderId);
    const rider = await this.getEntityOrThrow(companyId, riderId);

    rider.status = RiderStatus.SUSPENDED;
    rider.availabilityStatus = RiderAvailabilityStatus.OFFLINE;
    await this.riderRepository.save(rider);
    await this.unassignActiveMotorcycle(companyId, riderId);
    await this.suspendRiderMembership(companyId, rider.userId);

    await this.notifyRider(companyId, rider.userId, {
      subject: 'Your FleetOps rider account was deactivated',
      headline: 'Your rider account has been deactivated.',
      bodyLines: [
        'You will not receive trip assignments until an admin reactivates you.',
        'Contact your company admin if you think this was a mistake.',
      ],
    });

    const [dto] = await this.toResponseDtos([rider]);
    return dto;
  }

  async markUnavailable(companyId: string, riderId: string): Promise<RiderResponseDto> {
    const rider = await this.getEntityOrThrow(companyId, riderId);

    if (rider.status !== RiderStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.RIDER_NOT_AVAILABLE,
        'Inactive riders are already unavailable for assignment.',
      );
    }

    if (LOCKED_AVAILABILITY_STATES.has(rider.availabilityStatus)) {
      throw new DomainException(
        ErrorCode.TRIP_INVALID_STATE,
        'Cannot mark unavailable while the rider is on an active trip assignment.',
      );
    }

    rider.availabilityStatus = RiderAvailabilityStatus.OFFLINE;
    const saved = await this.riderRepository.save(rider);

    await this.notifyRider(companyId, rider.userId, {
      subject: 'You were marked unavailable on FleetOps',
      headline: 'An admin marked you unavailable (offline).',
      bodyLines: [
        'You will not receive new trip offers until you go Online again in the FleetOps app.',
      ],
    });

    const [dto] = await this.toResponseDtos([saved]);
    return dto;
  }

  async remove(companyId: string, riderId: string): Promise<{ id: string; deleted: true }> {
    await this.assertNoActiveTrip(companyId, riderId);
    const rider = await this.getEntityOrThrow(companyId, riderId);
    const user = await this.userRepository.findOne({ where: { id: rider.userId } });

    // Notify while contact details still exist.
    await this.notifyRider(companyId, rider.userId, {
      subject: 'You were removed as a rider on FleetOps',
      headline: 'Your rider profile was removed from the company.',
      bodyLines: [
        'You will no longer appear in the riders list or receive assignments.',
        'Contact your company admin if you need access again.',
      ],
    });

    await this.unassignActiveMotorcycle(companyId, riderId);

    await this.dataSource.transaction(async (manager) => {
      const riderRepo = manager.getRepository(Rider);
      const memberRepo = manager.getRepository(CompanyMember);
      const userRepo = manager.getRepository(User);
      const tokenRepo = manager.getRepository(EmailActivationToken);
      const refreshRepo = manager.getRepository(RefreshToken);

      await tokenRepo.delete({ userId: rider.userId, companyId });

      // Hard-remove membership so the same person can be invited again.
      await memberRepo.delete({
        userId: rider.userId,
        companyId,
        role: UserRole.RIDER,
      });

      // Keep rider row for trip history, but mark inactive.
      rider.status = RiderStatus.INACTIVE;
      rider.availabilityStatus = RiderAvailabilityStatus.OFFLINE;
      await riderRepo.save(rider);

      const remainingMemberships = await memberRepo.count({
        where: { userId: rider.userId },
      });

      // Free email/phone unique keys so a new invite can use the same contacts.
      if (remainingMemberships === 0 && user) {
        await refreshRepo.delete({ userId: user.id });
        await tokenRepo.delete({ userId: user.id });
        user.email = null;
        user.phone = null;
        user.status = UserStatus.INACTIVE;
        await userRepo.save(user);
      }
    });

    return { id: riderId, deleted: true };
  }

  async updateAvailability(
    companyId: string,
    riderId: string,
    dto: UpdateRiderAvailabilityDto,
    actor: AuthUser,
    actorRole: UserRole,
  ): Promise<RiderResponseDto> {
    // Use the same row lock as dispatch, so a late tap cannot overwrite a new assignment.
    const saved = await this.dataSource.transaction(async (manager) => {
      const riderRepo = manager.getRepository(Rider);
      const rider = await riderRepo.findOne({
        where: { id: riderId, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!rider) throw new NotFoundDomainException('Rider not found.');

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
          'Only OFFLINE, AVAILABLE and BUSY availability statuses can be set manually.',
        );
      }

      if (dto.availabilityStatus === RiderAvailabilityStatus.AVAILABLE) {
        const activeAssignment = await manager.getRepository(RiderMotorcycleAssignment).findOne({
          where: {
            companyId,
            riderId: rider.id,
            active: true,
          },
        });

        if (!activeAssignment) {
          throw new DomainException(
            ErrorCode.MOTORCYCLE_NOT_AVAILABLE,
            'Rider must have an active motorcycle assignment (phone tracking unit) before going available.',
          );
        }
      }

      rider.availabilityStatus = dto.availabilityStatus;
      return riderRepo.save(rider);
    });

    if (actorRole !== UserRole.RIDER) {
      if (dto.availabilityStatus === RiderAvailabilityStatus.AVAILABLE) {
        await this.notifyRider(companyId, saved.userId, {
          subject: 'You were set available on FleetOps',
          headline: 'An admin marked you available for trips.',
          bodyLines: [
            'Open the FleetOps app and keep GPS Online so dispatch can see your live location.',
          ],
        });
      } else if (dto.availabilityStatus === RiderAvailabilityStatus.OFFLINE) {
        await this.notifyRider(companyId, saved.userId, {
          subject: 'You were set offline on FleetOps',
          headline: 'An admin marked you offline.',
          bodyLines: [
            'You will not receive new trip offers until you go Online again.',
          ],
        });
      }
    }

    const [dtoOut] = await this.toResponseDtos([saved]);
    return dtoOut;
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

  private async assertNoActiveTrip(companyId: string, riderId: string): Promise<void> {
    const active = await this.tripRepository.findOne({
      where: {
        companyId,
        riderId,
        status: In(ACTIVE_TRIP_STATUSES),
      },
    });
    if (active) {
      throw new DomainException(
        ErrorCode.TRIP_INVALID_STATE,
        'Finish or reassign the rider’s active trip before this action.',
      );
    }
  }

  private async unassignActiveMotorcycle(
    companyId: string,
    riderId: string,
  ): Promise<void> {
    const assignment = await this.assignmentRepository.findOne({
      where: { companyId, riderId, active: true },
    });
    if (!assignment) return;
    assignment.active = false;
    assignment.unassignedAt = new Date();
    await this.assignmentRepository.save(assignment);
  }

  private async suspendRiderMembership(companyId: string, userId: string): Promise<void> {
    const membership = await this.companyMemberRepository.findOne({
      where: { companyId, userId, role: UserRole.RIDER },
    });
    if (!membership) return;
    membership.status = MembershipStatus.SUSPENDED;
    await this.companyMemberRepository.save(membership);
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

  private async toResponseDtos(riders: Rider[]): Promise<RiderResponseDto[]> {
    if (riders.length === 0) return [];
    const userIds = [...new Set(riders.map((r) => r.userId))];
    const users = await this.userRepository.find({ where: { id: In(userIds) } });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return riders.map((rider) => {
      const user = userMap.get(rider.userId);
      return RiderResponseDto.fromEntity(rider, {
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
      });
    });
  }

  private parseSort(sort?: string): { field: string; order: 'ASC' | 'DESC' } {
    const [rawField, rawOrder] = (sort ?? 'createdAt:DESC').split(':');
    const field = RidersService.SORT_FIELDS.has(rawField) ? rawField : 'createdAt';
    const order = rawOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { field, order };
  }

  private applyContactDetails(user: User, email: string, phone: string): void {
    if (!user.email) {
      user.email = email;
    }
    if (!user.phone) {
      user.phone = phone;
    }
  }

  private async notifyRider(
    companyId: string,
    userId: string,
    notice: { subject: string; headline: string; bodyLines: string[] },
  ): Promise<void> {
    const [user, company] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.companyRepository.findOne({ where: { id: companyId } }),
    ]);
    if (!user?.email) {
      this.logger.warn(`No email for user ${userId}; skipped rider notice`);
      return;
    }
    await this.mailService.sendRiderNoticeEmail({
      to: user.email,
      firstName: user.firstName || 'Rider',
      companyName: company?.name ?? 'your company',
      subject: notice.subject,
      headline: notice.headline,
      bodyLines: notice.bodyLines,
    });
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64url');
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
