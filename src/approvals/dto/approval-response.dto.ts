import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalAction } from '../../common/enums';
import { TransportRequestApproval } from '../entities/transport-request-approval.entity';

export class ApprovalResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  requestId!: string;

  @ApiProperty()
  supervisorId!: string;

  @ApiProperty({ enum: ApprovalAction })
  action!: ApprovalAction;

  @ApiPropertyOptional()
  reason?: string | null;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(entity: TransportRequestApproval): ApprovalResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      requestId: entity.requestId,
      supervisorId: entity.supervisorId,
      action: entity.action,
      reason: entity.reason,
      createdAt: entity.createdAt,
    };
  }
}
