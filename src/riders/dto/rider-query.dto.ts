import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  RiderAvailabilityStatus,
  RiderStatus,
} from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class RiderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RiderStatus })
  @IsOptional()
  @IsEnum(RiderStatus)
  status?: RiderStatus;

  @ApiPropertyOptional({ enum: RiderAvailabilityStatus })
  @IsOptional()
  @IsEnum(RiderAvailabilityStatus)
  availabilityStatus?: RiderAvailabilityStatus;
}
