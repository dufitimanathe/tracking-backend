import { ParsedTransportRequestDto } from '../dto/parsed-transport-request.dto';

export interface TransportMessageParser {
  parse(message: string, context?: { locale?: string }): Promise<ParsedTransportRequestDto>;
}
