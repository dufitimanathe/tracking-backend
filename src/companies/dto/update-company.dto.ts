import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  BillingDistanceSource,
  BillingPeriod,
} from '../../common/enums';
import { IsRwandaPhone } from '../../common/validators/is-rwanda-phone.decorator';

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
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
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: BillingPeriod })
  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;

  @ApiPropertyOptional({ enum: BillingDistanceSource })
  @IsOptional()
  @IsEnum(BillingDistanceSource)
  billingDistanceSource?: BillingDistanceSource;

  @ApiPropertyOptional({
    description: 'Minutes between rider GPS uploads (5–60). Default 10 for low-end phones.',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  trackingShareIntervalMinutes?: number;

  @ApiPropertyOptional({
    description: 'Days to keep daily parked/history location pings.',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  trackingHistoryRetentionDays?: number;

  @ApiPropertyOptional({
    description:
      'If true, only the last GPS ping per motorcycle per day is stored in history.',
  })
  @IsOptional()
  @IsBoolean()
  trackingKeepDailyLastPingOnly?: boolean;
}
