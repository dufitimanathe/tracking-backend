import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '../../common/enums';
import { Trip } from '../entities/trip.entity';

export class TripResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  transportRequestId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiPropertyOptional()
  employeeName?: string | null;

  @ApiPropertyOptional()
  riderId?: string | null;

  @ApiPropertyOptional()
  riderName?: string | null;

  @ApiPropertyOptional()
  motorcycleId?: string | null;

  @ApiPropertyOptional()
  motorcyclePlate?: string | null;

  @ApiProperty({ enum: TripStatus })
  status!: TripStatus;

  @ApiProperty()
  pickupAddress!: string;

  @ApiProperty()
  pickupLatitude!: number;

  @ApiProperty()
  pickupLongitude!: number;

  @ApiProperty()
  destinationAddress!: string;

  @ApiProperty()
  destinationLatitude!: number;

  @ApiProperty()
  destinationLongitude!: number;

  @ApiPropertyOptional()
  estimatedDistanceKm?: string | null;

  @ApiPropertyOptional()
  actualDistanceKm?: string | null;

  @ApiPropertyOptional()
  estimatedDurationMinutes?: number | null;

  @ApiPropertyOptional()
  actualDurationMinutes?: number | null;

  @ApiPropertyOptional()
  estimatedPrice?: string | null;

  @ApiPropertyOptional()
  finalPrice?: string | null;

  @ApiPropertyOptional()
  assignedAt?: Date | null;

  @ApiPropertyOptional()
  acceptedAt?: Date | null;

  @ApiPropertyOptional()
  arrivedAtPickupAt?: Date | null;

  @ApiPropertyOptional()
  startedAt?: Date | null;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  @ApiPropertyOptional()
  cancelledAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(
    entity: Trip,
    extras?: {
      employeeName?: string | null;
      riderName?: string | null;
      motorcyclePlate?: string | null;
    },
  ): TripResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      transportRequestId: entity.transportRequestId,
      employeeId: entity.employeeId,
      employeeName: extras?.employeeName ?? null,
      riderId: entity.riderId,
      riderName: extras?.riderName ?? null,
      motorcycleId: entity.motorcycleId,
      motorcyclePlate: extras?.motorcyclePlate ?? null,
      status: entity.status,
      pickupAddress: entity.pickupAddress,
      pickupLatitude: entity.pickupLatitude,
      pickupLongitude: entity.pickupLongitude,
      destinationAddress: entity.destinationAddress,
      destinationLatitude: entity.destinationLatitude,
      destinationLongitude: entity.destinationLongitude,
      estimatedDistanceKm: entity.estimatedDistanceKm,
      actualDistanceKm: entity.actualDistanceKm,
      estimatedDurationMinutes: entity.estimatedDurationMinutes,
      actualDurationMinutes: entity.actualDurationMinutes,
      estimatedPrice: entity.estimatedPrice,
      finalPrice: entity.finalPrice,
      assignedAt: entity.assignedAt,
      acceptedAt: entity.acceptedAt,
      arrivedAtPickupAt: entity.arrivedAtPickupAt,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      cancelledAt: entity.cancelledAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
