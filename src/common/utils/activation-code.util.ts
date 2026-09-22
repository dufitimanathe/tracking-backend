import { randomInt } from 'crypto';

/** Ambiguous chars (0/O, 1/I) omitted for easy phone typing. */
const ACTIVATION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const ACTIVATION_CODE_LENGTH = 6;

export function generateActivationCode(
  length = ACTIVATION_CODE_LENGTH,
): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ACTIVATION_CODE_ALPHABET[randomInt(ACTIVATION_CODE_ALPHABET.length)];
  }
  return code;
}

/** Uppercase and strip spaces/dashes so riders can type "AB12CD" or "AB 12 CD". */
export function normalizeActivationCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function formatActivationCodeForDisplay(code: string): string {
  const normalized = normalizeActivationCode(code);
  return normalized.split('').join(' ');
}
