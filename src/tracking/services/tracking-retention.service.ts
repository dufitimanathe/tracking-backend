import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { LocationPing } from '../../locations/entities/location-ping.entity';

@Injectable()
export class TrackingRetentionService {
  private readonly logger = new Logger(TrackingRetentionService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(LocationPing)
    private readonly pingRepository: Repository<LocationPing>,
  ) {}

  /**
   * For one motorcycle on a calendar day: keep only the newest ping, drop the rest.
   */
  async compactDayForMotorcycle(
    companyId: string,
    motorcycleId: string,
    day: Date,
    keepPingId: string,
  ): Promise<number> {
    const start = new Date(day);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const result = await this.pingRepository
      .createQueryBuilder()
      .delete()
      .where('"companyId" = :companyId', { companyId })
      .andWhere('"motorcycleId" = :motorcycleId', { motorcycleId })
      .andWhere('"recordedAt" >= :start AND "recordedAt" < :end', { start, end })
      .andWhere('id != :keepPingId', { keepPingId })
      .execute();

    return result.affected ?? 0;
  }

  /** Delete history older than each company's retention window. */
  async purgeExpiredHistory(): Promise<{ companies: number; deleted: number }> {
    const companies = await this.companyRepository.find();
    let deleted = 0;

    for (const company of companies) {
      const days = company.trackingHistoryRetentionDays ?? 30;
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - days);
      cutoff.setUTCHours(0, 0, 0, 0);

      const result = await this.pingRepository
        .createQueryBuilder()
        .delete()
        .where('"companyId" = :companyId', { companyId: company.id })
        .andWhere('"recordedAt" < :cutoff', { cutoff })
        .execute();

      deleted += result.affected ?? 0;
    }

    this.logger.log(
      `Tracking retention purge: removed ${deleted} pings across ${companies.length} companies`,
    );
    return { companies: companies.length, deleted };
  }
}
