import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BillingDistanceSource,
  BillingPeriod,
  CompanyStatus,
} from '../../common/enums';
import { Company } from '../entities/company.entity';
import { CompanyOnboarding } from '../entities/company-onboarding.entity';

export class CompanyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiPropertyOptional()
  address?: string | null;

  @ApiPropertyOptional()
  logoUrl?: string | null;

  @ApiPropertyOptional()
  registrationNumber?: string | null;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: CompanyStatus })
  status!: CompanyStatus;

  @ApiProperty({ enum: BillingPeriod })
  billingPeriod!: BillingPeriod;

  @ApiProperty({ enum: BillingDistanceSource })
  billingDistanceSource!: BillingDistanceSource;

  @ApiProperty({ example: 10 })
  trackingShareIntervalMinutes!: number;

  @ApiProperty({ example: 30 })
  trackingHistoryRetentionDays!: number;

  @ApiProperty({ example: true })
  trackingKeepDailyLastPingOnly!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(company: Company): CompanyResponseDto {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      email: company.email,
      phone: company.phone,
      address: company.address,
      logoUrl: company.logoUrl,
      registrationNumber: company.registrationNumber,
      timezone: company.timezone,
      currency: company.currency,
      status: company.status,
      billingPeriod: company.billingPeriod,
      billingDistanceSource: company.billingDistanceSource,
      trackingShareIntervalMinutes: company.trackingShareIntervalMinutes ?? 10,
      trackingHistoryRetentionDays: company.trackingHistoryRetentionDays ?? 30,
      trackingKeepDailyLastPingOnly: company.trackingKeepDailyLastPingOnly ?? true,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }
}

export class CompanyOnboardingResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  companyProfileCompleted!: boolean;

  @ApiProperty()
  operationalSettingsCompleted!: boolean;

  @ApiProperty()
  fleetAdded!: boolean;

  @ApiProperty()
  teamAdded!: boolean;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  static fromEntity(onboarding: CompanyOnboarding): CompanyOnboardingResponseDto {
    return {
      id: onboarding.id,
      companyId: onboarding.companyId,
      companyProfileCompleted: onboarding.companyProfileCompleted,
      operationalSettingsCompleted: onboarding.operationalSettingsCompleted,
      fleetAdded: onboarding.fleetAdded,
      teamAdded: onboarding.teamAdded,
      completedAt: onboarding.completedAt,
    };
  }
}

export class DashboardTodayStatsDto {
  @ApiProperty()
  tripsCompleted!: number;

  @ApiProperty()
  tripsStarted!: number;

  @ApiProperty()
  revenue!: string;
}

export class DashboardFleetTotalsDto {
  @ApiProperty()
  totalMotorcycles!: number;

  @ApiProperty()
  activeMotorcycles!: number;

  @ApiProperty()
  totalRiders!: number;

  @ApiProperty()
  availableRiders!: number;
}

export class DashboardRecentAlertDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  severity!: string;

  @ApiProperty()
  detectedAt!: Date;
}

export class CompanyDashboardDto {
  @ApiProperty({ example: 0 })
  activeTrips!: number;

  @ApiProperty({ example: 0 })
  pendingRequests!: number;

  @ApiProperty({ example: 0 })
  availableRiders!: number;

  @ApiProperty({ example: 0 })
  activeRiders!: number;

  @ApiProperty({ example: 0 })
  activeMotorcycles!: number;

  @ApiProperty({ example: 0 })
  openIncidents!: number;

  @ApiProperty({ example: 0 })
  membersCount!: number;

  @ApiProperty({ type: DashboardFleetTotalsDto })
  fleet!: DashboardFleetTotalsDto;

  @ApiProperty({ type: DashboardTodayStatsDto })
  today!: DashboardTodayStatsDto;

  @ApiProperty({ type: DashboardRecentAlertDto, isArray: true })
  recentAlerts!: DashboardRecentAlertDto[];
}
