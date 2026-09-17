import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignRiderMotorcycleDto {
  @ApiProperty()
  @IsUUID()
  riderId!: string;

  @ApiProperty()
  @IsUUID()
  motorcycleId!: string;
}
