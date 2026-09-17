import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParsedTransportRequestDto {
  @ApiProperty({ example: 'Kimironko Market' })
  @IsString()
  @MinLength(2)
  pickupAddress!: string;

  @ApiPropertyOptional({ example: -1.9595 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLatitude?: number;

  @ApiPropertyOptional({ example: 30.1228 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLongitude?: number;

  @ApiProperty({ example: 'Kigali Heights' })
  @IsString()
  @MinLength(2)
  destinationAddress!: string;

  @ApiPropertyOptional({ example: -1.9506 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLatitude?: number;

  @ApiPropertyOptional({ example: 30.0912 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requestedPickupTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 0.85, minimum: 0, maximum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;
}
