import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedTransportRequestDto } from '../dto/parsed-transport-request.dto';
import { TransportMessageParser } from '../interfaces/transport-message-parser.interface';
import { MockTransportParser } from './mock-transport.parser';

@Injectable()
export class OpenAITransportParser implements TransportMessageParser {
  private readonly logger = new Logger(OpenAITransportParser.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly fallback: MockTransportParser,
  ) {}

  async parse(message: string, context?: { locale?: string }): Promise<ParsedTransportRequestDto> {
    const apiKey = this.configService.get<string>('app.integrations.openaiApiKey', {
      infer: true,
    });

    if (!apiKey) {
      this.logger.debug('OpenAI API key not configured, using mock parser');
      return this.fallback.parse(message, context);
    }

    // Stub: integrate OpenAI structured output when API key is present
    this.logger.debug('OpenAI parser stub invoked, falling back to mock');
    return this.fallback.parse(message, context);
  }
}
