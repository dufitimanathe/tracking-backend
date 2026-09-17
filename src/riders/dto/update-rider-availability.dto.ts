import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RiderAvailabilityStatus } from '../../common/enums';

export class UpdateRiderAvailabilityDto {
  @ApiProperty({ enum: RiderAvailabilityStatus })
  @IsEnum(RiderAvailabilityStatus)
  availabilityStatus!: RiderAvailabilityStatus;
}
