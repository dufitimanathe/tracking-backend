import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportRequestChannel } from '../../common/enums';

export class CreateTransportRequestDto {
  @ApiPropertyOptional({ description: 'Required when an admin creates a request for an employee.' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  pickupAddress!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLatitude!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLongitude!: number;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  destinationAddress!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLatitude!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLongitude!: number;

  @ApiProperty()
  @IsDateString()
  requestedPickupTime!: string;

  @ApiPropertyOptional({ enum: TransportRequestChannel, default: TransportRequestChannel.ADMIN })
  @IsOptional()
  @IsEnum(TransportRequestChannel)
  channel?: TransportRequestChannel;

  @ApiPropertyOptional({ example: 5.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdById?: string;
}
