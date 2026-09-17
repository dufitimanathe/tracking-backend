import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus, UserRole } from '../../common/enums';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { CompanyMember } from '../entities/company-member.entity';
import { User } from '../../users/entities/user.entity';

export class MemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: MembershipStatus })
  status!: MembershipStatus;

  @ApiProperty()
  joinedAt!: Date;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiPropertyOptional({
    description: 'Present when a temporary password was generated for a new user.',
  })
  temporaryPassword?: string;

  static fromEntities(
    member: CompanyMember,
    user: User,
    temporaryPassword?: string,
  ): MemberResponseDto {
    return {
      id: member.id,
      companyId: member.companyId,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
      user: UserResponseDto.fromEntity(user),
      temporaryPassword,
    };
  }
}
