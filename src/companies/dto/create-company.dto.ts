import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  BillingDistanceSource,
  BillingPeriod,
} from '../../common/enums';
import { IsRwandaPhone } from '../../common/validators/is-rwanda-phone.decorator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Transport Ltd' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'billing@acme.rw' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @IsRwandaPhone()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({ default: 'Africa/Kigali' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ default: 'RWF' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: BillingPeriod, default: BillingPeriod.MONTHLY })
  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;

  @ApiPropertyOptional({
    enum: BillingDistanceSource,
    default: BillingDistanceSource.ROUTE_ESTIMATE,
  })
  @IsOptional()
  @IsEnum(BillingDistanceSource)
  billingDistanceSource?: BillingDistanceSource;
}
