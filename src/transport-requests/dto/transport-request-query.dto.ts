import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { TransportRequestStatus } from '../../common/enums';

export class TransportRequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TransportRequestStatus })
  @IsOptional()
  @IsEnum(TransportRequestStatus)
  status?: TransportRequestStatus;
}
