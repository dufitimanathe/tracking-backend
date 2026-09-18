import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RiderAvailabilityStatus,
  RiderStatus,
} from '../../common/enums';
import { Rider } from '../entities/rider.entity';

export class RiderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiProperty()
  phone!: string;

  @ApiPropertyOptional()
  licenseNumber?: string | null;

  @ApiProperty({ enum: RiderStatus })
  status!: RiderStatus;

  @ApiProperty({ enum: RiderAvailabilityStatus })
  availabilityStatus!: RiderAvailabilityStatus;

  @ApiPropertyOptional()
  currentLatitude?: string | null;

  @ApiPropertyOptional()
  currentLongitude?: string | null;

  @ApiPropertyOptional()
  locationUpdatedAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(
    entity: Rider,
    extras?: { firstName?: string | null; lastName?: string | null },
  ): RiderResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      userId: entity.userId,
      firstName: extras?.firstName ?? null,
      lastName: extras?.lastName ?? null,
      phone: entity.phone,
      licenseNumber: entity.licenseNumber ?? null,
      status: entity.status,
      availabilityStatus: entity.availabilityStatus,
      currentLatitude: entity.currentLatitude ?? null,
      currentLongitude: entity.currentLongitude ?? null,
      locationUpdatedAt: entity.locationUpdatedAt ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export class CreateRiderResultDto extends RiderResponseDto {
  @ApiPropertyOptional({
    description: 'Temporary password when a new user account was created.',
  })
  temporaryPassword?: string;
}

export class RiderMotorcycleSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  plateNumber!: string;

  @ApiPropertyOptional()
  internalCode?: string | null;

  @ApiPropertyOptional()
  brand?: string | null;

  @ApiPropertyOptional()
  model?: string | null;

  @ApiPropertyOptional()
  year?: number | null;

  @ApiPropertyOptional()
  color?: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  trackingStatus!: string;
}

export class RiderMeResponseDto extends RiderResponseDto {
  @ApiPropertyOptional({ type: RiderMotorcycleSummaryDto })
  motorcycle?: RiderMotorcycleSummaryDto | null;

  @ApiPropertyOptional()
  assignmentId?: string | null;
}
