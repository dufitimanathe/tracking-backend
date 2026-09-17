import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/roles.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { WhatsappService } from './whatsapp.service';

@ApiTags('whatsapp')
@Controller('integrations/whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Public()
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const result = this.whatsappService.verifyWebhook(mode, token, challenge);
    if (!result) {
      throw new ForbiddenException('Webhook verification failed.');
    }
    return result;
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: Record<string, unknown>,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));
    if (!this.whatsappService.validateSignature(rawBody, signature)) {
      throw new ForbiddenException('Invalid webhook signature.');
    }

    await this.whatsappService.processInboundWebhook(payload);
    return successResponse({ received: true });
  }
}
