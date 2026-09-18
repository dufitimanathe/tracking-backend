import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GeoPointDto {
  @ApiProperty({ example: -1.9441 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 30.0619 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class GeocodeQueryDto {
  @ApiProperty({ example: 'KG 7 Ave, Kacyiru, Kigali' })
  @IsString()
  address!: string;
}

export class CalculateRouteDto {
  @ApiProperty({ type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  origin!: GeoPointDto;

  @ApiProperty({ type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  destination!: GeoPointDto;
}

export class CalculateMatrixDto {
  @ApiProperty({ type: [GeoPointDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => GeoPointDto)
  origins!: GeoPointDto[];

  @ApiProperty({ type: [GeoPointDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => GeoPointDto)
  destinations!: GeoPointDto[];
}

export class RouteDeviationCheckDto {
  @ApiProperty({ type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  point!: GeoPointDto;

  @ApiProperty({
    description: 'Encoded polyline from calculateRoute (Google encoded polyline format)',
  })
  @IsString()
  encodedPolyline!: string;

  @ApiPropertyOptional({
    description: 'Meters off-route before flagging (defaults to TRACKING_ROUTE_DEVIATION_METERS)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(2000)
  thresholdMeters?: number;
}
