import { createHmac, timingSafeEqual } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { QUEUE_WHATSAPP } from '../jobs/jobs.constants';
import { WhatsAppMessageDirection, WhatsAppProcessingStatus } from '../common/enums';
import { WhatsAppMessage } from './entities/whatsapp-message.entity';
import { InboundWhatsAppJobPayload } from './whatsapp-orchestration.service';
import { normalizePhone } from './utils/phone.util';
import { IntegrationEvent } from '../integrations/entities/integration-event.entity';

export const WHATSAPP_PROCESS_INBOUND_JOB = 'process-inbound';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(WhatsAppMessage)
    private readonly whatsAppMessageRepository: Repository<WhatsAppMessage>,
    @InjectRepository(IntegrationEvent)
    private readonly integrationEventRepository: Repository<IntegrationEvent>,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_WHATSAPP)
    private readonly whatsappQueue: Queue,
  ) {}

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.configService.get<string>(
      'app.integrations.whatsappVerifyToken',
      { infer: true },
    );

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    return null;
  }

  validateSignature(rawBody: Buffer | undefined, signatureHeader?: string): boolean {
    const appSecret = this.configService.get<string>('app.integrations.whatsappAppSecret', {
      infer: true,
    });

    if (!appSecret) {
      return true;
    }

    if (!rawBody || !signatureHeader?.startsWith('sha256=')) {
      return false;
    }

    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const received = signatureHeader.slice(7);

    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
    } catch {
      return false;
    }
  }

  /**
   * Ack webhook quickly: persist idempotent inbound rows and enqueue processing.
   */
  async enqueueInboundWebhook(payload: Record<string, unknown>): Promise<void> {
    const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const value = (change.value as Record<string, unknown>) ?? {};
        const messages = (value.messages as Array<Record<string, unknown>>) ?? [];

        for (const message of messages) {
          await this.enqueueInboundMessage(message, value);
        }
      }
    }

    await this.integrationEventRepository.save(
      this.integrationEventRepository.create({
        provider: 'whatsapp',
        eventType: 'webhook_received',
        success: true,
        message: 'Webhook accepted',
      }),
    );
  }

  private async enqueueInboundMessage(
    message: Record<string, unknown>,
    value: Record<string, unknown>,
  ): Promise<void> {
    const externalMessageId = String(message.id ?? '');
    if (!externalMessageId) {
      return;
    }

    const existing = await this.whatsAppMessageRepository.findOne({
      where: { externalMessageId },
    });
    if (existing) {
      existing.processingStatus = WhatsAppProcessingStatus.DUPLICATE;
      await this.whatsAppMessageRepository.save(existing);
      return;
    }

    const phone = normalizePhone(
      String(
        (message.from as string) ??
          ((value.contacts as Array<{ wa_id?: string }>)?.[0]?.wa_id ?? ''),
      ),
    );

    const messageType = String(message.type ?? 'text');
    let textBody: string | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;
    let buttonId: string | undefined;
    let buttonTitle: string | undefined;

    if (messageType === 'text') {
      textBody = (message.text as { body?: string })?.body;
    } else if (messageType === 'location') {
      const loc = message.location as { latitude?: number; longitude?: number };
      latitude = loc?.latitude;
      longitude = loc?.longitude;
      textBody = 'shared_location';
    } else if (messageType === 'interactive') {
      const interactive = message.interactive as {
        type?: string;
        button_reply?: { id?: string; title?: string };
        list_reply?: { id?: string; title?: string };
      };
      buttonId = interactive?.button_reply?.id ?? interactive?.list_reply?.id;
      buttonTitle = interactive?.button_reply?.title ?? interactive?.list_reply?.title;
      textBody = buttonTitle;
    } else if (messageType === 'button') {
      const button = message.button as { payload?: string; text?: string };
      buttonId = button?.payload;
      buttonTitle = button?.text;
      textBody = buttonTitle;
    }

    await this.whatsAppMessageRepository.save(
      this.whatsAppMessageRepository.create({
        externalMessageId,
        phone,
        direction: WhatsAppMessageDirection.INBOUND,
        messageType,
        messageBody: textBody ?? null,
        processingStatus: WhatsAppProcessingStatus.QUEUED,
        payload: message,
      }),
    );

    const jobPayload: InboundWhatsAppJobPayload = {
      externalMessageId,
      phone,
      messageType,
      textBody,
      latitude,
      longitude,
      buttonId,
      buttonTitle,
      rawMessage: message,
      value,
    };

    await this.whatsappQueue.add(WHATSAPP_PROCESS_INBOUND_JOB, jobPayload, {
      jobId: externalMessageId,
      removeOnComplete: 1000,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    this.logger.debug(`Enqueued WhatsApp inbound ${externalMessageId}`);
  }

  /** @deprecated Prefer enqueueInboundWebhook — kept for tests */
  async processInboundWebhook(payload: Record<string, unknown>): Promise<void> {
    await this.enqueueInboundWebhook(payload);
  }
}
