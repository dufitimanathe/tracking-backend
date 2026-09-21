import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { GeocodeCache } from '../../tracking/entities/geocode-cache.entity';
import {
  LocationProvider,
  LocationSearchOptions,
  PlaceCandidate,
} from '../interfaces/location-provider.interface';

/**
 * Google Places API (New) — Text Search + Place Details.
 * Uses GOOGLE_MAPS_API_KEY. Never invents coordinates.
 */
@Injectable()
export class GooglePlacesProvider implements LocationProvider {
  private readonly logger = new Logger(GooglePlacesProvider.name);
  private readonly apiKey: string;

  constructor(
    configService: ConfigService,
    @InjectRepository(GeocodeCache)
    private readonly geocodeCacheRepository: Repository<GeocodeCache>,
  ) {
    this.apiKey =
      configService.get<string>('app.integrations.googleMapsApiKey', { infer: true }) ?? '';
  }

  async searchPlaces(options: LocationSearchOptions): Promise<PlaceCandidate[]> {
    if (!this.apiKey) {
      this.logger.debug('Google Places key missing — returning empty candidates');
      return [];
    }

    const maxResults = options.maxResults ?? 5;

    try {
      const response = await axios.post<{
        places?: Array<{
          id?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          location?: { latitude?: number; longitude?: number };
        }>;
      }>(
        'https://places.googleapis.com/v1/places:searchText',
        {
          textQuery: options.query,
          regionCode: options.regionCode ?? 'RW',
          languageCode: options.languageCode ?? 'en',
          maxResultCount: maxResults,
          locationBias: {
            circle: {
              center: { latitude: -1.9441, longitude: 30.0619 },
              radius: 50000.0,
            },
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location',
          },
          timeout: 10_000,
        },
      );

      const places = response.data.places ?? [];
      const candidates: PlaceCandidate[] = [];

      for (const place of places) {
        const lat = place.location?.latitude;
        const lng = place.location?.longitude;
        if (lat == null || lng == null || !place.id) {
          continue;
        }
        const candidate: PlaceCandidate = {
          placeId: place.id,
          displayName: place.displayName?.text ?? options.query,
          formattedAddress: place.formattedAddress ?? place.displayName?.text ?? options.query,
          lat,
          lng,
        };
        candidates.push(candidate);
        await this.cachePlace(candidate);
      }

      return candidates;
    } catch (error) {
      this.logger.warn(`Places Text Search failed: ${String(error)}`);
      return [];
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceCandidate | null> {
    const cached = await this.geocodeCacheRepository.findOne({ where: { placeId } });
    if (cached) {
      return {
        placeId,
        displayName: cached.formattedAddress ?? placeId,
        formattedAddress: cached.formattedAddress ?? placeId,
        lat: cached.latitude,
        lng: cached.longitude,
      };
    }

    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }>(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
        },
        timeout: 10_000,
      });

      const lat = response.data.location?.latitude;
      const lng = response.data.location?.longitude;
      if (lat == null || lng == null) {
        return null;
      }

      const candidate: PlaceCandidate = {
        placeId: response.data.id ?? placeId,
        displayName: response.data.displayName?.text ?? placeId,
        formattedAddress: response.data.formattedAddress ?? placeId,
        lat,
        lng,
      };
      await this.cachePlace(candidate);
      return candidate;
    } catch (error) {
      this.logger.warn(`Place Details failed: ${String(error)}`);
      return null;
    }
  }

  private async cachePlace(candidate: PlaceCandidate): Promise<void> {
    try {
      const geohash = `${candidate.lat.toFixed(3)},${candidate.lng.toFixed(3)}`;
      const existing = await this.geocodeCacheRepository.findOne({ where: { geohash } });
      if (existing) {
        existing.placeId = candidate.placeId;
        existing.formattedAddress = candidate.formattedAddress;
        existing.latitude = candidate.lat;
        existing.longitude = candidate.lng;
        await this.geocodeCacheRepository.save(existing);
        return;
      }
      await this.geocodeCacheRepository.save(
        this.geocodeCacheRepository.create({
          geohash,
          latitude: candidate.lat,
          longitude: candidate.lng,
          formattedAddress: candidate.formattedAddress,
          placeId: candidate.placeId,
          country: 'RW',
        }),
      );
    } catch {
      // cache is best-effort
    }
  }
}
