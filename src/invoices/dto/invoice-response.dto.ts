import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '../../common/enums';
import { InvoiceLine } from '../entities/invoice-line.entity';
import { Invoice } from '../entities/invoice.entity';

export class InvoiceLineResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional()
  tripId?: string | null;

  static fromEntity(entity: InvoiceLine): InvoiceLineResponseDto {
    return {
      id: entity.id,
      description: entity.description,
      amount: entity.amount,
      currency: entity.currency,
      tripId: entity.tripId,
    };
  }
}

export class InvoiceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  periodStart!: Date;

  @ApiProperty()
  periodEnd!: Date;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  total!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional()
  issuedAt?: Date | null;

  @ApiPropertyOptional()
  lines?: InvoiceLineResponseDto[];

  static fromEntity(entity: Invoice, lines?: InvoiceLine[]): InvoiceResponseDto {
    return {
      id: entity.id,
      companyId: entity.companyId,
      invoiceNumber: entity.invoiceNumber,
      periodStart: entity.periodStart,
      periodEnd: entity.periodEnd,
      status: entity.status,
      subtotal: entity.subtotal,
      total: entity.total,
      currency: entity.currency,
      issuedAt: entity.issuedAt,
      lines: lines?.map(InvoiceLineResponseDto.fromEntity),
    };
  }
}
