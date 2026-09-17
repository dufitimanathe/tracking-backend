import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGpsDeviceDto {
  @ApiProperty()
  @IsUUID()
  motorcycleId!: string;

  @ApiProperty({ example: 'teltonika-tracker' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  provider?: string;

  @ApiProperty({ example: 'DEV-123456789' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  externalDeviceId!: string;

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
}
