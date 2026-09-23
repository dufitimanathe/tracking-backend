import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

function omitNegative({ value }: { value: unknown }): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/** Minimal GPS ping for background uploads on low-end phones. */
export class LocationLiteDto {
  @ApiProperty()
  @IsUUID()
  trackingSessionId!: string;

  @ApiProperty({ example: -1.9595 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 30.1228 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ description: 'When the phone recorded the fix (ISO)' })
  @IsDateString()
  capturedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(omitNegative)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number;
}
