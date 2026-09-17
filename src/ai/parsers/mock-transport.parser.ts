import { Injectable } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ParsedTransportRequestDto } from '../dto/parsed-transport-request.dto';
import { TransportMessageParser } from '../interfaces/transport-message-parser.interface';

const KIGALI_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  kimironko: { lat: -1.9595, lng: 30.1228 },
  kacyiru: { lat: -1.9369, lng: 30.0827 },
  remera: { lat: -1.9495, lng: 30.1115 },
  nyabugogo: { lat: -1.9392, lng: 30.0444 },
  'kigali heights': { lat: -1.9506, lng: 30.0912 },
};

@Injectable()
export class MockTransportParser implements TransportMessageParser {
  async parse(message: string, _context?: { locale?: string }): Promise<ParsedTransportRequestDto> {
    const normalized = message.toLowerCase().trim();
    let pickupAddress = 'Kimironko';
    let destinationAddress = 'Kacyiru';
    let confidence = 0.5;

    const fromToMatch =
      /(?:from|kuva|kuri)\s+(.+?)\s+(?:to|kugera|kuri|->)\s+(.+)/i.exec(message);
    if (fromToMatch) {
      pickupAddress = fromToMatch[1].trim();
      destinationAddress = fromToMatch[2].trim();
      confidence = 0.85;
    } else if (/nshaka|need|transport|ride|motari/i.test(normalized)) {
      confidence = 0.65;
    }

    const pickupCoords = this.resolveLocation(pickupAddress);
    const destCoords = this.resolveLocation(destinationAddress);

    const dto = plainToInstance(ParsedTransportRequestDto, {
      pickupAddress,
      pickupLatitude: pickupCoords.lat,
      pickupLongitude: pickupCoords.lng,
      destinationAddress,
      destinationLatitude: destCoords.lat,
      destinationLongitude: destCoords.lng,
      requestedPickupTime: new Date(Date.now() + 30 * 60_000).toISOString(),
      notes: message,
      confidence,
    });

    const errors = validateSync(dto, { whitelist: true });
    if (errors.length > 0) {
      return plainToInstance(ParsedTransportRequestDto, {
        pickupAddress: 'Unknown',
        destinationAddress: 'Unknown',
        confidence: 0.2,
      });
    }

    return dto;
  }

  private resolveLocation(name: string): { lat: number; lng: number } {
    const key = name.toLowerCase().trim();
    for (const [loc, coords] of Object.entries(KIGALI_LOCATIONS)) {
      if (key.includes(loc)) {
        return coords;
      }
    }
    return { lat: -1.9441, lng: 30.0619 };
  }
}
