import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createHash } from 'crypto';
import * as argon2 from 'argon2';
import { DataSource, Repository } from 'typeorm';
import { getSkipTake } from '../common/dto/pagination.dto';
import {
  ConflictDomainException,
  DomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import {
  ErrorCode,
  MembershipStatus,
  UserRole,
  UserStatus,
} from '../common/enums';
import { normalizeRwandaPhone } from '../common/utils/rwanda-phone.util';
import { generateActivationCode } from '../common/utils/activation-code.util';
import { Company } from '../companies/entities/company.entity';
import { EmailActivationToken } from '../auth/entities/email-activation-token.entity';
import { MailService } from '../mail/mail.service';
import { Rider } from '../riders/entities/rider.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CompanyMember } from './entities/company-member.entity';

const STAFF_ROLES = new Set<UserRole>([
  UserRole.COMPANY_ADMIN,
  UserRole.SUPERVISOR,
  UserRole.ACCOUNTANT,
]);

@Injectable()
export class CompanyMembersService {
  private readonly logger = new Logger(CompanyMembersService.name);

  constructor(
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async createMember(
    companyId: string,
    dto: CreateMemberDto,
  ): Promise<MemberResponseDto> {
    if (!dto.email && !dto.phone) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Either email or phone is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (STAFF_ROLES.has(dto.role) && !dto.email?.trim()) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Email is required for supervisor, accountant, and admin invites.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const phone = dto.phone?.trim()
      ? normalizeRwandaPhone(dto.phone)
      : null;
    if (dto.phone?.trim() && !phone) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Phone must be a valid Rwanda mobile number.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const email = dto.email?.trim().toLowerCase() || undefined;
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundDomainException('Company not found.');
    }

    const needsInviteEmail = Boolean(email && STAFF_ROLES.has(dto.role));
    if (needsInviteEmail && !this.mailService.isConfigured()) {
      throw new DomainException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Email service is not configured. Set MAILER_* in the backend environment.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const memberRepo = manager.getRepository(CompanyMember);
      const riderRepo = manager.getRepository(Rider);
      const tokenRepo = manager.getRepository(EmailActivationToken);

      let user: User | null = null;
      if (email) {
        user = await userRepo.findOne({ where: { email } });
      }
      if (!user && phone) {
        user = await userRepo.findOne({ where: { phone } });
      }

      let temporaryPassword: string | undefined;
      let createdNewUser = false;

      if (!user) {
        createdNewUser = true;
        temporaryPassword = dto.password ?? this.generateTemporaryPassword();
        const passwordHash = await argon2.hash(temporaryPassword);
        user = userRepo.create({
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: email ?? null,
          phone: phone ?? null,
          passwordHash,
          status: needsInviteEmail
            ? UserStatus.PENDING_VERIFICATION
            : UserStatus.ACTIVE,
        });
        user = await userRepo.save(user);
      }

      const existingMembership = await memberRepo.findOne({
        where: { userId: user.id, companyId },
      });
      if (existingMembership) {
        throw new ConflictDomainException(
          ErrorCode.CONFLICT,
          'User is already a member of this company.',
        );
      }

      const membership = memberRepo.create({
        userId: user.id,
        companyId,
        role: dto.role,
        status: needsInviteEmail
          ? MembershipStatus.INVITED
          : (dto.status ?? MembershipStatus.ACTIVE),
        joinedAt: new Date(),
      });
      const savedMembership = await memberRepo.save(membership);

      if (dto.role === UserRole.RIDER && phone) {
        const existingRider = await riderRepo.findOne({
          where: { userId: user.id, companyId },
        });
        if (!existingRider) {
          await riderRepo.save(
            riderRepo.create({
              companyId,
              userId: user.id,
              phone,
            }),
          );
        }
      }

      let rawToken: string | undefined;
      if (needsInviteEmail && email) {
        rawToken = generateActivationCode();
        const expiresHours =
          this.configService.get<number>('app.activationTokenTtlHours') ?? 72;
        await tokenRepo.save(
          tokenRepo.create({
            userId: user.id,
            companyId,
            membershipId: savedMembership.id,
            tokenHash: this.hashToken(rawToken),
            expiresAt: new Date(Date.now() + expiresHours * 60 * 60 * 1000),
          }),
        );
      }

      return {
        membership: savedMembership,
        user,
        temporaryPassword: needsInviteEmail ? undefined : temporaryPassword,
        rawToken,
        createdNewUser,
      };
    });

    if (needsInviteEmail && email && result.rawToken) {
      const expiresHours =
        this.configService.get<number>('app.activationTokenTtlHours') ?? 72;
      const webUrl = this.configService.get<string>('app.publicWebUrl') ?? 'http://localhost:3001';
      const activationUrl = `${webUrl}/activate?token=${encodeURIComponent(result.rawToken)}`;

      try {
        await this.mailService.sendInviteActivationEmail({
          to: email,
          firstName: dto.firstName.trim(),
          companyName: company.name,
          roleLabel: this.roleLabel(dto.role),
          activationUrl,
          activationToken: result.rawToken,
          expiresHours,
        });
      } catch (error) {
        this.logger.error(`Failed to send invite email: ${String(error)}`);
        await this.dataSource.transaction(async (manager) => {
          await manager.getRepository(EmailActivationToken).delete({
            userId: result.user.id,
            membershipId: result.membership.id,
          });
          await manager.getRepository(CompanyMember).delete({ id: result.membership.id });
          if (result.createdNewUser) {
            await manager.getRepository(User).delete({ id: result.user.id });
          }
        });
        throw new DomainException(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Invite email could not be sent. Member was not created. Check MAILER_* settings and retry.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    return MemberResponseDto.fromEntities(
      result.membership,
      result.user,
      result.temporaryPassword,
    );
  }

  async listMembers(
    companyId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ items: MemberResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(page, limit);

    let members: CompanyMember[];
    let total: number;

    if (search?.trim()) {
      const query = this.companyMemberRepository
        .createQueryBuilder('member')
        .innerJoin(User, 'user', 'user.id = member.userId')
        .where('member.companyId = :companyId', { companyId })
        .andWhere(
          '(LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search OR LOWER(user.email) LIKE :search OR user.phone LIKE :search)',
          { search: `%${search.trim().toLowerCase()}%` },
        )
        .orderBy('member.createdAt', 'DESC')
        .skip(skip)
        .take(take);

      [members, total] = await query.getManyAndCount();
    } else {
      [members, total] = await this.companyMemberRepository.findAndCount({
        where: { companyId },
        order: { createdAt: 'DESC' },
        skip,
        take,
      });
    }

    const users = await this.usersService.findByIds(members.map((member) => member.userId));
    const userMap = new Map(users.map((user) => [user.id, user]));

    const items = members
      .map((member) => {
        const user = userMap.get(member.userId);
        if (!user) {
          this.logger.warn(`Skipping orphan membership ${member.id} (missing user)`);
          return null;
        }
        return MemberResponseDto.fromEntities(member, user);
      })
      .filter((item): item is MemberResponseDto => item != null);

    return { items, total };
  }

  async updateMember(
    companyId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberResponseDto> {
    const membership = await this.companyMemberRepository.findOne({
      where: { id: memberId, companyId },
    });
    if (!membership) {
      throw new NotFoundDomainException('Company member not found.');
    }

    if (dto.role !== undefined) {
      membership.role = dto.role;
    }
    if (dto.status !== undefined) {
      membership.status = dto.status;
    }

    const savedMembership = await this.companyMemberRepository.save(membership);
    const user = await this.usersService.findByIdOrFail(savedMembership.userId);
    return MemberResponseDto.fromEntities(savedMembership, user);
  }

  private roleLabel(role: UserRole): string {
    switch (role) {
      case UserRole.SUPERVISOR:
        return 'Operations Supervisor';
      case UserRole.ACCOUNTANT:
        return 'Accountant';
      case UserRole.COMPANY_ADMIN:
        return 'Company Admin';
      default:
        return role;
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateTemporaryPassword(): string {
    return `Tmp${randomBytes(6).toString('base64url')}!1A`;
  }
}
