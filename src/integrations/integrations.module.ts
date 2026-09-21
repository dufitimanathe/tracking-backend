import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsAppMessage } from '../whatsapp/entities/whatsapp-message.entity';
import { IntegrationEvent } from './entities/integration-event.entity';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IntegrationEvent, WhatsAppMessage])],
  controllers: [IntegrationsController],
})
export class IntegrationsModule {}
