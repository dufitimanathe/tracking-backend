import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedTransportRequestDto } from '../dto/parsed-transport-request.dto';
import { TransportMessageParser } from '../interfaces/transport-message-parser.interface';
import { MockTransportParser } from './mock-transport.parser';

@Injectable()
export class GeminiTransportParser implements TransportMessageParser {
  private readonly logger = new Logger(GeminiTransportParser.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly fallback: MockTransportParser,
  ) {}

  async parse(message: string, context?: { locale?: string }): Promise<ParsedTransportRequestDto> {
    const apiKey = this.configService.get<string>('app.integrations.geminiApiKey', {
      infer: true,
    });

    if (!apiKey) {
      this.logger.debug('Gemini API key not configured, using mock parser');
      return this.fallback.parse(message, context);
    }

    // Stub: integrate Gemini structured output when API key is present
    this.logger.debug('Gemini parser stub invoked, falling back to mock');
    return this.fallback.parse(message, context);
  }
}
