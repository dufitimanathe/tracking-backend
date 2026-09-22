import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsRwandaPhone } from '../../common/validators/is-rwanda-phone.decorator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({ example: '+250788123456' })
  @IsString()
  @MaxLength(30)
  @IsRwandaPhone()
  phone!: string;

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

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canRequestTransport?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}
