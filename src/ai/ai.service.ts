import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateSync } from 'class-validator';
import { ParsedTransportRequestDto } from './dto/parsed-transport-request.dto';
import { TransportMessageParser } from './interfaces/transport-message-parser.interface';
import { GeminiTransportParser } from './parsers/gemini-transport.parser';
import { OpenAITransportParser } from './parsers/openai-transport.parser';

@Injectable()
export class AiService {
  constructor(
    private readonly configService: ConfigService,
    private readonly openAiParser: OpenAITransportParser,
    private readonly geminiParser: GeminiTransportParser,
  ) {}

  getParser(): TransportMessageParser {
    const provider =
      this.configService.get<string>('app.integrations.aiProvider', { infer: true }) ?? 'openai';

    switch (provider) {
      case 'gemini':
        return this.geminiParser;
      case 'openai':
        return this.openAiParser;
      default:
        throw new ServiceUnavailableException(
          `Unsupported AI_PROVIDER="${provider}". Use openai (recommended) or gemini.`,
        );
    }
  }

  async parseTransportMessage(
    message: string,
    context?: { locale?: string },
  ): Promise<ParsedTransportRequestDto> {
    const parsed = await this.getParser().parse(message, context);
    const errors = validateSync(parsed, {
      whitelist: true,
      skipMissingProperties: true,
    });
    if (errors.length > 0) {
      return { ...parsed, confidence: Math.min(parsed.confidence, 0.3), needsClarification: true };
    }
    return parsed;
  }

  getConfidenceThreshold(): number {
    return (
      this.configService.get<number>('app.integrations.aiConfidenceThreshold', {
        infer: true,
      }) ?? 0.75
    );
  }

  isConfigured(): boolean {
    const provider =
      this.configService.get<string>('app.integrations.aiProvider', { infer: true }) ?? 'openai';
    if (provider === 'openai') {
      return Boolean(
        this.configService.get<string>('app.integrations.openaiApiKey', { infer: true }),
      );
    }
    if (provider === 'gemini') {
      return Boolean(
        this.configService.get<string>('app.integrations.geminiApiKey', { infer: true }),
      );
    }
    return false;
  }
}
