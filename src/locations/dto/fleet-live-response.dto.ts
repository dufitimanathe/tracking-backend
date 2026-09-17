import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MotorcycleStatus,
  MotorcycleTrackingStatus,
  RiderAvailabilityStatus,
} from '../../common/enums';

export enum LocationFreshness {
  LIVE = 'LIVE',
  DELAYED = 'DELAYED',
  OFFLINE = 'OFFLINE',
}

export class FleetLiveItemDto {
  @ApiProperty()
  motorcycleId!: string;

  @ApiProperty()
  plateNumber!: string;

  @ApiProperty({ enum: MotorcycleStatus })
  status!: MotorcycleStatus;

  @ApiProperty({ enum: MotorcycleTrackingStatus })
  trackingStatus!: MotorcycleTrackingStatus;

  @ApiPropertyOptional()
  riderId?: string | null;

  @ApiPropertyOptional()
  riderName?: string | null;

  @ApiPropertyOptional()
  latitude?: number | null;

  @ApiPropertyOptional()
  longitude?: number | null;

  @ApiPropertyOptional()
  speed?: number | null;

  @ApiPropertyOptional()
  heading?: number | null;

  @ApiPropertyOptional()
  recordedAt?: Date | null;

  @ApiProperty({ enum: LocationFreshness })
  freshness!: LocationFreshness;
}
