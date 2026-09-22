import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RiderStatus } from '../../common/enums';
import { IsRwandaPhone } from '../../common/validators/is-rwanda-phone.decorator';

export class UpdateRiderDto {
  @ApiPropertyOptional({ enum: RiderStatus })
  @IsOptional()
  @IsEnum(RiderStatus)
  status?: RiderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+250788999888' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @IsRwandaPhone()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string | null;
}
