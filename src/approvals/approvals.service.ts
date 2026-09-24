import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConflictDomainException, NotFoundDomainException } from '../common/exceptions/domain.exception';
import {
  ApprovalAction,
  ErrorCode,
  TransportRequestStatus,
  TripEventType,
  TripStatus,
} from '../common/enums';
import { toPointGeoJson } from '../common/utils/geo.util';
import { DispatchService } from '../dispatch/dispatch.service';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEventsService } from '../trip-events/trip-events.service';
import { Trip } from '../trips/entities/trip.entity';
import { WhatsAppStatusNotifierService } from '../whatsapp/whatsapp-status-notifier.service';
import { ApproveTransportRequestDto } from './dto/approve-transport-request.dto';
import { ApprovalResponseDto } from './dto/approval-response.dto';
import { RejectTransportRequestDto } from './dto/reject-transport-request.dto';
import { TransportRequestApproval } from './entities/transport-request-approval.entity';

export interface ApprovalResultDto {
  approval: ApprovalResponseDto;
  requestId: string;
  tripId?: string;
}

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(TransportRequestApproval)
    private readonly approvalRepository: Repository<TransportRequestApproval>,
    private readonly dataSource: DataSource,
    private readonly tripEventsService: TripEventsService,
    private readonly dispatchService: DispatchService,
    private readonly whatsappStatusNotifier: WhatsAppStatusNotifierService,
  ) {}

  async approve(
    companyId: string,
    requestId: string,
    supervisorId: string,
    dto: ApproveTransportRequestDto,
  ): Promise<ApprovalResultDto> {
    const tripId = await this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(TransportRequest);
      const approvalRepo = manager.getRepository(TransportRequestApproval);
      const tripRepo = manager.getRepository(Trip);

      const request = await requestRepo.findOne({
        where: { id: requestId, companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundDomainException('Transport request not found.');
      }

      if (request.status !== TransportRequestStatus.PENDING_APPROVAL) {
        throw new ConflictDomainException(
          ErrorCode.REQUEST_ALREADY_PROCESSED,
          'Transport request has already been processed.',
        );
      }

      const approval = await approvalRepo.save(
        approvalRepo.create({
          companyId,
          requestId: request.id,
          supervisorId,
          action: ApprovalAction.APPROVED,
          reason: dto.notes ?? null,
        }),
      );

      request.status = TransportRequestStatus.APPROVED;
      await requestRepo.save(request);

      request.status = TransportRequestStatus.DISPATCHING;
      await requestRepo.save(request);

      const trip = await tripRepo.save(
        tripRepo.create({
          companyId,
          transportRequestId: request.id,
          employeeId: request.employeeId,
          status: TripStatus.SEARCHING_RIDER,
          pickupAddress: request.pickupAddress,
          pickupLatitude: request.pickupLatitude,
          pickupLongitude: request.pickupLongitude,
          pickupLocation: toPointGeoJson({
            lat: request.pickupLatitude,
            lng: request.pickupLongitude,
          }),
          destinationAddress: request.destinationAddress,
          destinationLatitude: request.destinationLatitude,
          destinationLongitude: request.destinationLongitude,
          destinationLocation: toPointGeoJson({
            lat: request.destinationLatitude,
            lng: request.destinationLongitude,
          }),
          estimatedDistanceKm: request.estimatedDistanceKm,
          estimatedDurationMinutes: request.estimatedDurationMinutes,
          estimatedPrice: request.estimatedPrice,
        }),
      );

      await this.tripEventsService.appendEvent(
        companyId,
        trip.id,
        TripEventType.REQUEST_APPROVED,
        supervisorId,
        { requestId: request.id, approvalId: approval.id },
      );

      await this.tripEventsService.appendEvent(
        companyId,
        trip.id,
        TripEventType.DISPATCH_STARTED,
        supervisorId,
        { requestId: request.id },
      );

      return trip.id;
    });

    await this.whatsappStatusNotifier.notifyRequestStatus(
      companyId,
      requestId,
      'Approved — searching for a rider',
    );

    await this.dispatchService.startAutomaticDispatch(tripId);

    const approval = await this.approvalRepository.findOne({
      where: { requestId, companyId, action: ApprovalAction.APPROVED },
      order: { createdAt: 'DESC' },
    });

    return {
      approval: ApprovalResponseDto.fromEntity(approval!),
      requestId,
      tripId,
    };
  }

  async reject(
    companyId: string,
    requestId: string,
    supervisorId: string,
    dto: RejectTransportRequestDto,
  ): Promise<ApprovalResultDto> {
    const approval = await this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(TransportRequest);
      const approvalRepo = manager.getRepository(TransportRequestApproval);

      const request = await requestRepo.findOne({
        where: { id: requestId, companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundDomainException('Transport request not found.');
      }

      if (request.status !== TransportRequestStatus.PENDING_APPROVAL) {
        throw new ConflictDomainException(
          ErrorCode.REQUEST_ALREADY_PROCESSED,
          'Transport request has already been processed.',
        );
      }

      const savedApproval = await approvalRepo.save(
        approvalRepo.create({
          companyId,
          requestId: request.id,
          supervisorId,
          action: ApprovalAction.REJECTED,
          reason: dto.notes ?? null,
        }),
      );

      request.status = TransportRequestStatus.REJECTED;
      await requestRepo.save(request);

      return savedApproval;
    });

    await this.whatsappStatusNotifier.notifyRequestStatus(
      companyId,
      requestId,
      `Rejected${dto.notes ? `: ${dto.notes}` : ''}`,
    );

    return {
      approval: ApprovalResponseDto.fromEntity(approval),
      requestId,
    };
  }
}
