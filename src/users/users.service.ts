import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { ErrorCode } from '../common/enums';
import { User } from './entities/user.entity';

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  passwordHash: string;
  status?: UserStatus;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundDomainException('User not found.');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone: phone.trim() } });
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) {
      return [];
    }
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids })
      .getMany();
  }

  async create(input: CreateUserInput): Promise<User> {
    if (input.email) {
      const existingEmail = await this.findByEmail(input.email);
      if (existingEmail) {
        throw new ConflictDomainException(
          ErrorCode.CONFLICT,
          'A user with this email already exists.',
        );
      }
    }

    if (input.phone) {
      const existingPhone = await this.findByPhone(input.phone);
      if (existingPhone) {
        throw new ConflictDomainException(
          ErrorCode.CONFLICT,
          'A user with this phone already exists.',
        );
      }
    }

    const user = this.userRepository.create({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email?.toLowerCase().trim() ?? null,
      phone: input.phone?.trim() ?? null,
      passwordHash: input.passwordHash,
      status: input.status ?? UserStatus.ACTIVE,
    });

    return this.userRepository.save(user);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.userRepository.update(userId, { passwordHash });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLoginAt: new Date() });
  }
}
