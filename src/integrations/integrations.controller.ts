import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Public } from '../common/decorators/roles.decorator';
import { successResponse } from '../common/dto/api-response.dto';
import { IntegrationEvent } from './entities/integration-event.entity';
import { WhatsAppMessage } from '../whatsapp/entities/whatsapp-message.entity';

export interface IntegrationHealthDto {
  whatsapp: {
    configured: boolean;
    lastWebhookAt: string | null;
    recentErrorCount: number;
  };
  openai: {
    configured: boolean;
    provider: string;
    model: string;
  };
  googleMaps: {
    configured: boolean;
  };
}

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(IntegrationEvent)
    private readonly integrationEventRepository: Repository<IntegrationEvent>,
    @InjectRepository(WhatsAppMessage)
    private readonly whatsAppMessageRepository: Repository<WhatsAppMessage>,
  ) {}

  /** No secrets — configured flags + last webhook time only. */
  @Public()
  @Get('health')
  async health() {
    const integrations = this.configService.get('app.integrations', { infer: true })!;
    const since = new Date(Date.now() - 24 * 60 * 60_000);

    const lastWebhook = await this.integrationEventRepository.findOne({
      where: { provider: 'whatsapp', eventType: 'webhook_received' },
      order: { createdAt: 'DESC' },
    });

    const recentErrorCount = await this.integrationEventRepository.count({
      where: {
        provider: 'whatsapp',
        success: false,
        createdAt: MoreThan(since),
      },
    });

    const lastInbound = await this.whatsAppMessageRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    const payload: IntegrationHealthDto = {
      whatsapp: {
        configured: Boolean(
          integrations.whatsappAccessToken && integrations.whatsappPhoneNumberId,
        ),
        lastWebhookAt:
          lastWebhook?.createdAt?.toISOString() ??
          lastInbound?.createdAt?.toISOString() ??
          null,
        recentErrorCount,
      },
      openai: {
        configured: Boolean(integrations.openaiApiKey),
        provider: integrations.aiProvider,
        model: integrations.openaiTransportModel,
      },
      googleMaps: {
        configured: Boolean(integrations.googleMapsApiKey),
      },
    };

    return successResponse(payload);
  }
}
