import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CompanyDocumentStatus,
  CompanyDocumentType,
  CompanyStatus,
} from '../../common/enums';
import { CreateCompanyDto } from '../../companies/dto/create-company.dto';
import { IsRwandaPhone } from '../../common/validators/is-rwanda-phone.decorator';

export class PlatformCompaniesQueryDto {
  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}

export class ApproveCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RejectCompanyDto {
  @ApiProperty({ example: 'Missing or invalid registration documents.' })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export class ReviewDocumentDto {
  @ApiProperty({ enum: [CompanyDocumentStatus.APPROVED, CompanyDocumentStatus.REJECTED] })
  @IsEnum(CompanyDocumentStatus)
  status!: CompanyDocumentStatus.APPROVED | CompanyDocumentStatus.REJECTED;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class AddCompanyDocumentDto {
  @ApiProperty({ enum: CompanyDocumentType })
  @IsEnum(CompanyDocumentType)
  type!: CompanyDocumentType;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^(https?:\/\/|\/uploads\/).+/i, {
    message: 'fileUrl must be an http(s) URL or an /uploads/… path',
  })
  @MaxLength(1000)
  fileUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class PlatformCreateCompanyAdminDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @IsRwandaPhone()
  phone?: string;
}

export class PlatformCreateCompanyDto {
  @ApiProperty({ type: CreateCompanyDto })
  @ValidateNested()
  @Type(() => CreateCompanyDto)
  company!: CreateCompanyDto;

  @ApiProperty({ type: PlatformCreateCompanyAdminDto })
  @ValidateNested()
  @Type(() => PlatformCreateCompanyAdminDto)
  admin!: PlatformCreateCompanyAdminDto;

  @ApiPropertyOptional({
    description: 'When true, company is created as ACTIVE (already approved).',
    default: true,
  })
  @IsOptional()
  activateImmediately?: boolean;
}
