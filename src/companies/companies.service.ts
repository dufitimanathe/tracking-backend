import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, In, Repository } from 'typeorm';
import { BillingRecord } from '../billing/entities/billing-record.entity';
import { PricingRule } from '../billing/entities/pricing-rule.entity';
import { slugify, slugWithSuffix } from '../common/utils/slug.util';
import { normalizeRwandaPhone } from '../common/utils/rwanda-phone.util';
import {
  BillingDistanceSource,
  BillingPeriod,
  IncidentStatus,
  MembershipStatus,
  MotorcycleStatus,
  RiderAvailabilityStatus,
  RiderStatus,
  TransportRequestStatus,
  TripStatus,
  UserRole,
} from '../common/enums';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { Rider } from '../riders/entities/rider.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { Trip } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';
import { CompanyOnboarding } from './entities/company-onboarding.entity';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { RegisterCompanyAdminDto } from './dto/register-company.dto';
import {
  CompanyDashboardDto,
  CompanyOnboardingResponseDto,
  CompanyResponseDto,
} from './dto/company-response.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

export interface CompanyCreationResult {
  company: CompanyResponseDto;
  onboarding: CompanyOnboardingResponseDto;
}

const ACTIVE_TRIP_STATUSES: TripStatus[] = [
  TripStatus.IN_PROGRESS,
  TripStatus.RIDER_TO_PICKUP,
  TripStatus.RIDER_ARRIVED,
  TripStatus.RIDER_ACCEPTED,
  TripStatus.RIDER_ASSIGNED,
  TripStatus.SEARCHING_RIDER,
];

