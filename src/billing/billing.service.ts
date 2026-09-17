import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Repository } from 'typeorm';
import { BillingStatus } from '../common/enums';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { ErrorCode } from '../common/enums';
import { Trip } from '../trips/entities/trip.entity';
import { TripStatus } from '../common/enums';
import { BillingRecord } from './entities/billing-record.entity';
import { PricingService } from './pricing.service';
import { BillingRecordResponseDto } from './dto/billing-record-response.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingRecord)
    private readonly billingRecordRepository: Repository<BillingRecord>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    private readonly pricingService: PricingService,
  ) {}

  async createForCompletedTrip(tripId: string): Promise<BillingRecordResponseDto> {
    const existing = await this.billingRecordRepository.findOne({ where: { tripId } });
    if (existing) {
      return BillingRecordResponseDto.fromEntity(existing);
    }

    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundDomainException('Trip not found.');
    }

    if (trip.status !== TripStatus.COMPLETED) {
      throw new ConflictDomainException(
        ErrorCode.TRIP_INVALID_STATE,
        'Billing can only be created for completed trips.',
      );
    }

    if (!trip.riderId || !trip.motorcycleId) {
      throw new ConflictDomainException(
        ErrorCode.TRIP_INVALID_STATE,
        'Trip must have rider and motorcycle assigned for billing.',
      );
    }

    const distanceKm = Number(trip.actualDistanceKm ?? trip.estimatedDistanceKm ?? 0);
    const rule = await this.pricingService.getActiveRule(trip.companyId);
    const totalAmount = await this.pricingService.calculatePriceForCompany(
      trip.companyId,
      distanceKm,
    );

    const distance = new Decimal(distanceKm);
    const firstKmCharge = distance.lte(1)
      ? new Decimal(rule.firstKilometerPrice)
      : new Decimal(rule.firstKilometerPrice);
    const additionalKm = Decimal.max(distance.minus(1), 0);
    const additionalKmCharge = additionalKm.times(rule.additionalKilometerPrice);

    const record = this.billingRecordRepository.create({
      companyId: trip.companyId,
      tripId: trip.id,
      employeeId: trip.employeeId,
      riderId: trip.riderId,
      motorcycleId: trip.motorcycleId,
      distanceKm: distance.toFixed(3),
      firstKmCharge: firstKmCharge.toFixed(2),
      additionalKm: additionalKm.toFixed(3),
      additionalKmCharge: additionalKmCharge.toFixed(2),
      totalAmount,
      currency: rule.currency,
      billingStatus: BillingStatus.BILLED,
    });

    try {
      const saved = await this.billingRecordRepository.save(record);
      return BillingRecordResponseDto.fromEntity(saved);
    } catch {
      const raced = await this.billingRecordRepository.findOne({ where: { tripId } });
      if (raced) {
        return BillingRecordResponseDto.fromEntity(raced);
      }
      throw new ConflictDomainException(
        ErrorCode.BILLING_RECORD_EXISTS,
        'Billing record already exists for this trip.',
      );
    }
  }

  async listForCompany(companyId: string): Promise<BillingRecordResponseDto[]> {
    const records = await this.billingRecordRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
    return records.map(BillingRecordResponseDto.fromEntity);
  }
}
