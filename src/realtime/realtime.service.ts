import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEvent } from './realtime.constants';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToCompany(companyId: string, event: RealtimeEvent, payload: unknown): void {
    this.gateway.emitToCompany(companyId, event, payload);
  }

  emitToTrip(tripId: string, event: RealtimeEvent, payload: unknown): void {
    this.gateway.emitToRoom(`trip:${tripId}`, event, payload);
  }

  emitToRider(riderId: string, event: RealtimeEvent, payload: unknown): void {
    this.gateway.emitToRoom(`rider:${riderId}`, event, payload);
  }

  emitToUser(userId: string, event: RealtimeEvent, payload: unknown): void {
    this.gateway.emitToRoom(`user:${userId}`, event, payload);
  }
}
