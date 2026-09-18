import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { GeocodeCache } from '../entities/geocode-cache.entity';

function geohashEncode(lat: number, lng: number, precision = 7): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        idx = (idx << 1) + 1;
        lngMin = mid;
      } else {
        idx = idx << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = (idx << 1) + 1;
        latMin = mid;
      } else {
        idx = idx << 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      geohash += base32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

@Injectable()
export class ReverseGeocodingService {
  private readonly logger = new Logger(ReverseGeocodingService.name);

  constructor(
    @InjectRepository(GeocodeCache)
    private readonly cacheRepository: Repository<GeocodeCache>,
    private readonly configService: ConfigService,
  ) {}

  async reverse(lat: number, lng: number): Promise<string | null> {
    const hash = geohashEncode(lat, lng);
    const cached = await this.cacheRepository.findOne({ where: { geohash: hash } });
    if (cached?.formattedAddress) return cached.formattedAddress;

    const apiKey = this.configService.get<string>('app.integrations.googleMapsApiKey', {
      infer: true,
    });
    if (!apiKey) return null;

    try {
      const response = await axios.get<{
        status: string;
        results?: Array<{
          formatted_address?: string;
          place_id?: string;
          address_components?: Array<{ long_name: string; types: string[] }>;
        }>;
      }>('https://maps.googleapis.com/maps/api/geocode/json', {
        params: { latlng: `${lat},${lng}`, key: apiKey },
        timeout: 8000,
      });

      if (response.data.status !== 'OK' || !response.data.results?.[0]) {
        return null;
      }

      const top = response.data.results[0];
      const components = top.address_components ?? [];
      const find = (type: string) =>
        components.find((c) => c.types.includes(type))?.long_name ?? null;

      await this.cacheRepository.save(
        this.cacheRepository.create({
          geohash: hash,
          latitude: lat,
          longitude: lng,
          formattedAddress: top.formatted_address ?? null,
          placeId: top.place_id ?? null,
          locality: find('locality') ?? find('sublocality'),
          adminArea: find('administrative_area_level_1'),
          country: find('country'),
        }),
      );

      return top.formatted_address ?? null;
    } catch (err) {
      this.logger.debug(`Reverse geocode failed: ${(err as Error).message}`);
      return null;
    }
  }
}
