import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationType } from '../common/enums';
import { getSkipTake } from '../common/dto/pagination.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { Rider } from '../riders/entities/rider.entity';
import { Trip } from '../trips/entities/trip.entity';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { Notification } from './entities/notification.entity';
import { ExpoPushService } from './expo-push.service';

export interface CreateNotificationInput {
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    private readonly realtimeService: RealtimeService,
    private readonly expoPushService: ExpoPushService,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationResponseDto> {
    const notification = this.notificationRepository.create({
      companyId: input.companyId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
    });

    const saved = await this.notificationRepository.save(notification);
    const dto = NotificationResponseDto.fromEntity(saved);

    this.realtimeService.emitToUser(input.userId, REALTIME_EVENTS.NOTIFICATION_CREATED, dto);

    return dto;
  }

  async notifyRiderTripOffer(trip: Trip): Promise<void> {
    if (!trip.riderId) {
      return;
    }

    try {
      const rider = await this.riderRepository.findOne({ where: { id: trip.riderId } });
      if (!rider?.userId) {
        return;
      }

      const message = `${trip.pickupAddress} → ${trip.destinationAddress}`;
      await this.create({
        companyId: trip.companyId,
        userId: rider.userId,
        type: NotificationType.TRIP_ASSIGNMENT,
        title: 'New trip offer',
        message,
        relatedEntityType: 'trip',
        relatedEntityId: trip.id,
      });

      this.realtimeService.emitToRider(trip.riderId, REALTIME_EVENTS.TRIP_OFFER, {
        tripId: trip.id,
        companyId: trip.companyId,
        pickupAddress: trip.pickupAddress,
        destinationAddress: trip.destinationAddress,
        assignedAt: trip.assignedAt?.toISOString() ?? new Date().toISOString(),
      });
      this.realtimeService.emitToUser(rider.userId, REALTIME_EVENTS.TRIP_OFFER, {
        tripId: trip.id,
        companyId: trip.companyId,
        pickupAddress: trip.pickupAddress,
        destinationAddress: trip.destinationAddress,
        assignedAt: trip.assignedAt?.toISOString() ?? new Date().toISOString(),
      });

      await this.expoPushService.sendTripOfferAlarm(rider.userId, {
        tripId: trip.id,
        companyId: trip.companyId,
        pickupAddress: trip.pickupAddress,
        destinationAddress: trip.destinationAddress,
      });
    } catch (error) {
      this.logger.warn(`notifyRiderTripOffer failed for trip ${trip.id}: ${String(error)}`);
    }
  }

  async createForCompanyAdmins(
    companyId: string,
    adminUserIds: string[],
    input: Omit<CreateNotificationInput, 'companyId' | 'userId'>,
  ): Promise<void> {
    await Promise.all(
      adminUserIds.map((userId) =>
        this.create({
          companyId,
          userId,
          ...input,
        }),
      ),
    );
  }

  async listForUser(
    userId: string,
    companyId: string,
    query: PaginationQueryDto,
  ): Promise<{ items: NotificationResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);

    const [items, total] = await this.notificationRepository.findAndCount({
      where: { userId, companyId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return {
      items: items.map(NotificationResponseDto.fromEntity),
      total,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundDomainException('Notification not found.');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);
    }

    return NotificationResponseDto.fromEntity(notification);
  }
}
