import {
  canChangePickup,
  normalizePlaceKey,
  normalizeWhatsAppLang,
  pickupChangeDeadline,
  WhatsAppCopy,
} from './whatsapp-i18n';

describe('whatsapp-i18n', () => {
  it('detects rw language', () => {
    expect(normalizeWhatsAppLang('rw')).toBe('rw');
    expect(normalizeWhatsAppLang('kinyarwanda')).toBe('rw');
  });

  it('builds pickup change deadline', () => {
    const pickup = '2026-09-21T14:00:00.000Z';
    const deadline = pickupChangeDeadline(pickup, 30);
    expect(deadline?.toISOString()).toBe('2026-09-21T13:30:00.000Z');
    expect(canChangePickup(deadline, new Date('2026-09-21T13:00:00.000Z'))).toBe(true);
    expect(canChangePickup(deadline, new Date('2026-09-21T13:45:00.000Z'))).toBe(false);
  });

  it('normalizes place keys', () => {
    expect(normalizePlaceKey('Kimironko')).toBe(normalizePlaceKey('  kimironko '));
  });

  it('returns kinyarwanda confirm copy', () => {
    const body = WhatsAppCopy.confirmTrip('rw', 'Remera', 'Nyabugogo', undefined, null);
    expect(body).toContain('Emeza urugendo');
    expect(body).toContain('Remera');
  });
});
