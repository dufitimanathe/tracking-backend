/** Normalize and validate Rwanda mobile numbers to E.164 (+2507XXXXXXXX). */

const RW_MOBILE = /^(?:\+?250|0)?(7[2-9]\d{7})$/;

export function normalizeRwandaPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '').trim();
  const match = RW_MOBILE.exec(digits);
  if (!match) {
    return null;
  }
  return `+250${match[1]}`;
}

export function isValidRwandaPhone(input: string): boolean {
  return normalizeRwandaPhone(input) != null;
}
