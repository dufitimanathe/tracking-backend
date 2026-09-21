import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransportRequestChannel } from '../common/enums';
import { Employee } from '../employees/entities/employee.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { WhatsAppOrchestrationService } from './whatsapp-orchestration.service';

@Injectable()
export class WhatsAppStatusNotifierService {
  private readonly logger = new Logger(WhatsAppStatusNotifierService.name);

  constructor(
    @InjectRepository(TransportRequest)
    private readonly transportRequestRepository: Repository<TransportRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly orchestration: WhatsAppOrchestrationService,
  ) {}

  async notifyRequestStatus(
    companyId: string,
    requestId: string,
    statusLabel: string,
  ): Promise<void> {
    try {
      const request = await this.transportRequestRepository.findOne({
        where: { id: requestId, companyId },
      });
      if (!request || request.channel !== TransportRequestChannel.WHATSAPP) {
        return;
      }

      const employee = await this.employeeRepository.findOne({
        where: { id: request.employeeId, companyId },
      });
      if (!employee?.phone) {
        return;
      }

      await this.orchestration.notifyEmployeeStatus(
        employee.phone,
        companyId,
        `Transport update: ${statusLabel}. ${request.pickupAddress} → ${request.destinationAddress}`,
        request.id,
      );
    } catch (error) {
      this.logger.warn(`WhatsApp status notify failed: ${String(error)}`);
    }
  }
}
