import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { LocationUpdateDto } from './location-update.dto';

export class LocationBatchDto {
  @ApiProperty({ type: [LocationUpdateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LocationUpdateDto)
  locations!: LocationUpdateDto[];
}
