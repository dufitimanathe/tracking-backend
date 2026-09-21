import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TransportParseIntent,
  WhatsAppConversationState,
  WhatsAppMessageDirection,
  WhatsAppProcessingStatus,
} from '../common/enums';
import { AiService } from '../ai/ai.service';
import { ParsedTransportRequestDto } from '../ai/dto/parsed-transport-request.dto';
import { Employee } from '../employees/entities/employee.entity';
import { PlaceCandidate } from '../maps/interfaces/location-provider.interface';
import { MapsService } from '../maps/maps.service';
import { TransportRequestsService } from '../transport-requests/transport-requests.service';
import { TransportRequestParsing } from './entities/transport-request-parsing.entity';
import { WhatsAppMessage } from './entities/whatsapp-message.entity';
import { MetaWhatsAppMessagingProvider } from './providers/meta-whatsapp.messaging-provider';
import { normalizePhone } from './utils/phone.util';
import {
  canChangePickup,
  normalizePlaceKey,
  normalizeWhatsAppLang,
  pickupChangeDeadline,
  WhatsAppCopy,
  WhatsAppLang,
} from './utils/whatsapp-i18n';
import {
  ConversationDraft,
  WhatsAppConversationService,
} from './whatsapp-conversation.service';
import { WhatsAppConversation } from './entities/whatsapp-conversation.entity';

export interface InboundWhatsAppJobPayload {
  externalMessageId: string;
  phone: string;
  messageType: string;
  textBody?: string;
  latitude?: number;
  longitude?: number;
  buttonId?: string;
  buttonTitle?: string;
  rawMessage: Record<string, unknown>;
  value: Record<string, unknown>;
}

type PendingTripUpdate = {
  type: 'trip_update';
  proposed: ConversationDraft;
  pickupChanged: boolean;
  destChanged: boolean;
};

@Injectable()
export class WhatsAppOrchestrationService {
  private readonly logger = new Logger(WhatsAppOrchestrationService.name);

  constructor(
    @InjectRepository(WhatsAppMessage)
    private readonly messageRepository: Repository<WhatsAppMessage>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(TransportRequestParsing)
    private readonly parsingRepository: Repository<TransportRequestParsing>,
    private readonly conversationService: WhatsAppConversationService,
    private readonly messaging: MetaWhatsAppMessagingProvider,
    private readonly aiService: AiService,
    private readonly mapsService: MapsService,
    private readonly transportRequestsService: TransportRequestsService,
    private readonly configService: ConfigService,
  ) {}

