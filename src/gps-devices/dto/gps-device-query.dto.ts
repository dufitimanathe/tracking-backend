import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { GPSDeviceStatus } from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class GpsDeviceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: GPSDeviceStatus })
  @IsOptional()
  @IsEnum(GPSDeviceStatus)
  status?: GPSDeviceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  motorcycleId?: string;
}
