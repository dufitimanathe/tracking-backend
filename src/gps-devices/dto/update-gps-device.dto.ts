import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GPSDeviceStatus } from '../../common/enums';

export class UpdateGpsDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  motorcycleId?: string;

  @ApiPropertyOptional({ example: 'teltonika-tracker' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  provider?: string;

  @ApiPropertyOptional({ example: 'DEV-123456789' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  externalDeviceId?: string;

  @ApiPropertyOptional({ example: '356938035643809' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  imei?: string;

  @ApiPropertyOptional({ example: '+250788000111' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  simNumber?: string;

  @ApiPropertyOptional({ enum: GPSDeviceStatus })
  @IsOptional()
  @IsEnum(GPSDeviceStatus)
  status?: GPSDeviceStatus;
}
