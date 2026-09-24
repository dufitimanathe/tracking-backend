import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DevicePushToken } from './entities/device-push-token.entity';

@Injectable()
export class DevicePushTokensService {
  private readonly logger = new Logger(DevicePushTokensService.name);

  constructor(
    @InjectRepository(DevicePushToken)
    private readonly tokenRepository: Repository<DevicePushToken>,
  ) {}

  async upsertToken(userId: string, token: string, platform: string): Promise<DevicePushToken> {
    const existing = await this.tokenRepository.findOne({ where: { token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      return this.tokenRepository.save(existing);
    }

    return this.tokenRepository.save(
      this.tokenRepository.create({
        userId,
        token,
        platform,
      }),
    );
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.tokenRepository.delete({ userId, token });
  }

  async removeTokenByValue(token: string): Promise<void> {
    await this.tokenRepository.delete({ token });
  }

  async findTokensForUser(userId: string): Promise<DevicePushToken[]> {
    return this.tokenRepository.find({ where: { userId } });
  }
}
