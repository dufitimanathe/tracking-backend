import { ApiProperty } from '@nestjs/swagger';
import { BillingStatus } from '../../common/enums';
import { BillingRecord } from '../entities/billing-record.entity';

export class BillingRecordResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  tripId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  riderId!: string;

  @ApiProperty()
  motorcycleId!: string;

  @ApiProperty()
  distanceKm!: string;

  @ApiProperty()
  firstKmCharge!: string;

  @ApiProperty()
  additionalKm!: string;

  @ApiProperty()
  additionalKmCharge!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: BillingStatus })
  billingStatus!: BillingStatus;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(entity: BillingRecord): BillingRecordResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      tripId: entity.tripId,
      employeeId: entity.employeeId,
      riderId: entity.riderId,
      motorcycleId: entity.motorcycleId,
      distanceKm: entity.distanceKm,
      firstKmCharge: entity.firstKmCharge,
      additionalKm: entity.additionalKm,
      additionalKmCharge: entity.additionalKmCharge,
      totalAmount: entity.totalAmount,
      currency: entity.currency,
      billingStatus: entity.billingStatus,
      createdAt: entity.createdAt,
    };
  }
}
