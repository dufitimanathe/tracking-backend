import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignTripDto {
  @ApiProperty()
  @IsUUID()
  riderId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  motorcycleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
