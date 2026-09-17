import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { haversineDistanceMeters } from '../common/utils/geo.util';
import { Rider } from '../riders/entities/rider.entity';

export interface RiderMatchCandidate {
  riderId: string;
  motorcycleId: string;
  distanceMeters: number;
}

@Injectable()
export class RiderMatchingService {
  private readonly logger = new Logger(RiderMatchingService.name);

  constructor(
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
  ) {}

  async findNearbyAvailableRiders(
    companyId: string,
    pickupLat: number,
    pickupLng: number,
    radiusMeters: number,
    limit = 10,
  ): Promise<RiderMatchCandidate[]> {
    try {
      return await this.findWithPostGis(
        companyId,
        pickupLat,
        pickupLng,
        radiusMeters,
        limit,
      );
    } catch (error) {
      this.logger.warn(
        `PostGIS rider matching failed, falling back to haversine: ${String(error)}`,
      );
      return this.findWithHaversine(
        companyId,
        pickupLat,
        pickupLng,
        radiusMeters,
        limit,
      );
    }
  }

  private async findWithPostGis(
    companyId: string,
    pickupLat: number,
    pickupLng: number,
    radiusMeters: number,
    limit: number,
  ): Promise<RiderMatchCandidate[]> {
    const rows = await this.riderRepository.query(
      `
      SELECT r.id as "riderId", a."motorcycleId",
        ST_Distance(cl.position::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) as distance_meters
      FROM riders r
      JOIN rider_motorcycle_assignments a ON a."riderId" = r.id AND a.active = true
      JOIN motorcycle_current_locations cl ON cl."motorcycleId" = a."motorcycleId"
      WHERE r."companyId" = $1
        AND r.status = 'ACTIVE'
        AND r."availabilityStatus" = 'AVAILABLE'
        AND ST_DWithin(cl.position::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)
      ORDER BY distance_meters ASC
      LIMIT $5
      `,
      [companyId, pickupLng, pickupLat, radiusMeters, limit],
    );

    return rows.map((row: { riderId: string; motorcycleId: string; distance_meters: string }) => ({
      riderId: row.riderId,
      motorcycleId: row.motorcycleId,
      distanceMeters: Number(row.distance_meters),
    }));
  }

  private async findWithHaversine(
    companyId: string,
    pickupLat: number,
    pickupLng: number,
    radiusMeters: number,
    limit: number,
  ): Promise<RiderMatchCandidate[]> {
    const rows = await this.riderRepository.query(
      `
      SELECT r.id as "riderId", a."motorcycleId",
        r."currentLatitude"::float as lat,
        r."currentLongitude"::float as lng
      FROM riders r
      JOIN rider_motorcycle_assignments a ON a."riderId" = r.id AND a.active = true
      WHERE r."companyId" = $1
        AND r.status = 'ACTIVE'
        AND r."availabilityStatus" = 'AVAILABLE'
        AND r."currentLatitude" IS NOT NULL
        AND r."currentLongitude" IS NOT NULL
      `,
      [companyId],
    );

    const candidates: RiderMatchCandidate[] = rows.map(
      (row: {
        riderId: string;
        motorcycleId: string;
        lat: number;
        lng: number;
      }) => ({
        riderId: row.riderId,
        motorcycleId: row.motorcycleId,
        distanceMeters: haversineDistanceMeters(
          pickupLat,
          pickupLng,
          row.lat,
          row.lng,
        ),
      }),
    );

    return candidates
      .filter((candidate: RiderMatchCandidate) => candidate.distanceMeters <= radiusMeters)
      .sort(
        (left: RiderMatchCandidate, right: RiderMatchCandidate) =>
          left.distanceMeters - right.distanceMeters,
      )
      .slice(0, limit);
  }
}