  async processInbound(payload: InboundWhatsAppJobPayload): Promise<void> {
    const phone = normalizePhone(payload.phone);
    const existing = await this.messageRepository.findOne({
      where: { externalMessageId: payload.externalMessageId },
    });

    if (existing && existing.processingStatus === WhatsAppProcessingStatus.PROCESSED) {
      return;
    }

    const employee = await this.findEmployeeByPhone(phone);
    let message =
      existing ??
      (await this.messageRepository.save(
        this.messageRepository.create({
          externalMessageId: payload.externalMessageId,
          companyId: employee?.companyId ?? null,
          employeeId: employee?.id ?? null,
          phone,
          direction: WhatsAppMessageDirection.INBOUND,
          messageType: payload.messageType,
          messageBody: payload.textBody ?? payload.buttonTitle ?? null,
          processingStatus: WhatsAppProcessingStatus.PROCESSING,
          payload: payload.rawMessage,
        }),
      ));

    message.processingStatus = WhatsAppProcessingStatus.PROCESSING;
    await this.messageRepository.save(message);

    try {
      if (!employee) {
        await this.reply(
          phone,
          'Sorry, your phone number is not registered with any company transport account. Please contact your company admin.',
        );
        await this.markProcessed(message);
        return;
      }

      const conversation = await this.conversationService.getOrCreate(
        phone,
        employee.companyId,
        employee.id,
      );

      if (payload.buttonId) {
        await this.handleButton(employee, conversation, message, payload.buttonId);
      } else if (payload.messageType === 'location' && payload.latitude != null) {
        await this.handleSharedLocation(
          employee,
          conversation,
          message,
          payload.latitude,
          payload.longitude!,
        );
      } else {
        await this.handleText(
          employee,
          conversation,
          message,
          payload.textBody ?? '',
        );
      }

      await this.markProcessed(message);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        const lang = normalizeWhatsAppLang(
          /muraho|kuva|ngiye|njya|mvuye|muramfata|nshaka/i.test(payload.textBody ?? '')
            ? 'rw'
            : 'en',
        );
        await this.reply(phone, WhatsAppCopy.aiUnavailable(lang));
        message.processingStatus = WhatsAppProcessingStatus.FAILED;
        await this.messageRepository.save(message);
        return;
      }
      this.logger.error(`Failed processing WhatsApp ${payload.externalMessageId}: ${String(error)}`);
      message.processingStatus = WhatsAppProcessingStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  private async handleButton(
    employee: Employee,
    conversation: WhatsAppConversation,
    message: WhatsAppMessage,
    buttonId: string,
  ): Promise<void> {
    if (buttonId === 'confirm_yes' || buttonId === 'CONFIRM') {
      await this.confirmDraft(employee, conversation, message);
      return;
    }
    if (buttonId === 'confirm_no' || buttonId === 'CANCEL') {
      const lang = this.langOf(conversation);
      await this.conversationService.resetDraft(conversation);
      await this.reply(conversation.phone, WhatsAppCopy.cancelled(lang));
      return;
    }

    if (buttonId === 'update_yes') {
      await this.applyPendingTripUpdate(employee, conversation, message);
      return;
    }
    if (buttonId === 'update_no') {
      await this.rejectPendingTripUpdate(employee, conversation);
      return;
    }

    if (buttonId.startsWith('place_')) {
      const index = Number(buttonId.replace('place_', ''));
      await this.selectPlaceCandidate(employee, conversation, message, index);
    }
  }

  private async handleSharedLocation(
    employee: Employee,
    conversation: WhatsAppConversation,
    message: WhatsAppMessage,
    lat: number,
    lng: number,
  ): Promise<void> {
    const draft = this.conversationService.getDraft(conversation);
    draft.pickupLatitude = lat;
    draft.pickupLongitude = lng;
    draft.pickupDisplayName = draft.pickupDisplayName ?? 'Shared location';
    draft.pickupText = draft.pickupText ?? 'Shared location';

    await this.conversationService.update(conversation, {
      draft,
      state: WhatsAppConversationState.WAITING_FOR_DESTINATION,
    });

    if (draft.destinationLatitude != null && draft.destinationLongitude != null) {
      await this.promptConfirmation(employee, conversation, draft);
      return;
    }

    await this.reply(
      conversation.phone,
      'Pickup location saved. Where should we drop you off?',
    );
    message.requestId = conversation.transportRequestId ?? null;
  }

  private async handleText(
    employee: Employee,
    conversation: WhatsAppConversation,
    message: WhatsAppMessage,
    text: string,
  ): Promise<void> {
    const trimmed = text.trim();
    const langHint = this.langOf(conversation);
    if (!trimmed) {
      await this.reply(conversation.phone, WhatsAppCopy.emptyText(langHint));
      return;
    }

    const pendingUpdate = conversation.pendingCandidates as PendingTripUpdate | null;
    if (pendingUpdate?.type === 'trip_update') {
      if (/^(yes|y|confirm|oui|yego|hindura|update)\.?$/i.test(trimmed)) {
        await this.applyPendingTripUpdate(employee, conversation, message);
        return;
      }
      if (/^(no|n|cancel|annuler|hagarika|rekana|keep)\.?$/i.test(trimmed)) {
        await this.rejectPendingTripUpdate(employee, conversation);
        return;
      }
    }

    if (
      conversation.state === WhatsAppConversationState.READY_FOR_CONFIRMATION &&
      /^(yes|y|confirm|oui|yego|emeza)\.?$/i.test(trimmed)
    ) {
      await this.confirmDraft(employee, conversation, message);
      return;
    }

    if (
      conversation.state === WhatsAppConversationState.READY_FOR_CONFIRMATION &&
      /^(no|n|cancel|annuler|hagarika)\.?$/i.test(trimmed)
    ) {
      await this.conversationService.resetDraft(conversation);
      await this.reply(conversation.phone, WhatsAppCopy.cancelled(langHint));
      return;
    }

    if (
      conversation.state === WhatsAppConversationState.WAITING_FOR_LOCATION_SELECTION &&
      /^\d+$/.test(trimmed)
    ) {
      await this.selectPlaceCandidate(employee, conversation, message, Number(trimmed) - 1);
      return;
    }

    const previousState = conversation.state;

    await this.conversationService.update(conversation, {
      state: WhatsAppConversationState.PARSING,
    });

    let parsed: ParsedTransportRequestDto;
    try {
      parsed = await this.aiService.parseTransportMessage(trimmed, {
        locale: conversation.language ?? undefined,
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        await this.reply(conversation.phone, WhatsAppCopy.aiUnavailable(langHint));
        return;
      }
      throw error;
    }

    await this.persistParsing(employee, message, trimmed, parsed);
    const lang = normalizeWhatsAppLang(parsed.language ?? conversation.language);

    if (parsed.intent === TransportParseIntent.GREETING) {
      await this.reply(conversation.phone, WhatsAppCopy.greeting(lang));
      await this.conversationService.update(conversation, {
        state: WhatsAppConversationState.NEW,
        language: lang,
      });
      return;
    }

    if (parsed.intent === TransportParseIntent.HELP) {
      await this.reply(conversation.phone, WhatsAppCopy.help(lang));
      await this.conversationService.update(conversation, { language: lang });
      return;
    }

    if (parsed.intent === TransportParseIntent.CHECK_REQUEST_STATUS) {
      await this.replyStatus(employee, conversation);
      return;
    }

    if (parsed.intent === TransportParseIntent.CANCEL_REQUEST) {
      await this.conversationService.resetDraft(conversation);
      await this.reply(conversation.phone, WhatsAppCopy.draftCancelled(lang));
      return;
    }

    const isTripIntent =
      parsed.intent === TransportParseIntent.CREATE_TRANSPORT_REQUEST ||
      parsed.intent === TransportParseIntent.CHANGE_REQUEST;

    if (!isTripIntent) {
      await this.reply(conversation.phone, WhatsAppCopy.notUnderstood(lang));
      return;
    }

    const threshold = this.aiService.getConfidenceThreshold();
    if (
      parsed.confidence < threshold ||
      parsed.needsClarification ||
      (parsed.missingFields && parsed.missingFields.length > 0)
    ) {
      const missing = parsed.missingFields?.join(', ') || 'pickup/destination';
      await this.reply(conversation.phone, WhatsAppCopy.clarify(lang, missing));
      await this.conversationService.update(conversation, {
        state: WhatsAppConversationState.WAITING_FOR_PICKUP,
        draft: {
          notes: trimmed,
          language: lang,
        },
        pendingCandidates: null,
        transportRequestId: null,
        language: lang,
      });
      return;
    }

    const proposed: ConversationDraft = {
      pickupText: parsed.pickupText ?? parsed.pickupAddress,
      destinationText: parsed.destinationText ?? parsed.destinationAddress,
      requestedPickupTime: parsed.requestedPickupTime,
      passengerCount: parsed.passengerCount ?? 1,
      notes: parsed.notes ?? trimmed,
      language: lang,
    };

    if (previousState === WhatsAppConversationState.READY_FOR_CONFIRMATION) {
      const handled = await this.handleTripChangeWhileConfirming(
        employee,
        conversation,
        proposed,
        lang,
      );
      if (handled) {
        return;
      }
    }

    await this.startFreshTrip(employee, conversation, proposed, lang);
  }

  private async handleTripChangeWhileConfirming(
    employee: Employee,
    conversation: WhatsAppConversation,
    proposed: ConversationDraft,
    lang: WhatsAppLang,
  ): Promise<boolean> {
    const current = this.conversationService.getDraft(conversation);
    const currentPickup = current.pickupDisplayName ?? current.pickupText ?? '';
    const currentDest = current.destinationDisplayName ?? current.destinationText ?? '';
    const newPickup = proposed.pickupText ?? '';
    const newDest = proposed.destinationText ?? '';

    const pickupChanged =
      normalizePlaceKey(newPickup) !== normalizePlaceKey(currentPickup) && Boolean(newPickup);
    const destChanged =
      normalizePlaceKey(newDest) !== normalizePlaceKey(currentDest) && Boolean(newDest);

    if (!pickupChanged && !destChanged) {
      await this.promptConfirmation(employee, conversation, current);
      return true;
    }

    const deadline = this.getPickupDeadline(current.requestedPickupTime ?? proposed.requestedPickupTime);
    const pickupAllowed = canChangePickup(deadline);

    if (pickupChanged && !pickupAllowed && deadline) {
      await this.reply(
        conversation.phone,
        WhatsAppCopy.pickupChangeLocked(lang, deadline.toISOString()),
      );
      if (destChanged) {
        // Allow destination-only update proposal
        const destOnly: ConversationDraft = {
          ...current,
          destinationText: newDest,
          destinationLatitude: undefined,
          destinationLongitude: undefined,
          destinationPlaceId: undefined,
          destinationDisplayName: undefined,
          notes: proposed.notes,
          language: lang,
        };
        await this.promptTripUpdate(conversation, current, destOnly, false, true, lang);
      } else {
        await this.promptConfirmation(employee, conversation, current);
      }
      return true;
    }

    await this.promptTripUpdate(
      conversation,
      current,
      proposed,
      pickupChanged,
      destChanged,
      lang,
    );
    return true;
  }

  private async promptTripUpdate(
    conversation: WhatsAppConversation,
    current: ConversationDraft,
    proposed: ConversationDraft,
    pickupChanged: boolean,
    destChanged: boolean,
    lang: WhatsAppLang,
  ): Promise<void> {
    const currentPickup = current.pickupDisplayName ?? current.pickupText ?? '—';
    const currentDest = current.destinationDisplayName ?? current.destinationText ?? '—';
    const newPickup = proposed.pickupText ?? currentPickup;
    const newDest = proposed.destinationText ?? currentDest;
    const deadline = this.getPickupDeadline(
      proposed.requestedPickupTime ?? current.requestedPickupTime,
    );
    const cutoffLabel =
      deadline && canChangePickup(deadline)
        ? WhatsAppCopy.pickupChangeAllowedUntil(lang, deadline.toISOString())
        : null;

    const pending: PendingTripUpdate = {
      type: 'trip_update',
      proposed: {
        ...proposed,
        pickupText: pickupChanged ? proposed.pickupText : current.pickupText,
        destinationText: destChanged ? proposed.destinationText : current.destinationText,
        // Keep existing resolved coords for sides that did not change
        ...(pickupChanged
          ? {}
          : {
              pickupLatitude: current.pickupLatitude,
              pickupLongitude: current.pickupLongitude,
              pickupPlaceId: current.pickupPlaceId,
              pickupDisplayName: current.pickupDisplayName,
              pickupText: current.pickupText,
            }),
        ...(destChanged
          ? {}
          : {
              destinationLatitude: current.destinationLatitude,
              destinationLongitude: current.destinationLongitude,
              destinationPlaceId: current.destinationPlaceId,
              destinationDisplayName: current.destinationDisplayName,
              destinationText: current.destinationText,
            }),
      },
      pickupChanged,
      destChanged,
    };

    await this.conversationService.update(conversation, {
      state: WhatsAppConversationState.READY_FOR_CONFIRMATION,
      pendingCandidates: pending as unknown as Record<string, unknown>,
      language: lang,
    });

    await this.messaging.sendButtons({
      phone: conversation.phone,
      body: WhatsAppCopy.askTripUpdate(
        lang,
        currentPickup,
        currentDest,
        newPickup,
        newDest,
        pickupChanged,
        destChanged,
        cutoffLabel,
      ),
      buttons: [
        { id: 'update_yes', title: WhatsAppCopy.updateButtonYes(lang) },
        { id: 'update_no', title: WhatsAppCopy.updateButtonNo(lang) },
      ],
    });
  }

  private async applyPendingTripUpdate(
    employee: Employee,
    conversation: WhatsAppConversation,
    _message: WhatsAppMessage,
  ): Promise<void> {
    const pending = conversation.pendingCandidates as PendingTripUpdate | null;
    if (pending?.type !== 'trip_update') {
      return;
    }
    const lang = normalizeWhatsAppLang(pending.proposed.language ?? conversation.language);
    const draft: ConversationDraft = { ...pending.proposed, language: lang };
    // Force re-resolve sides that changed (coords cleared in promptTripUpdate)
    await this.conversationService.update(conversation, {
      draft,
      pendingCandidates: null,
      transportRequestId: null,
      language: lang,
      state: WhatsAppConversationState.WAITING_FOR_LOCATION_SELECTION,
    });
    await this.resolvePlacesAndContinue(employee, conversation, draft);
  }

  private async rejectPendingTripUpdate(
    employee: Employee,
    conversation: WhatsAppConversation,
  ): Promise<void> {
    const lang = this.langOf(conversation);
    const draft = this.conversationService.getDraft(conversation);
    await this.conversationService.update(conversation, {
      pendingCandidates: null,
      state: WhatsAppConversationState.READY_FOR_CONFIRMATION,
    });
    await this.reply(conversation.phone, WhatsAppCopy.keepingCurrentTrip(lang));
    await this.promptConfirmation(employee, conversation, draft);
  }

  private async startFreshTrip(
    employee: Employee,
    conversation: WhatsAppConversation,
    draft: ConversationDraft,
    lang: WhatsAppLang,
  ): Promise<void> {
    await this.conversationService.update(conversation, {
      draft,
      language: lang,
      state: WhatsAppConversationState.WAITING_FOR_LOCATION_SELECTION,
      pendingCandidates: null,
      transportRequestId: null,
    });
    await this.resolvePlacesAndContinue(employee, conversation, draft);
  }

  private langOf(conversation: WhatsAppConversation): WhatsAppLang {
    return normalizeWhatsAppLang(
      this.conversationService.getDraft(conversation).language ?? conversation.language,
    );
  }

  private getPickupDeadline(requestedPickupTime?: string): Date | null {
    const minutes =
      this.configService.get<number>('app.integrations.whatsappPickupChangeMinutesBefore', {
        infer: true,
      }) ?? 30;
    return pickupChangeDeadline(requestedPickupTime, minutes);
  }

  private async resolvePlacesAndContinue(
    employee: Employee,
    conversation: WhatsAppConversation,
    draft: ConversationDraft,
  ): Promise<void> {
    const lang = normalizeWhatsAppLang(draft.language ?? conversation.language);

    if (draft.pickupLatitude == null || draft.pickupLongitude == null) {
      const pickupQuery = draft.pickupText;
      if (!pickupQuery) {
        await this.reply(conversation.phone, WhatsAppCopy.askPickup(lang));
        await this.conversationService.update(conversation, {
          state: WhatsAppConversationState.WAITING_FOR_PICKUP,
          draft,
        });
        return;
      }

      const candidates = await this.mapsService.searchPlaces({
        query: pickupQuery,
        regionCode: 'RW',
        languageCode: lang,
      });

      if (candidates.length === 0) {
        await this.reply(
          conversation.phone,
          WhatsAppCopy.placeNotFound(lang, 'pickup', pickupQuery),
        );
        await this.conversationService.update(conversation, {
          state: WhatsAppConversationState.WAITING_FOR_PICKUP,
          draft,
        });
        return;
      }

      if (candidates.length === 1) {
        this.applyPlace(draft, 'pickup', candidates[0]);
      } else {
        await this.promptPlaceSelection(employee, conversation, draft, 'pickup', candidates);
        return;
      }
    }

    if (draft.destinationLatitude == null || draft.destinationLongitude == null) {
      const destQuery = draft.destinationText;
      if (!destQuery) {
        await this.reply(conversation.phone, WhatsAppCopy.askDestination(lang));
        await this.conversationService.update(conversation, {
          state: WhatsAppConversationState.WAITING_FOR_DESTINATION,
          draft,
        });
        return;
      }

      const candidates = await this.mapsService.searchPlaces({
        query: destQuery,
        regionCode: 'RW',
        languageCode: lang,
      });

      if (candidates.length === 0) {
        await this.reply(
          conversation.phone,
          WhatsAppCopy.placeNotFound(lang, 'destination', destQuery),
        );
        await this.conversationService.update(conversation, {
          state: WhatsAppConversationState.WAITING_FOR_DESTINATION,
          draft,
        });
        return;
      }

      if (candidates.length === 1) {
        this.applyPlace(draft, 'destination', candidates[0]);
      } else {
        await this.promptPlaceSelection(employee, conversation, draft, 'destination', candidates);
        return;
      }
    }

    await this.promptConfirmation(employee, conversation, draft);
  }

  private applyPlace(
    draft: ConversationDraft,
    side: 'pickup' | 'destination',
    place: PlaceCandidate,
  ): void {
    if (side === 'pickup') {
      draft.pickupPlaceId = place.placeId;
      draft.pickupDisplayName = place.displayName;
      draft.pickupLatitude = place.lat;
      draft.pickupLongitude = place.lng;
      draft.pickupText = place.displayName;
    } else {
      draft.destinationPlaceId = place.placeId;
      draft.destinationDisplayName = place.displayName;
      draft.destinationLatitude = place.lat;
      draft.destinationLongitude = place.lng;
      draft.destinationText = place.displayName;
    }
  }

  private async promptPlaceSelection(
    employee: Employee,
    conversation: WhatsAppConversation,
    draft: ConversationDraft,
    side: 'pickup' | 'destination',
    candidates: PlaceCandidate[],
  ): Promise<void> {
    draft.selectionSide = side;
    const limited = candidates.slice(0, 3);
    await this.conversationService.update(conversation, {
      state: WhatsAppConversationState.WAITING_FOR_LOCATION_SELECTION,
      draft,
      pendingCandidates: { side, candidates: limited },
    });

    const lines = limited
      .map((c, i) => `${i + 1}. ${c.displayName} — ${c.formattedAddress}`)
      .join('\n');

    await this.messaging.sendButtons({
      phone: conversation.phone,
      body: `Which ${side} did you mean?\n${lines}`,
      buttons: limited.map((_, i) => ({
        id: `place_${i}`,
        title: `Option ${i + 1}`,
      })),
    });
  }

  private async selectPlaceCandidate(
    employee: Employee,
    conversation: WhatsAppConversation,
    message: WhatsAppMessage,
    index: number,
  ): Promise<void> {
    const pending = conversation.pendingCandidates as {
      side?: 'pickup' | 'destination';
      candidates?: PlaceCandidate[];
    } | null;
    const candidates = pending?.candidates ?? [];
    const place = candidates[index];
    if (!place) {
      await this.reply(conversation.phone, 'Invalid selection. Reply with 1, 2, or 3.');
      return;
    }

    const draft = this.conversationService.getDraft(conversation);
    const side = pending?.side ?? draft.selectionSide ?? 'pickup';
    this.applyPlace(draft, side, place);

    await this.conversationService.update(conversation, {
      draft,
      pendingCandidates: null,
    });

    message.requestId = conversation.transportRequestId ?? null;
    await this.resolvePlacesAndContinue(employee, conversation, draft);
  }

  private async promptConfirmation(
    employee: Employee,
    conversation: WhatsAppConversation,
    draft: ConversationDraft,
  ): Promise<void> {
    const lang = normalizeWhatsAppLang(draft.language ?? conversation.language);
    await this.conversationService.update(conversation, {
      state: WhatsAppConversationState.READY_FOR_CONFIRMATION,
      draft,
      pendingCandidates: null,
      language: lang,
    });

    const pickup = draft.pickupDisplayName ?? draft.pickupText ?? 'Pickup';
    const dest = draft.destinationDisplayName ?? draft.destinationText ?? 'Destination';
    const deadline = this.getPickupDeadline(draft.requestedPickupTime);
    const cutoffLabel =
      deadline && canChangePickup(deadline)
        ? WhatsAppCopy.pickupChangeAllowedUntil(lang, deadline.toISOString())
        : null;

    await this.messaging.sendButtons({
      phone: conversation.phone,
      body: WhatsAppCopy.confirmTrip(lang, pickup, dest, draft.requestedPickupTime, cutoffLabel),
      buttons: [
        { id: 'confirm_yes', title: WhatsAppCopy.confirmButtonYes(lang) },
        { id: 'confirm_no', title: WhatsAppCopy.confirmButtonNo(lang) },
      ],
    });
  }

  private async confirmDraft(
    employee: Employee,
    conversation: WhatsAppConversation,
    message: WhatsAppMessage,
  ): Promise<void> {
    const draft = this.conversationService.getDraft(conversation);

    if (
      draft.pickupLatitude == null ||
      draft.pickupLongitude == null ||
      draft.destinationLatitude == null ||
      draft.destinationLongitude == null
    ) {
      await this.reply(
        conversation.phone,
        'Locations are incomplete. Please send pickup and destination again.',
      );
      await this.conversationService.update(conversation, {
        state: WhatsAppConversationState.WAITING_FOR_PICKUP,
      });
      return;
    }

    let requestId = conversation.transportRequestId;
    if (!requestId) {
      const created = await this.transportRequestsService.createFromWhatsApp(
        employee.companyId,
        employee.id,
        {
          pickupAddress: draft.pickupDisplayName ?? draft.pickupText ?? 'Pickup',
          pickupLatitude: draft.pickupLatitude,
          pickupLongitude: draft.pickupLongitude,
          destinationAddress: draft.destinationDisplayName ?? draft.destinationText ?? 'Destination',
          destinationLatitude: draft.destinationLatitude,
          destinationLongitude: draft.destinationLongitude,
          requestedPickupTime: draft.requestedPickupTime,
          notes: draft.notes,
          pickupPlaceId: draft.pickupPlaceId,
          destinationPlaceId: draft.destinationPlaceId,
          pickupDisplayName: draft.pickupDisplayName,
          destinationDisplayName: draft.destinationDisplayName,
          aiAssisted: true,
        },
        true,
      );
      requestId = created.id;
    }

    const confirmed = await this.transportRequestsService.confirmRequest(
      employee.companyId,
      requestId,
    );

    message.requestId = confirmed.id;
    await this.messageRepository.save(message);

    await this.conversationService.update(conversation, {
      state: WhatsAppConversationState.AWAITING_SUPERVISOR,
      transportRequestId: confirmed.id,
      draft: {},
      pendingCandidates: null,
    });

    const lang = normalizeWhatsAppLang(conversation.language);
    await this.reply(
      conversation.phone,
      WhatsAppCopy.submitted(lang, confirmed.pickupAddress, confirmed.destinationAddress),
    );
  }

  private async replyStatus(
    employee: Employee,
    conversation: WhatsAppConversation,
  ): Promise<void> {
    if (!conversation.transportRequestId) {
      await this.reply(conversation.phone, 'You have no active WhatsApp transport request.');
      return;
    }
    const request = await this.transportRequestsService.findOne(
      employee.companyId,
      conversation.transportRequestId,
    );
    await this.reply(
      conversation.phone,
      `Request status: ${request.status}. ${request.pickupAddress} → ${request.destinationAddress}`,
    );
  }

  private async persistParsing(
    employee: Employee,
    message: WhatsAppMessage,
    originalText: string,
    parsed: ParsedTransportRequestDto,
  ): Promise<void> {
    const model =
      this.configService.get<string>('app.integrations.openaiTransportModel', { infer: true }) ??
      'mock';

    await this.parsingRepository.save(
      this.parsingRepository.create({
        companyId: employee.companyId,
        employeeId: employee.id,
        whatsappMessageId: message.id,
        originalText,
        model:
          this.configService.get<string>('app.integrations.aiProvider', { infer: true }) ===
          'openai'
            ? model
            : 'mock',
        intent: parsed.intent,
        structured: { ...parsed } as unknown as Record<string, unknown>,
        confidence: parsed.confidence,
        needsClarification: Boolean(parsed.needsClarification),
      }),
    );
  }

  private async findEmployeeByPhone(phone: string): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return null;
    }

    const rows = await this.employeeRepository.query(
      `
      SELECT * FROM employees
      WHERE status = 'ACTIVE'
        AND regexp_replace(phone, '\\D', '', 'g') = $1
      LIMIT 1
      `,
      [normalized],
    );

    if (!rows[0]) {
      return null;
    }

    return this.employeeRepository.create(rows[0] as Employee);
  }

