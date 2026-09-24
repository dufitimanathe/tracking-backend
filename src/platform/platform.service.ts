import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { getSkipTake } from '../common/dto/pagination.dto';
import {
  CompanyDocumentStatus,
  CompanyStatus,
  ErrorCode,
  MembershipStatus,
  UserRole,
} from '../common/enums';
import {
  DomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { CompaniesService } from '../companies/companies.service';
import { CompanyResponseDto } from '../companies/dto/company-response.dto';
import { CompanyDocument } from '../companies/entities/company-document.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyMembersService } from '../company-members/company-members.service';
import { MemberResponseDto } from '../company-members/dto/member-response.dto';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { User } from '../users/entities/user.entity';
import {
  AddCompanyDocumentDto,
  ApproveCompanyDto,
  PlatformCreateCompanyDto,
  RejectCompanyDto,
  ReviewDocumentDto,
} from './dto/platform.dto';
import {
  CompanyDocumentResponseDto,
  PlatformCompanyDetailDto,
  PlatformCompanyListItemDto,
  PlatformOverviewDto,
} from './dto/platform-response.dto';

@Injectable()
export class PlatformService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyDocument)
    private readonly documentRepository: Repository<CompanyDocument>,
    @InjectRepository(CompanyMember)
    private readonly memberRepository: Repository<CompanyMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly companiesService: CompaniesService,
    private readonly companyMembersService: CompanyMembersService,
  ) {}

  async getOverview(): Promise<PlatformOverviewDto> {
    const [
      totalCompanies,
      pendingReview,
      activeCompanies,
      suspendedCompanies,
      rejectedCompanies,
      pendingDocuments,
    ] = await Promise.all([
      this.companyRepository.count(),
      this.companyRepository.count({ where: { status: CompanyStatus.PENDING_REVIEW } }),
      this.companyRepository.count({ where: { status: CompanyStatus.ACTIVE } }),
      this.companyRepository.count({ where: { status: CompanyStatus.SUSPENDED } }),
      this.companyRepository.count({ where: { status: CompanyStatus.REJECTED } }),
      this.documentRepository.count({ where: { status: CompanyDocumentStatus.SUBMITTED } }),
    ]);

    return {
      totalCompanies,
      pendingReview,
      activeCompanies,
      suspendedCompanies,
      rejectedCompanies,
      pendingDocuments,
    };
  }

  async listCompanies(input: {
    status?: CompanyStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: PlatformCompanyListItemDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(input.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(input.limit) || 20));
    const { skip, take } = getSkipTake(page, limit);
    const qb = this.companyRepository.createQueryBuilder('company');

    if (input.status) {
      qb.andWhere('company.status = :status', { status: input.status });
    }
    if (input.search?.trim()) {
      const term = `%${input.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(company.name) LIKE :term OR LOWER(company.slug) LIKE :term OR LOWER(COALESCE(company.email, \'\')) LIKE :term OR LOWER(COALESCE(company.registrationNumber, \'\')) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('company.createdAt', 'DESC').skip(skip).take(take);

    const [companies, total] = await qb.getManyAndCount();
    const companyIds = companies.map((c) => c.id);

    const adminCounts = new Map<string, number>();
    const docCounts = new Map<string, number>();
    const pendingDocCounts = new Map<string, number>();

    if (companyIds.length) {
      const admins = await this.memberRepository
        .createQueryBuilder('m')
        .select('m.companyId', 'companyId')
        .addSelect('COUNT(*)', 'count')
        .where('m.companyId IN (:...companyIds)', { companyIds })
        .andWhere('m.role = :role', { role: UserRole.COMPANY_ADMIN })
        .andWhere('m.status = :status', { status: MembershipStatus.ACTIVE })
        .groupBy('m.companyId')
        .getRawMany<{ companyId: string; count: string }>();
      for (const row of admins) {
        adminCounts.set(row.companyId, Number(row.count));
      }

      const docs = await this.documentRepository
        .createQueryBuilder('d')
        .select('d.companyId', 'companyId')
        .addSelect('COUNT(*)', 'count')
        .addSelect(
          `SUM(CASE WHEN d.status = :submitted THEN 1 ELSE 0 END)`,
          'pendingCount',
        )
        .where('d.companyId IN (:...companyIds)', { companyIds })
        .setParameter('submitted', CompanyDocumentStatus.SUBMITTED)
        .groupBy('d.companyId')
        .getRawMany<{ companyId: string; count: string; pendingCount: string }>();
      for (const row of docs) {
        docCounts.set(row.companyId, Number(row.count));
        pendingDocCounts.set(row.companyId, Number(row.pendingCount));
      }
    }

    const items: PlatformCompanyListItemDto[] = companies.map((company) => ({
      ...CompanyResponseDto.fromEntity(company),
      adminCount: adminCounts.get(company.id) ?? 0,
      documentCount: docCounts.get(company.id) ?? 0,
      pendingDocumentCount: pendingDocCounts.get(company.id) ?? 0,
    }));

    return { items, total, page, limit };
  }

  async getCompanyDetail(companyId: string): Promise<PlatformCompanyDetailDto> {
    const company = await this.companiesService.getCompanyResponse(companyId);
    const documents = await this.documentRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
    const adminMembers = await this.memberRepository.find({
      where: {
        companyId,
        role: UserRole.COMPANY_ADMIN,
      },
      order: { createdAt: 'DESC' },
    });
    const userIds = adminMembers.map((m) => m.userId);
    const users = userIds.length
      ? await this.userRepository
          .createQueryBuilder('u')
          .where('u.id IN (:...userIds)', { userIds })
          .getMany()
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      company,
      documents: documents.map(CompanyDocumentResponseDto.fromEntity),
      admins: adminMembers
        .map((member) => {
          const user = userMap.get(member.userId);
          return user ? MemberResponseDto.fromEntities(member, user) : null;
        })
        .filter((item): item is MemberResponseDto => Boolean(item)),
    };
  }

  async approveCompany(
    companyId: string,
    reviewerUserId: string,
    dto: ApproveCompanyDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.companiesService.findByIdOrFail(companyId);
    if (company.status === CompanyStatus.ACTIVE) {
      return CompanyResponseDto.fromEntity(company);
    }
    if (company.status === CompanyStatus.SUSPENDED) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Reactivate a suspended company instead of approving it.',
        HttpStatus.CONFLICT,
      );
    }

    company.status = CompanyStatus.ACTIVE;
    company.approvedAt = new Date();
    company.approvedByUserId = reviewerUserId;
    company.rejectedAt = null;
    company.rejectionReason = null;
    company.reviewNotes = dto.notes?.trim() ?? company.reviewNotes ?? null;
    const saved = await this.companyRepository.save(company);
    return CompanyResponseDto.fromEntity(saved);
  }

  async rejectCompany(
    companyId: string,
    reviewerUserId: string,
    dto: RejectCompanyDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.companiesService.findByIdOrFail(companyId);
    if (company.status === CompanyStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Suspend an active company instead of rejecting it.',
        HttpStatus.CONFLICT,
      );
    }

    company.status = CompanyStatus.REJECTED;
    company.rejectedAt = new Date();
    company.rejectionReason = dto.reason.trim();
    company.approvedAt = null;
    company.approvedByUserId = reviewerUserId;
    const saved = await this.companyRepository.save(company);
    return CompanyResponseDto.fromEntity(saved);
  }

  async suspendCompany(companyId: string, notes?: string): Promise<CompanyResponseDto> {
    const company = await this.companiesService.findByIdOrFail(companyId);
    company.status = CompanyStatus.SUSPENDED;
    if (notes?.trim()) {
      company.reviewNotes = notes.trim();
    }
    const saved = await this.companyRepository.save(company);
    return CompanyResponseDto.fromEntity(saved);
  }

  async reactivateCompany(companyId: string): Promise<CompanyResponseDto> {
    const company = await this.companiesService.findByIdOrFail(companyId);
    company.status = CompanyStatus.ACTIVE;
    company.approvedAt = company.approvedAt ?? new Date();
    company.rejectedAt = null;
    company.rejectionReason = null;
    const saved = await this.companyRepository.save(company);
    return CompanyResponseDto.fromEntity(saved);
  }

  async createCompany(
    actorUserId: string,
    dto: PlatformCreateCompanyDto,
  ): Promise<PlatformCompanyDetailDto> {
    const tempPassword = `Tmp${randomBytes(4).toString('hex')}A1`;
    const passwordHash = await argon2.hash(tempPassword);
    const activate = dto.activateImmediately !== false;

    const { company } = await this.companiesService.createWithNewAdmin(
      {
        firstName: dto.admin.firstName,
        lastName: dto.admin.lastName,
        email: dto.admin.email,
        phone: dto.admin.phone,
        password: tempPassword,
      },
      dto.company,
      passwordHash,
      undefined,
      {
        status: activate ? CompanyStatus.ACTIVE : CompanyStatus.PENDING_REVIEW,
      },
    );

    if (activate) {
      await this.companyRepository.update(company.company.id, {
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
      });
    }

    const detail = await this.getCompanyDetail(company.company.id);
    if (detail.admins[0]) {
      detail.admins[0].temporaryPassword = tempPassword;
    }
    return detail;
  }

  async listAdmins(companyId: string): Promise<MemberResponseDto[]> {
    await this.companiesService.findByIdOrFail(companyId);
    const detail = await this.getCompanyDetail(companyId);
    return detail.admins;
  }

  async createAdmin(
    companyId: string,
    body: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    },
  ): Promise<MemberResponseDto> {
    return this.companyMembersService.createMember(companyId, {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      role: UserRole.COMPANY_ADMIN,
    });
  }

  async updateAdmin(
    companyId: string,
    memberId: string,
    body: { status?: MembershipStatus },
  ): Promise<MemberResponseDto> {
    const member = await this.memberRepository.findOne({
      where: { id: memberId, companyId },
    });
    if (!member || member.role !== UserRole.COMPANY_ADMIN) {
      throw new NotFoundDomainException('Company admin not found.');
    }
    return this.companyMembersService.updateMember(companyId, memberId, {
      status: body.status,
    });
  }

  async addDocument(
    companyId: string,
    actorUserId: string,
    dto: AddCompanyDocumentDto,
  ): Promise<CompanyDocumentResponseDto> {
    await this.companiesService.findByIdOrFail(companyId);
    const doc = this.documentRepository.create({
      companyId,
      type: dto.type,
      title: dto.title.trim(),
      fileUrl: dto.fileUrl.trim(),
      notes: dto.notes?.trim() ?? null,
      status: CompanyDocumentStatus.SUBMITTED,
      uploadedByUserId: actorUserId,
    });
    const saved = await this.documentRepository.save(doc);
    return CompanyDocumentResponseDto.fromEntity(saved);
  }

  async reviewDocument(
    companyId: string,
    documentId: string,
    reviewerUserId: string,
    dto: ReviewDocumentDto,
  ): Promise<CompanyDocumentResponseDto> {
    const doc = await this.documentRepository.findOne({
      where: { id: documentId, companyId },
    });
    if (!doc) {
      throw new NotFoundDomainException('Document not found.');
    }
    if (
      dto.status !== CompanyDocumentStatus.APPROVED &&
      dto.status !== CompanyDocumentStatus.REJECTED
    ) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Document review status must be APPROVED or REJECTED.',
        HttpStatus.BAD_REQUEST,
      );
    }

    doc.status = dto.status;
    doc.reviewNotes = dto.notes?.trim() ?? null;
    doc.reviewedByUserId = reviewerUserId;
    doc.reviewedAt = new Date();
    const saved = await this.documentRepository.save(doc);
    return CompanyDocumentResponseDto.fromEntity(saved);
  }
}
