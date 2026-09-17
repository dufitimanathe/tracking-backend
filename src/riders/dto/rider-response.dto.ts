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

  static fromEntity(entity: Rider): RiderResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      userId: entity.userId,
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
