import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RiderStatus } from '../../common/enums';

export class UpdateRiderDto {
  @ApiProperty({ enum: RiderStatus })
  @IsEnum(RiderStatus)
  status!: RiderStatus;
}
