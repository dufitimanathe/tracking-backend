import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { MotorcycleStatus } from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class MotorcycleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MotorcycleStatus })
  @IsOptional()
  @IsEnum(MotorcycleStatus)
  status?: MotorcycleStatus;
}
