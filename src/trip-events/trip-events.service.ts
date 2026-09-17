import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripEventType } from '../common/enums';
import { TripEvent } from './entities/trip-event.entity';

@Injectable()
export class TripEventsService {
  constructor(
    @InjectRepository(TripEvent)
    private readonly tripEventRepository: Repository<TripEvent>,
  ) {}

  async appendEvent(
    companyId: string,
    tripId: string,
    type: TripEventType,
    actorId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<TripEvent> {
    const event = this.tripEventRepository.create({
      companyId,
      tripId,
      type,
      actorId: actorId ?? null,
      metadata: metadata ?? null,
    });

    return this.tripEventRepository.save(event);
  }
}
