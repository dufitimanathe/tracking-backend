import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationPing } from '../../locations/entities/location-ping.entity';

@Injectable()
export class DistanceService {
  constructor(
    @InjectRepository(LocationPing)
    private readonly pingRepository: Repository<LocationPing>,
  ) {}

  /**
   * Geodesic length of accepted session points using PostGIS geography.
   * Falls back to 0 when fewer than 2 points exist.
   */
  async sessionDistanceMeters(trackingSessionId: string): Promise<number> {
    const rows: Array<{ meters: string | number }> = await this.pingRepository.query(
      `
      SELECT COALESCE(
        (
          SELECT ST_Length(ST_MakeLine(geom ORDER BY "recordedAt")::geography)
          FROM (
            SELECT
              ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geom,
              "recordedAt"
            FROM location_pings
            WHERE "trackingSessionId" = $1
          ) AS pts
        ),
        0
      ) AS meters
      `,
      [trackingSessionId],
    );

    const meters = Number(rows?.[0]?.meters ?? 0);
    return Number.isFinite(meters) ? meters : 0;
  }

  async distanceSince(
    companyId: string,
    riderId: string,
    from: Date,
    to: Date = new Date(),
  ): Promise<number> {
    const rows: Array<{ meters: string | number }> = await this.pingRepository.query(
      `
      SELECT COALESCE(
        (
          SELECT ST_Length(ST_MakeLine(geom ORDER BY "recordedAt")::geography)
          FROM (
            SELECT
              ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geom,
              "recordedAt"
            FROM location_pings
            WHERE "companyId" = $1
              AND "riderId" = $2
              AND "recordedAt" >= $3
              AND "recordedAt" <= $4
          ) AS pts
        ),
        0
      ) AS meters
      `,
      [companyId, riderId, from.toISOString(), to.toISOString()],
    );
    const meters = Number(rows?.[0]?.meters ?? 0);
    return Number.isFinite(meters) ? meters : 0;
  }
}
