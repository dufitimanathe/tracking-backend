import { randomBytes } from 'crypto';

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function slugWithSuffix(baseSlug: string): string {
  const suffix = randomBytes(3).toString('hex');
  const trimmed = baseSlug.slice(0, 72);
  return `${trimmed}-${suffix}`;
}
