import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MembershipStatus, UserRole } from '../../common/enums';

const MEMBER_ROLES = [
  UserRole.COMPANY_ADMIN,
  UserRole.SUPERVISOR,
  UserRole.RIDER,
  UserRole.EMPLOYEE,
] as const;

export class CreateMemberDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+250788654321' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ enum: MEMBER_ROLES })
  @IsEnum(MEMBER_ROLES)
  role!: (typeof MEMBER_ROLES)[number];

  @ApiPropertyOptional({ enum: MembershipStatus, default: MembershipStatus.INVITED })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @ApiPropertyOptional({
    description: 'If omitted, a temporary password is generated for new users.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain uppercase, lowercase, and a number.',
  })
  password?: string;
}
