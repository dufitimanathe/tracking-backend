import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedTransportRequestDto } from '../dto/parsed-transport-request.dto';
import { TransportMessageParser } from '../interfaces/transport-message-parser.interface';

@Injectable()
export class GeminiTransportParser implements TransportMessageParser {
  private readonly logger = new Logger(GeminiTransportParser.name);

  constructor(private readonly configService: ConfigService) {}

  async parse(_message: string, _context?: { locale?: string }): Promise<ParsedTransportRequestDto> {
    const apiKey = this.configService.get<string>('app.integrations.geminiApiKey', {
      infer: true,
    });

    if (!apiKey) {
      throw new ServiceUnavailableException('Gemini API key is not configured');
    }

    this.logger.warn('Gemini transport parser is not implemented yet — use AI_PROVIDER=openai');
    throw new ServiceUnavailableException('Gemini transport parser is not implemented');
  }
}
