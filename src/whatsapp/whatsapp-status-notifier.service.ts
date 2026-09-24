import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransportRequestChannel, TripStatus } from '../common/enums';
import { Employee } from '../employees/entities/employee.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { Trip } from '../trips/entities/trip.entity';
import { normalizeWhatsAppLang } from './utils/whatsapp-i18n';
import { WhatsAppOrchestrationService } from './whatsapp-orchestration.service';

export interface RiderAssignedNotifyDetails {
  riderName: string;
  riderPhone: string;
  plateNumber: string;
  etaMinutes?: number;
  distanceMeters?: number;
  language?: string | null;
}

const TRIP_HAS_RIDER: ReadonlySet<TripStatus> = new Set([
  TripStatus.RIDER_ASSIGNED,
  TripStatus.RIDER_ACCEPTED,
  TripStatus.RIDER_TO_PICKUP,
  TripStatus.RIDER_ARRIVED,
  TripStatus.IN_PROGRESS,
  TripStatus.COMPLETED,
]);

@Injectable()
export class WhatsAppStatusNotifierService {
  private readonly logger = new Logger(WhatsAppStatusNotifierService.name);

  constructor(
    @InjectRepository(TransportRequest)
    private readonly transportRequestRepository: Repository<TransportRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
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

      if (await this.shouldSuppressStaleStatus(companyId, requestId, statusLabel)) {
        this.logger.debug(
          `Suppressed stale WhatsApp status for request ${requestId}: ${statusLabel}`,
        );
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

  /** Rich assign message: plate, rider phone, ETA from driver location. */
  async notifyRiderAssigned(
    companyId: string,
    requestId: string,
    details: RiderAssignedNotifyDetails,
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

      const lang = normalizeWhatsAppLang(details.language);
      const text = this.buildAssignedMessage(lang, request, details);

      await this.orchestration.notifyEmployeeStatus(
        employee.phone,
        companyId,
        text,
        request.id,
      );
    } catch (error) {
      this.logger.warn(`WhatsApp rider-assigned notify failed: ${String(error)}`);
    }
  }

  /**
   * Drop lagging "still searching / no rider" updates once a rider is already on the trip.
   */
  private async shouldSuppressStaleStatus(
    companyId: string,
    requestId: string,
    statusLabel: string,
  ): Promise<boolean> {
    const lower = statusLabel.toLowerCase();
    const isSearchingOrNoRider =
      lower.includes('no rider') ||
      lower.includes('awaiting admin assignment') ||
      lower.includes('searching for a rider');

    if (!isSearchingOrNoRider) {
      return false;
    }

    const trip = await this.tripRepository.findOne({
      where: { companyId, transportRequestId: requestId },
      order: { createdAt: 'DESC' },
    });

    return !!trip && TRIP_HAS_RIDER.has(trip.status);
  }

  private buildAssignedMessage(
    lang: ReturnType<typeof normalizeWhatsAppLang>,
    request: TransportRequest,
    details: RiderAssignedNotifyDetails,
  ): string {
    const eta =
      details.etaMinutes != null
        ? lang === 'rw'
          ? `Tegereza hafi minota ${details.etaMinutes}.`
          : lang === 'fr'
            ? `Temps d’attente estimé : ${details.etaMinutes} min.`
            : `Estimated wait: about ${details.etaMinutes} min.`
        : '';

    if (lang === 'rw') {
      return [
        'Umushoferi yagenewe urugendo rwawe.',
        `${request.pickupAddress} → ${request.destinationAddress}`,
        `Izina: ${details.riderName}`,
        `Telefoni: ${details.riderPhone}`,
        `Imatara / Plate: ${details.plateNumber}`,
        eta,
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (lang === 'fr') {
      return [
        'Un conducteur a été assigné à votre trajet.',
        `${request.pickupAddress} → ${request.destinationAddress}`,
        `Nom : ${details.riderName}`,
        `Téléphone : ${details.riderPhone}`,
        `Plaque : ${details.plateNumber}`,
        eta,
      ]
        .filter(Boolean)
        .join('\n');
    }

    return [
      'A rider was assigned to your trip.',
      `${request.pickupAddress} → ${request.destinationAddress}`,
      `Rider: ${details.riderName}`,
      `Phone: ${details.riderPhone}`,
      `Plate: ${details.plateNumber}`,
      eta,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
