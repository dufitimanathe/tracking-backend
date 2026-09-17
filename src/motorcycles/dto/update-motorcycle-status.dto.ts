import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { MotorcycleStatus } from '../../common/enums';

export class UpdateMotorcycleStatusDto {
  @ApiProperty({ enum: MotorcycleStatus })
  @IsEnum(MotorcycleStatus)
  status!: MotorcycleStatus;
}
