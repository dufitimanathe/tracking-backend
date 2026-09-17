import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Repository } from 'typeorm';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PricingRule } from './entities/pricing-rule.entity';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingRule)
    private readonly pricingRuleRepository: Repository<PricingRule>,
  ) {}

  async getActiveRule(companyId: string): Promise<PricingRule> {
    const companyRule = await this.pricingRuleRepository.findOne({
      where: { companyId, active: true },
      order: { effectiveFrom: 'DESC' },
    });

    if (companyRule) {
      return companyRule;
    }

    const platformRule = await this.pricingRuleRepository
      .createQueryBuilder('rule')
      .where('rule.companyId IS NULL')
      .andWhere('rule.active = true')
      .orderBy('rule.effectiveFrom', 'DESC')
      .getOne();

    if (!platformRule) {
      throw new NotFoundDomainException('Active pricing rule not found for company.');
    }

    return platformRule;
  }

  calculatePrice(distanceKm: number, firstKm = 500, additional = 400): string {
    const distance = new Decimal(distanceKm);

    if (distance.lte(1)) {
      return new Decimal(firstKm).toFixed(2);
    }

    const additionalKm = distance.minus(1);
    return new Decimal(firstKm).plus(additionalKm.times(additional)).toFixed(2);
  }

  async calculatePriceForCompany(
    companyId: string,
    distanceKm: number,
  ): Promise<string> {
    const rule = await this.getActiveRule(companyId);
    return this.calculatePrice(
      distanceKm,
      Number(rule.firstKilometerPrice),
      Number(rule.additionalKilometerPrice),
    );
  }
}
