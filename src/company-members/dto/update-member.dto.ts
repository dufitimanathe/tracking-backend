import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { MembershipStatus, UserRole } from '../../common/enums';

const MEMBER_ROLES = [
  UserRole.COMPANY_ADMIN,
  UserRole.SUPERVISOR,
  UserRole.RIDER,
  UserRole.EMPLOYEE,
] as const;

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: MEMBER_ROLES })
  @IsOptional()
  @IsEnum(MEMBER_ROLES)
  role?: (typeof MEMBER_ROLES)[number];

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
