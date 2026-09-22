import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MembershipStatus, UserRole } from '../../common/enums';
import { IsRwandaPhone } from '../../common/validators/is-rwanda-phone.decorator';

const MEMBER_ROLES = [
  UserRole.COMPANY_ADMIN,
  UserRole.SUPERVISOR,
  UserRole.ACCOUNTANT,
  UserRole.RIDER,
  UserRole.EMPLOYEE,
] as const;

const EMAIL_REQUIRED_ROLES = new Set<UserRole>([
  UserRole.COMPANY_ADMIN,
  UserRole.SUPERVISOR,
  UserRole.ACCOUNTANT,
]);

export class CreateMemberDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 'john@company.rw' })
  @ValidateIf((o: CreateMemberDto) => EMAIL_REQUIRED_ROLES.has(o.role) || !!o.email)
  @IsEmail({}, { message: 'Email must be a valid address.' })
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+250788654321' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @IsRwandaPhone()
  phone?: string;

  @ApiProperty({ enum: MEMBER_ROLES })
  @IsEnum(MEMBER_ROLES)
  role!: (typeof MEMBER_ROLES)[number];

  @ApiPropertyOptional({ enum: MembershipStatus, default: MembershipStatus.INVITED })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @ApiPropertyOptional({
    description: 'Optional. Invitees set their own password on activation.',
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
