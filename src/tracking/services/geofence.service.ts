import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeofenceEventType } from '../../common/enums';
import { toPointWkt } from '../../common/utils/geo.util';
import { REALTIME_EVENTS } from '../../realtime/realtime.constants';
import { RealtimeService } from '../../realtime/realtime.service';
import { Geofence } from '../entities/geofence.entity';
import { GeofenceEvent } from '../entities/geofence-event.entity';
import { CreateGeofenceDto } from '../dto/create-geofence.dto';
import { UpdateGeofenceDto } from '../dto/update-geofence.dto';

@Injectable()
export class GeofenceService {
  private readonly logger = new Logger(GeofenceService.name);

  constructor(
    @InjectRepository(Geofence)
    private readonly geofenceRepository: Repository<Geofence>,
    @InjectRepository(GeofenceEvent)
    private readonly eventRepository: Repository<GeofenceEvent>,
    private readonly realtimeService: RealtimeService,
  ) {}

  list(companyId: string): Promise<Geofence[]> {
    return this.geofenceRepository.find({
      where: { companyId },
      order: { name: 'ASC' },
    });
  }

  async create(companyId: string, dto: CreateGeofenceDto): Promise<Geofence> {
    const entity = this.geofenceRepository.create({
      companyId,
      name: dto.name,
      type: dto.type,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusMeters: dto.radiusMeters ?? 100,
      active: true,
      center: toPointWkt({ lat: dto.latitude, lng: dto.longitude }),
    });
    return this.geofenceRepository.save(entity);
  }

  async update(
    companyId: string,
    geofenceId: string,
    dto: UpdateGeofenceDto,
  ): Promise<Geofence | null> {
    const entity = await this.geofenceRepository.findOne({
      where: { id: geofenceId, companyId },
    });
    if (!entity) return null;
    if (dto.name != null) entity.name = dto.name;
    if (dto.type != null) entity.type = dto.type;
    if (dto.radiusMeters != null) entity.radiusMeters = dto.radiusMeters;
    if (dto.active != null) entity.active = dto.active;
    if (dto.latitude != null && dto.longitude != null) {
      entity.latitude = dto.latitude;
      entity.longitude = dto.longitude;
      entity.center = toPointWkt({ lat: dto.latitude, lng: dto.longitude });
    }
    return this.geofenceRepository.save(entity);
  }

  async remove(companyId: string, geofenceId: string): Promise<boolean> {
    const result = await this.geofenceRepository.delete({ id: geofenceId, companyId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Detect enter/exit using PostGIS ST_DWithin against active company geofences.
   */
  async checkPoint(input: {
    companyId: string;
    riderId: string;
    motorcycleId: string;
    trackingSessionId: string;
    latitude: number;
    longitude: number;
    at: Date;
  }): Promise<GeofenceEvent[]> {
    const inside: Array<{ id: string; name: string }> = await this.geofenceRepository.query(
      `
      SELECT g.id, g.name
      FROM geofences g
      WHERE g."companyId" = $1
        AND g.active = true
        AND ST_DWithin(
          g.center,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          g."radiusMeters"
        )
      `,
      [input.companyId, input.longitude, input.latitude],
    );

    const insideIds = new Set(inside.map((g) => g.id));
    const events: GeofenceEvent[] = [];

    // Recent ENTER without EXIT = currently inside
    const openEnters = await this.eventRepository.find({
      where: {
        companyId: input.companyId,
        riderId: input.riderId,
        type: GeofenceEventType.ENTER,
      },
      order: { occurredAt: 'DESC' },
      take: 50,
    });

    const currentlyInside = new Set<string>();
    for (const enter of openEnters) {
      if (currentlyInside.has(enter.geofenceId)) continue;
      const laterExit = await this.eventRepository.findOne({
        where: {
          geofenceId: enter.geofenceId,
          riderId: input.riderId,
          type: GeofenceEventType.EXIT,
        },
        order: { occurredAt: 'DESC' },
      });
      if (!laterExit || laterExit.occurredAt < enter.occurredAt) {
        currentlyInside.add(enter.geofenceId);
      }
    }

    for (const fence of inside) {
      if (!currentlyInside.has(fence.id)) {
        const ev = await this.eventRepository.save(
          this.eventRepository.create({
            companyId: input.companyId,
            geofenceId: fence.id,
            riderId: input.riderId,
            motorcycleId: input.motorcycleId,
            trackingSessionId: input.trackingSessionId,
            type: GeofenceEventType.ENTER,
            latitude: input.latitude,
            longitude: input.longitude,
            occurredAt: input.at,
          }),
        );
        events.push(ev);
        this.realtimeService.emitToCompany(
          input.companyId,
          REALTIME_EVENTS.TRACKING_GEOFENCE_ENTER,
          {
            geofenceId: fence.id,
            geofenceName: fence.name,
            riderId: input.riderId,
            motorcycleId: input.motorcycleId,
            occurredAt: input.at.toISOString(),
          },
        );
      }
    }

    for (const fenceId of currentlyInside) {
      if (!insideIds.has(fenceId)) {
        const fence = await this.geofenceRepository.findOne({
          where: { id: fenceId, companyId: input.companyId },
        });
        const ev = await this.eventRepository.save(
          this.eventRepository.create({
            companyId: input.companyId,
            geofenceId: fenceId,
            riderId: input.riderId,
            motorcycleId: input.motorcycleId,
            trackingSessionId: input.trackingSessionId,
            type: GeofenceEventType.EXIT,
            latitude: input.latitude,
            longitude: input.longitude,
            occurredAt: input.at,
          }),
        );
        events.push(ev);
        this.realtimeService.emitToCompany(
          input.companyId,
          REALTIME_EVENTS.TRACKING_GEOFENCE_EXIT,
          {
            geofenceId: fenceId,
            geofenceName: fence?.name ?? null,
            riderId: input.riderId,
            motorcycleId: input.motorcycleId,
            occurredAt: input.at.toISOString(),
          },
        );
      }
    }

    void this.logger;
    return events;
  }
}
