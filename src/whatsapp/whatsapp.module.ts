import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { RedisModule } from '../common/redis/redis.module';
import { Employee } from '../employees/entities/employee.entity';
import { QUEUE_WHATSAPP } from '../jobs/jobs.constants';
import { MapsModule } from '../maps/maps.module';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TransportRequestsModule } from '../transport-requests/transport-requests.module';
import { IntegrationEvent } from '../integrations/entities/integration-event.entity';
import { TransportRequestParsing } from './entities/transport-request-parsing.entity';
import { WhatsAppConversation } from './entities/whatsapp-conversation.entity';
import { WhatsAppMessage } from './entities/whatsapp-message.entity';
import { MetaWhatsAppMessagingProvider } from './providers/meta-whatsapp.messaging-provider';
import { WhatsAppConversationService } from './whatsapp-conversation.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappInboundProcessor } from './whatsapp-inbound.processor';
import { WhatsAppOrchestrationService } from './whatsapp-orchestration.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsAppStatusNotifierService } from './whatsapp-status-notifier.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsAppMessage,
      WhatsAppConversation,
      TransportRequestParsing,
      TransportRequest,
      Employee,
      IntegrationEvent,
    ]),
    BullModule.registerQueue({ name: QUEUE_WHATSAPP }),
    RedisModule,
    AiModule,
    MapsModule,
    forwardRef(() => TransportRequestsModule),
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    WhatsAppConversationService,
    WhatsAppOrchestrationService,
    MetaWhatsAppMessagingProvider,
    WhatsappInboundProcessor,
    WhatsAppStatusNotifierService,
  ],
  exports: [WhatsappService, WhatsAppOrchestrationService, WhatsAppStatusNotifierService],
})
export class WhatsappModule {}
