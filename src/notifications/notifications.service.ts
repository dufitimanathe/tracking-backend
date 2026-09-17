import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationType } from '../common/enums';
import { getSkipTake } from '../common/dto/pagination.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { Notification } from './entities/notification.entity';

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
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly realtimeService: RealtimeService,
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
