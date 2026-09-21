import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignmentMethod } from '../common/enums';
import { haversineDistanceMeters } from '../common/utils/geo.util';
import { MapsService } from '../maps/maps.service';
import { Rider } from '../riders/entities/rider.entity';

export interface RiderMatchCandidate {
  riderId: string;
  motorcycleId: string;
  distanceMeters: number;
  durationSeconds?: number;
  latitude?: number;
  longitude?: number;
  locationAgeSeconds?: number;
}

export interface RankedMatchResult {
  candidates: RiderMatchCandidate[];
  method: AssignmentMethod;
}

@Injectable()
export class RiderMatchingService {
  private readonly logger = new Logger(RiderMatchingService.name);

  constructor(
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    private readonly mapsService: MapsService,
    private readonly configService: ConfigService,
  ) {}

  async findNearbyAvailableRiders(
    companyId: string,
    pickupLat: number,
    pickupLng: number,
    radiusMeters: number,
    limit?: number,
  ): Promise<RiderMatchCandidate[]> {
    const ranked = await this.findAndRankCandidates(
      companyId,
      pickupLat,
      pickupLng,
      radiusMeters,
      limit,
    );
    return ranked.candidates;
  }

  async findAndRankCandidates(
    companyId: string,
    pickupLat: number,
    pickupLng: number,
    radiusMeters: number,
    limit?: number,
  ): Promise<RankedMatchResult> {
    const candidateLimit =
      limit ??
      this.configService.get<number>('app.ops.assignmentCandidateLimit', { infer: true }) ??
      10;
    const maxAgeSeconds =
      this.configService.get<number>('app.ops.riderLocationMaxAgeSeconds', { infer: true }) ?? 60;
    const matrixFallback =
      this.configService.get<boolean>('app.ops.assignmentMatrixFallback', { infer: true }) ?? true;

    let shortlist: RiderMatchCandidate[];
    try {
      shortlist = await this.findWithPostGis(
        companyId,
        pickupLat,
        pickupLng,
        radiusMeters,
        candidateLimit,
        maxAgeSeconds,
      );
    } catch (error) {
      this.logger.warn(
        `PostGIS rider matching failed, falling back to haversine: ${String(error)}`,
      );
      shortlist = await this.findWithHaversine(
        companyId,
        pickupLat,
        pickupLng,
        radiusMeters,
        candidateLimit,
        maxAgeSeconds,
      );
    }

    if (shortlist.length === 0) {
      return { candidates: [], method: AssignmentMethod.POSTGIS_FALLBACK };
    }

    try {
      const origins = shortlist.map((c) => ({
        lat: c.latitude ?? pickupLat,
        lng: c.longitude ?? pickupLng,
      }));
      const matrix = await this.mapsService.computeRouteMatrix(origins, [
        { lat: pickupLat, lng: pickupLng },
      ]);

      const ranked = shortlist
        .map((candidate, index) => {
          const durationSeconds = matrix.durationsSeconds[index]?.[0] ?? Number.MAX_SAFE_INTEGER;
          const distanceMeters =
            matrix.distancesMeters[index]?.[0] || candidate.distanceMeters;
          return {
            ...candidate,
            durationSeconds:
              durationSeconds === Number.MAX_SAFE_INTEGER ? undefined : durationSeconds,
            distanceMeters,
          };
        })
        .sort((a, b) => {
          const durA = a.durationSeconds ?? Number.MAX_SAFE_INTEGER;
          const durB = b.durationSeconds ?? Number.MAX_SAFE_INTEGER;
          if (durA !== durB) return durA - durB;
          return a.distanceMeters - b.distanceMeters;
        });

      return { candidates: ranked, method: AssignmentMethod.ROUTE_MATRIX };
    } catch (error) {
      this.logger.warn(`Route Matrix ranking failed: ${String(error)}`);
      if (!matrixFallback) {
        throw error;
      }
      return { candidates: shortlist, method: AssignmentMethod.POSTGIS_FALLBACK };
    }
  }

  private async findWithPostGis(
    companyId: string,
    pickupLat: number,
    pickupLng: number,
    radiusMeters: number,
    limit: number,
    maxAgeSeconds: number,
  ): Promise<RiderMatchCandidate[]> {
    const rows = await this.riderRepository.query(
      `
      SELECT r.id as "riderId", a."motorcycleId",
        ST_Distance(cl.position::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) as distance_meters,
        ST_Y(cl.position::geometry) as lat,
        ST_X(cl.position::geometry) as lng,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(cl."updatedAt", cl."createdAt"))) as age_seconds
      FROM riders r
      JOIN rider_motorcycle_assignments a ON a."riderId" = r.id AND a.active = true
      JOIN motorcycle_current_locations cl ON cl."motorcycleId" = a."motorcycleId"
      WHERE r."companyId" = $1
        AND r.status = 'ACTIVE'
        AND r."availabilityStatus" = 'AVAILABLE'
        AND ST_DWithin(cl.position::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)
        AND COALESCE(cl."updatedAt", cl."createdAt") >= NOW() - ($5 || ' seconds')::interval
      ORDER BY distance_meters ASC
      LIMIT $6
      `,
      [companyId, pickupLng, pickupLat, radiusMeters, maxAgeSeconds, limit],
    );

    return rows.map(
      (row: {
        riderId: string;
        motorcycleId: string;
        distance_meters: string;
        lat: number;
        lng: number;
        age_seconds: string;
      }) => ({
        riderId: row.riderId,
        motorcycleId: row.motorcycleId,
        distanceMeters: Number(row.distance_meters),
        latitude: Number(row.lat),
        longitude: Number(row.lng),
        locationAgeSeconds: Number(row.age_seconds),
      }),
    );
  }

  private async findWithHaversine(
    companyId: string,
    pickupLat: number,
    pickupLng: number,
    radiusMeters: number,
    limit: number,
    maxAgeSeconds: number,
  ): Promise<RiderMatchCandidate[]> {
    const rows = await this.riderRepository.query(
      `
      SELECT r.id as "riderId", a."motorcycleId",
        r."currentLatitude"::float as lat,
        r."currentLongitude"::float as lng,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(r."locationUpdatedAt", r."updatedAt"))) as age_seconds
      FROM riders r
      JOIN rider_motorcycle_assignments a ON a."riderId" = r.id AND a.active = true
      WHERE r."companyId" = $1
        AND r.status = 'ACTIVE'
        AND r."availabilityStatus" = 'AVAILABLE'
        AND r."currentLatitude" IS NOT NULL
        AND r."currentLongitude" IS NOT NULL
        AND COALESCE(r."locationUpdatedAt", r."updatedAt") >= NOW() - ($2 || ' seconds')::interval
      `,
      [companyId, maxAgeSeconds],
    );

    const candidates: RiderMatchCandidate[] = rows.map(
      (row: {
        riderId: string;
        motorcycleId: string;
        lat: number;
        lng: number;
        age_seconds: string;
      }) => ({
        riderId: row.riderId,
        motorcycleId: row.motorcycleId,
        distanceMeters: haversineDistanceMeters(pickupLat, pickupLng, row.lat, row.lng),
        latitude: row.lat,
        longitude: row.lng,
        locationAgeSeconds: Number(row.age_seconds),
      }),
    );

    return candidates
      .filter((candidate) => candidate.distanceMeters <= radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, limit);
  }
}