  private async reply(phone: string, text: string): Promise<void> {
    const result = await this.messaging.sendText({ phone, text });
    await this.messageRepository.save(
      this.messageRepository.create({
        externalMessageId: result.messageId ?? `out-${Date.now()}-${Math.random()}`,
        phone: normalizePhone(phone),
        direction: WhatsAppMessageDirection.OUTBOUND,
        messageType: 'text',
        messageBody: text,
        processingStatus: WhatsAppProcessingStatus.PROCESSED,
        payload: { text },
        processedAt: new Date(),
      }),
    );
  }

  private async markProcessed(message: WhatsAppMessage): Promise<void> {
    message.processingStatus = WhatsAppProcessingStatus.PROCESSED;
    message.processedAt = new Date();
    await this.messageRepository.save(message);
  }

  async notifyEmployeeStatus(
    phone: string,
    companyId: string,
    text: string,
    requestId?: string,
  ): Promise<void> {
    const result = await this.messaging.sendText({ phone, text });
    await this.messageRepository.save(
      this.messageRepository.create({
        externalMessageId: result.messageId ?? `status-${Date.now()}-${Math.random()}`,
        companyId,
        phone: normalizePhone(phone),
        direction: WhatsAppMessageDirection.OUTBOUND,
        messageType: 'text',
        messageBody: text,
        requestId: requestId ?? null,
        processingStatus: WhatsAppProcessingStatus.PROCESSED,
        payload: { text, statusUpdate: true },
        processedAt: new Date(),
      }),
    );
  }
}
