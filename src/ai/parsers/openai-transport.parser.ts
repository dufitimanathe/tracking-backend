import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TransportParseIntent } from '../../common/enums';
import { ParsedTransportRequestDto } from '../dto/parsed-transport-request.dto';
import { TransportMessageParser } from '../interfaces/transport-message-parser.interface';
import { MockTransportParser } from './mock-transport.parser';

const SYSTEM_PROMPT = `You are a transport request parser for corporate motorcycle (moto) dispatch in Rwanda (Kigali).
Languages: English, Kinyarwanda, French, or mixed. Timezone for relative times: Africa/Kigali.
Extract intent and text fields only. NEVER invent place names, coordinates, latitudes, or longitudes.
If pickup or destination is unclear, set needsClarification=true and list missingFields.
Intents: CREATE_TRANSPORT_REQUEST, CHECK_REQUEST_STATUS, CANCEL_REQUEST, CHANGE_REQUEST, GREETING, HELP, UNKNOWN.
For relative times (e.g. "saa tatu", "in 30 minutes", "à 15h"), resolve to requestedPickupTime ISO-8601 in Africa/Kigali when possible.
Return JSON matching the schema.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'intent',
    'language',
    'pickupText',
    'destinationText',
    'requestedDate',
    'requestedTime',
    'requestedPickupTime',
    'passengerCount',
    'notes',
    'confidence',
    'missingFields',
    'needsClarification',
  ],
  properties: {
    intent: {
      type: 'string',
      enum: Object.values(TransportParseIntent),
    },
    language: { type: 'string' },
    pickupText: { type: ['string', 'null'] },
    destinationText: { type: ['string', 'null'] },
    requestedDate: { type: ['string', 'null'] },
    requestedTime: { type: ['string', 'null'] },
    requestedPickupTime: { type: ['string', 'null'] },
    passengerCount: { type: ['integer', 'null'] },
    notes: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    missingFields: { type: 'array', items: { type: 'string' } },
    needsClarification: { type: 'boolean' },
  },
};

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

    const model =
      this.configService.get<string>('app.integrations.openaiTransportModel', { infer: true }) ??
      'gpt-4o';

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/responses',
        {
          model,
          input: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Locale hint: ${context?.locale ?? 'auto'}\nMessage: ${message}`,
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'transport_parse',
              strict: true,
              schema: RESPONSE_SCHEMA,
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        },
      );

      const rawText = this.extractOutputText(response.data);
      if (!rawText) {
        this.logger.warn('OpenAI returned empty structured output; falling back to mock');
        return this.fallback.parse(message, context);
      }

      const parsedJson = JSON.parse(rawText) as Record<string, unknown>;
      this.logger.debug(`OpenAI model=${model} intent=${String(parsedJson.intent)}`);

      const dto = plainToInstance(ParsedTransportRequestDto, {
        intent: parsedJson.intent ?? TransportParseIntent.UNKNOWN,
        language: parsedJson.language ?? 'en',
        pickupText: parsedJson.pickupText ?? undefined,
        destinationText: parsedJson.destinationText ?? undefined,
        pickupAddress: parsedJson.pickupText ?? undefined,
        destinationAddress: parsedJson.destinationText ?? undefined,
        requestedDate: parsedJson.requestedDate ?? undefined,
        requestedTime: parsedJson.requestedTime ?? undefined,
        requestedPickupTime: parsedJson.requestedPickupTime ?? undefined,
        passengerCount: parsedJson.passengerCount ?? 1,
        notes: parsedJson.notes ?? message,
        confidence: Number(parsedJson.confidence ?? 0),
        missingFields: parsedJson.missingFields ?? [],
        needsClarification: Boolean(parsedJson.needsClarification),
      });

      // Strip any accidental coordinates if the model ignored instructions
      delete dto.pickupLatitude;
      delete dto.pickupLongitude;
      delete dto.destinationLatitude;
      delete dto.destinationLongitude;

      const errors = validateSync(dto, { whitelist: true, skipMissingProperties: true });
      if (errors.length > 0) {
        return { ...dto, confidence: Math.min(dto.confidence, 0.3), needsClarification: true };
      }

      return dto;
    } catch (error) {
      this.logger.warn(`OpenAI parse failed, using mock: ${String(error)}`);
      return this.fallback.parse(message, context);
    }
  }

  private extractOutputText(data: unknown): string | null {
    const payload = data as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    if (typeof payload.output_text === 'string' && payload.output_text.length > 0) {
      return payload.output_text;
    }

    for (const item of payload.output ?? []) {
      for (const content of item.content ?? []) {
        if (content.text) {
          return content.text;
        }
      }
    }

    return null;
  }
}
