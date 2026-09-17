import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Repository } from 'typeorm';
import { IncidentStatus, TripStatus } from '../common/enums';
import { BillingRecord } from '../billing/entities/billing-record.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { Trip } from '../trips/entities/trip.entity';
import { ReportSummaryDto } from './dto/report-summary.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(BillingRecord)
    private readonly billingRecordRepository: Repository<BillingRecord>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
  ) {}

  async getSummary(companyId: string, from: Date, to: Date): Promise<ReportSummaryDto> {
    const tripStats = await this.tripRepository
      .createQueryBuilder('t')
      .select('COUNT(*)', 'totalTrips')
      .addSelect(
        `SUM(CASE WHEN t.status = '${TripStatus.COMPLETED}' THEN 1 ELSE 0 END)`,
        'completedTrips',
      )
      .addSelect(
        `SUM(CASE WHEN t.status = '${TripStatus.CANCELLED}' THEN 1 ELSE 0 END)`,
        'cancelledTrips',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.status = '${TripStatus.COMPLETED}' THEN CAST(t."actualDistanceKm" AS numeric) ELSE 0 END), 0)`,
        'totalDistanceKm',
      )
      .where('t.companyId = :companyId', { companyId })
      .andWhere('t.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne<{
        totalTrips: string;
        completedTrips: string;
        cancelledTrips: string;
        totalDistanceKm: string;
      }>();

    const revenueStats = await this.billingRecordRepository
      .createQueryBuilder('b')
      .select('COALESCE(SUM(CAST(b.totalAmount AS numeric)), 0)', 'totalRevenue')
      .where('b.companyId = :companyId', { companyId })
      .andWhere('b.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne<{ totalRevenue: string }>();

    const openIncidents = await this.incidentRepository.count({
      where: { companyId, status: IncidentStatus.OPEN },
    });

    const totalTrips = Number(tripStats?.totalTrips ?? 0);
    const completedTrips = Number(tripStats?.completedTrips ?? 0);
    const totalDistance = new Decimal(tripStats?.totalDistanceKm ?? 0);
    const averageDistance =
      completedTrips > 0 ? totalDistance.div(completedTrips) : new Decimal(0);

    return {
      totalTrips,
      completedTrips,
      cancelledTrips: Number(tripStats?.cancelledTrips ?? 0),
      totalRevenue: new Decimal(revenueStats?.totalRevenue ?? 0).toFixed(2),
      totalDistanceKm: totalDistance.toFixed(3),
      openIncidents,
      averageTripDistanceKm: averageDistance.toFixed(3),
    };
  }

  async exportTripsCsv(companyId: string, from: Date, to: Date): Promise<string> {
    const trips = await this.tripRepository
      .createQueryBuilder('t')
      .where('t.companyId = :companyId', { companyId })
      .andWhere('t.createdAt BETWEEN :from AND :to', { from, to })
      .orderBy('t.createdAt', 'ASC')
      .getMany();

    const header = [
      'id',
      'status',
      'employeeId',
      'riderId',
      'motorcycleId',
      'pickupAddress',
      'destinationAddress',
      'estimatedDistanceKm',
      'actualDistanceKm',
      'finalPrice',
      'createdAt',
      'completedAt',
    ].join(',');

    const rows = trips.map((trip) =>
      [
        trip.id,
        trip.status,
        trip.employeeId,
        trip.riderId ?? '',
        trip.motorcycleId ?? '',
        this.csvEscape(trip.pickupAddress),
        this.csvEscape(trip.destinationAddress),
        trip.estimatedDistanceKm ?? '',
        trip.actualDistanceKm ?? '',
        trip.finalPrice ?? '',
        trip.createdAt.toISOString(),
        trip.completedAt?.toISOString() ?? '',
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
