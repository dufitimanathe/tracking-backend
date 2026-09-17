import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { Employee } from '../employees/entities/employee.entity';
import { TransportRequestsModule } from '../transport-requests/transport-requests.module';
import { WhatsAppMessage } from './entities/whatsapp-message.entity';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsAppMessage, Employee]),
    AiModule,
    TransportRequestsModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
