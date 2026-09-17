import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOnboardingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  companyProfileCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  operationalSettingsCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fleetAdded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  teamAdded?: boolean;
}
