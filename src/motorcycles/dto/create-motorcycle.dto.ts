import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Allow a few model-years ahead of the calendar (pre-orders / next-year stock). */
const MAX_MOTORCYCLE_YEAR = new Date().getFullYear() + 5;

export class CreateMotorcycleDto {
  @ApiProperty({ example: 'RAB 123A' })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  plateNumber!: string;

  @ApiPropertyOptional({ example: 'MOTO-01' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  internalCode?: string;

  @ApiPropertyOptional({ example: 'Honda' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @ApiPropertyOptional({ example: 'CB125' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Year must be a whole number.' })
  @Min(1980, { message: 'Year must be 1980 or later.' })
  @Max(MAX_MOTORCYCLE_YEAR, {
    message: `Year cannot be later than ${MAX_MOTORCYCLE_YEAR}.`,
  })
  year?: number;

  @ApiPropertyOptional({ example: 'Red' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;
}
