import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainException } from '../../common/exceptions/domain.exception';
import { ErrorCode, MembershipStatus, UserRole } from '../../common/enums';
import { HttpStatus } from '@nestjs/common';
import { CompanyMember } from '../../company-members/entities/company-member.entity';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.id) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Authentication required.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const membership = await this.companyMemberRepository.findOne({
      where: {
        userId: request.user.id,
        role: UserRole.PLATFORM_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Platform admin access required.',
        HttpStatus.FORBIDDEN,
      );
    }

    request.isPlatformAdmin = true;
    request.company = {
      companyId: membership.companyId,
      role: UserRole.PLATFORM_ADMIN,
      membershipId: membership.id,
    };
    return true;
  }
}
