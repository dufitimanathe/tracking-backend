import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class StartTrackingDto {
  @ApiPropertyOptional({
    description: 'Optional trip to associate with this tracking session.',
  })
  @IsOptional()
  @IsUUID()
  tripId?: string;
}
