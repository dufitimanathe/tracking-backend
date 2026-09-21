import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportParseIntent } from '../../common/enums';

/**
 * AI parse result — text fields only. Coordinates come from Places, never from the model.
 */
export class ParsedTransportRequestDto {
  @ApiProperty({ enum: TransportParseIntent })
  @IsEnum(TransportParseIntent)
  intent!: TransportParseIntent;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: 'Kimironko Market' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  pickupText?: string;

  @ApiPropertyOptional({ example: 'Kigali Heights' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  destinationText?: string;

  /** @deprecated Prefer pickupText — kept for mock/legacy callers */
  @ApiPropertyOptional({ example: 'Kimironko Market' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  pickupAddress?: string;

  /** @deprecated Prefer destinationText */
  @ApiPropertyOptional({ example: 'Kigali Heights' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  destinationAddress?: string;

  @ApiPropertyOptional({ description: 'ISO date YYYY-MM-DD in Africa/Kigali' })
  @IsOptional()
  @IsString()
  requestedDate?: string;

  @ApiPropertyOptional({ description: 'Local time HH:mm in Africa/Kigali' })
  @IsOptional()
  @IsString()
  requestedTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requestedPickupTime?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  passengerCount?: number;

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingFields?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  needsClarification?: boolean;

  /** Never populated by AI parsers — Places resolves coords. */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLongitude?: number;
}
