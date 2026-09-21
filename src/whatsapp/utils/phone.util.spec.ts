import { normalizePhone } from './phone.util';

describe('normalizePhone', () => {
  it('normalizes Rwanda local 07 numbers', () => {
    expect(normalizePhone('0788123456')).toBe('250788123456');
  });

  it('strips plus and spaces', () => {
    expect(normalizePhone('+250 788 123 456')).toBe('250788123456');
  });

  it('keeps already international digits', () => {
    expect(normalizePhone('250788123456')).toBe('250788123456');
  });

  it('handles 9-digit mobile without leading zero', () => {
    expect(normalizePhone('788123456')).toBe('250788123456');
  });
});
