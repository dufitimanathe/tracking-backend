import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../common/enums';
import { Notification } from '../entities/notification.entity';

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional()
  relatedEntityType?: string | null;

  @ApiPropertyOptional()
  relatedEntityId?: string | null;

  @ApiPropertyOptional()
  readAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(entity: Notification): NotificationResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      userId: entity.userId,
      type: entity.type,
      title: entity.title,
      message: entity.message,
      relatedEntityType: entity.relatedEntityType,
      relatedEntityId: entity.relatedEntityId,
      readAt: entity.readAt,
      createdAt: entity.createdAt,
    };
  }
}
