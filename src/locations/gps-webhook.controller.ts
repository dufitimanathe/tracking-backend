import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/roles.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { LocationsService } from './locations.service';

@ApiTags('gps-integrations')
@Controller('integrations/gps')
export class GpsWebhookController {
  constructor(private readonly locationsService: LocationsService) {}

  @Public()
  @Post(':provider/webhook')
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: Record<string, unknown>,
    @Headers('x-gps-api-key') apiKey?: string,
  ) {
    const expectedKey = process.env.GPS_API_KEY;
    if (expectedKey && apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid GPS API key.');
    }

    const result = await this.locationsService.ingestGpsDevice(provider, payload);
    return successResponse(result);
  }
}
