import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportRequestChannel, TransportRequestStatus } from '../../common/enums';
import { TransportRequest } from '../entities/transport-request.entity';

export class TransportRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  employeeId!: string;

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

  @ApiProperty()
  requestedAt!: Date;

  @ApiProperty()
  requestedPickupTime!: Date;

  @ApiProperty({ enum: TransportRequestChannel })
  channel!: TransportRequestChannel;

  @ApiProperty({ enum: TransportRequestStatus })
  status!: TransportRequestStatus;

  @ApiPropertyOptional()
  estimatedDistanceKm?: string | null;

  @ApiPropertyOptional()
  estimatedDurationMinutes?: number | null;

  @ApiPropertyOptional()
  estimatedPrice?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  static fromEntity(entity: TransportRequest): TransportRequestResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      employeeId: entity.employeeId,
      pickupAddress: entity.pickupAddress,
      pickupLatitude: entity.pickupLatitude,
      pickupLongitude: entity.pickupLongitude,
      destinationAddress: entity.destinationAddress,
      destinationLatitude: entity.destinationLatitude,
      destinationLongitude: entity.destinationLongitude,
      requestedAt: entity.requestedAt,
      requestedPickupTime: entity.requestedPickupTime,
      channel: entity.channel,
      status: entity.status,
      estimatedDistanceKm: entity.estimatedDistanceKm,
      estimatedDurationMinutes: entity.estimatedDurationMinutes,
      estimatedPrice: entity.estimatedPrice,
      notes: entity.notes,
    };
  }
}
