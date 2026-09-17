import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyContext } from '../../common/decorators/current-user.decorator';
import { CompanyAccessDeniedException } from '../../common/exceptions/domain.exception';
import { DomainException } from '../../common/exceptions/domain.exception';
import {
  CompanyStatus,
  ErrorCode,
  MembershipStatus,
  UserRole,
} from '../../common/enums';
import { HttpStatus } from '@nestjs/common';
import { CompanyMember } from '../../company-members/entities/company-member.entity';
import { Company } from '../../companies/entities/company.entity';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

const COMPANY_ID_HEADER = 'x-company-id';

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const companyId = this.resolveCompanyId(request);

    if (!companyId) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Company context is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new DomainException(
        ErrorCode.NOT_FOUND,
        'Company not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (company.status === CompanyStatus.SUSPENDED) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'This company is suspended.',
        HttpStatus.FORBIDDEN,
      );
    }

    const platformAdminMembership = await this.companyMemberRepository.findOne({
      where: {
        userId: request.user.id,
        role: UserRole.PLATFORM_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (platformAdminMembership) {
      request.isPlatformAdmin = true;
      request.company = {
        companyId: company.id,
        role: UserRole.PLATFORM_ADMIN,
        membershipId: platformAdminMembership.id,
      };
      return true;
    }

    const membership = await this.companyMemberRepository.findOne({
      where: {
        userId: request.user.id,
        companyId: company.id,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new CompanyAccessDeniedException();
    }

    request.company = this.toCompanyContext(membership);
    return true;
  }

  private resolveCompanyId(request: AuthenticatedRequest): string | undefined {
    const paramId = request.params?.companyId;
    if (typeof paramId === 'string' && paramId.length > 0) {
      return paramId;
    }

    const headerValue = request.headers[COMPANY_ID_HEADER];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }

    return undefined;
  }

  private toCompanyContext(membership: CompanyMember): CompanyContext {
    return {
      companyId: membership.companyId,
      role: membership.role,
      membershipId: membership.id,
    };
  }
}
