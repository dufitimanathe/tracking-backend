import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
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
import { HttpStatus } from '@nestjs/common';
import { Rider } from '../riders/entities/rider.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CompanyMember } from './entities/company-member.entity';

@Injectable()
export class CompanyMembersService {
  constructor(
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    private readonly usersService: UsersService,
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

    let user: User | null = null;
    let temporaryPassword: string | undefined;

    if (dto.email) {
      user = await this.usersService.findByEmail(dto.email);
    }
    if (!user && dto.phone) {
      user = await this.usersService.findByPhone(dto.phone);
    }

    if (!user) {
      temporaryPassword = dto.password ?? this.generateTemporaryPassword();
      const passwordHash = await argon2.hash(temporaryPassword);
      user = await this.usersService.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        status: UserStatus.ACTIVE,
      });
    }

    const existingMembership = await this.companyMemberRepository.findOne({
      where: { userId: user.id, companyId },
    });
    if (existingMembership) {
      throw new ConflictDomainException(
        ErrorCode.CONFLICT,
        'User is already a member of this company.',
      );
    }

    const membership = this.companyMemberRepository.create({
      userId: user.id,
      companyId,
      role: dto.role,
      status: dto.status ?? MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    });
    const savedMembership = await this.companyMemberRepository.save(membership);

    if (dto.role === UserRole.RIDER && dto.phone) {
      const existingRider = await this.riderRepository.findOne({
        where: { userId: user.id, companyId },
      });
      if (!existingRider) {
        const rider = this.riderRepository.create({
          companyId,
          userId: user.id,
          phone: dto.phone,
        });
        await this.riderRepository.save(rider);
      }
    }

    return MemberResponseDto.fromEntities(savedMembership, user, temporaryPassword);
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

    const items = members.map((member) => {
      const user = userMap.get(member.userId);
      if (!user) {
        throw new NotFoundDomainException('Member user not found.');
      }
      return MemberResponseDto.fromEntities(member, user);
    });

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

  private generateTemporaryPassword(): string {
    return `Tmp${randomBytes(6).toString('base64url')}!1A`;
  }
}
