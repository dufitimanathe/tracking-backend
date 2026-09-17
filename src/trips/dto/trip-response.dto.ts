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
  riderId?: string | null;

  @ApiPropertyOptional()
  motorcycleId?: string | null;

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

  static fromEntity(entity: Trip): TripResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      transportRequestId: entity.transportRequestId,
      employeeId: entity.employeeId,
      riderId: entity.riderId,
      motorcycleId: entity.motorcycleId,
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
