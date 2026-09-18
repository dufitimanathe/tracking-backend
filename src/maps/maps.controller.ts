import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponse } from '../common/decorators/api-success.decorator';
import { Public } from '../common/decorators/roles.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import {
  CalculateMatrixDto,
  CalculateRouteDto,
  GeocodeQueryDto,
  RouteDeviationCheckDto,
} from './dto/maps.dto';
import { MapsService } from './maps.service';

@ApiTags('maps')
@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  /**
   * Public status for web/mobile clients. Does not expose API keys.
   * Paste your Google Console keys in env — this only reports whether they are set.
   */
  @Public()
  @Get('status')
  @ApiSuccessResponse(Object)
  getStatus() {
    return successResponse(this.mapsService.getStatus());
  }

  @Post('geocode')
  @ApiSuccessResponse(Object)
  async geocode(@Body() dto: GeocodeQueryDto) {
    const result = await this.mapsService.geocode(dto.address);
    return successResponse(result);
  }

  @Get('geocode')
  @ApiSuccessResponse(Object)
  async geocodeQuery(@Query() query: GeocodeQueryDto) {
    const result = await this.mapsService.geocode(query.address);
    return successResponse(result);
  }

  @Post('route')
  @ApiSuccessResponse(Object)
  async calculateRoute(@Body() dto: CalculateRouteDto) {
    const result = await this.mapsService.calculateRoute(dto.origin, dto.destination);
    return successResponse(result);
  }

  @Post('matrix')
  @ApiSuccessResponse(Object)
  async calculateMatrix(@Body() dto: CalculateMatrixDto) {
    const result = await this.mapsService.calculateMatrix(dto.origins, dto.destinations);
    return successResponse(result);
  }

  /**
   * Prepared for mobile enforcement: check if a live point is still on the planned road.
   * Web can also use this for trip detail overlays.
   */
  @Post('route-deviation')
  @ApiSuccessResponse(Object)
  checkRouteDeviation(@Body() dto: RouteDeviationCheckDto) {
    const result = this.mapsService.checkRouteDeviation(
      dto.point,
      dto.encodedPolyline,
      dto.thresholdMeters,
    );
    return successResponse(result);
  }
}
