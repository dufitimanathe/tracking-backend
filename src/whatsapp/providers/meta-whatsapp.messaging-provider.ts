import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  MessagingProvider,
  WhatsAppSendButtonsOptions,
  WhatsAppSendTemplateOptions,
  WhatsAppSendTextOptions,
} from '../interfaces/messaging-provider.interface';

@Injectable()
export class MetaWhatsAppMessagingProvider implements MessagingProvider {
  private readonly logger = new Logger(MetaWhatsAppMessagingProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private getConfig() {
    return {
      accessToken: this.configService.get<string>('app.integrations.whatsappAccessToken', {
        infer: true,
      }),
      phoneNumberId: this.configService.get<string>('app.integrations.whatsappPhoneNumberId', {
        infer: true,
      }),
      apiVersion:
        this.configService.get<string>('app.integrations.whatsappApiVersion', { infer: true }) ??
        'v21.0',
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  async sendText(options: WhatsAppSendTextOptions): Promise<{ messageId?: string }> {
    const { accessToken, phoneNumberId, apiVersion } = this.getConfig();
    if (!accessToken || !phoneNumberId) {
      this.logger.log(`WhatsApp stub outbound to ${options.phone}: ${options.text}`);
      return { messageId: `stub-${Date.now()}` };
    }

    try {
      const response = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: this.normalizePhone(options.phone),
          type: 'text',
          text: { body: options.text },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      return { messageId: response.data?.messages?.[0]?.id };
    } catch (error) {
      this.logMetaSendFailure('sendText', options.phone, error);
      throw error;
    }
  }

  async sendButtons(options: WhatsAppSendButtonsOptions): Promise<{ messageId?: string }> {
    const { accessToken, phoneNumberId, apiVersion } = this.getConfig();
    if (!accessToken || !phoneNumberId) {
      this.logger.log(
        `WhatsApp stub buttons to ${options.phone}: ${options.body} [${options.buttons
          .map((b) => b.title)
          .join(', ')}]`,
      );
      return { messageId: `stub-btn-${Date.now()}` };
    }

    try {
      const response = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: this.normalizePhone(options.phone),
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: options.body },
            action: {
              buttons: options.buttons.slice(0, 3).map((button) => ({
                type: 'reply',
                reply: { id: button.id, title: button.title.slice(0, 20) },
              })),
            },
          },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      return { messageId: response.data?.messages?.[0]?.id };
    } catch (error) {
      this.logMetaSendFailure('sendButtons', options.phone, error);
      throw error;
    }
  }

  async sendTemplate(options: WhatsAppSendTemplateOptions): Promise<{ messageId?: string }> {
    const { accessToken, phoneNumberId, apiVersion } = this.getConfig();
    if (!accessToken || !phoneNumberId) {
      this.logger.log(
        `WhatsApp stub template ${options.templateName} to ${options.phone}`,
      );
      return { messageId: `stub-tpl-${Date.now()}` };
    }

    const components =
      options.bodyParameters && options.bodyParameters.length > 0
        ? [
            {
              type: 'body',
              parameters: options.bodyParameters.map((text) => ({ type: 'text', text })),
            },
          ]
        : undefined;

    try {
      const response = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: this.normalizePhone(options.phone),
          type: 'template',
          template: {
            name: options.templateName,
            language: { code: options.languageCode ?? 'en' },
            ...(components ? { components } : {}),
          },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      return { messageId: response.data?.messages?.[0]?.id };
    } catch (error) {
      this.logMetaSendFailure('sendTemplate', options.phone, error);
      throw error;
    }
  }

  private logMetaSendFailure(operation: string, phone: string, error: unknown): void {
    if (axios.isAxiosError(error)) {
      this.logger.error(
        `Meta WhatsApp ${operation} failed for ${phone}: HTTP ${error.response?.status} ${JSON.stringify(error.response?.data ?? {})}`,
      );
      return;
    }
    this.logger.error(
      `Meta WhatsApp ${operation} failed for ${phone}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
