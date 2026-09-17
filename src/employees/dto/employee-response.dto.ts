import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeStatus } from '../../common/enums';
import { Employee } from '../entities/employee.entity';

export class EmployeeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  phone!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  employeeCode?: string | null;

  @ApiPropertyOptional()
  department?: string | null;

  @ApiPropertyOptional()
  supervisorId?: string | null;

  @ApiProperty()
  canRequestTransport!: boolean;

  @ApiProperty({ enum: EmployeeStatus })
  status!: EmployeeStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(entity: Employee): EmployeeResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      userId: entity.userId ?? null,
      fullName: entity.fullName,
      phone: entity.phone,
      email: entity.email ?? null,
      employeeCode: entity.employeeCode ?? null,
      department: entity.department ?? null,
      supervisorId: entity.supervisorId ?? null,
      canRequestTransport: entity.canRequestTransport,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
