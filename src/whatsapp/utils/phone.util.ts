/**
 * Normalize phone numbers toward E.164-ish digits for WhatsApp / employee lookup.
 * Rwanda default country code 250 when local 07… numbers are provided.
 */
export function normalizePhone(raw: string, defaultCountryCode = '250'): string {
  let digits = raw.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0') && digits.length === 10) {
    digits = `${defaultCountryCode}${digits.slice(1)}`;
  }

  if (digits.length === 9 && digits.startsWith('7')) {
    digits = `${defaultCountryCode}${digits}`;
  }

  return digits;
}

export function conversationRedisKey(companyId: string, phone: string): string {
  return `wa:conv:${companyId}:${normalizePhone(phone)}`;
}
