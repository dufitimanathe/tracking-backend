import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
} from '../../common/enums';
import { Incident } from '../entities/incident.entity';

export class IncidentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiPropertyOptional()
  motorcycleId?: string | null;

  @ApiPropertyOptional()
  riderId?: string | null;

  @ApiPropertyOptional()
  tripId?: string | null;

  @ApiProperty({ enum: IncidentType })
  type!: IncidentType;

  @ApiProperty({ enum: IncidentSeverity })
  severity!: IncidentSeverity;

  @ApiProperty({ enum: IncidentStatus })
  status!: IncidentStatus;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  detectedAt!: Date;

  @ApiPropertyOptional()
  acknowledgedAt?: Date | null;

  @ApiPropertyOptional()
  resolvedAt?: Date | null;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown> | null;

  static fromEntity(entity: Incident): IncidentResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      motorcycleId: entity.motorcycleId,
      riderId: entity.riderId,
      tripId: entity.tripId,
      type: entity.type,
      severity: entity.severity,
      status: entity.status,
      title: entity.title,
      description: entity.description,
      detectedAt: entity.detectedAt,
      acknowledgedAt: entity.acknowledgedAt,
      resolvedAt: entity.resolvedAt,
      metadata: entity.metadata,
    };
  }
}
