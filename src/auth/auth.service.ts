import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { Company } from '../companies/entities/company.entity';
import { RegisterCompanyDto } from '../companies/dto/register-company.dto';
import { CompaniesService } from '../companies/companies.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  ConflictDomainException,
  DomainException,
} from '../common/exceptions/domain.exception';
import { ErrorCode, UserStatus } from '../common/enums';
import { HttpStatus } from '@nestjs/common';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto, MembershipSummaryDto } from './dto/me-response.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthJwtPayload, TokenPair } from './interfaces/jwt-payload.interface';
import { parseDurationToMs } from './utils/duration.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    if (!dto.email && !dto.phone) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Either email or phone is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      status: UserStatus.ACTIVE,
    });

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: UserResponseDto.fromEntity(user),
    };
  }

  async registerCompany(dto: RegisterCompanyDto): Promise<AuthResponseDto> {
    if (!dto.admin.email && !dto.admin.phone) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Either admin email or phone is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.admin.email) {
      const existing = await this.usersService.findByEmail(dto.admin.email);
      if (existing) {
        throw new ConflictDomainException(
          ErrorCode.CONFLICT,
          'A user with this email already exists.',
        );
      }
    }

    if (dto.admin.phone) {
      const existing = await this.usersService.findByPhone(dto.admin.phone);
      if (existing) {
        throw new ConflictDomainException(
          ErrorCode.CONFLICT,
          'A user with this phone already exists.',
        );
      }
    }

    const passwordHash = await argon2.hash(dto.admin.password);
    const { userId } = await this.companiesService.createWithNewAdmin(
      dto.admin,
      dto.company,
      passwordHash,
    );

    const user = await this.usersService.findByIdOrFail(userId);
    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: UserResponseDto.fromEntity(user),
    };
  }

  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponseDto> {
    if (!dto.email && !dto.phone) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Either email or phone is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = dto.email
      ? await this.usersService.findByEmail(dto.email)
      : await this.usersService.findByPhone(dto.phone!);

    if (!user) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid credentials.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'User account is not active.',
        HttpStatus.FORBIDDEN,
      );
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid credentials.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user, userAgent, ipAddress);

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(user),
    };
  }

  async refresh(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    let payload: AuthJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthJwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('app.jwt.refreshSecret'),
      });
    } catch {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid refresh token.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (payload.type !== 'refresh') {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid refresh token.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: {
        userId: payload.sub,
        tokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!storedToken) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Refresh token has been revoked or expired.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    storedToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(storedToken);

    const user = await this.usersService.findByIdOrFail(payload.sub);
    return this.issueTokens(user, userAgent, ipAddress);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });

    if (storedToken) {
      storedToken.revokedAt = new Date();
      await this.refreshTokenRepository.save(storedToken);
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findByIdOrFail(userId);
    const validPassword = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!validPassword) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Current password is incorrect.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.usersService.updatePasswordHash(userId, passwordHash);
    await this.revokeAllRefreshTokens(userId);
  }

  async me(userId: string): Promise<MeResponseDto> {
    const user = await this.usersService.findByIdOrFail(userId);
    const memberships = await this.companyMemberRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const companyIds = [...new Set(memberships.map((membership) => membership.companyId))];
    const companies = companyIds.length
      ? await this.companyRepository
          .createQueryBuilder('company')
          .where('company.id IN (:...companyIds)', { companyIds })
          .getMany()
      : [];
    const companyMap = new Map(companies.map((company) => [company.id, company]));

    const membershipSummaries: MembershipSummaryDto[] = memberships.map((membership) => {
      const company = companyMap.get(membership.companyId);
      return {
        id: membership.id,
        companyId: membership.companyId,
        companyName: company?.name ?? 'Unknown',
        companySlug: company?.slug ?? '',
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt,
      };
    });

    return {
      user: UserResponseDto.fromEntity(user),
      memberships: membershipSummaries,
    };
  }

  async requestPasswordReset(
    dto: RequestPasswordResetDto,
  ): Promise<{ message: string; resetToken?: string }> {
    if (!dto.email && !dto.phone) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Either email or phone is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = dto.email
      ? await this.usersService.findByEmail(dto.email)
      : await this.usersService.findByPhone(dto.phone!);

    if (!user) {
      return { message: 'If the account exists, a reset link will be sent.' };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.passwordResetTokenRepository.save(
      this.passwordResetTokenRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    return {
      message: 'If the account exists, a reset link will be sent.',
      ...(process.env.NODE_ENV !== 'production' ? { resetToken: rawToken } : {}),
    };
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto): Promise<void> {
    const tokenHash = this.hashToken(dto.token);
    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!resetToken) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid or expired reset token.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.usersService.updatePasswordHash(resetToken.userId, passwordHash);
    resetToken.usedAt = new Date();
    await this.passwordResetTokenRepository.save(resetToken);
    await this.revokeAllRefreshTokens(resetToken.userId);
  }

  private async issueTokens(
    user: User,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const accessPayload: AuthJwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      type: 'access',
    };
    const refreshPayload: AuthJwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      type: 'refresh',
    };

    const accessSecret = this.configService.getOrThrow<string>('app.jwt.accessSecret');
    const refreshSecret = this.configService.getOrThrow<string>('app.jwt.refreshSecret');
    const accessExpiresIn =
      this.configService.get<string>('app.jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn =
      this.configService.get<string>('app.jwt.refreshExpiresIn') ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
    ]);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(refreshExpiresIn),
    );

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null,
      }),
    );

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
