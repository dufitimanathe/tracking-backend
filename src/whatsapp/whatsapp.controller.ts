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
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/roles.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { WhatsappService } from './whatsapp.service';

@ApiTags('whatsapp')
@Controller(['integrations/whatsapp', 'webhooks/whatsapp'])
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  /** Meta expects the raw hub.challenge string — not a JSON envelope. */
  @Public()
  @Get('webhook')
  verify(
    @Res() res: Response,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): void {
    const result = this.whatsappService.verifyWebhook(mode, token, challenge);
    if (!result) {
      throw new ForbiddenException('Webhook verification failed.');
    }
    res.status(200).contentType('text/plain').send(result);
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

    // Ack immediately — processing happens on Bull queue
    await this.whatsappService.enqueueInboundWebhook(payload);
    return successResponse({ received: true });
  }
}
