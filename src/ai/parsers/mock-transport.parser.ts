import { Injectable } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TransportParseIntent } from '../../common/enums';
import { ParsedTransportRequestDto } from '../dto/parsed-transport-request.dto';
import { TransportMessageParser } from '../interfaces/transport-message-parser.interface';

@Injectable()
export class MockTransportParser implements TransportMessageParser {
  async parse(message: string, _context?: { locale?: string }): Promise<ParsedTransportRequestDto> {
    const normalized = message.toLowerCase().trim();

    if (/^(hi|hello|muraho|bonjour|hey)\b/i.test(normalized)) {
      return this.build({
        intent: TransportParseIntent.GREETING,
        confidence: 0.95,
        needsClarification: false,
      });
    }

    if (/help|aide|ubufasha/i.test(normalized)) {
      return this.build({
        intent: TransportParseIntent.HELP,
        confidence: 0.9,
        needsClarification: false,
      });
    }

    if (/status|where.*request|ikihe/i.test(normalized)) {
      return this.build({
        intent: TransportParseIntent.CHECK_REQUEST_STATUS,
        confidence: 0.85,
        needsClarification: false,
      });
    }

    if (/cancel|annuler|hagarika/i.test(normalized)) {
      return this.build({
        intent: TransportParseIntent.CANCEL_REQUEST,
        confidence: 0.85,
        needsClarification: false,
      });
    }

    let pickupText = '';
    let destinationText = '';
    let confidence = 0.4;
    const missingFields: string[] = [];

    const fromToMatch =
      /(?:from|kuva|de)\s+(.+?)\s+(?:to|kugera|->|à|a)\s+(.+)/i.exec(message);
    if (fromToMatch) {
      pickupText = fromToMatch[1].trim();
      destinationText = fromToMatch[2].trim().replace(/[.?!,]+$/, '');
      confidence = 0.88;
    } else if (/nshaka|need|transport|ride|motari|taxi/i.test(normalized)) {
      confidence = 0.55;
      missingFields.push('pickupText', 'destinationText');
    } else {
      missingFields.push('pickupText', 'destinationText');
    }

    if (!pickupText) missingFields.push('pickupText');
    if (!destinationText) missingFields.push('destinationText');

    const needsClarification = confidence < 0.75 || missingFields.length > 0;

    return this.build({
      intent: TransportParseIntent.CREATE_TRANSPORT_REQUEST,
      pickupText: pickupText || undefined,
      destinationText: destinationText || undefined,
      pickupAddress: pickupText || undefined,
      destinationAddress: destinationText || undefined,
      requestedPickupTime: new Date(Date.now() + 30 * 60_000).toISOString(),
      passengerCount: 1,
      notes: message,
      confidence,
      missingFields: [...new Set(missingFields)],
      needsClarification,
      language: /muraho|nshaka|kuva/i.test(message)
        ? 'rw'
        : /bonjour|de |à /i.test(message)
          ? 'fr'
          : 'en',
    });
  }

  private build(
    partial: Partial<ParsedTransportRequestDto> & {
      intent: TransportParseIntent;
      confidence: number;
    },
  ): ParsedTransportRequestDto {
    const dto = plainToInstance(ParsedTransportRequestDto, {
      intent: partial.intent,
      language: partial.language ?? 'en',
      pickupText: partial.pickupText,
      destinationText: partial.destinationText,
      pickupAddress: partial.pickupAddress ?? partial.pickupText,
      destinationAddress: partial.destinationAddress ?? partial.destinationText,
      requestedPickupTime: partial.requestedPickupTime,
      passengerCount: partial.passengerCount ?? 1,
      notes: partial.notes,
      confidence: partial.confidence,
      missingFields: partial.missingFields ?? [],
      needsClarification: partial.needsClarification ?? false,
    });

    const errors = validateSync(dto, { whitelist: true, skipMissingProperties: true });
    if (errors.length > 0) {
      return plainToInstance(ParsedTransportRequestDto, {
        intent: TransportParseIntent.UNKNOWN,
        confidence: 0.2,
        needsClarification: true,
        missingFields: ['pickupText', 'destinationText'],
      });
    }

    return dto;
  }
}