const PENDING_REQUEST_STATUSES: TransportRequestStatus[] = [
  TransportRequestStatus.PENDING_CONFIRMATION,
  TransportRequestStatus.PENDING_APPROVAL,
  TransportRequestStatus.APPROVED,
  TransportRequestStatus.DISPATCHING,
];

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyOnboarding)
    private readonly onboardingRepository: Repository<CompanyOnboarding>,
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
    @InjectRepository(PricingRule)
    private readonly pricingRuleRepository: Repository<PricingRule>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
    @InjectRepository(TransportRequest)
    private readonly transportRequestRepository: Repository<TransportRequest>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(BillingRecord)
    private readonly billingRecordRepository: Repository<BillingRecord>,
    private readonly dataSource: DataSource,
  ) {}

  async createForUser(userId: string, dto: CreateCompanyDto): Promise<CompanyCreationResult> {
    return this.createCompanyBundle(userId, dto);
  }

  async createWithNewAdmin(
    admin: RegisterCompanyAdminDto,
    dto: CreateCompanyDto,
    passwordHash: string,
    userId?: string,
  ): Promise<{ userId: string; company: CompanyCreationResult }> {
    return this.dataSource.transaction(async (manager) => {
      let resolvedUserId = userId;

      if (!resolvedUserId) {
        const userRepo = manager.getRepository(User);
        const user = userRepo.create({
          firstName: admin.firstName.trim(),
          lastName: admin.lastName.trim(),
          email: admin.email?.toLowerCase().trim() ?? null,
          phone: admin.phone ? normalizeRwandaPhone(admin.phone) ?? admin.phone.trim() : null,
          passwordHash,
        });
        const savedUser = await userRepo.save(user);
        resolvedUserId = savedUser.id;
      }

      const slug = await this.generateUniqueSlug(dto.name, manager.getRepository(Company));
      const company = manager.getRepository(Company).create({
        name: dto.name.trim(),
        slug,
        email: dto.email?.trim() ?? null,
        phone: dto.phone ? normalizeRwandaPhone(dto.phone) ?? dto.phone.trim() : null,
        address: dto.address?.trim() ?? null,
        registrationNumber: dto.registrationNumber?.trim() ?? null,
        timezone: dto.timezone ?? 'Africa/Kigali',
        currency: dto.currency ?? 'RWF',
        billingPeriod: dto.billingPeriod ?? BillingPeriod.MONTHLY,
        billingDistanceSource:
          dto.billingDistanceSource ?? BillingDistanceSource.ROUTE_ESTIMATE,
      });
      const savedCompany = await manager.getRepository(Company).save(company);

      const onboarding = manager.getRepository(CompanyOnboarding).create({
        companyId: savedCompany.id,
        companyProfileCompleted: true,
      });
      const savedOnboarding = await manager.getRepository(CompanyOnboarding).save(onboarding);

      const membership = manager.getRepository(CompanyMember).create({
        userId: resolvedUserId,
        companyId: savedCompany.id,
        role: UserRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      });
      await manager.getRepository(CompanyMember).save(membership);

      const pricingRule = manager.getRepository(PricingRule).create({
        companyId: savedCompany.id,
        firstKilometerPrice: '500',
        additionalKilometerPrice: '400',
        currency: savedCompany.currency ?? 'RWF',
        effectiveFrom: new Date(),
        active: true,
      });
      await manager.getRepository(PricingRule).save(pricingRule);

      return {
        userId: resolvedUserId,
        company: {
          company: CompanyResponseDto.fromEntity(savedCompany),
          onboarding: CompanyOnboardingResponseDto.fromEntity(savedOnboarding),
        },
      };
    });
  }

  async findByIdOrFail(companyId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundDomainException('Company not found.');
    }
    return company;
  }

  async getCompanyResponse(companyId: string): Promise<CompanyResponseDto> {
    const company = await this.findByIdOrFail(companyId);
    return CompanyResponseDto.fromEntity(company);
  }

  async updateCompany(companyId: string, dto: UpdateCompanyDto): Promise<CompanyResponseDto> {
    const company = await this.findByIdOrFail(companyId);

    if (dto.name !== undefined) {
      company.name = dto.name.trim();
    }
    if (dto.email !== undefined) {
      company.email = dto.email?.trim() ?? null;
    }
    if (dto.phone !== undefined) {
      company.phone = dto.phone
        ? normalizeRwandaPhone(dto.phone) ?? dto.phone.trim()
        : null;
    }
    if (dto.address !== undefined) {
      company.address = dto.address?.trim() ?? null;
    }
    if (dto.logoUrl !== undefined) {
      company.logoUrl = dto.logoUrl?.trim() ?? null;
    }
    if (dto.registrationNumber !== undefined) {
      company.registrationNumber = dto.registrationNumber?.trim() ?? null;
    }
    if (dto.timezone !== undefined) {
      company.timezone = dto.timezone;
    }
    if (dto.currency !== undefined) {
      company.currency = dto.currency;
    }
    if (dto.billingPeriod !== undefined) {
      company.billingPeriod = dto.billingPeriod;
    }
    if (dto.billingDistanceSource !== undefined) {
      company.billingDistanceSource = dto.billingDistanceSource;
    }

    const saved = await this.companyRepository.save(company);
    return CompanyResponseDto.fromEntity(saved);
  }

  async getOnboarding(companyId: string): Promise<CompanyOnboardingResponseDto> {
    const onboarding = await this.onboardingRepository.findOne({
      where: { companyId },
    });
    if (!onboarding) {
      throw new NotFoundDomainException('Company onboarding not found.');
    }
    return CompanyOnboardingResponseDto.fromEntity(onboarding);
  }

  async updateOnboarding(
    companyId: string,
    dto: UpdateOnboardingDto,
  ): Promise<CompanyOnboardingResponseDto> {
    const onboarding = await this.onboardingRepository.findOne({
      where: { companyId },
    });
    if (!onboarding) {
      throw new NotFoundDomainException('Company onboarding not found.');
    }

    if (dto.companyProfileCompleted !== undefined) {
      onboarding.companyProfileCompleted = dto.companyProfileCompleted;
    }
    if (dto.operationalSettingsCompleted !== undefined) {
      onboarding.operationalSettingsCompleted = dto.operationalSettingsCompleted;
    }
    if (dto.fleetAdded !== undefined) {
      onboarding.fleetAdded = dto.fleetAdded;
    }
    if (dto.teamAdded !== undefined) {
      onboarding.teamAdded = dto.teamAdded;
    }

    const allComplete =
      onboarding.companyProfileCompleted &&
      onboarding.operationalSettingsCompleted &&
      onboarding.fleetAdded &&
      onboarding.teamAdded;

    onboarding.completedAt = allComplete ? new Date() : null;

    const saved = await this.onboardingRepository.save(onboarding);
    return CompanyOnboardingResponseDto.fromEntity(saved);
  }

  async getDashboard(companyId: string): Promise<CompanyDashboardDto> {
    await this.findByIdOrFail(companyId);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      membersCount,
      activeTrips,
      pendingRequests,
      activeRiders,
      availableRiders,
      totalRiders,
      activeMotorcycles,
      totalMotorcycles,
      openIncidents,
      tripsCompletedToday,
      tripsStartedToday,
      todayRevenueRaw,
      recentIncidents,
    ] = await Promise.all([
      this.companyMemberRepository.count({
        where: { companyId, status: MembershipStatus.ACTIVE },
      }),
      this.tripRepository.count({
        where: { companyId, status: In(ACTIVE_TRIP_STATUSES) },
      }),
      this.transportRequestRepository.count({
        where: { companyId, status: In(PENDING_REQUEST_STATUSES) },
      }),
      this.riderRepository.count({
        where: { companyId, status: RiderStatus.ACTIVE },
      }),
      this.riderRepository.count({
        where: {
          companyId,
          status: RiderStatus.ACTIVE,
          availabilityStatus: RiderAvailabilityStatus.AVAILABLE,
        },
      }),
      this.riderRepository.count({ where: { companyId } }),
      this.motorcycleRepository.count({
        where: { companyId, status: MotorcycleStatus.ACTIVE },
      }),
      this.motorcycleRepository.count({ where: { companyId } }),
      this.incidentRepository.count({
        where: { companyId, status: IncidentStatus.OPEN },
      }),
      this.tripRepository
        .createQueryBuilder('t')
        .where('t.companyId = :companyId', { companyId })
        .andWhere('t.status = :status', { status: TripStatus.COMPLETED })
        .andWhere('t.completedAt >= :startOfDay', { startOfDay })
        .getCount(),
      this.tripRepository
        .createQueryBuilder('t')
        .where('t.companyId = :companyId', { companyId })
        .andWhere('t.startedAt >= :startOfDay', { startOfDay })
        .getCount(),
      this.billingRecordRepository
        .createQueryBuilder('b')
        .select('COALESCE(SUM(CAST(b.totalAmount AS numeric)), 0)', 'total')
        .where('b.companyId = :companyId', { companyId })
        .andWhere('b.createdAt >= :startOfDay', { startOfDay })
        .getRawOne<{ total: string }>(),
      this.incidentRepository.find({
        where: { companyId },
        order: { detectedAt: 'DESC' },
        take: 5,
      }),
    ]);

    return {
      activeTrips,
      pendingRequests,
      availableRiders,
      activeRiders,
      activeMotorcycles,
      openIncidents,
      membersCount,
      fleet: {
        totalMotorcycles,
        activeMotorcycles,
        totalRiders,
        availableRiders,
      },
      today: {
        tripsCompleted: tripsCompletedToday,
        tripsStarted: tripsStartedToday,
        revenue: new Decimal(todayRevenueRaw?.total ?? 0).toFixed(2),
      },
      recentAlerts: recentIncidents.map((incident) => ({
        id: incident.id,
        type: incident.type,
        title: incident.title,
        severity: incident.severity,
        detectedAt: incident.detectedAt,
      })),
    };
  }

  private async createCompanyBundle(
    userId: string,
    dto: CreateCompanyDto,
  ): Promise<CompanyCreationResult> {
    return this.dataSource.transaction(async (manager) => {
      const slug = await this.generateUniqueSlug(dto.name, manager.getRepository(Company));
      const company = manager.getRepository(Company).create({
        name: dto.name.trim(),
        slug,
        email: dto.email?.trim() ?? null,
        phone: dto.phone ? normalizeRwandaPhone(dto.phone) ?? dto.phone.trim() : null,
        address: dto.address?.trim() ?? null,
        registrationNumber: dto.registrationNumber?.trim() ?? null,
        timezone: dto.timezone ?? 'Africa/Kigali',
        currency: dto.currency ?? 'RWF',
        billingPeriod: dto.billingPeriod ?? BillingPeriod.MONTHLY,
        billingDistanceSource:
          dto.billingDistanceSource ?? BillingDistanceSource.ROUTE_ESTIMATE,
      });
      const savedCompany = await manager.getRepository(Company).save(company);

      const onboarding = manager.getRepository(CompanyOnboarding).create({
        companyId: savedCompany.id,
        companyProfileCompleted: true,
      });
      const savedOnboarding = await manager.getRepository(CompanyOnboarding).save(onboarding);

      const membership = manager.getRepository(CompanyMember).create({
        userId,
        companyId: savedCompany.id,
        role: UserRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      });
      await manager.getRepository(CompanyMember).save(membership);

      const pricingRule = manager.getRepository(PricingRule).create({
        companyId: savedCompany.id,
        firstKilometerPrice: '500',
        additionalKilometerPrice: '400',
        currency: savedCompany.currency ?? 'RWF',
        effectiveFrom: new Date(),
        active: true,
      });
      await manager.getRepository(PricingRule).save(pricingRule);

      return {
        company: CompanyResponseDto.fromEntity(savedCompany),
        onboarding: CompanyOnboardingResponseDto.fromEntity(savedOnboarding),
      };
    });
  }

  private async generateUniqueSlug(
    name: string,
    repository: Repository<Company>,
  ): Promise<string> {
    const baseSlug = slugify(name) || 'company';
    let candidate = baseSlug;
    let exists = await repository.exist({ where: { slug: candidate } });

    while (exists) {
      candidate = slugWithSuffix(baseSlug);
      exists = await repository.exist({ where: { slug: candidate } });
    }

    return candidate;
  }
}
