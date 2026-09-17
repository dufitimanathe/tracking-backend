import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Between, Repository } from 'typeorm';
import { BillingStatus, InvoiceStatus } from '../common/enums';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { getSkipTake, PaginationQueryDto } from '../common/dto/pagination.dto';
import { BillingRecord } from '../billing/entities/billing-record.entity';
import { Company } from '../companies/entities/company.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceResponseDto } from './dto/invoice-response.dto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly invoiceLineRepository: Repository<InvoiceLine>,
    @InjectRepository(BillingRecord)
    private readonly billingRecordRepository: Repository<BillingRecord>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async listForCompany(
    companyId: string,
    query: PaginationQueryDto,
  ): Promise<{ items: InvoiceResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);

    const [items, total] = await this.invoiceRepository.findAndCount({
      where: { companyId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return {
      items: items.map((item) => InvoiceResponseDto.fromEntity(item)),
      total,
    };
  }

  async findOne(companyId: string, invoiceId: string): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new NotFoundDomainException('Invoice not found.');
    }

    const lines = await this.invoiceLineRepository.find({
      where: { invoiceId },
      order: { createdAt: 'ASC' },
    });

    return InvoiceResponseDto.fromEntity(invoice, lines);
  }

  async generateDraft(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<InvoiceResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundDomainException('Company not found.');
    }

    const billingRecords = await this.billingRecordRepository.find({
      where: {
        companyId,
        billingStatus: BillingStatus.BILLED,
        createdAt: Between(periodStart, periodEnd),
      },
      order: { createdAt: 'ASC' },
    });

    const subtotal = billingRecords.reduce(
      (sum, record) => sum.plus(record.totalAmount),
      new Decimal(0),
    );

    const invoiceNumber = await this.generateInvoiceNumber(companyId);
    const invoice = await this.invoiceRepository.save(
      this.invoiceRepository.create({
        companyId,
        invoiceNumber,
        periodStart,
        periodEnd,
        status: InvoiceStatus.DRAFT,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        currency: company.currency ?? 'RWF',
      }),
    );

    const lines: InvoiceLine[] = [];
    for (const record of billingRecords) {
      const line = await this.invoiceLineRepository.save(
        this.invoiceLineRepository.create({
          invoiceId: invoice.id,
          billingRecordId: record.id,
          tripId: record.tripId,
          description: `Trip ${record.tripId.slice(0, 8)} — ${record.distanceKm} km`,
          amount: record.totalAmount,
          currency: record.currency,
        }),
      );
      lines.push(line);

      record.billingStatus = BillingStatus.INVOICED;
      await this.billingRecordRepository.save(record);
    }

    return InvoiceResponseDto.fromEntity(invoice, lines);
  }

  async issueInvoice(companyId: string, invoiceId: string): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new NotFoundDomainException('Invoice not found.');
    }

    if (invoice.status === InvoiceStatus.DRAFT) {
      invoice.status = InvoiceStatus.ISSUED;
      invoice.issuedAt = new Date();
      invoice.dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.invoiceRepository.save(invoice);
    }

    return this.findOne(companyId, invoiceId);
  }

  private async generateInvoiceNumber(companyId: string): Promise<string> {
    const count = await this.invoiceRepository.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
