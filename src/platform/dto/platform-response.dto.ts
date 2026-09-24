import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CompanyDocumentStatus,
  CompanyDocumentType,
  CompanyStatus,
  MembershipStatus,
  UserRole,
} from '../../common/enums';
import { CompanyResponseDto } from '../../companies/dto/company-response.dto';
import { CompanyDocument } from '../../companies/entities/company-document.entity';
import { MemberResponseDto } from '../../company-members/dto/member-response.dto';

export class CompanyDocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty({ enum: CompanyDocumentType })
  type!: CompanyDocumentType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  fileUrl!: string;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty({ enum: CompanyDocumentStatus })
  status!: CompanyDocumentStatus;

  @ApiPropertyOptional()
  reviewNotes?: string | null;

  @ApiPropertyOptional()
  reviewedByUserId?: string | null;

  @ApiPropertyOptional()
  reviewedAt?: Date | null;

  @ApiPropertyOptional()
  uploadedByUserId?: string | null;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(doc: CompanyDocument): CompanyDocumentResponseDto {
    return {
      id: doc.id,
      companyId: doc.companyId,
      type: doc.type,
      title: doc.title,
      fileUrl: doc.fileUrl,
      notes: doc.notes ?? null,
      status: doc.status,
      reviewNotes: doc.reviewNotes ?? null,
      reviewedByUserId: doc.reviewedByUserId ?? null,
      reviewedAt: doc.reviewedAt ?? null,
      uploadedByUserId: doc.uploadedByUserId ?? null,
      createdAt: doc.createdAt,
    };
  }
}

export class PlatformCompanyListItemDto extends CompanyResponseDto {
  @ApiProperty()
  adminCount!: number;

  @ApiProperty()
  documentCount!: number;

  @ApiProperty()
  pendingDocumentCount!: number;
}

export class PlatformCompanyDetailDto {
  @ApiProperty({ type: CompanyResponseDto })
  company!: CompanyResponseDto;

  @ApiProperty({ type: [CompanyDocumentResponseDto] })
  documents!: CompanyDocumentResponseDto[];

  @ApiProperty({ type: [MemberResponseDto] })
  admins!: MemberResponseDto[];
}

export class PlatformOverviewDto {
  @ApiProperty()
  totalCompanies!: number;

  @ApiProperty()
  pendingReview!: number;

  @ApiProperty()
  activeCompanies!: number;

  @ApiProperty()
  suspendedCompanies!: number;

  @ApiProperty()
  rejectedCompanies!: number;

  @ApiProperty()
  pendingDocuments!: number;
}

export { CompanyStatus, MembershipStatus, UserRole };
