import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { EmployeeStatus } from '../common/enums';
import { AiService } from '../ai/ai.service';
import { Employee } from '../employees/entities/employee.entity';
import { TransportRequestsService } from '../transport-requests/transport-requests.service';
import { WhatsAppMessage, WhatsAppMessageDirection } from './entities/whatsapp-message.entity';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(WhatsAppMessage)
    private readonly whatsAppMessageRepository: Repository<WhatsAppMessage>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly transportRequestsService: TransportRequestsService,
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

  async processInboundWebhook(payload: Record<string, unknown>): Promise<void> {
    const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const value = (change.value as Record<string, unknown>) ?? {};
        const messages = (value.messages as Array<Record<string, unknown>>) ?? [];

        for (const message of messages) {
          await this.processInboundMessage(message, value);
        }
      }
    }
  }

  async sendMessage(phone: string, text: string): Promise<void> {
    const accessToken = this.configService.get<string>(
      'app.integrations.whatsappAccessToken',
      { infer: true },
    );
    const phoneNumberId = this.configService.get<string>(
      'app.integrations.whatsappPhoneNumberId',
      { infer: true },
    );

    if (!accessToken || !phoneNumberId) {
      this.logger.log(`WhatsApp stub outbound to ${phone}: ${text}`);
      return;
    }

    await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone.replace(/\D/g, ''),
        type: 'text',
        text: { body: text },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  private async processInboundMessage(
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
      return;
    }

    const phone = String(
      (message.from as string) ??
        ((value.contacts as Array<{ wa_id?: string }>)?.[0]?.wa_id ?? ''),
    );
    const textBody =
      ((message.text as { body?: string })?.body ??
        (message.body as string) ??
        '') as string;

    const employee = await this.employeeRepository.findOne({
      where: { phone, status: EmployeeStatus.ACTIVE },
    });

    const savedMessage = await this.whatsAppMessageRepository.save(
      this.whatsAppMessageRepository.create({
        externalMessageId,
        companyId: employee?.companyId ?? null,
        employeeId: employee?.id ?? null,
        phone,
        direction: WhatsAppMessageDirection.INBOUND,
        payload: message,
      }),
    );

    if (!employee) {
      await this.sendMessage(
        phone,
        'Sorry, your phone number is not registered with any company transport account.',
      );
      savedMessage.processedAt = new Date();
      await this.whatsAppMessageRepository.save(savedMessage);
      return;
    }

    const parsed = await this.aiService.parseTransportMessage(textBody);
    const threshold = this.aiService.getConfidenceThreshold();

    if (parsed.confidence < threshold) {
      await this.sendMessage(
        phone,
        'Could you clarify your pickup and destination? Example: From Kimironko to Kacyiru',
      );
      savedMessage.conversationState = { awaitingClarification: true, parsed };
      savedMessage.processedAt = new Date();
      await this.whatsAppMessageRepository.save(savedMessage);
      return;
    }

    const request = await this.transportRequestsService.createFromWhatsApp(
      employee.companyId,
      employee.id,
      {
        pickupAddress: parsed.pickupAddress,
        pickupLatitude: parsed.pickupLatitude ?? -1.9441,
        pickupLongitude: parsed.pickupLongitude ?? 30.0619,
        destinationAddress: parsed.destinationAddress,
        destinationLatitude: parsed.destinationLatitude ?? -1.9441,
        destinationLongitude: parsed.destinationLongitude ?? 30.0619,
        requestedPickupTime: parsed.requestedPickupTime,
        notes: parsed.notes,
      },
      true,
    );

    await this.sendMessage(
      phone,
      `Transport request received: ${parsed.pickupAddress} → ${parsed.destinationAddress}. Reply YES to confirm.`,
    );

    savedMessage.conversationState = { requestId: request.id };
    savedMessage.processedAt = new Date();
    await this.whatsAppMessageRepository.save(savedMessage);
  }
}
