import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GPSDeviceStatus } from '../../common/enums';
import { GpsDevice } from '../entities/gps-device.entity';

export class GpsDeviceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  motorcycleId!: string;

  @ApiPropertyOptional()
  provider?: string | null;

  @ApiProperty()
  externalDeviceId!: string;

  @ApiPropertyOptional()
  imei?: string | null;

  @ApiPropertyOptional()
  simNumber?: string | null;

  @ApiProperty({ enum: GPSDeviceStatus })
  status!: GPSDeviceStatus;

  @ApiPropertyOptional()
  lastSeenAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(entity: GpsDevice): GpsDeviceResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      motorcycleId: entity.motorcycleId,
      provider: entity.provider ?? null,
      externalDeviceId: entity.externalDeviceId,
      imei: entity.imei ?? null,
      simNumber: entity.simNumber ?? null,
      status: entity.status,
      lastSeenAt: entity.lastSeenAt ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
