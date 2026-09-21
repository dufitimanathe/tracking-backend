import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TransportParseIntent } from '../../common/enums';
import { ParsedTransportRequestDto } from '../dto/parsed-transport-request.dto';
import { TransportMessageParser } from '../interfaces/transport-message-parser.interface';

const SYSTEM_PROMPT = `You are a transport request parser for corporate motorcycle (moto) dispatch in Rwanda (Kigali and nationwide).
Languages: English, Kinyarwanda, French, or mixed (code-switching is normal). Timezone: Africa/Kigali.

Extract intent and TEXT place names only. NEVER invent coordinates or place names that were not implied.
If pickup or destination is unclear, set needsClarification=true and list missingFields (pickupText / destinationText).

Intents: CREATE_TRANSPORT_REQUEST, CHECK_REQUEST_STATUS, CANCEL_REQUEST, CHANGE_REQUEST, GREETING, HELP, UNKNOWN.
Set language to "en", "rw", or "fr" based on the dominant language of the message.

Kinyarwanda / mixed examples (pickup → destination):
- "kuva Remera kugera Nyabugogo" → Remera → Nyabugogo
- "kuva Musanze njya i Kacyiru" / "kuva Musanze nagiye Kacyiru" → Musanze → Kacyiru
- "ngiye i Musanze mvuye Nyabugogo" → Nyabugogo → Musanze
- "muramfata Kacyiru, nagiye i Musanze" → Kacyiru → Musanze
- "ngiye i Musanze mvuye Nyabugogo, muramfata Kacyiru" → prefer muramfata as pickup: Kacyiru → Musanze
- "nshaka motari kuva Kimironko kugera Kacyiru" → Kimironko → Kacyiru
- "From Kimironko to Kacyiru" → Kimironko → Kacyiru

If the user is clearly changing an existing trip (new pickup/destination), use CHANGE_REQUEST or CREATE_TRANSPORT_REQUEST with the new places — the app will ask them to confirm the update.

For relative times ("saa tatu", "in 30 minutes", "ejo", "tomorrow"), resolve requestedPickupTime to ISO-8601 in Africa/Kigali when possible.
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

  constructor(private readonly configService: ConfigService) {}

  async parse(message: string, context?: { locale?: string }): Promise<ParsedTransportRequestDto> {
    const apiKey = this.configService.get<string>('app.integrations.openaiApiKey', {
      infer: true,
    });

    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is missing — WhatsApp AI parsing requires a paid OpenAI key');
      throw new ServiceUnavailableException('OpenAI API key is not configured');
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
        throw new Error('OpenAI returned empty structured output');
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
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`OpenAI parse failed: ${String(error)}`);
      throw new ServiceUnavailableException('OpenAI transport parsing failed');
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
