import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmployeeStatus } from '../../common/enums';
import { IsRwandaPhone } from '../../common/validators/is-rwanda-phone.decorator';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @IsRwandaPhone()
  phone?: string;

  @ApiPropertyOptional({ example: 'jane.doe@company.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'EMP-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @ApiPropertyOptional({ example: 'Operations' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canRequestTransport?: boolean;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}
