import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class LocationUpdateDto {
  @ApiProperty()
  @IsUUID()
  clientLocationId!: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional({ description: 'Speed in m/s' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  speed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heading?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  altitude?: number;

  @ApiProperty({ description: 'When the phone recorded the fix (ISO)' })
  @IsDateString()
  capturedAt!: string;
}
