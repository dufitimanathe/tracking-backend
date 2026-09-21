import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { WhatsAppConversationState } from '../common/enums';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { WhatsAppConversation } from './entities/whatsapp-conversation.entity';
import { conversationRedisKey, normalizePhone } from './utils/phone.util';

const REDIS_TTL_SECONDS = 60 * 60 * 24;

export interface ConversationDraft {
  [key: string]: unknown;
  pickupText?: string;
  destinationText?: string;
  pickupPlaceId?: string;
  destinationPlaceId?: string;
  pickupDisplayName?: string;
  destinationDisplayName?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  destinationLatitude?: number;
  destinationLongitude?: number;
  requestedPickupTime?: string;
  passengerCount?: number;
  notes?: string;
  language?: string;
  selectionSide?: 'pickup' | 'destination';
}

@Injectable()
export class WhatsAppConversationService {
  constructor(
    @InjectRepository(WhatsAppConversation)
    private readonly conversationRepository: Repository<WhatsAppConversation>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async getOrCreate(phone: string, companyId?: string | null, employeeId?: string | null) {
    const normalized = normalizePhone(phone);
    let conversation = await this.conversationRepository.findOne({
      where: { phone: normalized },
    });

    if (!conversation) {
      conversation = await this.conversationRepository.save(
        this.conversationRepository.create({
          phone: normalized,
          companyId: companyId ?? null,
          employeeId: employeeId ?? null,
          state: WhatsAppConversationState.NEW,
          draft: {},
          lastMessageAt: new Date(),
        }),
      );
    } else if (companyId && conversation.companyId !== companyId) {
      conversation.companyId = companyId;
      conversation.employeeId = employeeId ?? conversation.employeeId;
      await this.conversationRepository.save(conversation);
    }

    await this.mirrorToRedis(conversation);
    return conversation;
  }

  async update(
    conversation: WhatsAppConversation,
    patch: Partial<
      Pick<
        WhatsAppConversation,
        'state' | 'draft' | 'pendingCandidates' | 'transportRequestId' | 'language' | 'lastMessageAt'
      >
    >,
  ): Promise<WhatsAppConversation> {
    Object.assign(conversation, patch);
    conversation.lastMessageAt = patch.lastMessageAt ?? new Date();
    const saved = await this.conversationRepository.save(conversation);
    await this.mirrorToRedis(saved);
    return saved;
  }

  async resetDraft(conversation: WhatsAppConversation): Promise<WhatsAppConversation> {
    return this.update(conversation, {
      state: WhatsAppConversationState.NEW,
      draft: {},
      pendingCandidates: null,
      transportRequestId: null,
    });
  }

  getDraft(conversation: WhatsAppConversation): ConversationDraft {
    return (conversation.draft ?? {}) as ConversationDraft;
  }

  private async mirrorToRedis(conversation: WhatsAppConversation): Promise<void> {
    if (!conversation.companyId) {
      return;
    }
    const key = conversationRedisKey(conversation.companyId, conversation.phone);
    await this.redis.set(
      key,
      JSON.stringify({
        id: conversation.id,
        state: conversation.state,
        draft: conversation.draft,
        pendingCandidates: conversation.pendingCandidates,
        transportRequestId: conversation.transportRequestId,
      }),
      'EX',
      REDIS_TTL_SECONDS,
    );
  }
}
