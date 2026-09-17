import { ApiProperty } from '@nestjs/swagger';
import { MembershipStatus, UserRole } from '../../common/enums';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class MembershipSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  companyName!: string;

  @ApiProperty()
  companySlug!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: MembershipStatus })
  status!: MembershipStatus;

  @ApiProperty()
  joinedAt!: Date;
}

export class MeResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({ type: [MembershipSummaryDto] })
  memberships!: MembershipSummaryDto[];
}
