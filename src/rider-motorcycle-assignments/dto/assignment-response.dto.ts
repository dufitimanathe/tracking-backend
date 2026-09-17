import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RiderMotorcycleAssignment } from '../entities/rider-motorcycle-assignment.entity';

export class AssignmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  riderId!: string;

  @ApiProperty()
  motorcycleId!: string;

  @ApiProperty()
  assignedById!: string;

  @ApiProperty()
  assignedAt!: Date;

  @ApiPropertyOptional()
  unassignedAt?: Date | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(entity: RiderMotorcycleAssignment): AssignmentResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      riderId: entity.riderId,
      motorcycleId: entity.motorcycleId,
      assignedById: entity.assignedById,
      assignedAt: entity.assignedAt,
      unassignedAt: entity.unassignedAt ?? null,
      active: entity.active,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
