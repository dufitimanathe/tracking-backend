import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { TripStatus } from '../../common/enums';

export class TripQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  riderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  motorcycleId?: string;
}
