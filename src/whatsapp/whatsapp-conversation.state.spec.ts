import { WhatsAppConversationState } from '../common/enums';

describe('WhatsApp conversation state machine', () => {
  const allowed: Record<string, WhatsAppConversationState[]> = {
    [WhatsAppConversationState.NEW]: [
      WhatsAppConversationState.PARSING,
      WhatsAppConversationState.WAITING_FOR_PICKUP,
    ],
    [WhatsAppConversationState.PARSING]: [
      WhatsAppConversationState.WAITING_FOR_LOCATION_SELECTION,
      WhatsAppConversationState.WAITING_FOR_PICKUP,
      WhatsAppConversationState.READY_FOR_CONFIRMATION,
      WhatsAppConversationState.NEW,
    ],
    [WhatsAppConversationState.WAITING_FOR_LOCATION_SELECTION]: [
      WhatsAppConversationState.READY_FOR_CONFIRMATION,
      WhatsAppConversationState.WAITING_FOR_PICKUP,
      WhatsAppConversationState.WAITING_FOR_DESTINATION,
    ],
    [WhatsAppConversationState.READY_FOR_CONFIRMATION]: [
      WhatsAppConversationState.AWAITING_SUPERVISOR,
      WhatsAppConversationState.NEW,
    ],
  };

  it('defines READY_FOR_CONFIRMATION before supervisor', () => {
    expect(allowed[WhatsAppConversationState.READY_FOR_CONFIRMATION]).toContain(
      WhatsAppConversationState.AWAITING_SUPERVISOR,
    );
  });

  it('allows place selection after parse', () => {
    expect(allowed[WhatsAppConversationState.PARSING]).toContain(
      WhatsAppConversationState.WAITING_FOR_LOCATION_SELECTION,
    );
  });
});
