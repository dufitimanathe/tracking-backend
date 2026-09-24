import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { Rider } from '../riders/entities/rider.entity';
import { DevicePushTokensService } from './device-push-tokens.service';
import { DevicesController } from './devices.controller';
import { DevicePushToken } from './entities/device-push-token.entity';
import { Notification } from './entities/notification.entity';
import { ExpoPushService } from './expo-push.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    AuthGuardsModule,
    RealtimeModule,
    TypeOrmModule.forFeature([Notification, DevicePushToken, Rider]),
  ],
  controllers: [NotificationsController, DevicesController],
  providers: [NotificationsService, DevicePushTokensService, ExpoPushService],
  exports: [NotificationsService, DevicePushTokensService, ExpoPushService],
})
export class NotificationsModule {}
