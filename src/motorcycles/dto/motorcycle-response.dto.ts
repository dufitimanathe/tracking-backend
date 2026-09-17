import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MotorcycleStatus,
  MotorcycleTrackingStatus,
} from '../../common/enums';
import { Motorcycle } from '../entities/motorcycle.entity';

export class MotorcycleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

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

  @ApiProperty({ enum: MotorcycleStatus })
  status!: MotorcycleStatus;

  @ApiProperty({ enum: MotorcycleTrackingStatus })
  trackingStatus!: MotorcycleTrackingStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(entity: Motorcycle): MotorcycleResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      plateNumber: entity.plateNumber,
      internalCode: entity.internalCode ?? null,
      brand: entity.brand ?? null,
      model: entity.model ?? null,
      year: entity.year ?? null,
      color: entity.color ?? null,
      status: entity.status,
      trackingStatus: entity.trackingStatus,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export class MotorcycleFleetTotalsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  active!: number;

  @ApiProperty()
  inactive!: number;

  @ApiProperty()
  maintenance!: number;

  @ApiProperty()
  suspended!: number;
}
